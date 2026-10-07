import type { GameBooks } from '../books';
import { currentTurn, settleDecision } from '../turn';
import type { CashflowGameSet } from '../types';
import type { Policy } from './policy';
import { SimGame, type GameRecord } from './session';
import { spreadOf, wilsonInterval, type Spread } from './stats';

/**
 * The position evaluator (todo/cashflow-game-analysis.md, E3): how good is this position? Play it out many times - the
 * same rules, a baseline strategy for the decisions to come, different dice each time - and count how the games end. A
 * chess engine searches a tree; with dice the honest answer is a distribution, and this is it.
 *
 * Two positions are compared on the **same seeds** (common random numbers): the dice that favour one favour the other, so
 * the difference between them is far less noisy than either figure alone.
 */

export interface Evaluation {
  games: number;
  /** Share of the games that escape the rat race / go bankrupt / have not ended at the roll limit. */
  escapeRate: number;
  bankruptRate: number;
  timeoutRate: number;
  /** 95% intervals for the escape rate. */
  escapeInterval: { low: number; high: number };
  /** Further rolls until the escape, among the games that escape. */
  turnsToEscape: Spread | null;
  /** Passive income at the end of the game, over all games. */
  passiveIncomeMinor: Spread | null;
}

export interface EvaluateOptions {
  gameSets: CashflowGameSet[];
  policy: Policy;
  /** How many games to play out. */
  rollouts: number;
  /** The first seed; the others follow it. */
  seedBase?: number;
  /** Rolls after which a game is called a timeout, counted from the position. */
  horizon?: number;
}

/**
 * A game played with a physical board (companion mode) has no token or dice of its own; to play it on, the position is
 * continued as a solo game from its books: the token at START, the opening Payday already behind it.
 */
export function asSoloPosition(books: GameBooks): GameBooks {
  if (books.state.mode === 'solo') return books;
  return {
    ...books,
    state: {
      ...books.state,
      mode: 'solo',
      boardPosition: null,
      turn: { phase: 'roll', count: 1 },
    },
  };
}

export function evaluatePosition(position: GameBooks, options: EvaluateOptions): Evaluation {
  const books = asSoloPosition(position);
  const gameSetId = books.state.gameSetId;
  const professionId = books.state.professionId;
  if (!gameSetId || !professionId) throw new Error('A position needs a running game.');
  const start = currentTurn(books.state).count;
  const records: GameRecord[] = [];
  for (let index = 0; index < options.rollouts; index += 1) {
    records.push(
      new SimGame({
        gameSets: options.gameSets,
        gameSetId,
        professionId,
        policy: options.policy,
        seed: (options.seedBase ?? 1) + index,
        maxTurns: start + (options.horizon ?? 300),
        from: books,
      }).play(),
    );
  }
  const escaped = records.filter((record) => record.outcome === 'escaped');
  const games = records.length;
  return {
    games,
    escapeRate: escaped.length / games,
    bankruptRate: records.filter((record) => record.outcome === 'bankrupt').length / games,
    timeoutRate: records.filter((record) => record.outcome === 'timeout').length / games,
    escapeInterval: wilsonInterval(escaped.length, games),
    turnsToEscape: spreadOf(escaped.map((record) => record.turns - start)),
    passiveIncomeMinor: spreadOf(records.map((record) => record.passiveIncomeMinor)),
  };
}

/** The position after an open card is left unplayed - what "pass" would have led to. */
export function afterPass(books: GameBooks): GameBooks {
  if (currentTurn(books.state).phase !== 'decide') return books;
  return {
    ...books,
    state: settleDecision(books.state, 'passed', books.subscriptions).state,
  };
}

/** One number for how much better `a` is than `b`: the gain in the chance to escape, in percentage points of probability. */
export function advantage(
  a: Evaluation,
  b: Evaluation,
): { escapeRate: number; turns: number | null } {
  const turnsA = a.turnsToEscape?.median;
  const turnsB = b.turnsToEscape?.median;
  return {
    escapeRate: a.escapeRate - b.escapeRate,
    turns: turnsA !== undefined && turnsB !== undefined ? turnsB - turnsA : null,
  };
}
