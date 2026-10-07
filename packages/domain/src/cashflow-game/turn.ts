import {
  moveToken,
  rollDice,
  diceAllowed,
  type DiceCount,
  type DiceRoll,
  type Move,
} from './movement';
import type { RatRaceBoard } from './board';
import { applyEffectsToBooks, type GameBooks } from './books';
import { clearCashflowStatus } from './engine';
import { playCharityPaying, playDownsizedPaying, type PaidWithLoan } from './auto-pay';
import { endIfOver } from './game-end';
import type { CardDeps } from './market-cards';
import { emptyEffects, type GameEffects } from './effects';
import { playBaby, playPayday, type RoundBooks } from './rounds';
import { systemRng, type Rng } from './rng';
import type { GameStep } from './steps';
import type {
  CashflowGameState,
  CashflowPendingDecision,
  CashflowProfession,
  CashflowSoloTurn,
} from './types';

/**
 * A solo turn (todo/cashflow-game-pro.md slice B3): roll, move, pay every Payday the token enters, resolve the space it
 * lands on. One roll is one undoable step - the caller takes one snapshot, then applies the effects in order. Playing
 * alone nobody else takes a turn, so nothing is skipped: Downsized's spanner is only a reminder and the next roll
 * removes it (JFK, 2026-10-05).
 */

export interface TurnRequest {
  /** One die or two; two only count while Charity runs. */
  dice?: DiceCount;
}

export interface TurnResult {
  /** The one History step for the whole roll, e.g. "4 + 3 -> space 7". */
  step: GameStep;
  /** What to apply, in order. Their own `step`s are dropped (the roll is the step); the last carries the new turn state. */
  effects: GameEffects[];
  state: CashflowGameState;
  roll: DiceRoll;
  move: Move;
  /** The first roll of a game also pays the opening Payday: it is what officially starts the game. */
  openingPayday: boolean;
  /** What the space's automatic bank loans lent, one entry each (Charity or Downsized with too little cash). */
  autoLoansMinor: number[];
}

/** What a turn rule needs on top of the books. */
export interface TurnDeps extends CardDeps {
  board: RatRaceBoard;
  profession: CashflowProfession;
  rng?: Rng;
}

/** The turn state of a solo game; a game without one is waiting for a roll. */
export function currentTurn(state: CashflowGameState): CashflowSoloTurn {
  return state.turn ?? { phase: 'roll', count: 0 };
}

/** Why a roll cannot be made now, or null when it can. */
export function whyCannotRoll(state: CashflowGameState): string | null {
  if (state.mode !== 'solo') return 'Rolling is only for a solo game.';
  if (!state.professionId) return 'Start a game first.';
  const phase = currentTurn(state).phase;
  if (phase === 'over') return 'The game is over.';
  if (phase === 'decide') return 'Deal with the card on this space first, or pass.';
  return null;
}

/** The round rules read a slimmer view of the books. */
function roundBooks(books: GameBooks): RoundBooks {
  return {
    state: books.state,
    subscriptions: books.subscriptions,
    transactions: books.transactions,
    growNotes: books.growProjects.map((project) => ({
      title: project.title,
      notes: project.notes,
    })),
  };
}

/** "maximum 3 children per player" (the printed Baby space). */
const MAX_CHILDREN = 3;

const CARD_SPACES = { deal: 'deal', market: 'market', doodad: 'doodad' } as const;

/**
 * Plays one turn. Throws when no roll can be made (see `whyCannotRoll`). A Payday is paid for every Payday space the
 * token enters - passed or landed on - before the landing space itself is resolved.
 */
