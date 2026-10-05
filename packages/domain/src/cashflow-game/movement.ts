import { spaceAt, type RatRaceBoard, type RatRaceSpace } from './board';
import { rollDie, systemRng, type Rng } from './rng';

/**
 * Dice, movement and landing on the rat-race ring (todo/cashflow-game-pro.md slice B2). Pure: the token position goes in,
 * what the roll did comes out; B3 turns it into game steps.
 *
 * A token position is the ring index of the space it stands on, or `null` while it is still at START - just before
 * space 0, so the first roll of n lands on space n - 1 (JFK, 2026-10-05).
 */

export type TokenPosition = number | null;

/** How many dice the player rolls: one, or two while Charity lasts (they choose each turn). */
export type DiceCount = 1 | 2;

export interface DiceRoll {
  dice: number[];
  total: number;
}

export interface Move {
  from: TokenPosition;
  to: number;
  steps: number;
  /** Every space the token enters, in order - the last one is where it lands. */
  entered: RatRaceSpace[];
  landed: RatRaceSpace;
  /** Payday spaces entered, landing included: each one pays once, whether the token passes it or stops on it. */
  paydays: number;
  /** Payday spaces passed on the way, without the landing one. */
  passedPaydays: number;
  landedOnPayday: boolean;
}

/** How many dice may be rolled this turn: always one, unless Charity is running and the player chose two. */
export function diceAllowed(charityRoundsLeft: number, wanted: DiceCount = 1): DiceCount {
  return charityRoundsLeft > 0 ? wanted : 1;
}

/** Rolls the dice for a turn. */
export function rollDice(count: DiceCount, rng: Rng = systemRng): DiceRoll {
  const dice = Array.from({ length: count }, () => rollDie(rng));
  return { dice, total: dice.reduce((sum, die) => sum + die, 0) };
}

/** Moves the token `steps` spaces clockwise (wrapping round the ring) and says what it entered and where it landed. */
export function moveToken(board: RatRaceBoard, from: TokenPosition, steps: number): Move {
  if (!Number.isInteger(steps) || steps < 1) throw new Error('A move is at least one space.');
  const first = from === null ? 0 : from + 1;
  const entered = Array.from({ length: steps }, (_, step) => spaceAt(board, first + step));
  const landed = entered[entered.length - 1];
  const paydays = entered.filter((space) => space.kind === 'payday').length;
  const landedOnPayday = landed.kind === 'payday';
  return {
    from,
    to: landed.index,
    steps,
    entered,
    landed,
    paydays,
    passedPaydays: paydays - (landedOnPayday ? 1 : 0),
    landedOnPayday,
  };
}
