import type { Difficulty } from './difficulty';
import type { GameRules } from './rules';
import { RULE_PRESETS } from './rules';

/**
 * The rules of the Custom JFK edition (JFK, 2026-10-26): what the player may decide and what the cards decide. The classic rules (selling,
 * buying, the order of a turn) belong to the classic edition; this game has its own, and they grow as the game does.
 *
 * - `free`: everything is open - to debug and to try things out. Any card of a stack can be searched, nothing is forced.
 * - `guided`: in between. The cards are shuffled, emergencies of the kind that cannot wait have to be paid, a promotion has to be
 *   rolled for; the player still decides about dreams and life.
 * - `strict`: the preparation for a game with others - the cards decide, the player only chooses what a card leaves open. Nothing is
 *   added by hand: no projects of their own, no transactions outside the game's moves.
 */
export type CustomMode = 'free' | 'guided' | 'strict';

/** `free`: any card of a stack can be searched; `random`: the card is shuffled and drawn. */
export type CustomCardChoice = 'free' | 'random';

/**
 * What an emergency asks before the game goes on: `never` - nothing; `payNow` - the ones that cannot be put on a plan are paid first;
 * `all` - every emergency is paid or planned first.
 */
export type EmergencySettle = 'never' | 'payNow' | 'all';

export interface CustomRules {
  mode: CustomMode;
  cardChoice: CustomCardChoice;
  /** How many dreams a Dream tile offers (1 to 3), and how many can be open at once. */
  dreamOffers: number;
  maxOpenDreams: number;
  /** The dreams offered may all be refused. */
  dreamMayDecline: boolean;
  /** A Life card that offers a choice may be declined. */
  lifeMayDecline: boolean;
  /** A promotion that is due has to be rolled for: the turn does not go on before. */
  careerMustRoll: boolean;
  emergencySettle: EmergencySettle;
  /** The player may add Smile and Fire projects of their own, besides the ones the cards bring. */
  ownProjects: boolean;
  /** Opportunity: cards shown per landing (1-3), side hustles that can run at once (1-5), copies of each savings card (1-3). */
  opportunityOffers: number;
  maxSideHustles: number;
  savingsCardCopies: number;
  /** How many turns a planned Opportunity card can still be bought: 1 = only in the turn the card is in hand (JFK, 2026-10-26). */
  opportunityValidTurns: number;
  /** The level of the game: the defaults of the decks and the odds. Only Medium is offered until the simulation has set the others. */
  difficulty: Difficulty;
  /** What the Bank loan costs each month, in percent of what is borrowed (JFK, 2026-10-26: 10 %, a setting). */
  bankInterestPercent: number;
}

export const CUSTOM_RULE_PRESETS: Record<CustomMode, CustomRules> = {
  free: {
    mode: 'free',
    cardChoice: 'free',
    dreamOffers: 2,
    maxOpenDreams: 3,
    dreamMayDecline: true,
    lifeMayDecline: true,
    careerMustRoll: false,
    emergencySettle: 'never',
    ownProjects: true,
    bankInterestPercent: 10,
    opportunityOffers: 2,
    maxSideHustles: 3,
    savingsCardCopies: 2,
    opportunityValidTurns: 1,
    difficulty: 'medium',
  },
  guided: {
    mode: 'guided',
    cardChoice: 'random',
    dreamOffers: 2,
    maxOpenDreams: 3,
    dreamMayDecline: true,
    lifeMayDecline: true,
    careerMustRoll: true,
    emergencySettle: 'payNow',
    ownProjects: true,
    bankInterestPercent: 10,
    opportunityOffers: 2,
    maxSideHustles: 3,
    savingsCardCopies: 2,
    opportunityValidTurns: 1,
    difficulty: 'medium',
  },
  strict: {
    mode: 'strict',
    cardChoice: 'random',
    dreamOffers: 2,
    maxOpenDreams: 3,
    // the dreams of the cards are for the points of a ranked game: they may be refused or given up; the life dream is the aim
    dreamMayDecline: true,
    lifeMayDecline: false,
    careerMustRoll: true,
    emergencySettle: 'all',
    ownProjects: false,
    bankInterestPercent: 10,
    opportunityOffers: 2,
    maxSideHustles: 3,
    savingsCardCopies: 2,
    opportunityValidTurns: 1,
    difficulty: 'medium',
  },
};

/** Rules read from a saved game (or typed): every setting present and valid, the mode's own where it is missing. */
export function normalizeCustomRules(raw: Partial<CustomRules> | undefined | null): CustomRules {
  const base = CUSTOM_RULE_PRESETS[raw?.mode ?? 'free'] ?? CUSTOM_RULE_PRESETS.free;
  const clamp = (value: unknown, low: number, high: number, fallback: number) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
  };
  return {
    mode: base.mode,
    cardChoice:
      raw?.cardChoice === 'free' || raw?.cardChoice === 'random' ? raw.cardChoice : base.cardChoice,
    dreamOffers: clamp(raw?.dreamOffers, 1, 3, base.dreamOffers),
    maxOpenDreams: clamp(raw?.maxOpenDreams, 1, 5, base.maxOpenDreams),
    dreamMayDecline:
      typeof raw?.dreamMayDecline === 'boolean' ? raw.dreamMayDecline : base.dreamMayDecline,
    lifeMayDecline:
      typeof raw?.lifeMayDecline === 'boolean' ? raw.lifeMayDecline : base.lifeMayDecline,
    careerMustRoll:
      typeof raw?.careerMustRoll === 'boolean' ? raw.careerMustRoll : base.careerMustRoll,
    emergencySettle:
      raw?.emergencySettle === 'never' ||
      raw?.emergencySettle === 'payNow' ||
      raw?.emergencySettle === 'all'
        ? raw.emergencySettle
        : base.emergencySettle,
    ownProjects: typeof raw?.ownProjects === 'boolean' ? raw.ownProjects : base.ownProjects,
    bankInterestPercent: clamp(raw?.bankInterestPercent, 1, 30, base.bankInterestPercent),
    opportunityOffers: clamp(raw?.opportunityOffers, 1, 3, base.opportunityOffers),
    maxSideHustles: clamp(raw?.maxSideHustles, 1, 5, base.maxSideHustles),
    savingsCardCopies: clamp(raw?.savingsCardCopies, 1, 3, base.savingsCardCopies),
    opportunityValidTurns: clamp(raw?.opportunityValidTurns, 1, 3, base.opportunityValidTurns),
    difficulty:
      raw?.difficulty === 'easy' || raw?.difficulty === 'medium' || raw?.difficulty === 'hard'
        ? raw.difficulty
        : base.difficulty,
  };
}

/** Whether the settings are exactly those of their mode (a changed setting makes it a custom mix). */
export function isPresetMode(rules: CustomRules): boolean {
  const preset = CUSTOM_RULE_PRESETS[rules.mode];
  return (Object.keys(preset) as (keyof CustomRules)[]).every((key) => preset[key] === rules[key]);
}

/** The classic rules the engine enforces for a mode: strict is the classic strict, and so on. */
export function classicRulesOfMode(mode: CustomMode): GameRules {
  return { ...RULE_PRESETS[mode] };
}
