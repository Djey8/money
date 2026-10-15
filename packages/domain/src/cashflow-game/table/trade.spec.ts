import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { cashOnHandMinor } from '../cash';
import type { CashflowAssetDeal, CashflowDealCard } from '../types';
import { applyCommand, applyTimeout, createTable, type TableContext } from './reducer';
import { deepFreeze, testContext } from './testing';
import {
  TableCommandError,
  type Table,
  type TableCommand,
  type TableErrorCode,
  type TableEvent,
} from './types';
import { projectFor } from './view';
import { fixedClock } from '../clock';

const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const EFH = 'classic-small-efh-45k-2k';
const efh = CLASSIC.decks!.dealSmall!.find((c) => c.id === EFH)! as CashflowDealCard;
const shareCard = (CLASSIC.decks!.dealSmall! as CashflowDealCard[]).find(
  (c) => c.assetKind === 'share',
)!;
const T0 = Date.parse('2026-10-15T09:00:00.000Z');
const at = (ms: number): TableContext => ({
  ...testContext,
  clock: fixedClock('2026-10-15', new Date(T0 + ms).toISOString()),
});

function expectError(fn: () => unknown, code: TableErrorCode, message?: RegExp): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TableCommandError);
    expect((error as TableCommandError).code).toBe(code);
    if (message) expect((error as TableCommandError).message).toMatch(message);
    return;
  }
  throw new Error(`expected ${code}, nothing was thrown`);
}

function playingTable(settings: object = {}, players = 3): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: {
        name: 'T',
        professions: 'random',
        turnOrder: 'seat',
        maxSeats: 8,
        clock: { mode: 'per-move', secondsPerMove: 60 },
        ...settings,
      },
      seed: 5,
    },
    at(0),
  ).table;
  const steps: [string, TableCommand][] = [];
  for (let i = 1; i < players; i += 1) {
    steps.push(
      [`p${i}`, { type: 'join', name: `P${i}` }],
      [`p${i}`, { type: 'set_ready', ready: true }],
    );
  }
  steps.push(['host', { type: 'start' }]);
  for (const [who, command] of steps) table = applyCommand(table, who, command, at(0)).table;
  return table;
}

const player = (table: Table, id: string) => table.players.find((p) => p.id === id)!;
const booksOf = (table: Table, id: string) => player(table, id).books!;
const cashOf = (table: Table, id: string) =>
  cashOnHandMinor(booksOf(table, id).transactions, booksOf(table, id).allocation);
const types = (events: TableEvent[]) => events.map((e) => e.type);

/** The active player stands on a Deals space and has drawn `cardId`: it is in their hand. */
function holding(table: Table, cardId: string, deck: 'dealSmall' | 'dealBig' = 'dealSmall'): Table {
  const ids = CLASSIC.decks![deck]!.map((c) => c.id).filter((id) => id !== cardId);
  const who = table.activePlayerId!;
  const books = booksOf(table, who);
  const onSpace: Table = {
    ...table,
    turnRolled: true,
    drawnCardIds: { ...table.drawnCardIds, [deck]: ids },
    players: table.players.map((p) =>
      p.id === who
        ? {
            ...p,
            books: {
              ...books,
              state: {
                ...books.state,
                turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 4 } },
              },
            },
          }
        : p,
    ),
  };
  return applyCommand(onSpace, who, { type: 'draw_card', deck }, at(1000)).table;
}

const send = (table: Table, who: string, command: TableCommand, ms = 2000) =>
  applyCommand(table, who, command, at(ms));

