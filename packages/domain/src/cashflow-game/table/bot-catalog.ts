import type { Policy, PolicyView } from '../simulation/policy';
import { CHAMPION_BOOK } from './champion-book';
import { CHARACTERS } from './characters';
import { PRESET_SPECS, policyFromSpec, type PolicySpec } from '../simulation/strategies';

/**
 * The bots a host can seat (todo/cashflow-tournament-and-bots.md B1/A5): named characters on a ladder of difficulty, each one a
 * strategy of the strategy lab / tournament. A bot is data - a readable strategy spec - so it can be explained in the docs,
 * replayed, and frozen: a champion is added here only with the numbers that earned it (`CASHFLOW_TOURNAMENT.md`).
 *
 * Difficulty is how often the strategy won a table against the others in the tournament, not a promise about any one game: the
 * dice decide a lot.
 */

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'champion';

export interface BotProfile {
  /** What the table stores and the API takes: `policyId`. */
  id: string;
  /** The character's name, the default name at the table. */
  name: string;
  difficulty: BotDifficulty;
  /** One line for the lobby: how it plays. */
  description: string;
  spec: PolicySpec;
  /**
   * A strategy that is not one fixed spec (the profession champion picks its spec by the player's profession). When present it is
   * what the bot plays; `spec` is then the fallback it names.
   */
  build?: () => Policy;
}

