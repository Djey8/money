import {
  buyDealAction,
  drawCardAction,
  payDoodadAction,
  rollDecisionAction,
  sellPositionAction,
  type ActionDeps,
  type ActionPlan,
} from '../actions';
import { CLASSIC_RAT_RACE_BOARD } from '../board';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { emptyEffects } from '../effects';
import { endIfOver } from '../game-end';
import { playBankLoan } from '../loan';
import type { Rng } from '../rng';
import { whyCannotSkipCard } from '../rules';
import { currentTurn, playTurn, settleDecision } from '../turn';
import type { CashflowProfession } from '../types';
import { tableRng } from './table-rng';
import { TableCommandError, type Table, type TableCommand } from './types';

/**
 * One player's move at a table (todo/cashflow-multiplayer.md slice T3): the solo game's own moves, run over that player's own
 * books with the table's pile and the table's dice stream. Nothing here knows about turns or other players - that is
 * turns.ts. A move the solo rules refuse throws `ILLEGAL_MOVE` with the rule's own words and changes nothing.
 */

export type PlayDeps = Omit<ActionDeps, 'rng'>;

/** The commands that are a move over the player's books. */
export type MoveCommand = Extract<
  TableCommand,
  {
    type:
      | 'roll'
      | 'draw_card'
      | 'buy_deal'
      | 'pay_doodad'
      | 'roll_decision'
      | 'pass_card'
      | 'bank_loan'
      | 'sell_position';
  }
>;

const MOVE_TYPES = new Set([
  'roll',
  'draw_card',
  'buy_deal',
  'pay_doodad',
  'roll_decision',
  'pass_card',
  'bank_loan',
  'sell_position',
]);

export function isMoveCommand(command: TableCommand): command is MoveCommand {
  return MOVE_TYPES.has(command.type);
}

/** What a move does to the books: the effects in order, a settled card decision, and the end of the game when the books say so. */
export function applyPlan(books: GameBooks, plan: ActionPlan): GameBooks {
  let next = plan.effects.reduce(applyEffectsToBooks, books);
  if (plan.settle && currentTurn(next.state).phase === 'decide') {
    next = {
      ...next,
      state: settleDecision(next.state, 'done', next.subscriptions).state,
    };
  }
  return { ...next, state: endIfOver(next.state, next.subscriptions) };
}

/** The plan of one move, by the solo game's own functions. */
export function planMove(
  command: MoveCommand,
  books: GameBooks,
  deps: ActionDeps,
  profession: CashflowProfession,
): ActionPlan {
  switch (command.type) {
    case 'roll': {
      const turn = playTurn(
        books,
        { ...deps, board: CLASSIC_RAT_RACE_BOARD, profession, rng: deps.rng },
        { dice: command.dice },
      );
      return {
        effects: turn.effects,
        step: turn.step,
        result: {
          dice: turn.roll.dice,
          total: turn.roll.total,
          from: books.state.boardPosition,
          to: turn.move.to,
          landed: turn.move.landed.kind,
          paydays: turn.move.paydays + (turn.openingPayday ? 1 : 0),
          openingPayday: turn.openingPayday,
          autoLoansMinor: turn.autoLoansMinor,
        },
      };
    }
    case 'pass_card': {
      const refused = whyCannotSkipCard(books.state);
      if (refused) throw new Error(refused);
      const settled = settleDecision(books.state, 'passed', books.subscriptions);
      return { effects: [emptyEffects(settled.state, settled.step)] };
    }
    case 'draw_card':
      return drawCardAction(books, { deck: command.deck }, deps);
    case 'buy_deal':
      return buyDealAction(books, { cardId: command.cardId, quantity: command.quantity }, deps);
    case 'pay_doodad':
      return payDoodadAction(books, { cardId: command.cardId }, deps);
    case 'roll_decision':
      return rollDecisionAction(books, { title: command.title }, deps);
    case 'sell_position':
      return sellPositionAction(books, command.input, deps);
    case 'bank_loan':
      return { effects: [playBankLoan(books, command.amountMinor, deps)] };
  }
}

export interface PlayedMove {
  table: Table;
  plan: ActionPlan;
}

/**
 * Runs `make` over the player's books, lent the table's discard piles, with the table's dice stream; applies the plan to those
 * books and hands the piles and the stream back. The version is the command's job.
 */
export function runPlan(
  table: Table,
  playerId: string,
  make: (books: GameBooks, rng: Rng) => ActionPlan,
  options: { openOfferWindow?: boolean } = {},
): PlayedMove {
  const player = table.players.find((candidate) => candidate.id === playerId);
  if (!player?.books) {
    throw new TableCommandError('NOT_A_MEMBER', 'That player has no cards to play with yet.');
  }
  const stream = tableRng(table.rngState);
  const turn = player.books.state.turn;
  // A one-roll offer ("until the next roll") is closed by the solo rule the moment the player's own space is settled. At a table
  // an offer comes from someone else's card while the player waits for their turn, so it has to stay open until their next roll:
  // while selling, the offer window sees the player as still deciding (put back below).
  const lendWindow = options.openOfferWindow && turn !== undefined && turn.phase === 'roll';
  const lent: GameBooks = {
    ...player.books,
    state: {
      ...player.books.state,
      drawnCardIds: table.drawnCardIds,
      ...(lendWindow ? { turn: { ...turn, phase: 'decide' as const } } : {}),
    },
  };
  let plan: ActionPlan;
  try {
    plan = make(lent, stream.rng);
  } catch (error) {
    if (error instanceof TableCommandError) throw error;
    throw new TableCommandError('ILLEGAL_MOVE', (error as Error).message);
  }
  let books = applyPlan(lent, plan);
  if (lendWindow && books.state.turn?.phase === 'decide') {
    books = { ...books, state: { ...books.state, turn: { ...books.state.turn, phase: 'roll' } } };
  }
  return {
    plan,
    table: {
      ...table,
      drawnCardIds: books.state.drawnCardIds,
      rngState: stream.state(),
      players: table.players.map((candidate) =>
        candidate.id === playerId ? { ...candidate, books } : candidate,
      ),
    },
  };
}
