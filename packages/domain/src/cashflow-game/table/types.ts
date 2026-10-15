import type { GameBooks } from '../books';
import type { GameRules } from '../rules';
import type { SellInput } from '../positions';
import type { CashflowDeckKind } from '../types';

/**
 * The multiplayer table (todo/cashflow-multiplayer.md, slice T1; docs/adr/0010). A table is plain data owned by a room on
 * the server: the settings chosen before the start, the seats, and - once play begins - one `GameBooks` per player. It never
 * reads or writes a personal account. Everything here is changed only by `applyCommand` (reducer.ts), which is pure.
 */

/** The server's hard ceiling on seats; a host picks fewer (default 6). */
export const TABLE_SEAT_CEILING = 24;
export const TABLE_MIN_SEATS = 2;
export const DEFAULT_TABLE_SEATS = 6;
export const TABLE_NAME_MAX = 60;
export const PLAYER_NAME_MAX = 24;

/** One colour per possible seat, so no two players ever share one. Tokens also differ by initial/shape in the UI. */
export const TABLE_COLORS: readonly string[] = [
  '#e6194b',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#bcf60c',
  '#008080',
  '#9a6324',
  '#800000',
  '#808000',
  '#000075',
  '#e6beff',
  '#aaffc3',
  '#fabed4',
  '#ffd8b1',
  '#fffac8',
  '#a9a9a9',
  '#7f3b08',
  '#2d6a4f',
  '#c9184a',
  '#5f0f40',
  '#0077b6',
];

export type TablePhase = 'lobby' | 'picking' | 'playing' | 'finished' | 'abandoned';

/** How a player's time is limited. T5 gives `bank`/`per-move`/`daily` their meaning; T1 only validates and stores them. */
export type ClockSettings =
  | { mode: 'none' }
  | { mode: 'per-move'; secondsPerMove: number }
  | { mode: 'bank'; bankSeconds: number; incrementSeconds: number }
  | { mode: 'daily'; hoursPerMove: number };

/** `first-escape`: the first player out of the rat race wins. `all-done`: play on until nobody is still in it. `round-limit`: ranked by passive income after N rounds. */
export type EndCondition = 'first-escape' | 'all-done' | 'round-limit';

/** `duplicates`: any profession, several players may share one. `unique`: one player per profession. `random`: assigned at the start. */
export type ProfessionRule = 'duplicates' | 'unique' | 'random';

/** `random`: shuffled when play starts. `seat`: the order players joined in. */
export type TurnOrderRule = 'random' | 'seat';

export interface TableSettings {
  name: string;
  visibility: 'public' | 'private';
  maxSeats: number;
  gameSetId: string;
  /** The preset the host started from; `rules` is what is enforced (the preset plus the table's forced settings). */
  rulesBase: 'guided' | 'strict';
  rules: GameRules;
  professions: ProfessionRule;
  turnOrder: TurnOrderRule;
  clock: ClockSettings;
  /** Consecutive timeouts after which a player is marked away and auto-played (T5). */
  awayAfterTimeouts: number;
  endCondition: EndCondition;
  /** Only with `round-limit`. */
  roundLimit?: number;
  spectators: boolean;
}

/** What a host may send: everything optional except the name; a few rule settings are the host's to tune. */
export interface TableSettingsInput extends Partial<Omit<TableSettings, 'rules' | 'rulesBase'>> {
  rulesBase?: 'guided' | 'strict';
  /** Overrides on the base preset. Settings a shared table has to force are refused, not silently changed. */
  rules?: Partial<GameRules>;
}

export type PlayerStatus = 'active' | 'left';

export interface TablePlayer {
  /** The account id; the server never sends it to other players (they see `name`/`color`). */
  id: string;
  name: string;
  color: string;
  ready: boolean;
  /** The profession asked for while picking; `random` until the reveal resolves it. Hidden from others until then (T2's projection). */
  pick: string | null;
  /** Set when play starts. */
  professionId: string | null;
  status: PlayerStatus;
  /** Timed out too often: their turns are played for them at once, until they come back. */
  away: boolean;
  /** Set when play starts: this player's own books, never an account's. */
  books: GameBooks | null;
}

/**
 * The running clock (epoch milliseconds, the server's own time). Only the server's clock counts; clients just draw the countdown.
 * `deadlineAt` is when the active player's time is up (null: no clock, or nobody is on the move).
 */
export interface TableClock {
  turnStartedAt: number | null;
  deadlineAt: number | null;
  /** Bank mode: the time each player has left, in milliseconds. */
  banksMs: Record<string, number>;
  /** Set while the host has paused the game. */
  pausedAt: number | null;
  /** Timeouts in a row, per player; any move of their own sets it back to zero. */
  timeouts: Record<string, number>;
}

/**
 * A Deal card offered to the other players (todo/cashflow-multiplayer.md slice T7): the "sell to a friend" of the solo game, at
 * a table. The card is the one the seller holds on their space - a property or a special asset; a share card stays with whoever
 * drew it. Nothing moves until both sides have agreed on a price, and then everything moves at once. It lives exactly as long as
 * the card is in the seller's hand: when their turn ends, they buy the card themselves, or they withdraw it, it is gone.
 */
export interface TradeOffer {
  sellerId: string;
  cardId: string;
  deck: 'dealSmall' | 'dealBig';
  /** One player, or null for the whole table. */
  to: string | null;
  /** The price the seller asks, in minor units. */
  priceMinor: number;
  /** What buyers proposed instead (at most one per buyer); the seller may accept one. */
  counters: { playerId: string; priceMinor: number }[];
  /** Buyers who said no (the offer is then not for them any more). */
  declined: string[];
}

