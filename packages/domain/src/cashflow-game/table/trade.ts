import { buyDealAction } from '../actions';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { cashOnHandMinor } from '../cash';
import { sellCardToFriend } from '../deals';
import { emptyEffects, type GameEffects } from '../effects';
import { textOrFallback } from '../game-text';
import { planAutoLoan, playBankLoan } from '../loan';
import { nextOneOffDate, placeOneOffTransactions } from '../rounds';
import { currentTurn, settleDecision } from '../turn';
import type { CashflowDealCard } from '../types';
import { endIfOver } from '../game-end';
import { resetTimeouts, whyClockBlocks } from './clock';
import { applyPlan, type PlayDeps } from './play';
import { tableRng } from './table-rng';
import { settleTable } from './turns';
import {
  TableCommandError,
  type Table,
  type TableCommand,
  type TableEvent,
  type TableEventType,
  type TablePlayer,
  type TradeOffer,
} from './types';

/**
 * Trading the card in hand (todo/cashflow-multiplayer.md slice T7). The solo game's "sell to a friend", at a table: the player
 * on the move who holds a property or special-asset Deal card may offer it to one player or to everyone at a price. Another
 * player can take it at that price, or propose a different one which the seller may take; nothing moves until the price is
 * agreed, and then both players' books change at once - the seller is paid and their space is settled, the buyer pays the
 * price and buys the card on its normal terms (the Bank loan covers a short purse). Either side's refusal changes nothing.
 *
 * Shares are not tradable: a share card belongs to whoever drew it. An offer lives as long as the card is in the seller's hand
 * (`expireTrade`, run after every command); a timeout plays the seller's passive turn, which passes the card, so it never offers
 * or answers anything for anyone.
 */

export type TradeCommand = Extract<
  TableCommand,
  { type: 'offer_trade' | 'withdraw_trade' | 'counter_trade' | 'decline_trade' | 'accept_trade' }
>;

const TRADE_TYPES = new Set([
  'offer_trade',
  'withdraw_trade',
  'counter_trade',
  'decline_trade',
  'accept_trade',
]);

export function isTradeCommand(command: TableCommand): command is TradeCommand {
  return TRADE_TYPES.has(command.type);
}

export type TradeEmit = (
  type: TableEventType,
  playerId: string | null,
  data?: Record<string, unknown>,
) => unknown;

function refuse(message: string): never {
  throw new TableCommandError('ILLEGAL_MOVE', message);
}

const playerOf = (table: Table, id: string) => table.players.find((p) => p.id === id);
const inTheGame = (p: TablePlayer | undefined): p is TablePlayer & { books: GameBooks } =>
  p !== undefined &&
  p.status === 'active' &&
  p.books !== null &&
  currentTurn(p.books.state).phase !== 'over';

function whole(priceMinor: number): number {
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) {
    refuse('The price has to be a whole amount above zero.');
  }
  return priceMinor;
}

/** The card the seller is holding, if it can be traded. */
function cardInHand(
  table: Table,
  sellerId: string,
): { card: CashflowDealCard; deck: 'dealSmall' | 'dealBig' } {
  const seller = playerOf(table, sellerId);
  const pending = seller?.books?.state.turn?.pending;
  if (!pending || pending.kind !== 'deal' || !pending.offered) {
    refuse('You can only trade the Deal card you are holding on your space.');
  }
  const { offered } = pending as NonNullable<typeof pending> & {
    offered: NonNullable<typeof pending.offered>;
  };
  if (pending!.played || pending!.closed || pending!.purchased) {
    refuse('This card has been dealt with already.');
  }
  if (offered.deck !== 'dealSmall' && offered.deck !== 'dealBig')
    refuse('Only Deal cards can be traded.');
  const deck = offered.deck as 'dealSmall' | 'dealBig';
  const card = seller!.books!.gameSet?.decks?.[deck]?.find((c) => c.id === offered.cardId);
  if (!card) refuse('That card is not in this game.');
  if (card!.assetKind === 'share') {
    refuse('A share card belongs to whoever drew it - it cannot be sold to a friend.');
  }
  return { card: card as CashflowDealCard, deck };
}

