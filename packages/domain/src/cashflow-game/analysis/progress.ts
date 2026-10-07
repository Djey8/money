import { summarizeGameFinances } from '../saved-games';
import type { CashflowGameSet } from '../types';
import { booksFromSnapshot } from './books-from-snapshot';
import type { ReviewEntry } from './review';
import type { GameSnapshot } from '../history';

/**
 * Where a game stood on the way to the exit (JFK, 2026-10-07: "more statistics, so the analyst has more background").
 * The card lab (`scripts/card-lab.js`) played thousands of whole games and recorded, at roll 10, 20, 30, 40 and 60, how far
 * passive income had got toward the expenses and how those games ended. This reads the same figure off a game that was
 * played, and says what became of games that stood there.
 */

/** Per "strategy|roll": five bands (passive income under 5%, 5-10%, 10-20%, 20-40%, 40%+ of the expenses): games, escaped, bankrupt. */
export type ProgressBands = Record<string, { games: number; escaped: number; bankrupt: number }[]>;

export interface ReviewProgressPoint {
  /** The roll the game is read at. */
  roll: number;
  /** Passive income as a share of the expenses at that roll (1 is the exit). */
  passiveShare: number;
  /** 0: under 5%, 1: 5-10%, 2: 10-20%, 3: 20-40%, 4: 40% or more. */
  band: 0 | 1 | 2 | 3 | 4;
  /** How many lab games stood in the same band at this roll, and how they ended. */
  games: number;
  escapeChance: number;
  bankruptChance: number;
}

export const PROGRESS_ROLLS = [10, 20, 30, 40, 60];
const MIN_GAMES = 20;

export const bandOf = (share: number): 0 | 1 | 2 | 3 | 4 =>
  share < 0.05 ? 0 : share < 0.1 ? 1 : share < 0.2 ? 2 : share < 0.4 ? 3 : 4;

export const BAND_NAMES = ['under 5%', '5-10%', '10-20%', '20-40%', '40% or more'];

/**
 * The game read at each of the lab's rolls it got to: the first position at or after that roll. Rolls the lab has no
 * games for (or too few) are left out - a figure from a handful of games would only look sure.
 */
export function progressPoints(
  stack: ReviewEntry[],
  live: GameSnapshot,
  options: { gameSets: CashflowGameSet[]; bands: ProgressBands; strategy?: string },
): ReviewProgressPoint[] {
  const strategy = options.strategy ?? 'all-rounder';
  const positions: (ReviewEntry | GameSnapshot)[] = [...stack, live];
  const rolled = (position: ReviewEntry | GameSnapshot): number =>
    position.cashflowGame.turn?.count ?? 0;
  const points: ReviewProgressPoint[] = [];
  for (const roll of PROGRESS_ROLLS) {
    const position = positions.find((candidate) => rolled(candidate) >= roll);
    if (!position) continue;
    const gameSet = options.gameSets.find(
      (candidate) => candidate.id === position.cashflowGame.gameSetId,
    );
    const books = booksFromSnapshot(position as ReviewEntry, { gameSet });
    const finances = summarizeGameFinances(books.state, books.subscriptions);
    if (finances.expensesMinor <= 0) continue;
    const passiveShare = finances.passiveIncomeMinor / finances.expensesMinor;
    const band = bandOf(passiveShare);
    const slot = options.bands[`${strategy}|${roll}`]?.[band];
    if (!slot || slot.games < MIN_GAMES) continue;
    points.push({
      roll,
      passiveShare,
      band,
      games: slot.games,
      escapeChance: slot.escaped / slot.games,
      bankruptChance: slot.bankrupt / slot.games,
    });
  }
  return points;
}

const pct = (value: number): string => `${Math.round(value * 100)}%`;

/** The progress in words, to follow the review: where the game stood, and how games that stood there ended. */
export function describeProgress(points: ReviewProgressPoint[]): string {
  if (points.length === 0) return '';
  const lines = ['', '**On the way to the exit**', ''];
  for (const point of points) {
    lines.push(
      `- Roll ${point.roll}: passive income covered ${pct(point.passiveShare)} of the expenses. Of ${point.games} simulated games that stood at ${BAND_NAMES[point.band]} at that roll, ${pct(point.escapeChance)} escaped and ${pct(point.bankruptChance)} went bankrupt.`,
    );
  }
  return lines.join('\n');
}