describe('offering the card in hand', () => {
  it('puts it on offer to the whole table, or to one player, for everyone to see', () => {
    const table = holding(playingTable(), EFH);
    const offered = send(table, 'host', { type: 'offer_trade', priceMinor: 300000 });
    expect(types(offered.events)).toEqual(['trade_offered']);
    expect(offered.table.trade).toEqual({
      sellerId: 'host',
      cardId: EFH,
      deck: 'dealSmall',
      to: null,
      priceMinor: 300000,
      counters: [],
      declined: [],
    });
    expect(offered.table.activePlayerId).toBe('host');
    expect(offered.table.version).toBe(table.version + 1);

    const view = projectFor(offered.table, 'p2');
    expect(view.trade).toEqual({
      sellerSeat: 0,
      cardId: EFH,
      deck: 'dealSmall',
      toSeat: null,
      priceMinor: 300000,
      counters: [],
      declinedSeats: [],
    });
    expect(JSON.stringify(view)).not.toContain('"host"');

    const toOne = send(table, 'host', { type: 'offer_trade', priceMinor: 100, to: 'p1' });
    expect(toOne.events[0].data).toMatchObject({ to: 'P1' });
    expect(toOne.table.trade!.to).toBe('p1');
    expect(projectFor(toOne.table, 'p2').trade!.toSeat).toBe(1);
  });

  it('only the player on the move, and only with a tradable card in hand', () => {
    const table = holding(playingTable(), EFH);
    expectError(() => send(table, 'p1', { type: 'offer_trade', priceMinor: 100 }), 'NOT_YOUR_TURN');
    // nothing in hand yet
    const bare = playingTable();
    expectError(
      () => send(bare, 'host', { type: 'offer_trade', priceMinor: 100 }),
      'ILLEGAL_MOVE',
      /holding/,
    );
    // a share card belongs to whoever drew it
    const share = holding(playingTable(), shareCard.id);
    expectError(
      () => send(share, 'host', { type: 'offer_trade', priceMinor: 100 }),
      'ILLEGAL_MOVE',
      /share card belongs to whoever drew it/,
    );
  });

  it('refuses a bad price, a bad buyer, a second offer, and a card already dealt with', () => {
    const table = holding(playingTable(), EFH);
    for (const priceMinor of [0, -5, 10.5, Number.NaN]) {
      expectError(
        () => send(table, 'host', { type: 'offer_trade', priceMinor }),
        'ILLEGAL_MOVE',
        /price/,
      );
    }
    expectError(
      () => send(table, 'host', { type: 'offer_trade', priceMinor: 100, to: 'host' }),
      'ILLEGAL_MOVE',
    );
    expectError(
      () => send(table, 'host', { type: 'offer_trade', priceMinor: 100, to: 'ghost' }),
      'ILLEGAL_MOVE',
    );
    const offered = send(table, 'host', { type: 'offer_trade', priceMinor: 100 }).table;
    expectError(
      () => send(offered, 'host', { type: 'offer_trade', priceMinor: 200 }),
      'ILLEGAL_MOVE',
      /already/,
    );
  });

  it('the seller can withdraw it; nobody else can', () => {
    const offered = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: 100,
    }).table;
    expectError(() => send(offered, 'p1', { type: 'withdraw_trade' }), 'ILLEGAL_MOVE');
    const withdrawn = send(offered, 'host', { type: 'withdraw_trade' });
    expect(types(withdrawn.events)).toEqual(['trade_withdrawn']);
    expect(withdrawn.table.trade).toBeNull();
    // the card is still in hand: the seller can buy it, or offer it again
    expect(
      send(withdrawn.table, 'host', { type: 'offer_trade', priceMinor: 50 }).table.trade,
    ).not.toBeNull();
  });
});

