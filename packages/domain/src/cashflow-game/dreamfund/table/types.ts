import type { CustomMode, CustomRules } from '../../custom-rules';
import type { Difficulty } from '../../difficulty';
import type { BoardSetup } from '../../dreamfund-board';
import type { HarvestLadderOffer } from '../../harvest';
import type { OpportunityPile } from '../../opportunity-deck';
import type { OpportunityChoice } from '../../opportunity';
import type { DreamPlayerData } from '../player';
import type {
  ClockSettings,
  PlayerStatus,
  ProfessionRule,
  TableClock,
  TablePace,
  TablePhase,
  TurnOrderRule,
} from '../../table/types';

/**
 * The Dreamfund table (todo/dreamfund-multiplayer.md, slice 2): the classic table's flow - lobby, seats, picking a character, turns
 * on a clock, a history of events, a result - for the Dreamfund game. Plain data owned by a room on the server; everything changes
 * through `applyDreamCommand` (reducer.ts), which is pure. Everyone plays their own life on the same map (parallel play); the Harvest
 * market is the table's: one card for everybody, one set of indices, anybody may sell into it.
 */

/** `first-win`: the first player to reach all five goals wins. `all-done`: play on until nobody is still playing. `round-limit`: ranked after N rounds. */
export type DreamEndCondition = 'first-win' | 'all-done' | 'round-limit';

export interface DreamTableSettings {
  name: string;
  visibility: 'public' | 'private';
  maxSeats: number;
  /** The level: the characters' numbers and the cards change with it (Easy, Normal, Hard). */
  difficulty: Difficulty;
  /** The map everybody plays on. */
  shape: BoardSetup['shape'];
  size: BoardSetup['size'];
  /** The Custom JFK rules: the mode and the single rules (offers per landing, side hustles...). */
  mode: CustomMode;
  customRules: CustomRules;
  professions: ProfessionRule;
  turnOrder: TurnOrderRule;
  clock: ClockSettings;
  awayAfterTimeouts: number;
  endCondition: DreamEndCondition;
  /** Only with `round-limit`. */
  roundLimit?: number;
  spectators: boolean;
  allowRewind: boolean;
  /** The table waits after each turn until everybody has said Continue (people only; bots are not waited for). */
  turnGate: boolean;
  pace: TablePace;
  /** Whether everybody's progress is shown. */
  showProgress: boolean;
  /** Whether the game may count for the leaderboard (decided by the ranked rules when it ends). */
  ranked: boolean;
  leaveFreeRounds: number;
}

/** What the table wants from a player next: a landing's decisions, in order. */
export type DreamPending =
  /** An Emergency card: the choice picked and the dice rolled on it so far (the table rolls them; they stay as they fell). */
  | {
      kind: 'emergency';
      cardId: string;
      choiceId?: string;
      rolls?: Record<string, number>;
      rerolled?: boolean;
    }
  | { kind: 'life'; cardId: string }
  | { kind: 'career_branch'; options: string[] }
  | { kind: 'dream'; offers: string[] }
  | { kind: 'opportunity_pile' }
  | { kind: 'opportunity'; pile: OpportunityPile; offers: string[] };

/** What a Harvest card left open to a player: they may still sell into it until the turn of the player who drew it is over. */
/** A card that was dealt with in the turn, for the screen to show what happened. */
export type DreamResolved =
  | {
      kind: 'emergency';
      cardId: string;
      choiceId?: string;
      rolls?: Record<string, number>;
      payMinor: number;
      how: 'now' | 3 | 6 | 12;
    }
  | { kind: 'life'; cardId: string; decision: string; outcome?: unknown };

export interface DreamHarvestOpen {
  /** The titles of the holdings that may be sold now, at today's price. */
  sellable: string[];
  /** Buyers' offers: the holding and what is offered gross. */
  sales: { holding: string; grossMinor: number; costsMinor: number; owedMinor: number }[];
  /** Hype offers (the ladder): the holding. */
  ladders: HarvestLadderOffer[];
}

