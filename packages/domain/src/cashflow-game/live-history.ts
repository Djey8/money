import { historySteps, type GameSnapshot, type HistoryDeps, type LiveGameView } from './history';
import {
  decodeUndoChain,
  encodeUndoChain,
  isEncodedUndoChain,
  type EncodedUndoChain,
} from './undo-chain';

/**
 * The live game's history, kept in the account (JFK, 2026-10-05: "you write into this data path all the time"). Saved
 * games already keep the whole undo history, but only when the player presses Save; the running game's history used to
 * live only in the browser. Written on every step (the browser debounces it; the Pro API writes it with the step), it
 * lets an agent - or the player on another device - see the whole story of a game, inspect any step and undo back to it.
 *
 * It is one document at `cashflowGameHistory`: the undo chain in its compact form (each snapshot relative to the next
 * newer one) plus a plain-text log. Like a saved game it is stored as a single packed string (gzip, base64) so it is
 * encrypted as one value instead of thousands - the packing itself is the caller's, because the browser and the server
 * compress differently.
 */

export const LIVE_HISTORY_PATH = 'cashflowGameHistory';
export const LIVE_HISTORY_SCHEMA = 1;

/** One line of the plain-text step log. */
export interface HistoryLogLine {
  number: number;
  kind: string;
  detail: string;
  at: string;
}

export interface LiveHistory {
  schema: number;
  /** When it was last written - the newer of the browser's and the account's copy wins. */
  updatedAt: string;
  /** The saved-game slot the running game belongs to, once it has one. */
  gameId?: string;
  /** Every earlier step, so Undo works from anywhere. */
  undo: EncodedUndoChain;
  /** What happened, oldest step first - readable without decoding a single snapshot. */
  steps: HistoryLogLine[];
}

/** The live history for an undo stack: the compact chain and the log, stamped with `now`. */
export function buildLiveHistory<S extends GameSnapshot>(
  stack: S[],
  live: LiveGameView,
  deps: HistoryDeps,
  now: string,
): LiveHistory {
  return {
    schema: LIVE_HISTORY_SCHEMA,
    updatedAt: now,
    ...(live.cashflowGame.gameId ? { gameId: live.cashflowGame.gameId } : {}),
    undo: encodeUndoChain(stack),
    steps: historySteps(stack, live, deps)
      .reverse()
      .map(({ number, kind, detail, at }) => ({ number, kind, detail, at })),
  };
}

/**
 * Reads a stored live history back. Null for anything that is not one - a missing value, a damaged one, or one written by
 * a newer version than this code understands - so a bad document can never replace a good local history.
 */
export function readLiveHistory<S extends GameSnapshot>(
  value: unknown,
): { stack: S[]; updatedAt: string; gameId?: string } | null {
  const history = value as Partial<LiveHistory> | null;
  if (!history || typeof history !== 'object') return null;
  if (typeof history.schema !== 'number' || history.schema > LIVE_HISTORY_SCHEMA) return null;
  if (typeof history.updatedAt !== 'string' || !isEncodedUndoChain(history.undo)) return null;
  try {
    return {
      stack: decodeUndoChain<S>(history.undo),
      updatedAt: history.updatedAt,
      ...(history.gameId ? { gameId: history.gameId } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Whether the account's copy should replace the browser's: it is strictly newer, or the browser has none. Equal
 * timestamps keep what is already loaded, so an unchanged history is never reapplied.
 */
export function accountHistoryIsNewer(
  accountAt: string,
  localAt: string | null | undefined,
): boolean {
  if (!localAt) return true;
  return accountAt > localAt;
}
