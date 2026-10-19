import { applyEffectsToBooks, type GameBooks } from '../books';
import { fixedClock } from '../clock';
import type { DealDeps } from '../deals';
import { identityText } from '../game-text';
import { payableLiabilities, payOffLiability, planLiabilityPayoff } from '../liability-payoff';
import { summarizeGameFinances } from '../saved-games';
import type { Policy, PolicyView } from './policy';

/**
 * Every bot knows it can pay a starting debt off in one payment (JFK, 2026-10-19): the mortgage, a car loan, a credit card debt, a
 * student loan. It is a thought added to ANY strategy - the strategies themselves are not searched again - and how often a bot has it
 * depends on its skill level and its style. A bot pays a debt off when it can do it from its own cash (it never borrows for it),
 * keeps a reserve, and the debt pays back within the bot's horizon - or when paying it off gets the bot out of the rat race. The
 * decision is a fixed hash of the position, never chance, so a game is still reproducible from its seed.
 */

export interface PayoffStyle {
  /** How likely the thought is at a given moment (before the skill level's own factor). */
  chance: number;
  /** A debt must pay itself back within this many months of the expense it ends (Infinity: any). */
  horizonMonths: number;
  /** The cash that must remain after the payment. */
  reserveMinor: number;
  /** Buy no deal while a debt can still be paid off: the cash is saved for it (the debt-first bot). */
  holdDeals?: boolean;
}

const DEFAULT_STYLE: PayoffStyle = { chance: 0.5, horizonMonths: 48, reserveMinor: 100_000 };
const CAUTIOUS: PayoffStyle = { chance: 0.7, horizonMonths: 60, reserveMinor: 100_000 };
const LEVERAGED: PayoffStyle = { chance: 0.25, horizonMonths: 36, reserveMinor: 200_000 };

/** The style of each bot (by its base id); a bot not listed has the default. */
export const PAYOFF_STYLES: Record<string, PayoffStyle> = {
  'debt-first': { chance: 1, horizonMonths: Infinity, reserveMinor: 0, holdDeals: true },
  'never-buy': CAUTIOUS,
  'picky-properties': CAUTIOUS,
  'cash-properties': CAUTIOUS,
  'big-deals-when-rich': CAUTIOUS,
  'character-cautious': CAUTIOUS,
  'leveraged-big': LEVERAGED,
  'bridge-loans': LEVERAGED,
  'character-gambler': LEVERAGED,
  'character-banker': LEVERAGED,
};

/** How much of the style's chance a skill level keeps: a master thinks of it as often as its style does. */
const LEVEL_FACTOR: Record<string, number> = {
  master: 1,
  strong: 0.85,
  casual: 0.5,
  beginner: 0.2,
};

/** A fixed pseudo-random number in [0, 1) from the position. */
function positionHash(view: PolicyView, salt: number): number {
  let h = Math.imul(view.round + 1, 2654435761) ^ Math.imul(view.turn + 11, 1597334677);
  h ^= Math.imul(Math.round(view.cashMinor / 100) + salt * 40503, 2246822507);
  h = Math.imul(h ^ (h >>> 15), 3266489909);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

function planningDeps(books: GameBooks): DealDeps {
  const day = books.state.virtualDate || '2026-01-01';
  return {
    clock: fixedClock(day, `${day}T00:00:00.000Z`),
    text: identityText,
    money: (minor) => String(minor / 100),
    plainMoney: (minor) => String(minor / 100),
  };
}

/** The debt this bot would pay off now, or null: the quickest to pay itself back among those it can pay from its cash. */
export function debtToPayOff(view: PolicyView, style: PayoffStyle): string | null {
  const books = view.books;
  const profession = books.gameSet?.professions.find((p) => p.id === books.state.professionId);
  const deps = planningDeps(books);
  let best: { tag: string; months: number } | null = null;
  for (const liability of payableLiabilities(books)) {
    const plan = planLiabilityPayoff(books, profession, liability.tag, deps);
    // from its own cash only, and with the reserve left
    if (!plan.ok || plan.borrowMinor > 0 || plan.freedMonthlyMinor <= 0) continue;
    if (view.cashMinor - plan.amountMinor < style.reserveMinor) continue;
    const months = plan.amountMinor / plan.freedMonthlyMinor;
    if (months > style.horizonMonths) {
      // too slow to pay itself back - unless it gets the bot out of the rat race
      const after = payOffLiability(books, profession, liability.tag, deps).reduce(
        applyEffectsToBooks,
        books,
      );
      if (!summarizeGameFinances(after.state, after.subscriptions).escapedRatRace) continue;
    }
    if (!best || months < best.months) best = { tag: liability.tag, months };
  }
  return best ? best.tag : null;
}

/** The strategy with the thought of paying debts off added (its other decisions are untouched). */
export function withDebtPayoff(policy: Policy, base: string, level: string): Policy {
  const style = PAYOFF_STYLES[base] ?? DEFAULT_STYLE;
  const chance = style.chance * (LEVEL_FACTOR[level] ?? 1);
  return {
    ...policy,
    deal(view, card) {
      if (style.holdDeals && debtToPayOffSoon(view)) return { buy: false };
      return policy.deal(view, card);
    },
    maintain(view) {
      const moves = policy.maintain(view);
      if (chance <= 0 || positionHash(view, 17) >= chance) return moves;
      const tag = debtToPayOff(view, style);
      return tag ? [...moves, { kind: 'payoff', tag }] : moves;
    },
  };
}

/** Whether any debt is left that this bot is saving for (a debt-first bot buys nothing meanwhile). */
function debtToPayOffSoon(view: PolicyView): boolean {
  return payableLiabilities(view.books).length > 0;
}
