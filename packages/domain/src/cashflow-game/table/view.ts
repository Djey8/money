import type { GameBooks } from '../books';
import type { CashflowDeckKind, CashflowGameState } from '../types';
import { nextDeadline } from './clock';
import { cardsLeft } from './deck';
import type {
  PlayerStatus,
  TableEndReason,
  TableStanding,
  Table,
  TableEvent,
  TableEventType,
  TablePhase,
  TableSettings,
} from './types';

/**
 * What one viewer is allowed to see of a table (todo/cashflow-multiplayer.md slice T2) - the single place that decides it. A
 * Cashflow table is open information: every player's profession, books, cards and history are readable by everyone at any
 * time. What stays hidden is only what would let someone predict or cheat:
 *
 *  - the dice and card stream's position (`rngState`) - it is the future;
 *  - the order of the draw piles (only the discard piles and the cards left are shown);
 *  - another player's profession pick while a duplicates table is still picking in secret;
 *  - account ids: players are known by **seat** number, name and colour.
 *
 * A viewer who is not seated (a spectator, or the server's own) gets `youSeat: null` and sees the same public table.
 */

export type PublicState = Omit<CashflowGameState, 'drawnCardIds'>;

/** A player's books as everyone sees them: the static game set (the client has it) and the private pile copy are left out. */
export type PublicBooks = Omit<GameBooks, 'gameSet' | 'state'> & { state: PublicState };

export interface PlayerView {
  seat: number;
  name: string;
  color: string;
  ready: boolean;
  status: PlayerStatus;
  /** Timed out too often: their turns are played for them until they are back. */
  away: boolean;
  /** Whether a profession has been picked (always true once play starts). */
  hasPicked: boolean;
  /** The pick - the viewer's own, anyone's at a unique table, or everyone's once play has started; otherwise null. */
  pick: string | null;
  professionId: string | null;
  books: PublicBooks | null;
}

export interface DeckView {
  /** Cards still in the pile. */
  left: number;
  /** The cards drawn since the last reshuffle, oldest first. */
  discard: string[];
}

export interface TableView {
  id: string;
  version: number;
  phase: TablePhase;
  settings: TableSettings;
  hostSeat: number;
  /** The viewer's own seat, or null for a spectator. */
  youSeat: number | null;
  players: PlayerView[];
  /** Turn order as seats. */
  order: number[];
  activeSeat: number | null;
  tableRound: number;
  /** The active player has rolled and is settling their space. */
  turnRolled: boolean;
  clock: ClockView;
  result: ResultView | null;
  decks: Record<CashflowDeckKind, DeckView>;
  createdAt: string;
}

/** The clock as everyone sees it. Times are the server's epoch milliseconds; clients draw the countdown from `deadlineAt`. */
export interface ClockView {
  /** When the player on the move runs out of time; null without a clock, while paused, or when nobody is on the move. */
  deadlineAt: number | null;
  /** Set while the host has the game paused. */
  pausedAt: number | null;
  /** Bank mode: each seat's remaining time in milliseconds (null for the other modes). */
  banksMs: (number | null)[];
  /** Timeouts in a row, by seat. */
  timeouts: number[];
}

export interface ResultView {
  reason: TableEndReason;
  winnerSeat: number | null;
  ranking: (Omit<TableStanding, 'playerId'> & { seat: number })[];
}

export interface TableEventView {
  version: number;
  at: string;
  type: TableEventType;
  /** Who it concerns, as a seat; null for the table itself. */
  seat: number | null;
  data?: Record<string, unknown>;
}

const DECKS: CashflowDeckKind[] = ['dealSmall', 'dealBig', 'market', 'doodad'];

function publicBooks(books: GameBooks): PublicBooks {
  const { state, ...rest } = books;
  const publicState: Partial<CashflowGameState> = { ...state };
  delete publicState.drawnCardIds;
  const publicRest: Partial<GameBooks> = { ...rest };
  delete publicRest.gameSet;
  return { ...publicRest, state: publicState } as PublicBooks;
}

/** The table as `viewerId` (an account id, or anything not seated for a spectator) may see it. */
export function projectFor(table: Table, viewerId: string | null): TableView {
  const seatOf = (id: string) => table.players.findIndex((player) => player.id === id);
  const youSeat = viewerId === null ? -1 : seatOf(viewerId);
  const picksAreOpen = table.phase === 'playing' || table.phase === 'finished';
  const uniquePicks = table.settings.professions === 'unique';

  return {
    id: table.id,
    version: table.version,
    phase: table.phase,
    settings: table.settings,
    hostSeat: seatOf(table.hostId),
    youSeat: youSeat >= 0 ? youSeat : null,
    players: table.players.map((player, seat) => ({
      seat,
      name: player.name,
      color: player.color,
      ready: player.ready,
      status: player.status,
      away: player.away,
      hasPicked: player.pick !== null || player.professionId !== null,
      pick: seat === youSeat || uniquePicks || picksAreOpen ? player.pick : null,
      professionId: player.professionId,
      books: player.books ? publicBooks(player.books) : null,
    })),
    order: table.order.map(seatOf),
    activeSeat: table.activePlayerId === null ? null : seatOf(table.activePlayerId),
    tableRound: table.tableRound,
    turnRolled: table.turnRolled,
    clock: {
      deadlineAt: nextDeadline(table),
      pausedAt: table.clock.pausedAt,
      banksMs: table.players.map((p) => table.clock.banksMs[p.id] ?? null),
      timeouts: table.players.map((p) => table.clock.timeouts[p.id] ?? 0),
    },
    result: table.result
      ? {
          reason: table.result.reason,
          winnerSeat: table.result.winnerId === null ? null : seatOf(table.result.winnerId),
          ranking: table.result.ranking.map(({ playerId, ...standing }) => ({
            ...standing,
            seat: seatOf(playerId),
          })),
        }
      : null,
    decks: Object.fromEntries(
      DECKS.map((deck) => [
        deck,
        { left: cardsLeft(table, deck), discard: [...table.drawnCardIds[deck]] },
      ]),
    ) as Record<CashflowDeckKind, DeckView>,
    createdAt: table.createdAt,
  };
}

/** An event as every viewer may see it: the account id becomes a seat. Events carry nothing secret (see the reducer). */
export function projectEvent(table: Table, event: TableEvent): TableEventView {
  const seat =
    event.playerId === null ? -1 : table.players.findIndex((p) => p.id === event.playerId);
  return {
    version: event.version,
    at: event.at,
    type: event.type,
    seat: seat >= 0 ? seat : null,
    ...(event.data ? { data: event.data } : {}),
  };
}

export function projectEvents(table: Table, events: readonly TableEvent[]): TableEventView[] {
  return events.map((event) => projectEvent(table, event));
}