const preset = (id: string): PolicySpec => {
  const spec = PRESET_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown strategy preset '${id}'.`);
  return spec;
};

/** The best strategy the solo lab's search found (its results.json); kept here as code so the bots do not read a report. */
const BEST_FOUND: PolicySpec = {
  id: 'best-found',
  label: 'Best strategy found by the search',
  description:
    'Properties paying at least 4% a month, no reserve, borrows when the card pays for it, Big Deals from 20,000 cash, buys Multi-Level-Marketing.',
  overrides: {
    minMonthlyReturn: 0.04,
    reserveMinor: 0,
    loans: 'bridge',
    bigDealFromCashMinor: 2000000,
    buyMlm: true,
    shares: null,
    repayLoans: true,
    loanCoverage: 1.5,
  },
};

/**
 * The champion (todo/cashflow-tournament-and-bots.md A3-A5): found by `scripts/tournament-search.js` (80 candidates, 8
 * generations, the lab's knobs plus the race-aware ones) and verified on fresh games the search never played. Against a field of
 * the all-rounder, the solo search's best, big-deals-when-rich, marketing-first and bridge-loans, over every profession at tables
 * of 2 and 4 under the guided rules, it won 74.7% of 2,400 tables (95% range 73-76%); the best hand-built strategy, the
 * all-rounder, won 59.7% (58-62%) under the same test. What sets it apart: it buys any 2% property with no reserve, borrows when
 * covered 1.5 times, goes for Big Deals from 10,000 cash, takes Multi-Level-Marketing, trades stocks, sells at 12 months of
 * profit - and when a rival is 10 points closer to escaping it accepts a 20% lower return: it chases.
 * Frozen: its numbers are pinned by `bot-catalog.spec.ts`; a rules change that moves them means searching again (v2).
 */
export const CHAMPION_V1: PolicySpec = {
  id: 'champion-v1',
  label: 'Champion (v1)',
  description:
    'The best strategy the tournament search found: any 2% property with no reserve, loans when covered 1.5x, Big Deals from 10,000 cash, marketing, stock trading, selling at 12 months of profit - and it takes more risk when a rival pulls ahead.',
  overrides: {
    minMonthlyReturn: 0.02,
    reserveMinor: 0,
    loans: 'bridge',
    loanCoverage: 1.5,
    bigDealFromCashMinor: 1000000,
    buyMlm: true,
    buyGambles: false,
    shares: { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.4 },
    sellWhenProfitMonths: 12,
    repayLoans: true,
    catchUp: {
      gap: 0.1,
      minMonthlyReturnFactor: 0.8,
      loanCoverageFactor: 1,
      reserveFactor: 0.3,
    },
    protectLead: null,
  },
};

/**
 * The strategy of the champion book (`champion-book.ts`, found by `scripts/champion-search.js`): whatever profession the bot has, it
 * plays the champion of that profession - and champion-v1 for a profession the book does not know.
 */
function championByProfession(): Policy {
  const base = policyFromSpec(CHARACTERS['any']?.spec ?? CHAMPION_V1);
  const cache = new Map<string, Policy>();
  const forView = (view: PolicyView): Policy => {
    const entry = CHAMPION_BOOK[view.books.state.professionId ?? ''];
    if (!entry) return base;
    let policy = cache.get(entry.spec.id);
    if (!policy) {
      policy = policyFromSpec(entry.spec);
      cache.set(entry.spec.id, policy);
    }
    return policy;
  };
  return {
    id: 'champion',
    label: 'Champion of the profession',
    description: 'Plays the champion of its own profession from the champion book.',
    dice: (view) => forView(view).dice(view),
    pile: (view, random) => forView(view).pile(view, random),
    deal: (view, card) => forView(view).deal(view, card),
    doodad: (view, card) => forView(view).doodad?.(view, card) ?? 'pay',
    maintain: (view) => forView(view).maintain(view),
  };
}

/**
 * How hard a searched strategy is, from the share of fresh tables it won against the field of the best known strategies (2, 4 and 6
 * seats, both rule sets, every profession). The field is strong, so even a good strategy wins a minority of those tables.
 */
export function difficultyOf(winRate: number): BotDifficulty {
  if (winRate >= 0.6) return 'champion';
  if (winRate >= 0.4) return 'hard';
  if (winRate >= 0.2) return 'medium';
  return 'easy';
}

/** The characters (the best of each style) and the global champion, as the searches wrote them (`characters.ts`). */
function searchedProfiles(): BotProfile[] {
  const out: BotProfile[] = [];
  const global = CHARACTERS['any'];
  if (global) {
    out.push({
      id: 'champion-v2',
      name: 'Champion Cleo II',
      difficulty: 'champion',
      description: `The global champion of the second search: ${global.spec.description} It won ${Math.round(global.winRate * 100)}% of fresh tables against the field.`,
      spec: { ...global.spec, id: 'champion-v2' },
    });
  }
  for (const [style, entry] of Object.entries(CHARACTERS)) {
    if (style === 'any') continue;
    out.push({
      id: `character-${style}`,
      name: entry.name,
      difficulty: difficultyOf(entry.winRate),
      description: `${entry.summary} ${entry.spec.description}`,
      spec: { ...entry.spec, id: `character-${style}` },
    });
  }
  return out;
}

/** Built on first use (not at load): nothing that only imports the domain package for something else carries the catalog with it. */
function buildProfiles(): BotProfile[] {
  return [...baseProfiles(), ...searchedProfiles()];
}

function baseProfiles(): BotProfile[] {
  return [
    {
      id: 'never-buy',
      name: 'Sleepy Sam',
      difficulty: 'easy',
      description:
        'Never invests: pays every Doodad and passes every deal. A bot to practise against.',
      spec: preset('never-buy'),
    },
    {
      id: 'picky-properties',
      name: 'Careful Carla',
      difficulty: 'easy',
      description: 'Buys only properties that pay at least 3% a month, and keeps a reserve.',
      spec: preset('picky-properties'),
    },
    {
      id: 'cash-properties',
      name: 'Cash Charlie',
      difficulty: 'easy',
      description: 'Buys any property it can pay for in cash. No loans.',
      spec: preset('cash-properties'),
    },
    {
      id: 'stocks-for-deposits',
      name: 'Trader Tina',
      difficulty: 'medium',
      description: 'Trades stocks to raise the deposits for properties.',
      spec: preset('stocks-for-deposits'),
    },
    {
      id: 'bridge-loans',
      name: 'Banker Ben',
      difficulty: 'medium',
      description:
        'Borrows from the bank when a property pays well above the interest, and pays back early.',
      spec: preset('bridge-loans'),
    },
    {
      id: 'mlm-then-properties',
      name: 'Marketing Mia',
      difficulty: 'medium',
      description: 'Takes every Multi-Level-Marketing card it can afford, then buys properties.',
      spec: preset('mlm-then-properties'),
    },
    {
      id: 'big-deals-when-rich',
      name: 'Steady Stella',
      difficulty: 'medium',
      description: 'Small Deals first, Big Deals once the cash is there.',
      spec: preset('big-deals-when-rich'),
    },
    {
      id: 'leveraged-big',
      name: 'Gambler Gus',
      difficulty: 'medium',
      description:
        'Goes for Big Deals on borrowed money. Fast when it works, bankrupt when it does not.',
      spec: preset('leveraged-big'),
    },
    {
      id: 'all-rounder',
      name: 'Allie All-Round',
      difficulty: 'hard',
      description:
        'Properties, loans only when well covered, marketing, stocks and selling to generous buyers.',
      spec: preset('all-rounder'),
    },
    {
      id: 'champion',
      name: 'Master Maxine',
      difficulty: 'champion',
      description:
        'Plays the champion of her own profession: the strategy that won the most tables for that profession in the tournament.',
      spec: CHAMPION_V1,
      build: championByProfession,
    },
    {
      id: 'champion-v1',
      name: 'Champion Cleo',
      difficulty: 'champion',
      description:
        'The strategy the tournament found to win tables most often, and the only one that watches the race: it takes more risk when a rival pulls ahead.',
      spec: CHAMPION_V1,
    },
    {
      id: 'best-found',
      name: 'Quick Quinn',
      difficulty: 'hard',
      description:
        'The best strategy the solo search found: fast properties, borrowing when it pays, marketing.',
      spec: BEST_FOUND,
    },
  ];
}

let profiles: BotProfile[] | null = null;

/** Every bot a host can seat, easiest first. */
export function botProfiles(): BotProfile[] {
  if (!profiles) profiles = buildProfiles();
  return profiles;
}

// -- Skill levels ------------------------------------------------------------------------------------------------

/**
 * How well a bot plays its strategy: a master plays it as found, the others slip now and then - they pass a deal their strategy
 * would take, take one it would leave, pay a Doodad they could pass, forget to sell or to repay. The chance of a slip, per decision.
 * The slips are decided by the position itself (a fixed hash of the round, the turn and the cash), never by chance, so a game is
 * still reproducible from its seed. A leveled bot is the base bot's id and the level: `champion-v2--casual`.
 */
export type BotLevel = 'master' | 'strong' | 'casual' | 'beginner';

export const BOT_LEVELS: Record<BotLevel, number> = {
  master: 0,
  strong: 0.1,
  casual: 0.25,
  beginner: 0.45,
};
const LEVEL_ORDER: BotLevel[] = ['master', 'strong', 'casual', 'beginner'];
const LEVEL_SEPARATOR = '--';

/** `champion-v2--casual` -> the base bot and the level; a plain id is a master. Null for a level that does not exist. */
export function splitBotId(id: string): { base: string; level: BotLevel } | null {
  const at = id.lastIndexOf(LEVEL_SEPARATOR);
  if (at < 0) return { base: id, level: 'master' };
  const level = id.slice(at + LEVEL_SEPARATOR.length) as BotLevel;
  return LEVEL_ORDER.includes(level) ? { base: id.slice(0, at), level } : null;
}

export function botIdWithLevel(base: string, level: BotLevel): string {
  return level === 'master' ? base : `${base}${LEVEL_SEPARATOR}${level}`;
}

const TIERS: BotDifficulty[] = ['easy', 'medium', 'hard', 'champion'];

/** A fixed pseudo-random number in [0, 1) from the position - no chance involved. */
function slip(view: PolicyView, salt: number): number {
  let h = Math.imul(view.round + 1, 2654435761) ^ Math.imul(view.turn + 7, 1597334677);
  h ^= Math.imul(Math.round(view.cashMinor / 100) + salt * 40503, 2246822507);
  h = Math.imul(h ^ (h >>> 15), 3266489909);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

function withMistakes(policy: Policy, rate: number, id: string): Policy {
  return {
    ...policy,
    id,
    deal(view, card) {
      const choice = policy.deal(view, card);
      if (choice.buy && slip(view, 1) < rate) return { buy: false };
      if (
        !choice.buy &&
        slip(view, 2) < rate / 3 &&
        (card.depositMinor ?? card.costMinor ?? Infinity) <= view.cashMinor
      ) {
        return { buy: true };
      }
      return choice;
    },
    doodad: (view, card) => {
      const choice = policy.doodad?.(view, card) ?? 'pay';
      return choice === 'pass' && slip(view, 3) < rate ? 'pay' : choice;
    },
    maintain: (view) => (slip(view, 4) < rate ? [] : policy.maintain(view)),
  };
}

export function botProfile(id: string): BotProfile | undefined {
  const parts = splitBotId(id);
  if (!parts) return undefined;
  const base = botProfiles().find((profile) => profile.id === parts.base);
  if (!base || parts.level === 'master') return base;
  const step = LEVEL_ORDER.indexOf(parts.level);
  const tier = Math.max(0, TIERS.indexOf(base.difficulty) - step);
  return {
    ...base,
    id,
    name: `${base.name} (${parts.level})`,
    difficulty: parts.level === 'beginner' ? 'easy' : TIERS[tier],
    description: `${base.description} Plays at the ${parts.level} level: now and then it slips.`,
  };
}

const cache = new Map<string, Policy>();

/** The strategy a bot id plays, or null when there is no such bot. */
export function botPolicy(id: string): Policy | null {
  const parts = splitBotId(id);
  const profile = botProfile(id);
  if (!parts || !profile) return null;
  let policy = cache.get(id);
  if (!policy) {
    const base = botProfiles().find((p) => p.id === parts.base)!;
    const plain = base.build ? base.build() : policyFromSpec(base.spec);
    policy = parts.level === 'master' ? plain : withMistakes(plain, BOT_LEVELS[parts.level], id);
    cache.set(id, policy);
  }
  return policy;
}
