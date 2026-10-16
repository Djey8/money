'use strict';

/**
 * The quickest legal move for the player on the move, from a table view as the API serves it: roll, then pass the card of the
 * space - except a Doodad, which nobody can pass at a table: draw it and pay it. Used by the tests that only need a table to get
 * through its turns.
 */
function quickMove(current) {
  const legal = current.legalActions.map((a) => a.action);
  const seat = current.table.activeSeat;
  const books = seat === null ? null : current.table.players[seat].books;
  const pending = books && books.state.turn && books.state.turn.pending;
  if (pending && pending.kind === 'doodad') {
    return pending.offered
      ? { type: 'pay_doodad', cardId: pending.offered.cardId }
      : { type: 'draw_card', deck: 'doodad' };
  }
  if (legal.includes('pass_card')) return { type: 'pass_card' };
  if (legal.includes('roll_decision')) return { type: 'roll_decision' };
  return { type: 'roll' };
}

module.exports = { quickMove };