export interface DreamSeat {
  id: string;
  name: string;
  color: string;
  initials?: string;
  ready: boolean;
  /** The character asked for while picking (`random` until the reveal). */
  pick: string | null;
  /** The character (the id of its Normal version), set when play starts. */
  professionId: string | null;
  status: PlayerStatus;
  leftRound?: number;
  away: boolean;
  /** A seat played by a strategy of the server (the 12 strategies of the simulation). */
  bot?: { policyId: string; professionId?: string };
  /** This player's life, set when play starts. */
  life: DreamPlayerData | null;
  /** What the player has to decide before the turn can end. */
  pending: DreamPending | null;
  /** The Harvest card's open options for this player. */
  harvest: DreamHarvestOpen | null;
  /** The card dealt with this turn and what came of it, shown on the player's screen until their next roll. */
  resolved?: DreamResolved | null;
  /** A Payday was passed in this turn and the player has not yet said what to do with the month's money (`settle_payday`). */
  paydayDue?: boolean;
  /** The round of the table in which each goal was first reached. */
  reached: {
    reserve?: number;
    debts?: number;
    dream?: number;
    independence?: number;
    won?: number;
  };
}

/** How a player stands: the goals, the dream points and one number to rank by. */
export interface DreamStanding {
  playerId: string;
  rank: number;
  outcome: 'won' | 'playing' | 'bankrupt' | 'left';
  /** The five goals and how far each is (0 to 1). */
  goals: { reserve: number; debts: number; dream: number; independence: number };
  goalsMet: number;
  dreamPoints: number;
  reserveMinor: number;
  passiveMinor: number;
  expensesMinor: number;
  netWorthMinor: number;
  /** The round a player won in. */
  wonRound?: number;
  /** What the ranking is made of: goal progress, dream points, a win. */
  score: number;
}

export type DreamEndReason = 'won' | 'last-standing' | 'round-limit' | 'all-done' | 'everyone-out';

export interface DreamResult {
  reason: DreamEndReason;
  winnerId: string | null;
  ranking: DreamStanding[];
}

/** An Opportunity card a player offers to the others for a fee (the classic trade of a Deal card, for the holdings of a life). */
export interface DreamTradeOffer {
  sellerId: string;
  /** The title of the holding offered, and its card. */
  holding: string;
  cardId: string;
  /** One player, or null for the whole table. */
  to: string | null;
  /** What the seller asks, in minor units. */
  priceMinor: number;
  /** What buyers proposed instead (at most one each); the seller may accept one. */
  counters: { playerId: string; priceMinor: number }[];
  /** Buyers who said no. */
  declined: string[];
  at?: number;
}

export interface DreamTable {
  kind: 'dreamfund';
  id: string;
  version: number;
  phase: TablePhase;
  settings: DreamTableSettings;
  hostId: string;
  players: DreamSeat[];
  order: string[];
  activePlayerId: string | null;
  tableRound: number;
  /** The active player has rolled this turn. */
  turnRolled: boolean;
  /** Players who won or went bankrupt, in the order it happened. */
  finishers: { playerId: string; outcome: 'won' | 'bankrupt' }[];
  result: DreamResult | null;
  clock: TableClock;
  /** The Harvest pile: the cards drawn since its last reshuffle (one pile for the whole table). */
  /** The card on offer to the other players, if any - at most one, made in the turn of its seller. */
  trade: DreamTradeOffer | null;
  harvestDeck: unknown;
  /** The Harvest markets' indices: one set for the whole table. */
  markets: Record<string, number>;
  /** The seed of the map. */
  seed: number;
  /** The dice and card stream's position. */
  rngState: number;
  createdAt: string;
}

