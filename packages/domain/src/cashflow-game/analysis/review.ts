import type { GameBooks } from '../books';
import { cashOnHandMinor } from '../cash';
import { executeDeal, type DealDeps } from '../deals';
import { fixedClock } from '../clock';
import { buyDealAction, type ActionDeps } from '../actions';
import { cardSeenBeforePass, type GameSnapshot } from '../history';
import { seededRng } from '../rng';
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
  /** True when the time budget ran out before every decision was judged; `unjudged` counts the ones left. */
  truncated: boolean;
  unjudged: number;
  /** The fewest and most simulated games any move was judged on (fewer when the time budget was tight). */
  rolloutsUsed: { min: number; max: number } | null;
  /** Decisions that could not be judged (the position could not be played on from). */
  skipped: number;
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

/** What buying a card needs when only its numbers matter: no words, a fixed day, no luck. */
const quietActionDeps: ActionDeps = {
  ...quietDeps,
  cards: {
    textFor: () => ({}),
    symbolFor: (symbol) => symbol,
    sharedText: () => '',
    groupName: (group) => group,
  },
  rng: seededRng(1),
};

function afterDone(books: GameBooks): GameBooks {
  if (currentTurn(books.state).phase !== 'decide') return books;
  return { ...books, state: settleDecision(books.state, 'done', books.subscriptions).state };
}

/** Both alternatives escape almost every time (a high salary): the chance cannot tell them apart, the speed can. */
const SATURATED_ESCAPE_RATE = 0.9;
/** Fewest simulated games per alternative worth judging a move on; below this the labels are noise. */
const MIN_ROLLOUTS = 20;

/**
 * The label for how much a move changed the chance to escape; a tie in the chance is broken by the time it saves.
 * When both alternatives nearly always escape (`saturated`) the chance carries no signal, and the rolls saved decide:
 * 15 or more is the best, 5 a good move, 5 lost an inaccuracy, 10 a mistake, 20 a blunder.
 */
