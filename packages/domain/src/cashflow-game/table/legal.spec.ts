import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { buyDealAction } from '../actions';
import { seededRng } from '../rng';
import type { CashflowDealCard, CashflowDeckKind } from '../types';
import { tableLegalActions } from './legal';
import { applyPlan } from './play';
import { applyCommand, createTable } from './reducer';
import { testContext } from './testing';
import type { Table, TableCommand } from './types';

const ctx = testContext;
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const EFH = 'classic-small-efh-45k-2k';
const efh = CLASSIC.decks!.dealSmall!.find((c) => c.id === EFH)! as CashflowDealCard;
const shareCard = (CLASSIC.decks!.dealSmall! as CashflowDealCard[]).find(
  (c) => c.assetKind === 'share',
)!;

function playingTable(settings: object = {}, players = 3): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 8, ...settings },
      seed: 5,
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

const ids = (table: Table, who: string) => tableLegalActions(table, who).map((a) => a.action);
const booksOf = (table: Table, id: string) => table.players.find((p) => p.id === id)!.books!;

/** The active player stands on a Deals space holding `cardId` (drawn). */
function holding(table: Table, cardId: string, deck: CashflowDeckKind = 'dealSmall'): Table {
  const pile = CLASSIC.decks![deck]!.map((c) => c.id).filter((id) => id !== cardId);
  const who = table.activePlayerId!;
  const books = booksOf(table, who);
  const onSpace: Table = {
    ...table,
    turnRolled: true,
    drawnCardIds: { ...table.drawnCardIds, [deck]: pile },
    players: table.players.map((p) =>
      p.id === who
        ? {
            ...p,
            books: {
              ...books,
              state: {
                ...books.state,
                turn: {
                  phase: 'decide',
                  count: 1,
                  pending: { kind: deck === 'market' ? 'market' : 'deal', spaceIndex: 4 },
                },
              },
            },
          }
        : p,
    ),
  };
  return applyCommand(onSpace, who, { type: 'draw_card', deck }, ctx).table;
}

function owns(table: Table, playerId: string, card: CashflowDealCard): Table {
  const before = booksOf(table, playerId);
  const deciding = {
    ...before,
    state: {
      ...before.state,
      turn: {
        phase: 'decide' as const,
        count: 1,
        pending: {
          kind: 'deal' as const,
          spaceIndex: 0,
          offered: { deck: 'dealSmall' as const, cardId: card.id },
        },
      },
    },
  };
  const plan = buyDealAction(deciding, { cardId: card.id }, { ...ctx, rng: seededRng(1) });
  const bought = applyPlan(deciding, plan);
  const books = {
    ...bought,
    state: { ...bought.state, turn: { phase: 'roll' as const, count: 1 } },
  };
  return { ...table, players: table.players.map((p) => (p.id === playerId ? { ...p, books } : p)) };
}