export type DreamCommand =
  | { type: 'join'; name: string; color?: string; initials?: string }
  | { type: 'leave' }
  | { type: 'add_bot'; name: string; policyId: string; professionId?: string; color?: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'kick'; target: string }
  | { type: 'update_settings'; settings: DreamSettingsInput }
  | { type: 'start' }
  | { type: 'pick_profession'; professionId: string }
  | { type: 'close' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'away' }
  | { type: 'back' }
  // Play: the active player's turn.
  | { type: 'roll' }
  /** An Emergency card: the choice it asks for (if any), and how it is paid - now, or on a plan of 3, 6 or 12 Paydays. */
  | { type: 'pay_emergency'; choiceId?: string; pay: 'now' | 3 | 6 | 12 }
  /** The choice of an Emergency card that has options. */
  | { type: 'emergency_choose'; choiceId: string }
  /** Rolls one of the card's dice (`main`, `bucket:<id>`, `extra`, `reroll`): the table rolls it. */
  | { type: 'emergency_roll'; key: string }
  /** Takes the offer to roll again. */
  | { type: 'emergency_reroll' }
  | {
      type: 'answer_life';
      decision: 'accept' | 'decline' | 'roll' | 'pass' | 'give' | 'lend' | { option: string };
    }
  | { type: 'choose_career_branch'; index: number }
  | { type: 'take_dream'; cardId: string }
  | { type: 'choose_pile'; pile: OpportunityPile }
  | { type: 'take_opportunity'; cardId: string; choice?: OpportunityChoice }
  /** Leaves the decision open on the table as it is (no dream taken, no card bought). */
  | { type: 'skip' }
  | { type: 'end_turn' }
  // The player's own money, on their own turn.
  /** Says the month's money is dealt with (plans set, lump sums paid): a bot sends it after its money moves. */
  | { type: 'settle_payday' }
  | { type: 'fund_reserve'; amountMinor: number }
  | { type: 'fund_dream'; amountMinor: number }
  | { type: 'repay_debt'; tag: string }
  | { type: 'repay_bank_loan'; amountMinor: number }
  | { type: 'set_plan'; kind: 'mojo' | 'life' | 'smile'; id: string; perMinor: number }
  // Selling and trading what the player owns.
  /** The way out that is always there: a holding sold at the market price less a discount. */
  | { type: 'sell_holding'; holding: string }
  /** Offers a holding to one player (or everybody) for a price; it lasts until the seller's turn is over. */
  | { type: 'offer_trade'; holding: string; priceMinor: number; to?: string }
  | { type: 'withdraw_trade' }
  | { type: 'counter_trade'; priceMinor: number }
  | { type: 'decline_trade' }
  | { type: 'accept_trade'; from?: string }
  // The Harvest card's options (any player, until the turn of its drawer is over).
  | { type: 'harvest_sell'; holding: string }
  | { type: 'harvest_accept'; holding: string }
  | { type: 'harvest_ladder'; holding: string; action: 'ride' | 'cash' | 'skip' };

export interface DreamSettingsInput {
  name?: string;
  visibility?: 'public' | 'private';
  maxSeats?: number;
  difficulty?: Difficulty;
  shape?: BoardSetup['shape'];
  size?: BoardSetup['size'];
  mode?: CustomMode;
  customRules?: Partial<CustomRules>;
  professions?: ProfessionRule;
  turnOrder?: TurnOrderRule;
  clock?: ClockSettings;
  awayAfterTimeouts?: number;
  endCondition?: DreamEndCondition;
  roundLimit?: number;
  spectators?: boolean;
  allowRewind?: boolean;
  turnGate?: boolean;
  pace?: TablePace;
  showProgress?: boolean;
  ranked?: boolean;
  leaveFreeRounds?: number;
}

export type DreamEventType =
  | 'table_created'
  | 'player_joined'
  | 'bot_added'
  | 'player_left'
  | 'player_kicked'
  | 'ready_changed'
  | 'host_changed'
  | 'settings_updated'
  | 'picking_started'
  | 'profession_picked'
  | 'professions_revealed'
  | 'play_started'
  | 'table_closed'
  | 'turn_started'
  | 'round_started'
  | 'rolled'
  | 'payday'
  | 'emergency'
  | 'life'
  | 'career'
  | 'dream'
  | 'opportunity'
  | 'opportunity_taken'
  | 'harvest'
  | 'harvest_sold'
  | 'trade_offered'
  | 'trade_countered'
  | 'trade_declined'
  | 'trade_withdrawn'
  | 'trade_made'
  | 'trade_expired'
  | 'holding_sold'
  | 'money_moved'
  | 'goal_reached'
  | 'player_won'
  | 'player_bankrupt'
  | 'player_away'
  | 'player_returned'
  | 'turn_timeout'
  | 'paused'
  | 'resumed'
  | 'game_finished';

export interface DreamEvent {
  version: number;
  at: string;
  type: DreamEventType;
  playerId: string | null;
  data?: Record<string, unknown>;
}

export const DREAM_TABLE_SEAT_CEILING = 24;
export const DREAM_TABLE_MIN_SEATS = 2;
export const DREAM_DEFAULT_SEATS = 6;