/** Why the player cannot offer their card for trade right now, or null when they can. */
export function whyCannotOfferTrade(table: Table, sellerId: string): string | null {
  if (table.trade) return 'A card is on offer already.';
  try {
    cardInHand(table, sellerId);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/** Whether the player may answer the open offer (take it, counter it, turn it down). */
export function canAnswerTrade(table: Table, playerId: string): boolean {
  const offer = table.trade;
  if (!offer || playerId === offer.sellerId) return false;
  const player = playerOf(table, playerId);
  return (
    inTheGame(player) &&
    (offer.to === null || offer.to === playerId) &&
    !offer.declined.includes(playerId)
  );
}

/** Who may answer the offer: not the seller, in the game, named by the offer (or anyone), not someone who said no. */
function buyerOf(table: Table, offer: TradeOffer, buyerId: string) {
  const buyer = playerOf(table, buyerId);
  if (buyerId === offer.sellerId) refuse('You cannot trade with yourself.');
  if (!inTheGame(buyer)) refuse('You are not in the game.');
  if (offer.to !== null && offer.to !== buyerId) refuse('This offer is not for you.');
  if (offer.declined.includes(buyerId)) refuse('You turned this offer down.');
  return buyer as TablePlayer & { books: GameBooks };
}

/** What the buyer pays the seller: the price, after a Bank loan if the cash on hand falls short. */
function payForCard(
  books: GameBooks,
  priceMinor: number,
  name: string,
  deps: PlayDeps,
): GameEffects[] {
  const today = deps.clock.todayIso();
  const steps: GameEffects[] = [];
  let working = books;
  const plan = planAutoLoan({
    costMinor: priceMinor,
    cashMinor: cashOnHandMinor(books.transactions, books.allocation),
    financedMinor: 0,
    incrementMinor: books.gameSet?.loanRule.incrementMinor ?? 0,
  });
  if (plan.loanMinor > 0) {
    const loan = playBankLoan(books, plan.loanMinor, deps, {
      date: nextOneOffDate(books, today),
      mandatory: true,
    });
    loan.step = { kind: 'loanAuto', detail: deps.money(plan.loanMinor) };
    steps.push(loan);
    working = applyEffectsToBooks(working, loan);
  }
  const pay = emptyEffects(working.state, { kind: 'transaction', detail: `${name} card` });
  pay.appendedTransactions = placeOneOffTransactions(
    [
      {
        account: 'Fire',
        amountMinor: -priceMinor,
        date: '',
        time: '',
        category: `@${name} card purchase`,
        comment: `${textOrFallback(deps.text, 'CashflowGame.cardPurchaseComment', `Bought the ${name} card from a friend`)}\n#cashflow`,
      },
    ],
    working,
    today,
  );
  steps.push(pay);
  return steps;
}

/**
 * Both sides of an agreed trade, computed on copies. Throws (as `ILLEGAL_MOVE`) if either side cannot go through, before
 * anything has changed.
 */
function trade(
  table: Table,
  offer: TradeOffer,
  buyerId: string,
  priceMinor: number,
  deps: PlayDeps,
): { table: Table; buyResult: Record<string, unknown> } {
  const seller = playerOf(table, offer.sellerId) as TablePlayer & { books: GameBooks };
  const buyer = playerOf(table, buyerId) as TablePlayer & { books: GameBooks };
  const { card } = cardInHand(table, offer.sellerId);
  const name = card.symbol ?? card.title;
  const stream = tableRng(table.rngState);

  try {
    // The seller: paid, and the card is dealt with - their space is settled.
    let sBooks = applyEffectsToBooks(
      seller.books,
      sellCardToFriend(seller.books, card, priceMinor, undefined, deps),
    );
    const turn = currentTurn(sBooks.state);
    sBooks = {
      ...sBooks,
      state: {
        ...sBooks.state,
        turn: { ...turn, pending: { ...turn.pending!, played: true, closed: true } },
      },
    };
    sBooks = {
      ...sBooks,
      state: endIfOver(
        settleDecision(sBooks.state, 'done', sBooks.subscriptions).state,
        sBooks.subscriptions,
      ),
    };

    // The buyer: pays the seller, then buys the card on its normal terms as if it were theirs in hand.
    let bBooks = buyer.books;
    for (const step of payForCard(bBooks, priceMinor, name, deps)) {
      bBooks = applyEffectsToBooks(bBooks, step);
    }
    const before = bBooks.state.turn;
    const lent: GameBooks = {
      ...bBooks,
      state: {
        ...bBooks.state,
        turn: {
          ...(before ?? { count: 0 }),
          phase: 'decide',
          pending: {
            kind: 'deal',
            spaceIndex: turn.pending?.spaceIndex ?? 0,
            offered: { deck: offer.deck, cardId: offer.cardId },
          },
        },
      },
    };
    const plan = buyDealAction(lent, { cardId: offer.cardId }, { ...deps, rng: stream.rng });
    bBooks = applyPlan(lent, plan);
    // The buyer was not on a space: their own turn state comes back (unless the purchase ended their game).
    if (currentTurn(bBooks.state).phase !== 'over') {
      const restored = { ...bBooks.state };
      if (before) restored.turn = before;
      else delete restored.turn;
      bBooks = { ...bBooks, state: restored };
    }

    return {
      buyResult: { ...(plan.result ?? {}) },
      table: {
        ...table,
        rngState: stream.state(),
        trade: null,
        players: table.players.map((p) =>
          p.id === seller.id
            ? { ...p, books: sBooks }
            : p.id === buyer.id
              ? { ...p, books: bBooks }
              : p,
        ),
      },
    };
  } catch (error) {
    if (error instanceof TableCommandError) throw error;
    return refuse((error as Error).message);
  }
}

/** The trade commands. Returns the new table (version set) and its events. */
export function applyTradeCommand(
  table: Table,
  playerId: string,
  command: TradeCommand,
  version: number,
  now: number,
  deps: PlayDeps,
  makeEvent: (
    type: TableEventType,
    playerId: string | null,
    data?: Record<string, unknown>,
  ) => TableEvent,
): { table: Table; events: TableEvent[] } {
  if (table.phase !== 'playing') {
    throw new TableCommandError('WRONG_PHASE', 'The game is not being played now.');
  }
  const me = playerOf(table, playerId);
  if (!inTheGame(me)) refuse('You are not in the game.');
  const blocked = whyClockBlocks(table, now);
  if (blocked?.code === 'PAUSED') throw new TableCommandError('PAUSED', blocked.message);

  const events: TableEvent[] = [];
  const emit: TradeEmit = (type, who, data) => events.push(makeEvent(type, who, data));
  const name = (id: string) => playerOf(table, id)?.name as string;
  const offer = table.trade;
  const isSeller = offer?.sellerId === playerId;
  const done = (next: Table): { table: Table; events: TableEvent[] } => ({
    table: settleTable({ ...next, version }, emit, now),
    events,
  });

  switch (command.type) {
    case 'offer_trade': {
      if (table.activePlayerId !== playerId)
        throw new TableCommandError('NOT_YOUR_TURN', 'It is not your turn.');
      if (blocked) throw new TableCommandError(blocked.code, blocked.message);
      if (offer) refuse('A card is on offer already.');
      const { deck, card } = cardInHand(table, playerId);
      const priceMinor = whole(command.priceMinor);
      const to = command.to ?? null;
      if (to !== null) {
        if (to === playerId) refuse('You cannot trade with yourself.');
        if (!inTheGame(playerOf(table, to))) refuse('That player is not in the game.');
      }
      const next: TradeOffer = {
        sellerId: playerId,
        cardId: card.id,
        deck,
        to,
        priceMinor,
        counters: [],
        declined: [],
        at: now,
      };
      emit('trade_offered', playerId, {
        cardId: card.id,
        priceMinor,
        ...(to ? { to: name(to) } : {}),
      });
      // the card has been put to the table once: the seller's space remembers it (a bot never offers the same card twice)
      const marked = table.players.map((p) => {
        const turn = p.id === playerId && p.books ? p.books.state.turn : undefined;
        return turn?.pending && p.books
          ? {
              ...p,
              books: {
                ...p.books,
                state: {
                  ...p.books.state,
                  turn: { ...turn, pending: { ...turn.pending, tradeTried: true } },
                },
              },
            }
          : p;
      });
      return done(resetTimeouts({ ...table, players: marked, trade: next }, playerId));
    }

    case 'withdraw_trade': {
      if (!offer || !isSeller) refuse('You have no card on offer.');
      emit('trade_withdrawn', playerId, { cardId: offer!.cardId });
      return done({ ...table, trade: null });
    }

    case 'counter_trade': {
      if (!offer) refuse('There is no card on offer.');
      buyerOf(table, offer!, playerId);
      const priceMinor = whole(command.priceMinor);
      const counters = [
        ...offer!.counters.filter((c) => c.playerId !== playerId),
        { playerId, priceMinor },
      ];
      emit('trade_countered', playerId, { cardId: offer!.cardId, priceMinor });
      return done({ ...table, trade: { ...offer!, counters } });
    }

    case 'decline_trade': {
      if (!offer) refuse('There is no card on offer.');
      buyerOf(table, offer!, playerId);
      emit('trade_declined', playerId, { cardId: offer!.cardId });
      const declined = [...offer!.declined, playerId];
      // An offer to one player who says no is over; an offer to the table goes on for the others.
      const over = offer!.to === playerId;
      if (over) emit('trade_expired', offer!.sellerId, { cardId: offer!.cardId });
      return done({
        ...table,
        trade: over
          ? null
          : {
              ...offer!,
              declined,
              counters: offer!.counters.filter((c) => c.playerId !== playerId),
            },
      });
    }

    case 'accept_trade': {
      if (!offer) refuse('There is no card on offer.');
      let buyerId = playerId;
      let priceMinor = offer!.priceMinor;
      if (isSeller) {
        // The seller takes a buyer's proposed price.
        const counter = offer!.counters.find((c) => c.playerId === command.from);
        if (!counter) refuse('Name the buyer whose price you accept.');
        if (blocked) throw new TableCommandError(blocked.code, blocked.message);
        buyerId = counter!.playerId;
        priceMinor = counter!.priceMinor;
      }
      buyerOf(table, offer!, buyerId);
      const made = trade(table, offer!, buyerId, priceMinor, deps);
      emit('trade_made', offer!.sellerId, {
        cardId: offer!.cardId,
        priceMinor,
        with: name(buyerId),
      });
      emit('card_played', buyerId, { action: 'buy_deal', via: 'trade', ...made.buyResult });
      return done(isSeller ? resetTimeouts(made.table, playerId) : made.table);
    }
  }
}
