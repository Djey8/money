import { legalActions as soloLegalActions } from '../legal-actions';
import { currentTurn } from '../turn';
import { canAnswerTrade, whyCannotOfferTrade } from './trade';
import type { Table, TableCommand } from './types';

/**
 * What one player may do at a table right now (todo/cashflow-multiplayer.md slice S3) - the command types the table would
 * accept from them, with a line for an agent or a tooltip. The UI enables its buttons from this and an agent plays only from
 * it, so both are held to the same rules the reducer enforces: nothing here is a second opinion, it asks the solo rules and the
 * table's own state the same questions the commands do.
 *
 * Selling is listed for everyone at any time a buyer's offer is open for them (a Market card or a stock price card somebody
 * drew); nothing else can be done out of turn except answering a trade offer and the host's pause.
 */

export type TableActionId = TableCommand['type'];

export interface TableLegalAction {
  action: TableActionId;
  description: string;
}

/** The solo moves that are also table moves. */
const MOVES = new Set([
  'roll',
  'draw_card',
  'buy_deal',
  'pay_doodad',
  'roll_decision',
  'pass_card',
  'bank_loan',
]);

export function tableLegalActions(table: Table, playerId: string): TableLegalAction[] {
  if (table.phase !== 'playing') return [];
  const me = table.players.find((p) => p.id === playerId);
  if (!me) return [];
  const actions: TableLegalAction[] = [];
  const add = (action: TableActionId, description: string) => actions.push({ action, description });

  // A paused game does nothing but wait for the host.
  if (table.clock.pausedAt !== null) {
    if (playerId === table.hostId)
      add('resume', 'Resume the game: everyone gets back the time that went by.');
    return actions;
  }
  if (me.away) add('back', 'Say you are here again: you play your own turns from now on.');
  if (me.status !== 'active' || !me.books || currentTurn(me.books.state).phase === 'over')
    return actions;

  const state = me.books.state;
  const myTurn = table.activePlayerId === playerId;
  const solo = soloLegalActions(state);

  if (myTurn) {
    for (const entry of solo) {
      if (MOVES.has(entry.action)) add(entry.action as TableActionId, entry.description);
    }
  }

  // Selling, for anyone with an offer open to them. A one-roll offer is closed by the solo rule once the player's own space is
  // settled; at a table it stays until their next roll, so the question is asked as if they were still deciding.
  const turn = currentTurn(state);
  const asking =
    turn.phase === 'roll' ? { ...state, turn: { ...turn, phase: 'decide' as const } } : state;
  if (soloLegalActions(asking).some((entry) => entry.action === 'sell_position')) {
    add(
      'sell_position',
      "Sell a position you hold into a buyer's offer that is open for you (a Market card or a stock price card someone drew).",
    );
  }

  // The card in hand can be offered to the other players; an offer can be answered.
  if (myTurn && whyCannotOfferTrade(table, playerId) === null) {
    add(
      'offer_trade',
      'Offer the Deal card in your hand to one player or to everyone at a price; they take it, or answer with a price of their own.',
    );
  }
  const offer = table.trade;
  if (offer && offer.sellerId === playerId) {
    add('withdraw_trade', 'Take your offer back.');
    if (offer.counters.length > 0) {
      add('accept_trade', 'Accept the price a buyer proposed (name the buyer).');
    }
  } else if (canAnswerTrade(table, playerId)) {
    add('accept_trade', `Take the card at the asking price.`);
    add('counter_trade', 'Propose another price for the card.');
    add('decline_trade', 'Turn the offer down.');
  }

  if (playerId === table.hostId)
    add('pause', 'Pause the game: the clock stops and nobody can move.');
  return actions;
}