describe('an agreed price moves everything at once', () => {
  const PRICE = 300000;

  it('a buyer takes the card at the asking price', () => {
    const offered = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: PRICE,
    }).table;
    const hostCash = cashOf(offered, 'host');
    const buyerTurn = booksOf(offered, 'p2').state.turn;

    const made = send(offered, 'p2', { type: 'accept_trade' });
    expect(types(made.events)).toEqual(
      expect.arrayContaining(['trade_made', 'card_played', 'turn_started']),
    );
    expect(made.events.find((e) => e.type === 'trade_made')).toMatchObject({
      playerId: 'host',
      data: { cardId: EFH, priceMinor: PRICE, with: 'P2' },
    });
    expect(made.events.find((e) => e.type === 'card_played')).toMatchObject({
      playerId: 'p2',
      data: { action: 'buy_deal', via: 'trade' },
    });
    expect(made.table.trade).toBeNull();

    // the seller is paid and their space is settled: the turn moves on
    expect(cashOf(made.table, 'host')).toBe(hostCash + PRICE);
    expect(
      booksOf(made.table, 'host').transactions.some(
        (t) => t.category === '@EFH card sale' && t.amountMinor === PRICE,
      ),
    ).toBe(true);
    expect(booksOf(made.table, 'host').state.turn?.pending).toBeUndefined();
    expect(booksOf(made.table, 'host').investments.some((i) => i.tag === 'EFH')).toBe(false);
    expect(made.table.activePlayerId).toBe('p1');

    // the buyer paid the seller and owns the property; their own turn state is untouched
    const bought = booksOf(made.table, 'p2');
    expect(bought.investments.some((i) => i.tag === 'EFH')).toBe(true);
    expect(
      bought.transactions.some(
        (t) => t.category === '@EFH card purchase' && t.amountMinor === -PRICE,
      ),
    ).toBe(true);
    expect(bought.state.turn).toEqual(buyerTurn);
    // the third player is untouched
    expect(booksOf(made.table, 'p1')).toEqual(booksOf(offered, 'p1'));
  });

  it('a short purse takes the Bank loan, as for any purchase', () => {
    const offered = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: PRICE,
    }).table;
    const poor: Table = {
      ...offered,
      players: offered.players.map((p) =>
        p.id === 'p1' && p.books ? { ...p, books: { ...p.books, transactions: [] } } : p,
      ),
    };
    const made = send(poor, 'p1', { type: 'accept_trade' });
    const books = booksOf(made.table, 'p1');
    expect(books.liabilities.some((l) => l.tag === 'Bank loan' && l.amountMinor > 0)).toBe(true);
    expect(books.investments.some((i) => i.tag === 'EFH')).toBe(true);
  });

  it('an offer to one player cannot be answered by another', () => {
    const offered = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: PRICE,
      to: 'p1',
    }).table;
    expectError(() => send(offered, 'p2', { type: 'accept_trade' }), 'ILLEGAL_MOVE', /not for you/);
    expectError(
      () => send(offered, 'p2', { type: 'counter_trade', priceMinor: 100 }),
      'ILLEGAL_MOVE',
    );
    expect(send(offered, 'p1', { type: 'accept_trade' }).table.trade).toBeNull();
  });

  it('refuses the seller as a buyer, a stranger, and a player who is out', () => {
    const offered = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: PRICE,
    }).table;
    expectError(() => send(offered, 'host', { type: 'accept_trade' }), 'ILLEGAL_MOVE');
    expectError(() => send(offered, 'stranger', { type: 'accept_trade' }), 'NOT_A_MEMBER');
    const left: Table = {
      ...offered,
      players: offered.players.map((p) => (p.id === 'p2' ? { ...p, status: 'left' as const } : p)),
    };
    expectError(() => send(left, 'p2', { type: 'accept_trade' }), 'ILLEGAL_MOVE');
  });

  it('is all or nothing: a buyer who cannot take the card leaves both sides untouched', () => {
    const offered = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: PRICE,
    }).table;
    const waiting: CashflowAssetDeal = {
      title: 'GOLD',
      coins: 3,
      costMinor: 1000,
      stage: 'awaitingRoll',
      successOn: 4,
    };
    const blocked: Table = {
      ...offered,
      players: offered.players.map((p) =>
        p.id === 'p2' && p.books
          ? { ...p, books: { ...p.books, state: { ...p.books.state, assetDeals: [waiting] } } }
          : p,
      ),
    };
    // the buyer owes a dice roll first (the dice-first rule): the whole trade is refused
    expectError(() => send(blocked, 'p2', { type: 'accept_trade' }), 'ILLEGAL_MOVE', /dice/i);
    expect(blocked.trade).not.toBeNull();
    expect(cashOf(blocked, 'host')).toBe(cashOf(offered, 'host'));
  });
});