export interface Table {
  id: string;
  /** Counts accepted commands; the server's optimistic-concurrency token. */
  version: number;
  phase: TablePhase;
  settings: TableSettings;
  hostId: string;
  /** Seats in the order they were taken. */
  players: TablePlayer[];
  /** Turn order (player ids), fixed when play starts. */
  order: string[];
  activePlayerId: string | null;
  tableRound: number;
  /** The active player has rolled this turn: the turn ends once their space is settled. */
  turnRolled: boolean;
  /** Players who left the rat race (escaped) or lost (bankrupt), in the order it happened. */
  finishers: { playerId: string; outcome: 'escaped' | 'bankrupt' }[];
  /** Set when the game is over. */
  result: TableResult | null;
  clock: TableClock;
  /** The Deal card on offer to the other players, if any - at most one, since only the player on the move holds a card. */
  trade: TradeOffer | null;
  /**
   * The table's discard piles: per deck, the card ids drawn since its last reshuffle. There is **one** set for the whole table
   * (todo/cashflow-multiplayer.md T2), so two players never draw the same card until the pile runs out and is reshuffled.
   */
  drawnCardIds: Record<CashflowDeckKind, string[]>;
  /** The dice and card stream's position, advanced by every use of chance. With the seed it is the whole secret (T2 hides it). */
  rngState: number;
  createdAt: string;
}

export type TableEndReason =
  'escaped' | 'last-standing' | 'round-limit' | 'all-done' | 'everyone-out';

export interface TableStanding {
  playerId: string;
  rank: number;
  outcome: 'escaped' | 'playing' | 'bankrupt' | 'left';
  passiveIncomeMinor: number;
  monthlyCashflowMinor: number;
}

/** How a finished game ended and how everyone placed: escapees first (earliest first), then by passive income, then the bankrupt, then those who left. */
export interface TableResult {
  reason: TableEndReason;
  winnerId: string | null;
  ranking: TableStanding[];
}

export type TableCommand =
  | { type: 'join'; name: string; color?: string }
  | { type: 'leave' }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'kick'; target: string }
  | { type: 'update_settings'; settings: TableSettingsInput }
  | { type: 'start' }
  | { type: 'pick_profession'; professionId: string }
  | { type: 'close' }
  | { type: 'pause' }
  | { type: 'resume' }
  /** An away player is back and plays their own turns again. */
  | { type: 'back' }
  // Play (T3): the active player's turn, in the solo game's own moves.
  | { type: 'roll'; dice?: 1 | 2 }
  | { type: 'draw_card'; deck: CashflowDeckKind }
  | { type: 'buy_deal'; cardId: string; quantity?: number }
  | { type: 'pay_doodad'; cardId: string }
  | { type: 'roll_decision'; title?: string }
  | { type: 'pass_card' }
  | { type: 'bank_loan'; amountMinor: number }
  // Trading the card in hand (T7).
  | { type: 'offer_trade'; priceMinor: number; to?: string }
  | { type: 'withdraw_trade' }
  | { type: 'counter_trade'; priceMinor: number }
  | { type: 'decline_trade' }
  | { type: 'accept_trade'; from?: string }
  // Any seated player, any time the rules let them (todo/cashflow-multiplayer.md §4.0, decision 5a).
  | { type: 'sell_position'; input: SellInput };

export type TableEventType =
  | 'table_created'
  | 'player_joined'
  | 'player_left'
  | 'player_kicked'
  | 'ready_changed'
  | 'host_changed'
  | 'settings_updated'
  | 'picking_started'
  | 'profession_picked'
  | 'back_to_lobby'
  | 'professions_revealed'
  | 'play_started'
  | 'table_closed'
  | 'turn_started'
  | 'turn_skipped'
  | 'round_started'
  | 'rolled'
  | 'card_drawn'
  | 'card_passed'
  | 'card_played'
  | 'market_card_played'
  | 'market_effect'
  | 'dice_decided'
  | 'position_sold'
  | 'loan_changed'
  | 'player_escaped'
  | 'player_bankrupt'
  | 'game_finished'
  | 'trade_offered'
  | 'trade_countered'
  | 'trade_declined'
  | 'trade_withdrawn'
  | 'trade_made'
  | 'trade_expired'
  | 'turn_timeout'
  | 'player_away'
  | 'player_returned'
  | 'paused'
  | 'resumed';

/** One thing that happened, in the order it happened. The log of these (with the commands' version) is the replay. */
export interface TableEvent {
  /** The table version this event belongs to; one command may produce several events. */
  version: number;
  at: string;
  type: TableEventType;
  playerId: string | null;
  data?: Record<string, unknown>;
}

export type TableErrorCode =
  | 'NOT_A_MEMBER'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'TABLE_FULL'
  | 'ALREADY_JOINED'
  | 'INVALID_NAME'
  | 'NAME_TAKEN'
  | 'COLOR_TAKEN'
  | 'INVALID_SETTINGS'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_READY'
  | 'UNKNOWN_PROFESSION'
  | 'PROFESSION_TAKEN'
  | 'UNKNOWN_PLAYER'
  | 'CANNOT_KICK_HOST'
  | 'NOT_YOUR_TURN'
  | 'ILLEGAL_MOVE'
  | 'NOT_DUE'
  | 'PAUSED'
  | 'TIME_UP'
  | 'UNKNOWN_COMMAND';

/** A refused command. The server maps `code` to a 4xx; nothing about the table changed. */
export class TableCommandError extends Error {
  constructor(
    readonly code: TableErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TableCommandError';
  }
}
