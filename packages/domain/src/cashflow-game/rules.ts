import type { CashflowGameState, CashflowMarketOffer } from './types';

/**
 * The rules a game is played under (JFK, 2026-10-10): how much freedom the player has. Chosen when the game starts and
 * frozen for its whole length, so a player cannot loosen them half way through. They live in the game state and are
 * enforced by the engine's own moves - the app, the Pro API, an agent and a future multiplayer server all go through the
 * same functions, so the screen hiding a button is a convenience, never the protection.
 *
 * `free` is how the game always worked (every freedom, no limits) and is what a game saved before rules existed uses.
 */

export type RulePreset = 'free' | 'guided' | 'strict' | 'custom';

/** `free`: open any card, draw another, look through the pile. `offered-once`: one random card per space, take it or pass. */
export type CardChoiceRule = 'free' | 'offered-once';

/** `always`: sell any time, at any price you name. `with-offer`: only while a Market card offers a buyer / price. `never`. */
export type SellRule = 'always' | 'with-offer' | 'never';

export interface GameRules {
  preset: RulePreset;
  /** Solo games: how cards come to the player. (Companion mode has a physical deck; nothing to restrict.) */
  cardChoice: CardChoiceRule;
  sell: SellRule;
  /** With `with-offer`: how many of the player's rolls an offer stays open (1 = until the next roll); 0 = until the next Payday. */
  sellOfferRolls: number;
  /** Free-form transactions and amounts outside the game's own moves (the Add dialog, an API transaction). */
  manualTransactions: 'allowed' | 'forbidden';
  bankLoan: 'allowed' | 'forbidden';
  /** The Bank loan may not grow above this (minor units); null: no cap. */
  maxLoanMinor: number | null;
  /** Any free amount (a manual transaction, a price named by the caller) above this is refused; null: no cap. */
  maxFreeAmountMinor: number | null;
}

export const RULE_PRESETS: Record<Exclude<RulePreset, 'custom'>, GameRules> = {
  free: {
    preset: 'free',
    cardChoice: 'free',
    sell: 'always',
    sellOfferRolls: 0,
    manualTransactions: 'allowed',
    bankLoan: 'allowed',
    maxLoanMinor: null,
    maxFreeAmountMinor: null,
  },
  guided: {
    preset: 'guided',
    cardChoice: 'offered-once',
    sell: 'with-offer',
    sellOfferRolls: 3,
    manualTransactions: 'allowed',
    bankLoan: 'allowed',
    maxLoanMinor: null,
    maxFreeAmountMinor: 1_000_000, // 10,000.00 in minor units
  },
  strict: {
    preset: 'strict',
    cardChoice: 'offered-once',
    sell: 'with-offer',
    sellOfferRolls: 1,
    manualTransactions: 'forbidden',
    bankLoan: 'allowed',
    maxLoanMinor: null,
    maxFreeAmountMinor: 0,
  },
};

export const FREE_RULES: GameRules = RULE_PRESETS.free;

/** The rules of a game; one saved before rules existed has none, which is `free`. */
export function rulesOf(state: Pick<CashflowGameState, 'rules'>): GameRules {
  return state.rules ?? FREE_RULES;
}

const isWholeAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * A complete, valid set of rules from what a caller gave: a preset name and/or single settings. Anything missing comes from
 * the preset (`free` if none); changing a setting of a preset makes it `custom`. Throws on a value that is not allowed.
 */
