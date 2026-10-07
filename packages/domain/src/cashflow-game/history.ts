import { toMinorUnits } from '../money/minor-units';
import type { GameText } from './game-text';
import type { GameStep } from './steps';
import { gameTradeStep } from './trades';
import { initialCashflowGameState, type CashflowGameState } from './types';

/**
 * The game's history, undo and snapshots as pure functions (todo/cashflow-game-pro.md slice A2).
 *
 * A **snapshot** is a deep copy of everything the live game consists of - the unit both Undo and a saved game use (JFK,
 * 2026-10-04). The undo history is a list of them, one per step, taken *before* the step ran. Snapshots keep the
 * in-memory decimal amounts of the app's own entities ("schema 1": that is what saved games already store, and they must
 * keep loading); the rules read them only loosely, so the entity lists are typed as far as the history needs and no
 * further.
 */

/** How many past actions can be undone in a row - comfortably more than one play session needs. */
export const UNDO_STACK_LIMIT = 200;

/** A transaction as far as the History reads it. */
export interface SnapshotTransaction {
  category?: string;
  comment?: string;
}

/** Everything the live game consists of. The entity lists are the app's own, as stored (decimal amounts). */
export interface GameSnapshot {
  /** Which step this snapshot is the "before" of; absent on snapshots saved before history tracking. */
  step?: GameStep & { at: string };
  allTransactions: SnapshotTransaction[];
  allSubscriptions: unknown[];
  allGrowProjects: unknown[];
  allShares: unknown[];
  allInvestments: unknown[];
  allAssets: unknown[];
  liabilities: { tag: string; amount: number | string }[];
  allSmileProjects: unknown[];
  allFireEmergencies: unknown[];
  mojo: unknown;
  cashflowGame: CashflowGameState;
}

/** The parts of the live account the History reads to describe the newest step. */
export type LiveGameView = Pick<
  GameSnapshot,
  'cashflowGame' | 'liabilities' | 'allGrowProjects' | 'allTransactions'
>;

/** One line of the game's History, newest first - exactly one per undo step. */
export interface HistoryStep<T = SnapshotTransaction> {
  id: string;
  /** 1 for the first thing that happened in this game, counting up - stays the same when newer steps are undone. */
  number: number;
  kind: GameStep['kind'];
  detail: string;
  /** ISO timestamp of when the step was taken (empty for steps saved before history tracking). */
  at: string;
  /** What the step added to the books - e.g. a Payday's income and expense lines for the month. */
  transactions: T[];
  /** For a passed card: the Deal card that had been drawn before the player left it (absent when none was drawn). */
  cardId?: string;
}

/** The text a History line needs: the word "Round" for a Payday, and how an amount reads. */
export interface HistoryDeps {
  text: GameText;
  /** Formats an amount in minor units ("4.000 €"). */
  money: (amountMinor: number) => string;
}

// ── The undo stack ──────────────────────────────────────────────────────────────────────────────

/** A deep copy of everything that is part of the game: what a snapshot, an undo step and a saved game all hold. */
export function captureGameSnapshot<S extends GameSnapshot>(live: S): S {
  return JSON.parse(JSON.stringify(live)) as S;
}

