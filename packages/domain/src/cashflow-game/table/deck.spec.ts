import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import type { CashflowDeckKind } from '../types';
import { cardsLeft, drawTableCard, type TableDrawDeps } from './deck';
import { applyCommand, createTable } from './reducer';
import { deepFreeze, testContext } from './testing';
import { TableCommandError, type Table, type TableCommand } from './types';

const ctx = testContext;
const deps: TableDrawDeps = testContext;
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;

/** A started 3-player table (random professions). */
function playingTable(seed = 77, players = 3): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', maxSeats: Math.max(players, 6) },
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

/** Puts a player on a card space, waiting for a card (what T3's roll will do). */
function onSpace(table: Table, playerId: string, kind: 'deal' | 'market' | 'doodad'): Table {
  return {
    ...table,
    players: table.players.map((p) =>
      p.id === playerId && p.books
        ? {
            ...p,
            books: {
              ...p.books,
              state: {
                ...p.books.state,
                turn: { phase: 'decide', count: 1, pending: { kind, spaceIndex: 0 } },
              },
            },
          }
        : p,
    ),
  };
}

const offeredCard = (table: Table, playerId: string) =>
  table.players.find((p) => p.id === playerId)?.books?.state.turn?.pending?.offered?.cardId;

describe('the table shares one pile per deck', () => {
  it('never deals the same card twice before the deck runs out, whoever draws', () => {
    let table = playingTable();
    const size = CLASSIC.decks!.dealSmall!.length;
    const seen: string[] = [];
    const players = ['host', 'p1', 'p2'];
    for (let i = 0; i < size; i += 1) {
      const who = players[i % players.length];
      table = onSpace(table, who, 'deal');
      const draw = drawTableCard(table, who, { deck: 'dealSmall' }, deps);
      table = draw.table;
      seen.push(offeredCard(table, who)!);
      expect((draw.plan.result as { reshuffled: boolean }).reshuffled).toBe(false);
    }
    expect(new Set(seen).size).toBe(size);
    expect(table.drawnCardIds.dealSmall).toHaveLength(size);
    expect(cardsLeft(table, 'dealSmall')).toBe(0);
  });

  it('reshuffles for the whole table when a deck is used up, starting a fresh pile', () => {
    let table = playingTable();
    const size = CLASSIC.decks!.doodad!.length;
    for (let i = 0; i < size; i += 1) {
      table = onSpace(table, 'host', 'doodad');
      table = drawTableCard(table, 'host', { deck: 'doodad' }, deps).table;
    }
    expect(cardsLeft(table, 'doodad')).toBe(0);
    table = onSpace(table, 'p1', 'doodad');
    const draw = drawTableCard(table, 'p1', { deck: 'doodad' }, deps);
    expect((draw.plan.result as { reshuffled: boolean }).reshuffled).toBe(true);
    expect(draw.table.drawnCardIds.doodad).toEqual([offeredCard(draw.table, 'p1')]);
    expect(cardsLeft(draw.table, 'doodad')).toBe(size - 1);
  });

  it('keeps the decks apart', () => {
    let table = onSpace(playingTable(), 'host', 'deal');
    table = drawTableCard(table, 'host', { deck: 'dealBig' }, deps).table;
    expect(table.drawnCardIds.dealBig).toHaveLength(1);
    expect(table.drawnCardIds.dealSmall).toEqual([]);
    expect(table.drawnCardIds.market).toEqual([]);
  });

  it("puts the drawn card in the drawing player's hand only (offered-once)", () => {
    let table = playingTable();
    table = onSpace(onSpace(table, 'host', 'deal'), 'p1', 'deal');
    table = drawTableCard(table, 'host', { deck: 'dealSmall' }, deps).table;
    expect(offeredCard(table, 'host')).toBeDefined();
    expect(offeredCard(table, 'p1')).toBeUndefined();
    expect(offeredCard(table, 'p2')).toBeUndefined();
  });

  it('the solo draw rules still apply: one card per space, the right pile, a space to draw for', () => {
    const table = onSpace(onSpace(playingTable(), 'host', 'deal'), 'p1', 'doodad');
    const drawn = drawTableCard(table, 'host', { deck: 'dealSmall' }, deps).table;
    expect(() => drawTableCard(drawn, 'host', { deck: 'dealBig' }, deps)).toThrow(
      /already offered/,
    );
    expect(() => drawTableCard(table, 'p1', { deck: 'dealSmall' }, deps)).toThrow(/doodad card/);
    // p2 is on no space at all
    expect(() => drawTableCard(table, 'p2', { deck: 'dealSmall' }, deps)).toThrow(
      /only deal a card/,
    );
    // a refused draw leaves the table untouched
    expect(table.drawnCardIds.dealSmall).toEqual([]);
  });

  it('needs a seated player who has books', () => {
    const lobby = createTable(
      { id: 't', hostId: 'host', hostName: 'H', settings: { name: 'T' }, seed: 1 },
      ctx,
    ).table;
    for (const who of ['host', 'ghost']) {
      try {
        drawTableCard(lobby, who, { deck: 'market' }, deps);
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TableCommandError);
        expect((error as TableCommandError).code).toBe('NOT_A_MEMBER');
      }
    }
  });

  it('is repeatable: same table, same draw, same card; the dice stream moves on', () => {
    const table = onSpace(playingTable(5), 'host', 'deal');
    const a = drawTableCard(table, 'host', { deck: 'dealSmall' }, deps).table;
    const b = drawTableCard(table, 'host', { deck: 'dealSmall' }, deps).table;
    expect(offeredCard(a, 'host')).toBe(offeredCard(b, 'host'));
    expect(a.rngState).toBe(b.rngState);
    expect(a.rngState).not.toBe(table.rngState);
  });

  it('does not mutate the table it is given', () => {
    const table = deepFreeze(onSpace(playingTable(), 'host', 'market'));
    const draw = drawTableCard(table, 'host', { deck: 'market' }, deps);
    expect(draw.table).not.toBe(table);
    expect(table.drawnCardIds.market).toEqual([]);
  });

  it('every deck can be drawn from a played-out table without a card appearing twice in a row', () => {
    const kinds: CashflowDeckKind[] = ['dealSmall', 'dealBig', 'market', 'doodad'];
    const space = {
      dealSmall: 'deal',
      dealBig: 'deal',
      market: 'market',
      doodad: 'doodad',
    } as const;
    let table = playingTable(11, 4);
    const ids = ['host', 'p1', 'p2', 'p3'];
    for (const deck of kinds) {
      const drawn = new Set<string>();
      for (let i = 0; i < Math.min(6, CLASSIC.decks![deck]!.length); i += 1) {
        const who = ids[i % ids.length];
        table = onSpace(table, who, space[deck]);
        table = drawTableCard(table, who, { deck }, deps).table;
        const card = offeredCard(table, who)!;
        expect(drawn.has(card)).toBe(false);
        drawn.add(card);
      }
    }
  });
});