export function labelMove(
  deltaEscape: number,
  deltaRolls: number | null,
  saturated = false,
): MoveLabel {
  if (saturated) {
    if (deltaRolls === null) return 'neutral';
    if (deltaRolls >= 15) return 'best';
    if (deltaRolls >= 5) return 'good';
    if (deltaRolls > -5) return 'neutral';
    if (deltaRolls > -10) return 'inaccuracy';
    if (deltaRolls > -20) return 'mistake';
    return 'blunder';
  }
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
  let skipped = 0;
  // the games per alternative the move being judged gets (scaled down to fit the time budget)
  let rolloutsNow = rollouts;
  let msPerRollout: number | null = null;
  let leastUsed = Infinity;
  let mostUsed = 0;
  const evaluate = (books: GameBooks): Evaluation =>
    evaluatePosition(books, {
      gameSets: options.gameSets,
      policy: options.policy,
      rollouts: rolloutsNow,
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
    // a position the policy cannot play on from (a card still waiting, a dice decision open) is not judged: one such
    // step must not cost the player the review of all the others
    let a: Evaluation;
    let b: Evaluation;
    const startedAt = Date.now();
    try {
      a = evaluate(taken);
      b = evaluate(other);
    } catch {
      skipped += 1;
      return;
    }
    const spent = (Date.now() - startedAt) / (2 * rolloutsNow);
    msPerRollout = msPerRollout === null ? spent : (msPerRollout + spent) / 2;
    leastUsed = Math.min(leastUsed, rolloutsNow);
    mostUsed = Math.max(mostUsed, rolloutsNow);
    const saturatedMove = Math.min(a.escapeRate, b.escapeRate) >= SATURATED_ESCAPE_RATE;
    const rollsTaken = a.turnsToEscape?.median ?? null;
    const rollsOther = b.turnsToEscape?.median ?? null;
    const delta = a.escapeRate - b.escapeRate;
    const saved = rollsTaken !== null && rollsOther !== null ? rollsOther - rollsTaken : null;
    moves.push({
      number: index + 1,
      round: entry(index).cashflowGame.round,
      kind,
      title,
      label: labelMove(delta, saved, saturatedMove),
      escapeChance: { taken: a.escapeRate, other: b.escapeRate, delta },
      rollsToEscape: { taken: rollsTaken, other: rollsOther },
      alternative,
      facts: factsOf(taken, title, card),
    });
  };

  // the Deal card that was drawn and then left at a step (not a share: it has no count to buy), if there was one
  const passedCardOf = (index: number) => {
    const seen = cardSeenBeforePass(stack, index);
    if (!seen) return null;
    const set = gameSet(stack[index].cashflowGame.gameSetId);
    const card = [...(set?.decks?.dealSmall ?? []), ...(set?.decks?.dealBig ?? [])].find(
      (candidate) => candidate.id === seen.cardId,
    );
    return card && card.assetKind !== 'share' ? card : null;
  };

  // a planned card that was neither bought nor passed with its card known (that pass is judged on its own)
  const isLeftPlan = (index: number): boolean => {
    const title = stack[index].step?.detail ?? '';
    const next = (offset: number) => stack[index + offset]?.step;
    const bought = [1, 2, 3].some(
      (offset) =>
        next(offset) && PURCHASES.has(next(offset)!.kind) && next(offset)!.detail === title,
    );
    const passedKnown = [1, 2, 3].some(
      (offset) => next(offset)?.kind === 'skipCard' && passedCardOf(index + offset) !== null,
    );
    return !bought && !passedKnown;
  };

  // the decisions there are to judge, so the time budget can be shared between them
  const isDecision = (index: number): boolean => {
    const step = stack[index].step;
    if (!step) return false;
    if (PURCHASES.has(step.kind)) return true;
    if (step.kind === 'skipCard') return passedCardOf(index) !== null;
    if (step.kind === 'planDeal') return isLeftPlan(index);
    return (
      (SALES.has(step.kind) && step.kind !== 'cardSale') ||
      step.kind === 'loanTaken' ||
      step.kind === 'loanRepaid'
    );
  };
  const decisionIndexes = stack.map((_, index) => index).filter(isDecision);
  let reached = 0;

  for (let index = 0; index < stack.length; index += 1) {
    const step = stack[index].step;
    if (!step) continue;
    const title = step.detail ?? '';
    if (isDecision(index)) {
      if (Date.now() >= deadline) break;
      reached += 1;
      const left = decisionIndexes.length - reached + 1;
      if (msPerRollout !== null && deadline !== Infinity) {
        const fits = Math.floor(
          (deadline - Date.now()) / left / (2 * Math.max(msPerRollout, 0.01)),
        );
        rolloutsNow = Math.max(MIN_ROLLOUTS, Math.min(rollouts, fits));
      }
    }

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
    } else if (step.kind === 'skipCard') {
      // a card that was drawn and left: judged against buying it
      const card = passedCardOf(index);
      if (card) {
        const before = booksOf(entry(index));
        let bought: GameBooks | null = null;
        try {
          const plan = buyDealAction(before, { cardId: card.id }, quietActionDeps);
          bought = afterDone(plan.effects.reduce(applyEffectsToBooks, before));
        } catch {
          // a deal that could not have been bought (no cash, even with the bank) was no decision to judge
        }
        if (bought) {
          judge(
            index,
            'passed-card',
            card.symbol ?? card.title,
            booksOf(entry(index + 1)),
            bought,
            'buying it',
            card,
          );
        }
      }
    } else if (step.kind === 'planDeal') {
      // a card that was planned and not bought within the next steps was left
      if (isLeftPlan(index) && index + 1 <= stack.length) {
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
        // a sale can be made with a card waiting on the space: both sides leave that card alone
        const before = booksOf(entry(index));
        judge(
          index,
          'sale',
          title,
          afterDone(booksOf(entry(index + 1))),
          afterDone(before),
          'keeping it',
        );
      }
    } else if (step.kind === 'loanTaken') {
      judge(
        index,
        'loan',
        'Bank loan',
        afterDone(booksOf(entry(index + 1))),
        afterDone(booksOf(entry(index))),
        'not borrowing',
      );
    } else if (step.kind === 'loanRepaid') {
      judge(
        index,
        'repayment',
        'Bank loan',
        afterDone(booksOf(entry(index + 1))),
        afterDone(booksOf(entry(index))),
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
  // how much a move mattered: the chance won or lost, and (the tie-break that carries a high salary) the rolls saved
  const effect = (move: ReviewedMove): number =>
    move.escapeChance.delta +
    (move.rollsToEscape.taken !== null && move.rollsToEscape.other !== null
      ? (move.rollsToEscape.other - move.rollsToEscape.taken) * 0.002
      : 0);
  const worst = moves
    .filter((move) => ['inaccuracy', 'mistake', 'blunder'].includes(move.label))
    .sort((a, b) => effect(a) - effect(b))[0];
  const top = moves
    .filter((move) => move.label === 'best' || move.label === 'good')
    .sort((a, b) => effect(b) - effect(a))[0];
  return {
    moves,
    turningPoint: worst ?? null,
    bestMove: top ?? null,
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
    truncated: reached < decisionIndexes.length,
    unjudged: Math.max(0, decisionIndexes.length - reached),
    rolloutsUsed: moves.length > 0 ? { min: leastUsed, max: mostUsed } : null,
    skipped,
    rollouts,
  };
}