describe('agreeing on a price', () => {
  const ASK = 300000;
  const offer = () =>
    send(holding(playingTable(), EFH), 'host', { type: 'offer_trade', priceMinor: ASK }).table;

  it('a buyer proposes another price and the seller takes it', () => {
    const countered = send(offer(), 'p1', { type: 'counter_trade', priceMinor: 200000 });
    expect(types(countered.events)).toEqual(['trade_countered']);
    expect(countered.table.trade!.counters).toEqual([{ playerId: 'p1', priceMinor: 200000 }]);
    expect(projectFor(countered.table, 'p2').trade!.counters).toEqual([
      { seat: 1, priceMinor: 200000 },
    ]);
    // nothing has moved yet
    expect(booksOf(countered.table, 'p1').investments).toEqual(booksOf(offer(), 'p1').investments);

    const hostCash = cashOf(countered.table, 'host');
    const made = send(countered.table, 'host', { type: 'accept_trade', from: 'p1' });
    expect(made.events.find((e) => e.type === 'trade_made')!.data).toMatchObject({
      priceMinor: 200000,
      with: 'P1',
    });
    expect(cashOf(made.table, 'host')).toBe(hostCash + 200000);
    expect(booksOf(made.table, 'p1').investments.some((i) => i.tag === 'EFH')).toBe(true);
  });

  it('a new counter from the same buyer replaces the old one; the seller must name a real counter', () => {
    let table = send(offer(), 'p1', { type: 'counter_trade', priceMinor: 100 }).table;
    table = send(table, 'p1', { type: 'counter_trade', priceMinor: 250000 }).table;
    table = send(table, 'p2', { type: 'counter_trade', priceMinor: 150000 }).table;
    expect(table.trade!.counters).toEqual([
      { playerId: 'p1', priceMinor: 250000 },
      { playerId: 'p2', priceMinor: 150000 },
    ]);
    expectError(() => send(table, 'host', { type: 'accept_trade' }), 'ILLEGAL_MOVE', /buyer/);
    expectError(() => send(table, 'host', { type: 'accept_trade', from: 'ghost' }), 'ILLEGAL_MOVE');
    expectError(() => send(table, 'p1', { type: 'counter_trade', priceMinor: 0 }), 'ILLEGAL_MOVE');
  });

  it('a buyer who says no is out of it; an offer to one player ends, an offer to all goes on', () => {
    const declined = send(offer(), 'p1', { type: 'decline_trade' });
    expect(types(declined.events)).toEqual(['trade_declined']);
    expect(declined.table.trade!.declined).toEqual(['p1']);
    expectError(
      () => send(declined.table, 'p1', { type: 'accept_trade' }),
      'ILLEGAL_MOVE',
      /turned/,
    );
    expect(send(declined.table, 'p2', { type: 'accept_trade' }).table.trade).toBeNull();

    const one = send(holding(playingTable(), EFH), 'host', {
      type: 'offer_trade',
      priceMinor: ASK,
      to: 'p1',
    }).table;
    const over = send(one, 'p1', { type: 'decline_trade' });
    expect(types(over.events)).toEqual(['trade_declined', 'trade_expired']);
    expect(over.table.trade).toBeNull();
  });
});

describe("an offer lives only while the card is in the seller's hand", () => {
  const offer = () =>
    send(holding(playingTable(), EFH), 'host', { type: 'offer_trade', priceMinor: 300000 }).table;

  it('buying the card yourself ends it', () => {
    const bought = send(offer(), 'host', { type: 'buy_deal', cardId: EFH });
    expect(types(bought.events)).toEqual(expect.arrayContaining(['card_played', 'trade_expired']));
    expect(bought.table.trade).toBeNull();
  });

  it('passing the card ends it', () => {
    const passed = send(offer(), 'host', { type: 'pass_card' });
    expect(types(passed.events)).toEqual(expect.arrayContaining(['card_passed', 'trade_expired']));
    expect(passed.table.trade).toBeNull();
  });

  it('running out of time plays the passive turn: the card is passed, never traded', () => {
    const table = offer();
    const result = applyTimeout(table, at(120_000));
    expect(types(result.events)).toEqual(expect.arrayContaining(['turn_timeout', 'trade_expired']));
    expect(types(result.events)).not.toContain('trade_made');
    expect(result.table.trade).toBeNull();
  });

  it('the seller leaving ends it', () => {
    const left = send(offer(), 'host', { type: 'leave' });
    expect(left.table.trade).toBeNull();
    expect(types(left.events)).toContain('trade_expired');
  });

  it('a paused game takes no trade commands', () => {
    const paused = send(offer(), 'host', { type: 'pause' }).table;
    expectError(() => send(paused, 'p1', { type: 'accept_trade' }, 3000), 'PAUSED');
    expectError(() => send(paused, 'p1', { type: 'counter_trade', priceMinor: 5 }, 3000), 'PAUSED');
    expectError(() => send(paused, 'host', { type: 'withdraw_trade' }, 3000), 'PAUSED');
  });
});

describe('purity and replay', () => {
  it('never mutates the table and gives the same game twice', () => {
    const offered = deepFreeze(
      send(holding(playingTable(), EFH), 'host', { type: 'offer_trade', priceMinor: 300000 }).table,
    );
    const a = send(offered, 'p2', { type: 'accept_trade' });
    const b = send(offered, 'p2', { type: 'accept_trade' });
    expect(b.table).toEqual(a.table);
    expect(b.events).toEqual(a.events);
    expect(offered.trade).not.toBeNull();
    expect(efh.assetKind).toBe('investment');
  });
});
