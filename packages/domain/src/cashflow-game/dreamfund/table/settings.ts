import { CUSTOM_RULE_PRESETS, normalizeCustomRules } from '../../custom-rules';
import { normalizeClock } from '../../table/settings';
import { TABLE_NAME_MAX, TableCommandError } from '../../table/types';
import {
  DREAM_DEFAULT_SEATS,
  DREAM_TABLE_MIN_SEATS,
  DREAM_TABLE_SEAT_CEILING,
  type DreamSettingsInput,
  type DreamTableSettings,
} from './types';

/**
 * The settings of a Dreamfund table: the classic table's (seats, clock, end condition, visibility...) with the Dreamfund's own -
 * the difficulty, the map and the Custom JFK rules, the same ones the solo game is set up with. Validated once, frozen when play starts.
 */

const SHAPES = ['ring', 'infinity', 'rectangle', 'square', 'mountain'] as const;
const SIZES = ['small', 'medium', 'large'] as const;

function invalid(message: string): never {
  throw new TableCommandError('INVALID_SETTINGS', message);
}

function whole(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return invalid(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** Complete, valid settings from a host's input. Throws `TableCommandError('INVALID_SETTINGS')`. */
export function normalizeDreamSettings(
  input: DreamSettingsInput,
  characterCount: number,
): DreamTableSettings {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > TABLE_NAME_MAX) {
    invalid(`The table name must be 1 to ${TABLE_NAME_MAX} characters.`);
  }
  const visibility = input.visibility ?? 'public';
  if (visibility !== 'public' && visibility !== 'private') {
    invalid("visibility must be 'public' or 'private'.");
  }
  const maxSeats = whole(
    input.maxSeats ?? DREAM_DEFAULT_SEATS,
    'maxSeats',
    DREAM_TABLE_MIN_SEATS,
    DREAM_TABLE_SEAT_CEILING,
  );
  const difficulty = input.difficulty ?? 'medium';
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
    invalid("difficulty must be 'easy', 'medium' or 'hard'.");
  }
  const shape = input.shape ?? 'ring';
  if (!SHAPES.includes(shape)) invalid(`shape must be one of ${SHAPES.join(', ')}.`);
  const size = input.size ?? 'medium';
  if (!SIZES.includes(size)) invalid(`size must be one of ${SIZES.join(', ')}.`);
  const mode = input.mode ?? 'guided';
  if (!CUSTOM_RULE_PRESETS[mode]) invalid("mode must be 'free', 'guided' or 'strict'.");
  // a shared table cannot run in the open mode: any card of a stack could be picked
  if (mode === 'free') invalid("A table is played in 'guided' or 'strict' mode: the cards decide.");
  const customRules = normalizeCustomRules({
    ...CUSTOM_RULE_PRESETS[mode],
    ...(input.customRules ?? {}),
    mode,
    difficulty,
  });
  const professions = input.professions ?? 'duplicates';
  if (!['duplicates', 'unique', 'random'].includes(professions)) {
    invalid("professions must be 'duplicates', 'unique' or 'random'.");
  }
  if (professions === 'unique' && maxSeats > characterCount) {
    invalid(`Unique characters allow at most ${characterCount} seats.`);
  }
  const turnOrder = input.turnOrder ?? 'random';
  if (turnOrder !== 'random' && turnOrder !== 'seat') {
    invalid("turnOrder must be 'random' or 'seat'.");
  }
  const endCondition = input.endCondition ?? 'first-win';
  if (!['first-win', 'all-done', 'round-limit'].includes(endCondition)) {
    invalid("endCondition must be 'first-win', 'all-done' or 'round-limit'.");
  }
  let roundLimit: number | undefined;
  if (endCondition === 'round-limit') {
    roundLimit = whole(input.roundLimit, 'roundLimit', 1, 1000);
  } else if (input.roundLimit !== undefined) {
    invalid("roundLimit only goes with endCondition 'round-limit'.");
  }
  const pace = input.pace ?? 'normal';
  if (pace !== 'fast' && pace !== 'normal' && pace !== 'slow') {
    invalid("pace must be 'fast', 'normal' or 'slow'.");
  }
  return {
    name,
    visibility,
    maxSeats,
    difficulty,
    shape,
    size,
    mode,
    customRules,
    professions,
    turnOrder,
    clock: normalizeClock(input.clock),
    awayAfterTimeouts: whole(input.awayAfterTimeouts ?? 2, 'awayAfterTimeouts', 1, 20),
    endCondition,
    ...(roundLimit !== undefined ? { roundLimit } : {}),
    spectators: input.spectators ?? false,
    allowRewind: input.allowRewind ?? false,
    turnGate: input.turnGate ?? false,
    pace,
    showProgress: input.showProgress ?? true,
    ranked: input.ranked ?? false,
    leaveFreeRounds: whole(input.leaveFreeRounds ?? 0, 'leaveFreeRounds', 0, 1000),
  };
}
