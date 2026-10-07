import type { GameBooks } from '../books';
import { cashOnHandMinor } from '../cash';
import { executeDeal, type DealDeps } from '../deals';
import { fixedClock } from '../clock';
import type { GameSnapshot } from '../history';
import { identityText } from '../game-text';
import { summarizeGameFinances } from '../saved-games';
import type { GameStep } from '../steps';
import { currentTurn, settleDecision } from '../turn';
import type { CashflowGameSet } from '../types';
import { afterPass, evaluatePosition, type Evaluation } from '../simulation/evaluate';
import type { Policy } from '../simulation/policy';
import { applyEffectsToBooks } from '../books';
import { booksFromSnapshot } from './books-from-snapshot';

/**
 * The game analyst (todo/cashflow-game-analysis.md, E4): reads a game that was played - its undo history, one snapshot
 * per step, taken before the step - finds the decisions that mattered (what was bought, what was sold, what was borrowed
 * or repaid, a card that was planned and left), and judges each the way a chess review does: play the position after the
 * move, and the position after the alternative, many times each with the same dice, and compare how often the games
 * escape the rat race. The judgement is about the decision, not the luck: the dice after it are the same for both.
 */

export type MoveLabel = 'best' | 'good' | 'neutral' | 'inaccuracy' | 'mistake' | 'blunder';
export type MoveKind = 'purchase' | 'passed-card' | 'sale' | 'loan' | 'repayment';

export interface MoveFacts {
  title: string;
  depositMinor?: number;
  cashflowMinor?: number;
  /** Cashflow a month per unit of deposit (0.05 = 5% a month). */
  returnPerMonth?: number;
  /** What was in cash, and what was owed to the bank, once the move was done. */
  cashAfterMinor: number;
  bankLoanAfterMinor: number;
  monthlyCashflowAfterMinor: number;
  passiveIncomeAfterMinor: number;
}

export interface ReviewedMove {
  /** The history step number (1 = the start). */
  number: number;
  round: number;
  kind: MoveKind;
  title: string;
  label: MoveLabel;
  /** The chance to escape after the move that was made, after the alternative, and the difference (taken minus other). */
  escapeChance: { taken: number; other: number; delta: number };
  /** Median rolls still needed to escape, for both (null when too few games escaped). */
  rollsToEscape: { taken: number | null; other: number | null };
  /** What the alternative was, in words. */
  alternative: string;
  facts: MoveFacts;
}

export interface GameReview {
  moves: ReviewedMove[];
  /** The move that cost the most chance (null when no move cost a noticeable amount). */
  turningPoint: ReviewedMove | null;
  /** The move that helped the most. */
  bestMove: ReviewedMove | null;
  counts: Record<MoveLabel, number>;
  /** Where the game ended up. */
  final: {
    outcome: 'escaped' | 'bankrupt' | 'playing';
    round: number;
    rolls: number;
    passiveIncomeMinor: number;
    expensesMinor: number;
    monthlyCashflowMinor: number;
    cashMinor: number;
    children: number;
  };
  /** How many steps of the history there were, and how many were judged. */
  steps: number;
  judged: number;
  rollouts: number;
}

export interface ReviewOptions {
  gameSets: CashflowGameSet[];
  /** The strategy that plays on after each position - a good all-round one. */
  policy: Policy;
  /** Games per position (two positions per move). */
  rollouts?: number;
  horizon?: number;
  seedBase?: number;
  /** Stop judging after this long, in milliseconds; the moves judged so far are returned. */
  timeBudgetMs?: number;
}

/** An undo-history entry: the game as it stood before the step, and what the step was. */
export type ReviewEntry = Omit<GameSnapshot, 'step'> & { step?: GameStep & { at?: string } };

const PURCHASES = new Set(['buyDeal', 'buyShare', 'buyInvestment', 'buyAsset']);
const SALES = new Set(['sellShare', 'sellInvestment', 'sellAsset']);

const quietDeps: DealDeps = {
  clock: fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
  text: identityText,
  money: (minor) => `${minor / 100}`,
  plainMoney: (minor) => `${minor / 100}`,
};

function afterDone(books: GameBooks): GameBooks {
  if (currentTurn(books.state).phase !== 'decide') return books;
  return { ...books, state: settleDecision(books.state, 'done', books.subscriptions).state };
}

/** The label for how much a move changed the chance to escape; a tie in the chance is broken by the time it saves. */
export function labelMove(deltaEscape: number, deltaRolls: number | null): MoveLabel {
  if (deltaEscape >= 0.05) return 'best';
  if (deltaEscape >= 0.01) return 'good';
  if (deltaEscape > -0.01) {
    if (deltaRolls !== null && deltaRolls >= 10) return 'good';
    if (deltaRolls !== null && deltaRolls <= -10) return 'inaccuracy';
    return 'neutral';
  }
  if (deltaEscape > -0.05) return 'inaccuracy';
  if (deltaEscape > -0.12) return 'mistake';
  return 'blunder';
}

function factsOf(
  books: GameBooks,
  title: string,
  card?: { depositMinor?: number; cashflowMinor?: number },
): MoveFacts {
  const finances = summarizeGameFinances(books.state, books.subscriptions);
  const grow = books.growProjects.find((project) => project.title === title);
  const deposit = card?.depositMinor ?? grow?.investment?.depositMinor;
  const cashflow = card?.cashflowMinor ?? grow?.cashflowMinor;
  return {
    title,
    ...(deposit !== undefined ? { depositMinor: deposit } : {}),
    ...(cashflow !== undefined ? { cashflowMinor: cashflow } : {}),
    ...(deposit && cashflow ? { returnPerMonth: cashflow / deposit } : {}),
    cashAfterMinor: cashOnHandMinor(books.transactions, books.allocation),
    bankLoanAfterMinor: books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0,
    monthlyCashflowAfterMinor: finances.monthlyCashflowMinor,
    passiveIncomeAfterMinor: finances.passiveIncomeMinor,
  };
}

