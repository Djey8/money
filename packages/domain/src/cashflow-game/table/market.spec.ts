import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { buyDealAction } from '../actions';
import { cashOnHandMinor } from '../cash';
import { seededRng } from '../rng';
import type { CashflowDealCard, CashflowDeckKind, CashflowMarketCard } from '../types';
import { applyPlan } from './play';
import { applyCommand, applyTimeout, createTable } from './reducer';
import { tableLegalActions } from './legal';
import { nextPassiveCommand } from './passive';
import { canSellNow, mustConfirmOffer } from './sell-check';
import { deepFreeze, testContext } from './testing';
import {
  TableCommandError,
  type Table,
  type TableCommand,
  type TableEvent,
  type TableErrorCode,
} from './types';

const ctx = testContext;
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const dealCards = [...CLASSIC.decks!.dealSmall!, ...CLASSIC.decks!.dealBig!];
const marketCards = CLASSIC.decks!.market!;

const efh = dealCards.find((c) => c.id === 'classic-small-efh-45k-2k')!;
const shareCards = (symbol: string) =>
  (dealCards as CashflowDealCard[])
    .filter((c) => c.assetKind === 'share' && c.symbol === symbol)
    .sort((a, b) => (a.priceMinor ?? 0) - (b.priceMinor ?? 0));
const marketCard = (id: string) => marketCards.find((c) => c.id === id)! as CashflowMarketCard;