export function playTurn(books: GameBooks, deps: TurnDeps, request: TurnRequest = {}): TurnResult {
  const cannot = whyCannotRoll(books.state);
  if (cannot) throw new Error(cannot);
  const rng = deps.rng ?? systemRng;
  const before = books.state;
  const turn = currentTurn(before);

  // The next roll continues from Downsized: the spanner goes.
  let state = before.unemployedRoundsLeft > 0 ? clearCashflowStatus(before, 'unemployed') : before;
  const count = diceAllowed(state.charityRoundsLeft, request.dice ?? 1);
  const roll = rollDice(count, rng);
  // Each roll under Charity uses up one of its three turns.
  if (state.charityRoundsLeft > 0)
    state = { ...state, charityRoundsLeft: state.charityRoundsLeft - 1 };
  const move = moveToken(deps.board, before.boardPosition, roll.total);

  let working: GameBooks = { ...books, state };
  const effects: GameEffects[] = [];
  const autoLoansMinor: number[] = [];
  const applyPaid = (paid: PaidWithLoan) => {
    paid.effects.forEach(apply);
    autoLoansMinor.push(...paid.loansMinor);
  };
  const apply = (next: GameEffects) => {
    effects.push({ ...next, step: null });
    working = applyEffectsToBooks(working, next);
  };

  // The first roll starts the game officially (JFK, 2026-10-06): the opening Payday is paid, on top of the savings the
  // game began with, before the token moves.
  const openingPayday = turn.count === 0;
  if (openingPayday) apply(playPayday(roundBooks(working), deps));
  for (let i = 0; i < move.paydays; i++) apply(playPayday(roundBooks(working), deps));

  let pending: CashflowPendingDecision | undefined;
  switch (move.landed.kind) {
    case 'baby':
      // The board's limit is 3 children: a fourth Baby space simply changes nothing.
      if (working.state.children < MAX_CHILDREN)
        apply(playBaby(roundBooks(working), deps.profession, deps));
      break;
    // Charity and Downsized pay cash: a short account takes the bank loan first, never goes negative.
    case 'charity':
      applyPaid(playCharityPaying(working, deps));
      break;
    case 'downsized':
      applyPaid(playDownsizedPaying(working, deps));
      break;
    case 'deal':
    case 'market':
    case 'doodad':
      pending = { kind: CARD_SPACES[move.landed.kind], spaceIndex: move.landed.index };
      break;
    case 'payday':
      break; // paid above, as one of the Paydays entered
  }

  const nextTurn: CashflowSoloTurn = {
    phase: pending ? 'decide' : 'roll',
    count: turn.count + 1,
    lastRoll: roll.dice,
    ...(pending ? { pending } : {}),
  };
  // A Payday or a landing can end the game: out of the rat race, or bankrupt.
  const finalState = endIfOver(
    { ...working.state, boardPosition: move.to, turn: nextTurn },
    working.subscriptions,
  );
  // The turn state rides on the last effect (or on one of its own when nothing else changed).
  if (effects.length === 0) effects.push(emptyEffects(finalState, null));
  else effects[effects.length - 1] = { ...effects[effects.length - 1], state: finalState };

  return {
    step: { kind: 'roll', detail: stepDetail(roll, move) },
    effects,
    state: finalState,
    roll,
    move,
    openingPayday,
    autoLoansMinor,
  };
}

function stepDetail(roll: DiceRoll, move: Move): string {
  const sum = roll.dice.length > 1 ? `${roll.dice.join(' + ')} = ${roll.total}` : `${roll.total}`;
  return `${sum} -> ${move.landed.kind} (${move.to})`;
}

export interface DecisionResult {
  state: CashflowGameState;
  /** Only passing is a step of its own; dealing with the card is the card action's own step. */
  step: GameStep | null;
}

/** Why the open card decision cannot be settled, or null when it can. */
export function whyCannotSettle(state: CashflowGameState): string | null {
  if (state.mode !== 'solo') return 'This is only for a solo game.';
  return currentTurn(state).phase === 'decide' ? null : 'There is no card to deal with.';
}

/**
 * Closes the turn's open card decision: `done` once the card was dealt with (its own steps are already in the history),
 * `passed` to leave it - a step of its own, so it can be undone. The next roll is open afterwards.
 */
export function settleDecision(
  state: CashflowGameState,
  how: 'done' | 'passed',
  subscriptions?: { title: string; amountMinor: number }[],
): DecisionResult {
  const cannot = whyCannotSettle(state);
  if (cannot) throw new Error(cannot);
  const turn = currentTurn(state);
  const rest: CashflowSoloTurn = { ...turn };
  delete rest.pending;
  return {
    // Dealing with the card may have changed the monthly picture: the end is checked when the books are given.
    state: subscriptions
      ? endIfOver({ ...state, turn: { ...rest, phase: 'roll' } }, subscriptions)
      : { ...state, turn: { ...rest, phase: 'roll' } },
    step: how === 'passed' ? { kind: 'skipCard', detail: turn.pending?.kind } : null,
  };
}
