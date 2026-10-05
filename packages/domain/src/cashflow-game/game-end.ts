import { cashOnHandMinor } from './cash';
import type { GameBooks } from './books';
import { summarizeGameFinances, type CashflowFinanceSummary } from './saved-games';
import type { CashflowGameState, CashflowSoloTurn } from './types';

/**
 * How a solo game ends (todo/cashflow-game-pro.md slice B4). Fast Track is out of scope (JFK, 2026-10-05), so escaping
 * the rat race - passive income covering every monthly expense - ends the game, and so does going bankrupt - a negative
 * monthly cashflow. Both use the finance summary the dashboard and the games list already use, so a solo game, its saved
 * entry and the live view always agree.
 */

export type GameOutcome = 'playing' | 'escaped' | 'bankrupt';

/** How the books stand: still playing, escaped (checked first), or bankrupt. */
export function gameOutcome(
  state: Pick<CashflowGameState, 'gameSubscriptionTitles'>,
  subscriptions: { title: string; amountMinor: number }[],
): GameOutcome {
  const finances = summarizeGameFinances(state, subscriptions);
  if (finances.escapedRatRace) return 'escaped';
  if (finances.bankrupt) return 'bankrupt';
  return 'playing';
}

/**
 * The state with the game ended when the books say so; the same state when it goes on (or is already over). Call it
 * after anything that changes the monthly picture: a roll, a deal, a loan.
 */
export function endIfOver(
  state: CashflowGameState,
  subscriptions: { title: string; amountMinor: number }[],
): CashflowGameState {
  if (state.mode !== 'solo' || !state.professionId || state.turn?.phase === 'over') return state;
  const outcome = gameOutcome(state, subscriptions);
  if (outcome === 'playing') return state;
  const turn: CashflowSoloTurn = { ...(state.turn ?? { phase: 'roll', count: 0 }) };
  delete turn.pending;
  return { ...state, turn: { ...turn, phase: 'over', outcome } };
}

export interface FinalSummary {
  outcome: 'escaped' | 'bankrupt' | 'playing';
  round: number;
  turns: number;
  children: number;
  cashMinor: number;
  finances: CashflowFinanceSummary;
}

/** The game's closing numbers - what an agent reports and the games list keeps. */
export function finalSummary(books: GameBooks): FinalSummary {
  const finances = summarizeGameFinances(books.state, books.subscriptions);
  return {
    outcome: books.state.turn?.outcome ?? gameOutcome(books.state, books.subscriptions),
    round: books.state.round,
    turns: books.state.turn?.count ?? 0,
    children: books.state.children,
    cashMinor: cashOnHandMinor(books.transactions, books.allocation),
    finances,
  };
}