describe('what a player may do', () => {
  it('nothing before the game runs or after it is over', () => {
    const lobby = createTable(
      { id: 't', hostId: 'host', hostName: 'H', settings: { name: 'T' }, seed: 1 },
      ctx,
    ).table;
    expect(tableLegalActions(lobby, 'host')).toEqual([]);
    expect(tableLegalActions(playingTable(), 'stranger')).toEqual([]);
    const finished: Table = { ...playingTable(), phase: 'finished' };
    expect(tableLegalActions(finished, 'host')).toEqual([]);
  });

  it('the player on the move can roll; the others can only wait; the host can pause', () => {
    const table = playingTable();
    expect(ids(table, 'host')).toEqual(expect.arrayContaining(['roll', 'pause']));
    expect(ids(table, 'host')).not.toContain('pass_card');
    expect(ids(table, 'p1')).toEqual([]);
    expect(ids(table, 'p2')).toEqual([]);
    for (const entry of tableLegalActions(table, 'host'))
      expect(entry.description.length).toBeGreaterThan(10);
  });

  it('follows a Deal card from the space to the decision, and offers it for trade', () => {
    const onSpace = holding(playingTable(), EFH);
    // drawn: the card is in hand
    expect(ids(onSpace, 'host')).toEqual(
      expect.arrayContaining(['buy_deal', 'pass_card', 'offer_trade']),
    );
    expect(ids(onSpace, 'host')).not.toContain('roll');
    expect(ids(onSpace, 'p1')).toEqual([]);

    const offered = applyCommand(
      onSpace,
      'host',
      { type: 'offer_trade', priceMinor: 100000 },
      ctx,
    ).table;
    expect(ids(offered, 'host')).toEqual(expect.arrayContaining(['withdraw_trade']));
    expect(ids(offered, 'host')).not.toContain('offer_trade');
    expect(ids(offered, 'host')).not.toContain('accept_trade');
    for (const who of ['p1', 'p2']) {
      expect(ids(offered, who)).toEqual(['accept_trade', 'counter_trade', 'decline_trade']);
    }
    const countered = applyCommand(
      offered,
      'p1',
      { type: 'counter_trade', priceMinor: 50000 },
      ctx,
    ).table;
    expect(ids(countered, 'host')).toEqual(
      expect.arrayContaining(['withdraw_trade', 'accept_trade']),
    );
    const declined = applyCommand(countered, 'p2', { type: 'decline_trade' }, ctx).table;
    expect(ids(declined, 'p2')).toEqual([]);
  });

  it('an offer to one player is listed for that player only; a share card cannot be offered', () => {
    const onSpace = holding(playingTable(), EFH);
    const toP1 = applyCommand(
      onSpace,
      'host',
      { type: 'offer_trade', priceMinor: 100, to: 'p1' },
      ctx,
    ).table;
    expect(ids(toP1, 'p1')).toContain('accept_trade');
    expect(ids(toP1, 'p2')).toEqual([]);
    const share = holding(playingTable(), shareCard.id);
    expect(ids(share, 'host')).toContain('buy_deal');
    expect(ids(share, 'host')).not.toContain('offer_trade');
  });

  it('selling is listed for whoever owns what a buyer card wants - on or off their turn - and for nobody else', () => {
    let table = playingTable({ rulesBase: 'strict' });
    table = owns(owns(table, 'p1', efh), 'p2', efh);
    expect(ids(table, 'p1')).not.toContain('sell_position');
    const drawn = holding(table, 'classic-market-efh-pct20-a', 'market');
    // the Market card is drawn and played for the whole table at once
    expect(drawn.players.find((p) => p.id === 'host')!.books!.state.marketOffers ?? []).toEqual([]);
    expect(ids(drawn, 'p1')).toContain('sell_position');
    expect(ids(drawn, 'p2')).toContain('sell_position');
    expect(ids(drawn, 'host')).not.toContain('sell_position');
    // p1 is the player on the move now, p2 is waiting: both may sell
    expect(drawn.activePlayerId).toBe('p1');
    expect(ids(drawn, 'p1')).toEqual(expect.arrayContaining(['sell_position', 'roll']));
    expect(ids(drawn, 'p2')).toEqual(['sell_position']);
  });

  it('a paused game offers only the resume; an away player is offered "back"', () => {
    const table = playingTable();
    const paused = applyCommand(table, 'host', { type: 'pause' }, ctx).table;
    expect(ids(paused, 'host')).toEqual(['resume']);
    expect(ids(paused, 'p1')).toEqual([]);
    const away: Table = {
      ...table,
      players: table.players.map((p) => (p.id === 'p1' ? { ...p, away: true } : p)),
    };
    expect(ids(away, 'p1')).toEqual(['back']);
  });

  it('a player who left or is out is offered nothing', () => {
    const table = playingTable();
    const left = applyCommand(table, 'p2', { type: 'leave' }, ctx).table;
    expect(ids(left, 'p2')).toEqual([]);
  });

  it('every action offered is accepted, and one that is not offered is refused', () => {
    const table = playingTable();
    expect(() => applyCommand(table, 'host', { type: 'roll' }, ctx)).not.toThrow();
    expect(() => applyCommand(table, 'p1', { type: 'roll' }, ctx)).toThrow();
    const onSpace = holding(table, EFH);
    expect(() =>
      applyCommand(onSpace, 'host', { type: 'offer_trade', priceMinor: 10 }, ctx),
    ).not.toThrow();
    expect(() => applyCommand(onSpace, 'host', { type: 'roll' }, ctx)).toThrow();
    expect(() => applyCommand(onSpace, 'p1', { type: 'accept_trade' }, ctx)).toThrow();
  });
});
