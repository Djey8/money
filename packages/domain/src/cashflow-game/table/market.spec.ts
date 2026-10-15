import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { buyDealAction } from '../actions';
import { cashOnHandMinor } from '../cash';
import { seededRng } from '../rng';
import type { CashflowDealCard, CashflowDeckKind, CashflowMarketCard } from '../types';
import { applyPlan } from './play';
import { applyCommand, createTable } from './reducer';
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

/** Draws `cardId` from `deck` as the active player. */
function draw(table: Table, deck: 'market' | 'dealSmall' | 'dealBig', cardId: string) {
  const ready = onCardSpace(stack(table, deck, cardId), deck === 'market' ? 'market' : 'deal');
  return applyCommand(ready, ready.activePlayerId!, { type: 'draw_card', deck }, ctx);
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

  it("the drawer's turn ends with the card: it cannot be passed on", () => {
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
  it('a cost card charges every player who owns a property', () => {
    const card = marketCard('classic-market-cost-pipe-1k');
    const table = owns(owns(playingTable(), 'p1', efh), 'p2', efh);
    const drawn = draw(table, 'market', card.id);
    // the payment is booked on the property; a short purse takes the Bank loan first, as for any forced payment
    const payments = (t: Table, id: string) =>
      booksOf(t, id).transactions.filter((tx) => tx.amountMinor === -100000);
    expect(payments(drawn.table, 'p1')).toHaveLength(payments(table, 'p1').length + 1);
    expect(payments(drawn.table, 'p2')).toHaveLength(payments(table, 'p2').length + 1);
    expect(payments(drawn.table, 'host')).toHaveLength(payments(table, 'host').length);
    const effects = effectsOf(drawn.events);
    expect(effects.map((e) => e.playerId)).toEqual(['host', 'p1', 'p2']);
    expect(effects[1].data).toMatchObject({ kind: 'cost', property: 'EFH', costMinor: 100000 });
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