/** A new stack with `snapshot` on top, the oldest dropped past `limit`. */
export function pushUndoSnapshot<S>(stack: S[], snapshot: S, limit = UNDO_STACK_LIMIT): S[] {
  const next = [...stack, snapshot];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Takes the newest `count` steps off the stack. `snapshot` is the oldest of them - how the game stood before they ran. */
export function popUndoSteps<S>(
  stack: S[],
  count: number,
): { snapshot: S | undefined; stack: S[] } {
  const taken = Math.min(Math.max(0, count), stack.length);
  if (taken === 0) return { snapshot: undefined, stack };
  return { snapshot: stack[stack.length - taken], stack: stack.slice(0, stack.length - taken) };
}

/**
 * A step from before the game was first saved knows nothing of its saved slot: restoring it keeps the slot the game has
 * now. Without a slot the snapshot is restored as it is.
 */
export function keepSavedSlot<S extends GameSnapshot>(
  snapshot: S,
  current: Pick<CashflowGameState, 'gameId' | 'gameName'>,
): S {
  if (!current.gameId) return snapshot;
  return {
    ...snapshot,
    cashflowGame: {
      ...snapshot.cashflowGame,
      gameId: current.gameId,
      gameName: current.gameName,
    },
  };
}

/** Whether a loaded snapshot has the shape of a game (a corrupt or foreign file must never replace a live game). */
export function isGameSnapshot(value: unknown): value is GameSnapshot {
  const snapshot = value as Partial<GameSnapshot> | null;
  return Boolean(
    snapshot &&
    [
      snapshot.allTransactions,
      snapshot.allSubscriptions,
      snapshot.allGrowProjects,
      snapshot.allShares,
      snapshot.allInvestments,
      snapshot.allAssets,
      snapshot.liabilities,
      snapshot.allSmileProjects,
      snapshot.allFireEmergencies,
    ].every(Array.isArray) &&
    snapshot.mojo &&
    snapshot.cashflowGame &&
    Array.isArray(snapshot.cashflowGame.gameSubscriptionTitles),
  );
}

/** What a reset leaves behind: every list empty, Mojo at zero, a fresh game state. */
export function blankGameData(): Omit<GameSnapshot, 'step'> {
  return {
    allTransactions: [],
    allSubscriptions: [],
    allGrowProjects: [],
    allShares: [],
    allInvestments: [],
    allAssets: [],
    liabilities: [],
    allSmileProjects: [],
    allFireEmergencies: [],
    mojo: { amount: 0, target: 0 },
    cashflowGame: initialCashflowGameState(),
  };
}

// ── The History list ────────────────────────────────────────────────────────────────────────────

/** The Bank loan's principal in a snapshot (0 when there is none). */
function bankLoan(snapshot: Pick<GameSnapshot, 'liabilities'>): number {
  const amount = snapshot.liabilities.find((liability) => liability.tag === 'Bank loan')?.amount;
  return Number(amount) || 0;
}

/**
 * Names a step from what it changed in the game: the state before it against the state after. Only for steps saved
 * before history tracking, which carry no name of their own.
 */
export function inferStep(
  before: Pick<
    GameSnapshot,
    'cashflowGame' | 'liabilities' | 'allGrowProjects' | 'allTransactions'
  >,
  after: LiveGameView,
  deps: HistoryDeps,
): GameStep {
  const was = before.cashflowGame;
  const now = after.cashflowGame;
  if (!was.professionId && now.professionId) return { kind: 'start' };
  if (was.professionId && !now.professionId) return { kind: 'reset' };
  if (now.round > was.round) {
    return { kind: 'payday', detail: `${deps.text('CashflowGame.Round')} ${now.round}` };
  }
  if (now.children > was.children) return { kind: 'baby' };
  if (now.charityRoundsLeft > was.charityRoundsLeft) return { kind: 'charity' };
  if (now.unemployedRoundsLeft > was.unemployedRoundsLeft) return { kind: 'downsized' };
  const loanChange = bankLoan(after) - bankLoan(before);
  if (loanChange !== 0) {
    return {
      kind: loanChange > 0 ? 'loanTaken' : 'loanRepaid',
      detail: deps.money(toMinorUnits(Math.abs(loanChange))),
    };
  }
  const added = after.allTransactions.slice(before.allTransactions.length);
  const last = added[added.length - 1];
  if (last?.category?.endsWith(' card sale')) {
    return { kind: 'cardSale', detail: last.category.replace(/^@| card sale$/g, '') };
  }
  if (last) return gameTradeStep(last.comment ?? '', last.category ?? '');
  if (after.allGrowProjects.length > before.allGrowProjects.length) return { kind: 'planDeal' };
  return { kind: 'transaction' };
}

/**
 * The Deal card the player had drawn when they passed (a `skipCard` step), or null when none was drawn. Drawing is not a
 * step of its own, but it is remembered: the deck's list of cards given out since its last shuffle grows by the drawn
 * card. So the card is whatever the Deal decks gained between the position before the roll that landed on the space and
 * the position before the pass - which is why a game that left a card unseen cannot say what it left.
 */
export function cardSeenBeforePass<
  S extends Pick<GameSnapshot, 'cashflowGame'> & { step?: GameStep },
>(stack: S[], index: number): { deck: 'dealSmall' | 'dealBig'; cardId: string } | null {
  if (stack[index]?.step?.kind !== 'skipCard') return null;
  let roll = index - 1;
  while (roll >= 0 && stack[roll].step?.kind !== 'roll') roll -= 1;
  if (roll < 0) return null;
  // drawing is no step, so the position before the roll is the last one that shows the decks as they were
  const beforeRoll = stack[roll].cashflowGame.drawnCardIds;
  const beforePass = stack[index].cashflowGame.drawnCardIds;
  let seen: { deck: 'dealSmall' | 'dealBig'; cardId: string } | null = null;
  for (const deck of ['dealSmall', 'dealBig'] as const) {
    const was = beforeRoll?.[deck] ?? [];
    const now = beforePass?.[deck] ?? [];
    const last = now[now.length - 1];
    // a longer list, or a reshuffle (a shorter one) that ends in another card
    if (last && (now.length !== was.length || last !== was[was.length - 1])) {
      seen = { deck, cardId: last };
    }
  }
  return seen;
}

/**
 * The game's History: one line per undo step, newest first (JFK, 2026-10-03: "each step to go backwards (undo) should be
 * on this list"). What each step added to the books is whatever the books gained between its snapshot and the next
 * one's - so a Payday lists its whole month, and nothing has to be recorded twice.
 */
export function historySteps<S extends GameSnapshot>(
  stack: S[],
  live: LiveGameView,
  deps: HistoryDeps,
): HistoryStep<S['allTransactions'][number]>[] {
  return stack
    .map((snapshot, index) => {
      const after: LiveGameView = index + 1 < stack.length ? stack[index + 1] : live;
      // Steps saved before history tracking carry no name: work it out from what changed.
      const step = snapshot.step ?? inferStep(snapshot, after, deps);
      const seen = cardSeenBeforePass(stack, index);
      return {
        id: `${snapshot.step?.at ?? 'saved'}-${index}`,
        number: index + 1,
        kind: step.kind,
        detail: step.detail ?? '',
        at: snapshot.step?.at ?? '',
        transactions: after.allTransactions.slice(snapshot.allTransactions.length),
        ...(seen ? { cardId: seen.cardId } : {}),
      };
    })
    .reverse() as HistoryStep<S['allTransactions'][number]>[];
}
