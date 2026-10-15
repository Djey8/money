import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { normalizeRules, type GameRules } from '../rules';
import type { CashflowGameSet } from '../types';
import {
  DEFAULT_TABLE_SEATS,
  TABLE_MIN_SEATS,
  TABLE_NAME_MAX,
  TABLE_SEAT_CEILING,
  TableCommandError,
  type ClockSettings,
  type TableSettings,
  type TableSettingsInput,
} from './types';

/**
 * Table settings (todo/cashflow-multiplayer.md §3.2): validated once, frozen when play starts. A shared table cannot run
 * under the solo game's loose rules - a claimed dice roll, a hand-typed transaction, a peeked-at deck or a self-named sale
 * price would let one player cheat the others - so those settings are forced, and a host who asks for the opposite is told
 * no rather than silently overruled.
 */

/** What every table runs, whatever the host picked. */
export const FORCED_TABLE_RULES = {
  cardChoice: 'offered-once',
  buy: 'with-card',
  reportRolls: 'forbidden',
  manualTransactions: 'forbidden',
  maxFreeAmountMinor: 0,
} as const satisfies Partial<GameRules>;

function invalid(message: string): never {
  throw new TableCommandError('INVALID_SETTINGS', message);
}

function whole(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return invalid(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

export function normalizeClock(input: ClockSettings | undefined): ClockSettings {
  if (!input || input.mode === 'none') return { mode: 'none' };
  switch (input.mode) {
    case 'per-move':
      return {
        mode: 'per-move',
        secondsPerMove: whole(input.secondsPerMove, 'secondsPerMove', 10, 3600),
      };
    case 'bank':
      return {
        mode: 'bank',
        bankSeconds: whole(input.bankSeconds, 'bankSeconds', 60, 14400),
        incrementSeconds: whole(input.incrementSeconds ?? 0, 'incrementSeconds', 0, 300),
      };
    case 'daily':
      return { mode: 'daily', hoursPerMove: whole(input.hoursPerMove, 'hoursPerMove', 1, 168) };
    default:
      return invalid("clock.mode must be 'none', 'per-move', 'bank' or 'daily'.");
  }
}

/** Rules for a table: the base preset, the host's tunable overrides, and the forced settings on top. */
export function normalizeTableRules(
  base: 'guided' | 'strict',
  overrides: Partial<GameRules> | undefined,
): GameRules {
  if (base !== 'guided' && base !== 'strict') invalid("rulesBase must be 'guided' or 'strict'.");
  const given: Partial<GameRules> = { ...(overrides ?? {}) };
  delete given.preset;
  for (const [key, forced] of Object.entries(FORCED_TABLE_RULES)) {
    const value = (given as Record<string, unknown>)[key];
    if (value !== undefined && value !== forced) {
      invalid(`A shared table always plays with ${key} = ${String(forced)}.`);
    }
  }
  if (given.sell === 'always') {
    invalid(
      "A table cannot use sell = 'always': a seller naming their own price would create money. Use 'with-offer' or 'never'.",
    );
  }
  try {
    return normalizeRules({ preset: base, ...given, ...FORCED_TABLE_RULES });
  } catch (error) {
    return invalid((error as Error).message);
  }
}

/** Why a game set cannot be played at a table, or null. */
export function whyGameSetNotForTables(gameSet: CashflowGameSet): string | null {
  const decks = gameSet.decks;
  const missing = (['dealSmall', 'dealBig', 'market', 'doodad'] as const).filter(
    (kind) => !decks?.[kind]?.length,
  );
  if (missing.length > 0) return `Game set '${gameSet.id}' has no ${missing.join(', ')} cards.`;
  if (gameSet.professions.length === 0) return `Game set '${gameSet.id}' has no professions.`;
  return null;
}

/** Complete, valid settings from a host's input. Throws `TableCommandError('INVALID_SETTINGS')`. */
export function normalizeTableSettings(
  input: TableSettingsInput,
  gameSets: CashflowGameSet[] = CASHFLOW_GAME_SETS,
): TableSettings {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > TABLE_NAME_MAX) {
    invalid(`The table name must be 1 to ${TABLE_NAME_MAX} characters.`);
  }
  const visibility = input.visibility ?? 'public';
  if (visibility !== 'public' && visibility !== 'private') {
    invalid("visibility must be 'public' or 'private'.");
  }
  const maxSeats = whole(
    input.maxSeats ?? DEFAULT_TABLE_SEATS,
    'maxSeats',
    TABLE_MIN_SEATS,
    TABLE_SEAT_CEILING,
  );

  const gameSetId = input.gameSetId ?? 'cashflow';
  const gameSet = gameSets.find((candidate) => candidate.id === gameSetId);
  if (!gameSet) return invalid(`Unknown game set '${gameSetId}'.`);
  const notForTables = whyGameSetNotForTables(gameSet);
  if (notForTables) invalid(notForTables);

  const professions = input.professions ?? 'duplicates';
  if (!['duplicates', 'unique', 'random'].includes(professions)) {
    invalid("professions must be 'duplicates', 'unique' or 'random'.");
  }
  const poolSize = gameSet.professions.length;
  if (professions === 'unique' && maxSeats > poolSize) {
    invalid(
      `Unique professions allow at most ${poolSize} seats in this game set (it has ${poolSize} professions).`,
    );
  }

  const turnOrder = input.turnOrder ?? 'random';
  if (turnOrder !== 'random' && turnOrder !== 'seat') {
    invalid("turnOrder must be 'random' or 'seat'.");
  }

  const endCondition = input.endCondition ?? 'first-escape';
  if (!['first-escape', 'all-done', 'round-limit'].includes(endCondition)) {
    invalid("endCondition must be 'first-escape', 'all-done' or 'round-limit'.");
  }
  let roundLimit: number | undefined;
  if (endCondition === 'round-limit') {
    roundLimit = whole(input.roundLimit, 'roundLimit', 1, 1000);
  } else if (input.roundLimit !== undefined) {
    invalid("roundLimit only goes with endCondition 'round-limit'.");
  }

  const rulesBase = input.rulesBase ?? 'guided';
  return {
    name,
    visibility,
    maxSeats,
    gameSetId,
    rulesBase,
    rules: normalizeTableRules(rulesBase, input.rules),
    professions,
    turnOrder,
    clock: normalizeClock(input.clock),
    awayAfterTimeouts: whole(input.awayAfterTimeouts ?? 2, 'awayAfterTimeouts', 1, 20),
    endCondition,
    ...(roundLimit !== undefined ? { roundLimit } : {}),
    spectators: input.spectators ?? false,
  };
}
