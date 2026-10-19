import { legalActions as soloLegalActions } from '../legal-actions';
import { openDecisions } from '../asset-deals';
import { currentTurn } from '../turn';
import { payableLiabilities } from '../liability-payoff';
import { BANK_LOAN_TAG } from '../loan';
import { whyPaymentPending } from '../rules';
import { canSellNow } from './sell-check';
import { undoVoters } from './undo-vote';
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
  'pay_market',
  'roll_decision',
  'pass_card',
  'bank_loan',
]);

const canVoteOnUndo = (table: Table, playerId: string) => undoVoters(table).includes(playerId);

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
  else if (me.status === 'active' && table.phase === 'playing') {
    add(
      'away',
      'Go away: your turns are played passively (like running out of the clock) so the others never wait for you.',
    );
  }
  if (me.status !== 'active' || !me.books || currentTurn(me.books.state).phase === 'over')
    return actions;

  const state = me.books.state;
  const myTurn = table.activePlayerId === playerId;
  const solo = soloLegalActions(state);

  // The turn is over and the table waits for the players who can still sell: they say "done" (turns.ts, the hold).
  const hold = table.hold ?? null;
  // a card with a die to roll (Multi-Level-Marketing ...) is rolled before the turn can end
  const dieWaiting = myTurn && openDecisions(state).length > 0;
  if (hold?.playerIds.includes(playerId) && !dieWaiting) {
    add('done', 'Say you are done: the next turn waits for everyone who can still sell.');
  }

  // Undoing the last turn is the table's vote: anyone here may ask, and everyone here may answer.
  if (table.settings.allowRewind && canVoteOnUndo(table, playerId)) {
    if (!table.undoVote)
      add(
        'propose_undo',
        'Ask the table to go back one turn: it happens when more than half of the people say yes.',
      );
    else if (!table.undoVote.yes.includes(playerId) && !table.undoVote.no.includes(playerId)) {
      add('vote_undo', 'Vote yes or no (yes: true / false) on going back one turn.');
    }
  }

  // the bank stays open while the turn waits for everybody to continue, as it does between two rolls of the solo game
  if (myTurn && hold) {
    for (const entry of solo) {
      if (entry.action === 'bank_loan' || entry.action === 'roll_decision') {
        add(entry.action, entry.description);
      }
    }
  }

  if (myTurn && !hold) {
    const inPlay = !!currentTurn(state).pending?.played;
    for (const entry of solo) {
      // a card that was played (planned, sold to a friend) is only bought through its plan or ticked off
      if (inPlay && entry.action === 'buy_deal') continue;
      if (MOVES.has(entry.action)) add(entry.action as TableActionId, entry.description);
      // The solo game's two steps for a Deal card: plan it (Grow), then buy the plan - or tick it off.
      if (entry.action === 'buy_deal') {
        add(
          'plan_deal',
          'Plan the Deal card in hand as a Grow project (nothing is paid yet), as the solo game does.',
        );
      }
    }
    const pending = currentTurn(state).pending;
    if (
      pending?.kind === 'deal' &&
      pending.played &&
      pending.offered?.title &&
      !pending.purchased
    ) {
      add(
        'buy_planned',
        'Buy the project the card in hand became (the Grow Buy button): shares with their quantity, a property or an asset.',
      );
    }
    // a cost card the player drew: it is paid before anything else (the table waits for it, like a Doodad)
    if (pending?.kind === 'market' && pending.paymentDue && pending.offered && !pending.played) {
      add(
        'pay_market',
        'Pay the cost of the Market card in hand (from Fire, on your first property; a Bank loan is taken first when cash is short).',
      );
    }
    if (pending?.played && !whyPaymentPending(state)) {
      add(
        'finish_card',
        'Tick off the card you played: the space is settled and the next roll is open.',
      );
    }
  }

  // Selling, for anyone with an offer open to them (see canSellNow).
  if (canSellNow(table, playerId)) {
    add(
      'sell_position',
      "Sell a position you hold into a buyer's offer that is open for you (a Market card or a stock price card someone drew).",
    );
  }

  // Paying the bank back is open at any time when the table allows it (a negative amountMinor); borrowing stays in the player's turn.
  if (
    table.settings.repayOffTurn !== false &&
    !actions.some((a) => a.action === 'bank_loan') &&
    (me.books.liabilities ?? []).some(
      (liability) => liability.tag === BANK_LOAN_TAG && liability.amountMinor > 0,
    )
  ) {
    add(
      'bank_loan',
      'Repay the bank loan at any time (amountMinor negative); borrowing is only in your own turn.',
    );
  }

  // A debt (mortgage, car loan, credit card ...) paid off in one payment: in your own turn, or any time when the table allows it.
  if (
    (myTurn || table.settings.repayOffTurn !== false) &&
    payableLiabilities(me.books).length > 0 &&
    !(myTurn && hold)
  ) {
    add(
      'pay_liability',
      'Pay one liability off in one payment of the full amount (tag): its monthly expense ends. Short of cash a Bank loan is taken first, unless that would leave your monthly cashflow negative.',
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