function expectError(fn: () => unknown, code: TableErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TableCommandError);
    expect((error as TableCommandError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}, nothing was thrown`);
}

function playingTable(settings: object = {}, players = 3, seed = 3): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 8, ...settings },
      seed,
    },
    ctx,
  ).table;
  const steps: [string, TableCommand][] = [];
  for (let i = 1; i < players; i += 1) {
    steps.push(
      [`p${i}`, { type: 'join', name: `P${i}` }],
      [`p${i}`, { type: 'set_ready', ready: true }],
    );
  }
  steps.push(['host', { type: 'start' }]);
  for (const [who, command] of steps) table = applyCommand(table, who, command, ctx).table;
  return table;
}

const player = (table: Table, id: string) => table.players.find((p) => p.id === id)!;
const booksOf = (table: Table, id: string) => player(table, id).books!;
const types = (events: TableEvent[]) => events.map((e) => e.type);

/** Gives a player a Deal card's position the way the game would (drawn, then bought), without playing the turns. */
function owns(table: Table, playerId: string, card: CashflowDealCard, quantity?: number): Table {
  const deck: CashflowDeckKind = CLASSIC.decks!.dealSmall!.some((c) => c.id === card.id)
    ? 'dealSmall'
    : 'dealBig';
  const before = booksOf(table, playerId);
  const turn = before.state.turn!;
  const deciding = {
    ...before,
    state: {
      ...before.state,
      turn: {
        ...turn,
        phase: 'decide' as const,
        pending: { kind: 'deal' as const, spaceIndex: 0, offered: { deck, cardId: card.id } },
      },
    },
  };
  const plan = buyDealAction(
    deciding,
    { cardId: card.id, quantity },
    { ...ctx, rng: seededRng(1) },
  );
  const bought = applyPlan(deciding, plan);
  const books = {
    ...bought,
    state: { ...bought.state, turn: { phase: 'roll' as const, count: 1 } },
  };
  return {
    ...table,
    players: table.players.map((p) => (p.id === playerId ? { ...p, books } : p)),
  };
}

/** Leaves exactly one card in a deck's pile, so the next draw is that card. */
function stack(table: Table, deck: 'market' | 'dealSmall' | 'dealBig', cardId: string): Table {
  const ids = (CLASSIC.decks![deck] as { id: string }[])
    .map((c) => c.id)
    .filter((id) => id !== cardId);
  return { ...table, drawnCardIds: { ...table.drawnCardIds, [deck]: ids } };
}

/** The active player stands on a card space and has rolled. */
function onCardSpace(table: Table, kind: 'deal' | 'market'): Table {
  const who = table.activePlayerId!;
  const books = booksOf(table, who);
  return {
    ...table,
    turnRolled: true,
    players: table.players.map((p) =>
      p.id === who
        ? {
            ...p,
            books: {
              ...books,
              state: {
                ...books.state,
                turn: { phase: 'decide', count: 1, pending: { kind, spaceIndex: 7 } },
              },
            },
          }
        : p,
    ),
  };
}

/** Opens `cardId` from `deck` as the active player: a Market card takes effect for everybody, and waits in hand to be ticked off. */
function open(table: Table, deck: 'market' | 'dealSmall' | 'dealBig', cardId: string) {
  const ready = onCardSpace(stack(table, deck, cardId), deck === 'market' ? 'market' : 'deal');
  return applyCommand(ready, ready.activePlayerId!, { type: 'draw_card', deck }, ctx);
}

/** Draws `cardId` and - for a Market card - ticks it off, as the player does: the drawer's turn is then over. */
function draw(table: Table, deck: 'market' | 'dealSmall' | 'dealBig', cardId: string) {
  const opened = open(table, deck, cardId);
  if (deck !== 'market') return opened;
  const who = table.activePlayerId!;
  const done = applyCommand(opened.table, who, { type: 'finish_card' }, ctx);
  return { table: done.table, events: [...opened.events, ...done.events] };
}

const effectsOf = (events: TableEvent[]) => events.filter((e) => e.type === 'market_effect');
const offersOf = (table: Table, id: string) => booksOf(table, id).state.marketOffers ?? [];

describe('a buyer card is for the whole table', () => {
  const card = marketCard('classic-market-efh-pct20-a');

  it('makes an offer to every player who owns that kind of property, whoever drew it', () => {
    let table = playingTable();
    table = owns(owns(table, 'p1', efh), 'p2', efh);
    const before = booksOf(table, 'p1').state.marketOffers;
    expect(before ?? []).toEqual([]);

    const drawn = draw(table, 'market', card.id);
    expect(types(drawn.events)).toEqual(
      expect.arrayContaining(['card_drawn', 'market_card_played', 'market_effect', 'turn_started']),
    );
    expect(drawn.events.find((e) => e.type === 'market_card_played')).toMatchObject({
      playerId: 'host',
      data: { cardId: card.id, kind: 'buyer' },
    });
    // p1 and p2 got an offer; the drawer (who owns nothing) only has the card's own entry
    const effects = effectsOf(drawn.events);
    expect(effects.map((e) => e.playerId)).toEqual(['host', 'p1', 'p2']);
    expect(effects[1].data).toMatchObject({ kind: 'buyer', matched: ['EFH'] });
    expect(effects[0].data).toMatchObject({ kind: 'buyer', matched: [] });

    const original = efh.depositMinor! + efh.mortgageMinor!;
    for (const id of ['p1', 'p2']) {
      expect(offersOf(drawn.table, id)).toEqual([
        expect.objectContaining({
          title: 'EFH',
          cardId: card.id,
          salePriceMinor: Math.round(original * 1.2),
        }),
      ]);
    }
    expect(offersOf(drawn.table, 'host')).toEqual([]);
  });

  it('the card waits in hand once opened: it is played already, cannot be passed, and ticking it off ends the turn', () => {
    const opened = open(playingTable(), 'market', card.id);
    expect(opened.table.activePlayerId).toBe('host');
    expect(booksOf(opened.table, 'host').state.turn?.pending).toMatchObject({ played: true });
    expectError(
      () => applyCommand(opened.table, 'host', { type: 'pass_card' }, ctx),
      'ILLEGAL_MOVE',
    );
    const drawn = draw(playingTable(), 'market', card.id);
    expect(drawn.table.activePlayerId).toBe('p1');
    expect(booksOf(drawn.table, 'host').state.turn?.phase).toBe('roll');
    expect(booksOf(drawn.table, 'host').state.turn?.pending).toBeUndefined();
  });

  it('a player who does not own the property is untouched', () => {
    const table = owns(playingTable(), 'p1', efh);
    const before = booksOf(table, 'p2');
    const drawn = draw(table, 'market', card.id);
    expect(booksOf(drawn.table, 'p2')).toEqual(before);
  });

  it('players who left or are out get nothing', () => {
    let table = owns(owns(playingTable(), 'p1', efh), 'p2', efh);
    table = {
      ...table,
      players: table.players.map((p) => (p.id === 'p2' ? { ...p, status: 'left' as const } : p)),
    };
    const drawn = draw(table, 'market', card.id);
    expect(effectsOf(drawn.events).map((e) => e.playerId)).toEqual(['host', 'p1']);
    expect(offersOf(drawn.table, 'p2')).toEqual([]);
  });

  it('a player can sell into it off their own turn - and only because of the card', () => {
    const table = owns(owns(playingTable(), 'p1', efh), 'p2', efh);
    // no card, no selling
    expectError(
      () => applyCommand(table, 'p2', { type: 'sell_position', input: { title: 'EFH' } }, ctx),
      'ILLEGAL_MOVE',
    );
    const drawn = draw(table, 'market', card.id);
    expect(drawn.table.activePlayerId).toBe('p1');
    const cashBefore = cashOnHandMinor(
      booksOf(drawn.table, 'p2').transactions,
      booksOf(drawn.table, 'p2').allocation,
    );
    // p2 is not the active player
    const sold = applyCommand(
      drawn.table,
      'p2',
      { type: 'sell_position', input: { title: 'EFH' } },
      ctx,
    );
    expect(types(sold.events)).toEqual(['position_sold']);
    expect(sold.table.activePlayerId).toBe('p1');
    expect(booksOf(sold.table, 'p2').investments.find((i) => i.tag === 'EFH')).toBeUndefined();
    expect(
      cashOnHandMinor(booksOf(sold.table, 'p2').transactions, booksOf(sold.table, 'p2').allocation),
    ).toBeGreaterThan(cashBefore);
    // p1 still holds theirs and their offer
    expect(booksOf(sold.table, 'p1').investments.some((i) => i.tag === 'EFH')).toBe(true);
    expect(offersOf(sold.table, 'p1')).toHaveLength(1);
  });

  it("under strict rules the offer lasts until the player's next roll, even off their turn", () => {
    let table = playingTable({ rulesBase: 'strict' });
    expect(table.settings.rules.sellOfferRolls).toBe(1);
    table = owns(owns(table, 'p1', efh), 'p2', efh);
    const drawn = draw(table, 'market', card.id);
    // p2 waits for their turn: the offer must still be there to take
    const sold = applyCommand(
      drawn.table,
      'p2',
      { type: 'sell_position', input: { title: 'EFH' } },
      ctx,
    );
    expect(sold.table.players[2].books!.investments.some((i) => i.tag === 'EFH')).toBe(false);

    // p1 (active next) rolls without selling: the turn count moves on, so their offer is gone afterwards
    let after = drawn.table;
    const rolled = applyCommand(after, 'p1', { type: 'roll' }, ctx);
    const p1Books = booksOf(rolled.table, 'p1');
    if (booksOf(rolled.table, 'p1').state.turn?.phase === 'decide') {
      after = applyCommand(rolled.table, 'p1', { type: 'pass_card' }, ctx).table;
    } else {
      after = rolled.table;
    }
    expect(p1Books.state.turn!.count).toBeGreaterThan(1);
    expectError(
      () => applyCommand(after, 'p1', { type: 'sell_position', input: { title: 'EFH' } }, ctx),
      'ILLEGAL_MOVE',
    );
  });

  it("leaves the player's own turn state alone while selling", () => {
    const table = owns(owns(playingTable(), 'p1', efh), 'p2', efh);
    const drawn = draw(table, 'market', card.id);
    const sold = applyCommand(
      drawn.table,
      'p2',
      { type: 'sell_position', input: { title: 'EFH' } },
      ctx,
    );
    expect(booksOf(sold.table, 'p2').state.turn).toEqual(booksOf(drawn.table, 'p2').state.turn);
  });
});

describe('the other Market cards', () => {
  it('a cost card applies only to its drawer, who pays it with a move of their own - the game waits for the payment', () => {
    const card = marketCard('classic-market-cost-pipe-1k');
    const table = owns(owns(playingTable(), 'host', efh), 'p1', efh);
    const payments = (t: Table, id: string) =>
      booksOf(t, id).transactions.filter((tx) => tx.amountMinor === -100000);
    const opened = open(table, 'market', card.id);
    // nothing is booked by opening the card, for the drawer or for anybody else
    expect(payments(opened.table, 'host')).toHaveLength(payments(table, 'host').length);
    expect(payments(opened.table, 'p1')).toHaveLength(payments(table, 'p1').length);
    expect(booksOf(opened.table, 'host').state.turn?.pending).toMatchObject({
      paymentDue: true,
      played: false,
    });
    expect(effectsOf(opened.events).map((e) => e.playerId)).toEqual(['host']);
    // the table waits: the payment is the move, a pass is not
    const moves = tableLegalActions(opened.table, 'host').map((a) => a.action);
    expect(moves).toContain('pay_market');
    expect(moves).not.toContain('finish_card');
    expect(nextPassiveCommand(opened.table, 'host')).toEqual({
      type: 'pay_market',
      cardId: card.id,
    });
    // paying books it on the property (a short purse takes the Bank loan first), and settles the space
    const paid = applyCommand(opened.table, 'host', { type: 'pay_market', cardId: card.id }, ctx);
    expect(payments(paid.table, 'host')).toHaveLength(payments(table, 'host').length + 1);
    expect(payments(paid.table, 'p1')).toHaveLength(payments(table, 'p1').length);
    expect(paid.table.activePlayerId).toBe('p1');
  });

  it('a cost card for a drawer without a property is ignored and ticked off, as the card says', () => {
    const card = marketCard('classic-market-cost-pipe-1k');
    const opened = open(playingTable(), 'market', card.id);
    expect(booksOf(opened.table, 'host').state.turn?.pending).toMatchObject({ played: true });
    expect(tableLegalActions(opened.table, 'host').map((a) => a.action)).not.toContain(
      'pay_market',
    );
  });

  it('a stock split is decided by ONE roll for every holder', () => {
    const card = marketCard('classic-market-split-ok4u');
    const ok4u = shareCards('OK4U')[0];
    let table = playingTable();
    table = owns(owns(table, 'host', ok4u, 10), 'p1', ok4u, 10);
    const quantity = (t: Table, id: string) =>
      booksOf(t, id).shares.find((s) => s.tag === 'OK4U')!.quantity;
    expect(quantity(table, 'host')).toBe(10);

    const drawn = draw(table, 'market', card.id);
    const effects = effectsOf(drawn.events);
    expect(effects.map((e) => e.playerId)).toEqual(['host', 'p1']);
    const roll = effects[0].data!.roll as number;
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    expect(effects[1].data!.roll).toBe(roll);
    const expected = roll <= 3 ? 20 : 5;
    expect(quantity(drawn.table, 'host')).toBe(expected);
    expect(quantity(drawn.table, 'p1')).toBe(expected);
    // no dice decision is left open for anyone
    expect(
      booksOf(drawn.table, 'p1').state.assetDeals?.filter((d) => d.stage === 'awaitingRoll'),
    ).toEqual([]);
    expect(drawn.table.rngState).not.toBe(table.rngState);
  });

  it("a split of a share nobody holds does nothing but end the drawer's turn", () => {
    const drawn = draw(playingTable(), 'market', 'classic-market-split-myt4u');
    expect(effectsOf(drawn.events).map((e) => e.playerId)).toEqual(['host']);
    expect(drawn.table.activePlayerId).toBe('p1');
  });

  it('a cashflow boost reaches every player with a qualifying investment', () => {
    const boost = marketCards.find((c) => c.boost)!;
    const table = owns(owns(playingTable(), 'p1', efh), 'p2', efh);
    const cashflow = (t: Table, id: string) =>
      booksOf(t, id).growProjects.find((p) => p.title === 'EFH')?.cashflowMinor;
    const drawn = draw(table, 'market', boost.id);
    for (const id of ['p1', 'p2']) {
      const changed = effectsOf(drawn.events).find((e) => e.playerId === id)?.data
        ?.changed as unknown[];
      if (efh.cashflowMinor! <= boost.boost!.maxCashflowMinor) {
        expect(changed.length).toBeGreaterThan(0);
        expect(cashflow(drawn.table, id)).toBe(cashflow(table, id)! + boost.boost!.addMinor);
      }
    }
  });

  it('a stock card moves the price for every other holder, who may then sell at it', () => {
    const [cheap, dear] = shareCards('OK4U');
    expect(dear.priceMinor).toBeGreaterThan(cheap.priceMinor!);
    const table = owns(owns(playingTable(), 'p1', cheap, 10), 'p2', cheap, 10);
    const drawn = draw(table, 'dealSmall', dear.id);
    const effects = effectsOf(drawn.events);
    expect(effects.map((e) => [e.playerId, e.data])).toEqual([
      ['p1', { kind: 'price', share: 'OK4U', priceMinor: dear.priceMinor }],
      ['p2', { kind: 'price', share: 'OK4U', priceMinor: dear.priceMinor }],
    ]);
    expect(offersOf(drawn.table, 'p2')).toEqual([
      expect.objectContaining({ title: 'OK4U', pricePerShareMinor: dear.priceMinor }),
    ]);
    // the drawer holds nothing and has not bought: their turn goes on (only the drawer can buy at this price)
    expect(drawn.table.activePlayerId).toBe('host');
    expect(booksOf(drawn.table, 'host').shares).toEqual([]);

    const cashBefore = cashOnHandMinor(
      booksOf(drawn.table, 'p2').transactions,
      booksOf(drawn.table, 'p2').allocation,
    );
    const sold = applyCommand(
      drawn.table,
      'p2',
      { type: 'sell_position', input: { title: 'OK4U' } },
      ctx,
    );
    expect(booksOf(sold.table, 'p2').shares.find((s) => s.tag === 'OK4U')?.quantity ?? 0).toBe(0);
    expect(
      cashOnHandMinor(booksOf(sold.table, 'p2').transactions, booksOf(sold.table, 'p2').allocation),
    ).toBeGreaterThan(cashBefore);
    // p1 did not sell and still holds theirs
    expect(booksOf(sold.table, 'p1').shares.find((s) => s.tag === 'OK4U')!.quantity).toBe(10);
  });

  it('a holder may also buy more at the price of a stock card somebody else drew - off their turn too', () => {
    const [cheap, dear] = shareCards('OK4U');
    const table = owns(owns(playingTable(), 'p1', cheap, 10), 'p2', cheap, 10);
    const drawn = draw(table, 'dealSmall', dear.id);
    expect(drawn.table.activePlayerId).toBe('host');
    expect(tableLegalActions(drawn.table, 'p2').map((a) => a.action)).toContain('buy_planned');
    expect(tableLegalActions(drawn.table, 'host').map((a) => a.action)).not.toContain(
      'buy_planned',
    );
    const cashBefore = cashOnHandMinor(
      booksOf(drawn.table, 'p2').transactions,
      booksOf(drawn.table, 'p2').allocation,
    );
    const bought = applyCommand(
      drawn.table,
      'p2',
      { type: 'buy_planned', title: 'OK4U', quantity: 2 },
      ctx,
    );
    expect(booksOf(bought.table, 'p2').shares.find((s) => s.tag === 'OK4U')!.quantity).toBe(12);
    expect(
      cashOnHandMinor(
        booksOf(bought.table, 'p2').transactions,
        booksOf(bought.table, 'p2').allocation,
      ),
    ).toBeLessThan(cashBefore);
    // it is still the drawer's turn; the buyer's own turn is untouched
    expect(bought.table.activePlayerId).toBe('host');
    // someone who holds nothing of it cannot buy at that price
    expectError(
      () =>
        applyCommand(drawn.table, 'host', { type: 'buy_planned', title: 'OK4U', quantity: 1 }, ctx),
      'ILLEGAL_MOVE',
    );
  });

  it('a share nobody else holds moves no price', () => {
    const [cheap, dear] = shareCards('OK4U');
    const drawn = draw(owns(playingTable(), 'host', cheap, 10), 'dealSmall', dear.id);
    expect(effectsOf(drawn.events)).toEqual([]);
  });
});

describe('purity and replay', () => {
  it('never mutates the table it is given', () => {
    const table = deepFreeze(
      onCardSpace(
        stack(owns(playingTable(), 'p1', efh), 'market', 'classic-market-efh-pct20-a'),
        'market',
      ),
    );
    const result = applyCommand(table, 'host', { type: 'draw_card', deck: 'market' }, ctx);
    expect(result.table).not.toBe(table);
    expect(offersOf(table, 'p1')).toEqual([]);
  });

  it('the same table and the same draw give the same game, split roll included', () => {
    const ok4u = shareCards('OK4U')[0];
    const table = owns(owns(playingTable(), 'host', ok4u, 10), 'p1', ok4u, 10);
    const a = draw(table, 'market', 'classic-market-split-ok4u');
    const b = draw(table, 'market', 'classic-market-split-ok4u');
    expect(b.table).toEqual(a.table);
    expect(b.events).toEqual(a.events);
  });
});

describe('the held turn (the table waits until everybody has said Continue)', () => {
  const card = marketCard('classic-market-efh-pct20-a');
  const heldTable = (settings: object = {}) =>
    draw(
      owns(owns(playingTable({ turnGate: true, ...settings }), 'p1', efh), 'p2', efh),
      'market',
      card.id,
    );

  it('holds the next turn until each person has said done, the one who played too, and nobody rolls meanwhile', () => {
    const held = heldTable().table;
    expect(held.hold?.playerIds).toEqual(['host', 'p1', 'p2']);
    expect(held.activePlayerId).toBe('host');
    expectError(() => applyCommand(held, 'host', { type: 'roll' }, ctx), 'ILLEGAL_MOVE');
    const one = applyCommand(held, 'p2', { type: 'done' }, ctx);
    expect(one.table.hold?.playerIds).toEqual(['host', 'p1']);
    expectError(() => applyCommand(one.table, 'p2', { type: 'done' }, ctx), 'WRONG_PHASE');
    const two = applyCommand(one.table, 'host', { type: 'done' }, ctx);
    expect(two.table.activePlayerId).toBe('host');
    const all = applyCommand(two.table, 'p1', { type: 'done' }, ctx);
    expect(all.table.hold).toBeNull();
    expect(all.table.activePlayerId).toBe('p1');
    expect(types(all.events)).toEqual(
      expect.arrayContaining(['hold_done', 'turn_released', 'turn_started']),
    );
  });

  it('asks about a card once: an offer that stays open does not hold the next turn again', () => {
    const held = heldTable({ rules: { sellOfferRolls: 3 } }).table;
    expect(held.hold?.playerIds).toEqual(['host', 'p1', 'p2']);
    const one = applyCommand(held, 'p2', { type: 'done' }, ctx);
    const two = applyCommand(one.table, 'host', { type: 'done' }, ctx);
    const all = applyCommand(two.table, 'p1', { type: 'done' }, ctx).table;
    expect(all.activePlayerId).toBe('p1');
    // p2 still could sell into the offer, but has said Continue to this card
    expect(canSellNow(all, 'p2')).toBe(true);
    expect(mustConfirmOffer(all, 'p2')).toBe(false);
  });

  it('gives the end of the turn - and the decision to sell - the time a move has', () => {
    const held = heldTable({ clock: { mode: 'per-move', secondsPerMove: 90 } }).table;
    expect(held.clock.deadlineAt! - held.clock.turnStartedAt!).toBe(90_000);
  });

  it('lets the people sell while it waits; whoever has sold what there was to sell has nothing more to confirm', () => {
    const held = heldTable().table;
    const sold = applyCommand(held, 'p2', { type: 'sell_position', input: { title: 'EFH' } }, ctx);
    // p2 sold: nothing is left for p2 to do, the table waits for the mover and for p1
    expect(sold.table.hold?.playerIds).toEqual(['host', 'p1']);
    expect(sold.table.activePlayerId).toBe('host');
  });

  it("asks only the mover when a card touches nobody, and nobody at all when a bot's turn does", () => {
    const quiet = draw(playingTable({ turnGate: true }), 'market', card.id).table;
    expect(quiet.hold?.playerIds).toEqual(['host']);
    const asBot = {
      ...playingTable({ turnGate: true }),
    };
    const botsTurn: Table = {
      ...asBot,
      players: asBot.players.map((p) =>
        p.id === 'host' ? { ...p, bot: { policyId: 'all-rounder' } } : p,
      ),
    };
    expect(draw(botsTurn, 'market', card.id).table.hold ?? null).toBeNull();
  });

  it('is released by the clock without anyone being marked as having timed out', () => {
    const held = heldTable({ clock: { mode: 'per-move', secondsPerMove: 60 } }).table;
    expect(held.clock.deadlineAt).not.toBeNull();
    const late = {
      ...ctx,
      clock: { ...ctx.clock, nowIso: () => new Date(held.clock.deadlineAt! + 1).toISOString() },
    };
    const result = applyTimeout(held, late);
    expect(result.table.hold).toBeNull();
    expect(result.table.activePlayerId).toBe('p1');
    expect(types(result.events)).not.toContain('turn_timeout');
    expect(result.table.clock.timeouts['host'] ?? 0).toBe(0);
  });

  it('does not wait for bots or for players who are away, and a table of bots is never held', () => {
    let table = owns(owns(playingTable({ turnGate: true }), 'p1', efh), 'p2', efh);
    table = {
      ...table,
      players: table.players.map((p) =>
        p.id === 'p1'
          ? { ...p, bot: { policyId: 'all-rounder' } }
          : p.id === 'p2'
            ? { ...p, away: true }
            : p,
      ),
    };
    const drawn = draw(table, 'market', card.id);
    // only the host is here and a person: the host has to say Continue
    expect(drawn.table.hold?.playerIds).toEqual(['host']);
    const bots = {
      ...table,
      players: table.players.map((p) =>
        p.id === 'host' ? { ...p, bot: { policyId: 'all-rounder' } } : p,
      ),
    };
    expect(draw(bots, 'market', card.id).table.hold ?? null).toBeNull();
  });

  it('is off unless the table asked for it', () => {
    const table = draw(owns(owns(playingTable(), 'p1', efh), 'p2', efh), 'market', card.id).table;
    expect(table.hold ?? null).toBeNull();
    expect(table.activePlayerId).toBe('p1');
  });

  it('keeps the bank open for the one who moved while the turn waits, as between two rolls of the solo game', () => {
    const held = heldTable().table;
    const asking = tableLegalActions(held, 'host').map((a) => a.action);
    expect(asking).toEqual(expect.arrayContaining(['done', 'bank_loan']));
    expect(asking).not.toContain('roll');
    const borrowed = applyCommand(held, 'host', { type: 'bank_loan', amountMinor: 1_000_000 }, ctx);
    expect(borrowed.table.hold?.playerIds).toEqual(['host', 'p1', 'p2']);
    expect(borrowed.table.activePlayerId).toBe('host');
    // the others cannot borrow on somebody else's turn
    expect(tableLegalActions(held, 'p1').map((a) => a.action)).not.toContain('bank_loan');
  });

  it('a card with a die to roll (MLM) is rolled before the turn can end, even while the table waits', () => {
    const held = heldTable().table;
    const withDie: Table = {
      ...held,
      players: held.players.map((p) =>
        p.id === 'host'
          ? {
              ...p,
              books: {
                ...p.books!,
                state: {
                  ...p.books!.state,
                  assetDeals: [
                    {
                      title: 'MLM',
                      coins: 0,
                      costMinor: 100000,
                      successOn: 4,
                      payoutMinor: 50000,
                      recurring: true,
                      stage: 'awaitingRoll',
                    },
                  ],
                } as never,
              },
            }
          : p,
      ),
    };
    const asking = tableLegalActions(withDie, 'host').map((a) => a.action);
    expect(asking).toContain('roll_decision');
    expect(asking).not.toContain('done');
    expectError(() => applyCommand(withDie, 'host', { type: 'done' }, ctx), 'ILLEGAL_MOVE');
    const rolled = applyCommand(withDie, 'host', { type: 'roll_decision', title: 'MLM' }, ctx);
    expect(types(rolled.events)).toContain('dice_decided');
    expect(tableLegalActions(rolled.table, 'host').map((a) => a.action)).toContain('done');
  });
});