export function reviewGame(
  stack: ReviewEntry[],
  live: GameSnapshot,
  options: ReviewOptions,
): GameReview {
  const rollouts = options.rollouts ?? 100;
  const deadline = options.timeBudgetMs ? Date.now() + options.timeBudgetMs : Infinity;
  const gameSet = (id: string | null | undefined) =>
    options.gameSets.find((candidate) => candidate.id === id);
  const booksOf = (snapshot: ReviewEntry) =>
    booksFromSnapshot(snapshot, { gameSet: gameSet(snapshot.cashflowGame.gameSetId) });
  const entry = (index: number): ReviewEntry => stack[index] ?? live;

  const moves: ReviewedMove[] = [];
  const evaluate = (books: GameBooks): Evaluation =>
    evaluatePosition(books, {
      gameSets: options.gameSets,
      policy: options.policy,
      rollouts,
      horizon: options.horizon ?? 300,
      seedBase: options.seedBase ?? 1,
    });

  const judge = (
    index: number,
    kind: MoveKind,
    title: string,
    taken: GameBooks,
    other: GameBooks,
    alternative: string,
    card?: { depositMinor?: number; cashflowMinor?: number },
  ): void => {
    const a = evaluate(taken);
    const b = evaluate(other);
    const rollsTaken = a.turnsToEscape?.median ?? null;
    const rollsOther = b.turnsToEscape?.median ?? null;
    const delta = a.escapeRate - b.escapeRate;
    const saved = rollsTaken !== null && rollsOther !== null ? rollsOther - rollsTaken : null;
    moves.push({
      number: index + 1,
      round: entry(index).cashflowGame.round,
      kind,
      title,
      label: labelMove(delta, saved),
      escapeChance: { taken: a.escapeRate, other: b.escapeRate, delta },
      rollsToEscape: { taken: rollsTaken, other: rollsOther },
      alternative,
      facts: factsOf(taken, title, card),
    });
  };

  for (let index = 0; index < stack.length && Date.now() < deadline; index += 1) {
    const step = stack[index].step;
    if (!step) continue;
    const title = step.detail ?? '';

    if (PURCHASES.has(step.kind)) {
      // a purchase (an automatic loan step before it belongs to it)
      if (
        step.kind === 'buyDeal' ||
        step.kind === 'buyInvestment' ||
        step.kind === 'buyShare' ||
        step.kind === 'buyAsset'
      ) {
        const before = booksOf(entry(index));
        const after = booksOf(entry(index + 1));
        judge(index, 'purchase', title, afterDone(after), afterPass(before), 'not buying it');
      }
    } else if (step.kind === 'planDeal') {
      // a card that was planned and not bought within the next steps was left
      const bought = [1, 2, 3].some((offset) => {
        const next = stack[index + offset]?.step;
        return next && PURCHASES.has(next.kind) && next.detail === title;
      });
      if (!bought && index + 1 <= stack.length) {
        const planned = booksOf(entry(index + 1));
        try {
          const executed = executeDeal(planned, title, undefined, quietDeps);
          const bought = executed.steps.reduce(applyEffectsToBooks, planned);
          judge(index, 'passed-card', title, afterPass(planned), afterDone(bought), 'buying it');
        } catch {
          // a card that could not have been bought (a share with no count) is not judged
        }
      }
    } else if (SALES.has(step.kind) || step.kind === 'cardSale') {
      if (step.kind !== 'cardSale') {
        const before = booksOf(entry(index));
        judge(index, 'sale', title, booksOf(entry(index + 1)), before, 'keeping it');
      }
    } else if (step.kind === 'loanTaken') {
      judge(
        index,
        'loan',
        'Bank loan',
        booksOf(entry(index + 1)),
        booksOf(entry(index)),
        'not borrowing',
      );
    } else if (step.kind === 'loanRepaid') {
      judge(
        index,
        'repayment',
        'Bank loan',
        booksOf(entry(index + 1)),
        booksOf(entry(index)),
        'keeping the loan',
      );
    }
  }

  const finalBooks = booksOf(live);
  const finances = summarizeGameFinances(finalBooks.state, finalBooks.subscriptions);
  const turn = currentTurn(finalBooks.state);
  const counts: Record<MoveLabel, number> = {
    best: 0,
    good: 0,
    neutral: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  for (const move of moves) counts[move.label] += 1;
  const worst = [...moves].sort((a, b) => a.escapeChance.delta - b.escapeChance.delta)[0];
  const top = [...moves].sort((a, b) => b.escapeChance.delta - a.escapeChance.delta)[0];
  return {
    moves,
    turningPoint: worst && worst.escapeChance.delta <= -0.03 ? worst : null,
    bestMove: top && top.escapeChance.delta >= 0.03 ? top : null,
    counts,
    final: {
      outcome:
        turn.outcome ??
        (finances.escapedRatRace ? 'escaped' : finances.bankrupt ? 'bankrupt' : 'playing'),
      round: finalBooks.state.round,
      rolls: turn.count,
      passiveIncomeMinor: finances.passiveIncomeMinor,
      expensesMinor: finances.expensesMinor,
      monthlyCashflowMinor: finances.monthlyCashflowMinor,
      cashMinor: cashOnHandMinor(finalBooks.transactions, finalBooks.allocation),
      children: finalBooks.state.children,
    },
    steps: stack.length,
    judged: moves.length,
    rollouts,
  };
}