export function normalizeRules(input: Partial<GameRules> | undefined | null): GameRules {
  const base = RULE_PRESETS[(input?.preset as keyof typeof RULE_PRESETS) ?? 'free'];
  if (!base && input?.preset !== 'custom') {
    throw new Error(`Unknown rule preset '${String(input?.preset)}': free, guided or strict.`);
  }
  const start = base ?? RULE_PRESETS.free;
  const merged: GameRules = { ...start, ...stripUndefined(input ?? {}) };

  if (!['free', 'offered-once'].includes(merged.cardChoice)) {
    throw new Error("cardChoice must be 'free' or 'offered-once'.");
  }
  if (!['always', 'with-offer', 'never'].includes(merged.sell)) {
    throw new Error("sell must be 'always', 'with-offer' or 'never'.");
  }
  if (
    !Number.isInteger(merged.sellOfferRolls) ||
    merged.sellOfferRolls < 0 ||
    merged.sellOfferRolls > 12
  ) {
    throw new Error('sellOfferRolls must be a whole number from 0 (until the next Payday) to 12.');
  }
  if (!['allowed', 'forbidden'].includes(merged.manualTransactions)) {
    throw new Error("manualTransactions must be 'allowed' or 'forbidden'.");
  }
  if (!['allowed', 'forbidden'].includes(merged.bankLoan)) {
    throw new Error("bankLoan must be 'allowed' or 'forbidden'.");
  }
  for (const key of ['maxLoanMinor', 'maxFreeAmountMinor'] as const) {
    const value = merged[key];
    if (value !== null && !isWholeAmount(value)) {
      throw new Error(`${key} must be null or a whole amount of minor units, zero or more.`);
    }
  }

  const sameAsPreset = (Object.keys(start) as (keyof GameRules)[])
    .filter((key) => key !== 'preset')
    .every((key) => merged[key] === start[key]);
  return { ...merged, preset: sameAsPreset && base ? start.preset : 'custom' };
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

// ── What the rules forbid ─────────────────────────────────────────────────────────────────────────

/** Why the player may not add a free-form transaction of this size, or null. `amountMinor` is the absolute amount. */
export function whyCannotAddFreeAmount(
  state: Pick<CashflowGameState, 'rules'>,
  amountMinor: number,
): string | null {
  const rules = rulesOf(state);
  if (rules.manualTransactions === 'forbidden') {
    return 'These game rules do not allow free-form transactions: use the game moves (cards, selling, Payday).';
  }
  if (rules.maxFreeAmountMinor !== null && Math.abs(amountMinor) > rules.maxFreeAmountMinor) {
    return `These game rules limit a free amount to ${rules.maxFreeAmountMinor} minor units.`;
  }
  return null;
}

/** Why a price or amount the caller names for a sale is refused, or null. Under `always` any price is fine (as before). */
export function whyCannotNameSalePrice(state: Pick<CashflowGameState, 'rules'>): string | null {
  return rulesOf(state).sell === 'always'
    ? null
    : 'These game rules fix the price of a sale to the offer of the Market card; it cannot be named.';
}

/** Why the Bank loan may not be raised to `loanAfterMinor`, or null. Paying it back is always allowed. */
export function whyCannotBorrow(
  state: Pick<CashflowGameState, 'rules'>,
  loanBeforeMinor: number,
  loanAfterMinor: number,
): string | null {
  if (loanAfterMinor <= loanBeforeMinor) return null;
  const rules = rulesOf(state);
  if (rules.bankLoan === 'forbidden') return 'These game rules do not allow a Bank loan.';
  if (rules.maxLoanMinor !== null && loanAfterMinor > rules.maxLoanMinor) {
    return `These game rules cap the Bank loan at ${rules.maxLoanMinor} minor units.`;
  }
  return null;
}

/**
 * Whether a Market card's offer can still be taken: it stays until the next Payday, and - when the rules give it a number
 * of rolls (`sellOfferRolls`) - for that many of the player's rolls from the one it was played on.
 */
export function offerIsOpen(
  state: Pick<CashflowGameState, 'rules' | 'turn'>,
  offer: Pick<CashflowMarketOffer, 'offeredAtRoll'>,
): boolean {
  const rolls = rulesOf(state).sellOfferRolls;
  if (rolls <= 0 || offer.offeredAtRoll === undefined || !state.turn) return true;
  return state.turn.count - offer.offeredAtRoll < rolls;
}

/** The open offer for a position (a property, gold, a share), or undefined. */
export function openOfferFor(
  state: Pick<CashflowGameState, 'rules' | 'turn' | 'marketOffers'>,
  title: string,
): CashflowMarketOffer | undefined {
  return (state.marketOffers ?? []).find(
    (candidate) => candidate.title === title && offerIsOpen(state, candidate),
  );
}

/** Why a sale of `title` is refused by the rules (no buyer, or selling is off), or null. */
export function whyCannotSell(
  state: Pick<CashflowGameState, 'rules' | 'turn' | 'marketOffers'>,
  title: string,
): string | null {
  const rules = rulesOf(state);
  if (rules.sell === 'always') return null;
  if (rules.sell === 'never') return 'These game rules do not allow selling.';
  return openOfferFor(state, title)
    ? null
    : `No buyer for ${title}: these game rules only allow selling while a Market card offers a price for it.`;
}

/** Why this card may not be drawn or played on the open space under `offered-once`, or null. */
export function whyCannotUseCard(
  state: Pick<CashflowGameState, 'rules' | 'mode' | 'turn'>,
  cardId: string | undefined,
): string | null {
  if (rulesOf(state).cardChoice !== 'offered-once' || state.mode !== 'solo') return null;
  const offered = state.turn?.pending?.offered;
  if (!offered) return 'These game rules deal the card for a space: draw it first.';
  if (cardId !== undefined && offered.cardId !== cardId) {
    return `These game rules only allow the card that was offered on this space (${offered.cardId}).`;
  }
  return null;
}

/** Why a card may not be drawn now under `offered-once` (one is already on offer), or null. */
export function whyCannotDraw(
  state: Pick<CashflowGameState, 'rules' | 'mode' | 'turn'>,
): string | null {
  if (rulesOf(state).cardChoice !== 'offered-once' || state.mode !== 'solo') return null;
  const pending = state.turn?.pending;
  if (!pending) return 'These game rules only deal a card for the space you landed on.';
  if (pending.offered) {
    return 'A card was already offered on this space: play it or pass. These game rules deal one card.';
  }
  return null;
}
