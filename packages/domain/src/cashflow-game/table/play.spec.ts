import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import type { GameBooks } from '../books';
import { applyCommand, createTable, type CommandResult } from './reducer';
import { deepFreeze, testContext } from './testing';
import { projectFor } from './view';
import {
  TableCommandError,
  type Table,
  type TableCommand,
  type TableErrorCode,
  type TableEvent,
} from './types';

const ctx = testContext;
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;

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

/** A started table in seat order host, p1, p2... with every player at the start of the board. */
function playingTable(players = 3, settings: object = {}, seed = 1): Table {
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
        ...settings,
      },
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

function editBooks(table: Table, playerId: string, edit: (books: GameBooks) => GameBooks): Table {
  return {
    ...table,
    players: table.players.map((p) =>
      p.id === playerId && p.books ? { ...p, books: edit(p.books) } : p,
    ),
  };
}

const booksOf = (table: Table, id: string) => table.players.find((p) => p.id === id)!.books!;
const types = (events: TableEvent[]) => events.map((e) => e.type);
const rolledData = (result: CommandResult) =>
  result.events.find((e) => e.type === 'rolled')!.data as { landed: string; to: number };

/** The active player's roll for the first dice stream that makes `wanted` true - the stream position is the table's to set. */
function rollWhere(
  table: Table,
  wanted: (landed: string, result: CommandResult) => boolean,
  dice?: 1 | 2,
): CommandResult {
  const who = table.activePlayerId!;
  for (let seed = 1; seed <= 4000; seed += 1) {
    const result = applyCommand({ ...table, rngState: seed }, who, { type: 'roll', dice }, ctx);
    if (wanted(rolledData(result).landed, result)) return result;
  }
  throw new Error('no dice stream gives that roll');
}

/**
 * A whole turn the quickest way: roll (never onto Downsized, which changes the turn order), and if the space asks for a card,
 * pass it. Returns the table and every event of the turn.
 */
function autoRoll(table: Table, avoid: string[] = ['downsized', 'doodad']): CommandResult {
  const who = table.activePlayerId!;
  const rolled = rollWhere(table, (landed) => !avoid.includes(landed));
  const pending = booksOf(rolled.table, who).state.turn?.pending;
  if (rolled.table.phase !== 'playing' || !pending || rolled.table.activePlayerId !== who) {
    return rolled;
  }
  const passed = applyCommand(rolled.table, who, { type: 'pass_card' }, ctx);
  return { table: passed.table, events: [...rolled.events, ...passed.events] };
}

/** Makes the player a winner of the rat race: passive income far above any expense. */
function escapes(books: GameBooks): GameBooks {
  const title = 'Gold mine Cashflow';
  return {
    ...books,
    state: {
      ...books.state,
      gameSubscriptionTitles: [...books.state.gameSubscriptionTitles, title],
    },
    subscriptions: [
      ...books.subscriptions,
      { ...books.subscriptions[0], title, amountMinor: 100_000_000, category: '@x' },
    ],
  };
}

/** Makes the player bankrupt: a monthly loss that no income covers. */
function bankrupt(books: GameBooks): GameBooks {
  const title = 'Money pit';
  return {
    ...books,
    state: {
      ...books.state,
      gameSubscriptionTitles: [...books.state.gameSubscriptionTitles, title],
    },
    subscriptions: [
      ...books.subscriptions,
      { ...books.subscriptions[0], title, amountMinor: -100_000_000, category: '@x' },
    ],
  };
}

describe('a turn', () => {
  it('belongs to the active player: others cannot roll, draw or play', () => {
    const table = playingTable();
    expect(table.activePlayerId).toBe('host');
    expectError(() => applyCommand(table, 'p1', { type: 'roll' }, ctx), 'NOT_YOUR_TURN');
    expectError(
      () => applyCommand(table, 'p1', { type: 'draw_card', deck: 'dealSmall' }, ctx),
      'NOT_YOUR_TURN',
    );
    expectError(() => applyCommand(table, 'p1', { type: 'pass_card' }, ctx), 'NOT_YOUR_TURN');
    expectError(() => applyCommand(table, 'stranger', { type: 'roll' }, ctx), 'NOT_A_MEMBER');
  });

  it('a roll onto a self-settling space moves the turn to the next player', () => {
    const table = playingTable();
    const result = autoRoll(table);
    expect(types(result.events)).toEqual(expect.arrayContaining(['rolled', 'turn_started']));
    expect(result.table.activePlayerId).toBe('p1');
    expect(result.table.turnRolled).toBe(false);
    expect(result.table.version).toBe(table.version + 1);
    // the roll moved only the roller's token and books
    expect(booksOf(result.table, 'host').state.boardPosition).not.toBeNull();
    expect(booksOf(result.table, 'p1').state.boardPosition).toBeNull();
    expect(result.table.tableRound).toBe(1);
  });

  it('a roll onto a card space keeps the turn open until the card is dealt with', () => {
    const table = playingTable();
    const result = rollWhere(table, (landed) => landed === 'deal');
    expect(result.table.activePlayerId).toBe('host');
    expect(result.table.turnRolled).toBe(true);
    expect(booksOf(result.table, 'host').state.turn?.phase).toBe('decide');
    expectError(
      () => applyCommand(result.table, 'host', { type: 'roll' }, ctx),
      'ILLEGAL_MOVE',
      /card/i,
    );
    expectError(() => applyCommand(result.table, 'p1', { type: 'roll' }, ctx), 'NOT_YOUR_TURN');

    const drawn = applyCommand(result.table, 'host', { type: 'draw_card', deck: 'dealSmall' }, ctx);
    expect(types(drawn.events)).toEqual(['card_drawn']);
    expect(drawn.table.activePlayerId).toBe('host');
    expect(drawn.table.drawnCardIds.dealSmall).toHaveLength(1);

    const passed = applyCommand(drawn.table, 'host', { type: 'pass_card' }, ctx);
    expect(types(passed.events)).toEqual(['card_passed', 'turn_started']);
    expect(passed.table.activePlayerId).toBe('p1');
  });

  it('paying a Doodad settles the space and ends the turn', () => {
    const table = playingTable();
    const landed = rollWhere(table, (kind) => kind === 'doodad');
    const drawn = applyCommand(landed.table, 'host', { type: 'draw_card', deck: 'doodad' }, ctx);
    const cardId = drawn.table.players[0].books!.state.turn!.pending!.offered!.cardId;
    const paid = applyCommand(drawn.table, 'host', { type: 'pay_doodad', cardId }, ctx);
    expect(types(paid.events)).toEqual(['card_played', 'turn_started']);
    expect(paid.events[0].data).toMatchObject({ action: 'pay_doodad' });
    expect(paid.table.activePlayerId).toBe('p1');
    expect(paid.table.players[0].books!.transactions.length).toBeGreaterThan(
      landed.table.players[0].books!.transactions.length,
    );
  });

  it('refuses a move the solo rules refuse, with their words, and changes nothing', () => {
    const table = deepFreeze(playingTable());
    expectError(
      () => applyCommand(table, 'host', { type: 'draw_card', deck: 'dealSmall' }, ctx),
      'ILLEGAL_MOVE',
      /only deal a card/,
    );
    expectError(() => applyCommand(table, 'host', { type: 'pass_card' }, ctx), 'ILLEGAL_MOVE');
    expectError(
      () => applyCommand(table, 'host', { type: 'buy_deal', cardId: 'nope' }, ctx),
      'ILLEGAL_MOVE',
    );
    expect(table.version).toBe(playingTable().version);
  });

  it('the players take turns in order and a new round starts when it wraps', () => {
    let table = playingTable(3);
    const seen: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      seen.push(table.activePlayerId!);
      table = autoRoll(table).table;
    }
    expect(seen).toEqual(['host', 'p1', 'p2', 'host', 'p1', 'p2']);
    expect(table.tableRound).toBe(3);
  });

  it('draws come from one shared pile, whoever is playing', () => {
    let table = playingTable(2);
    const cards: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const who = table.activePlayerId!;
      table = rollWhere(table, (kind) => kind === 'deal').table;
      table = applyCommand(table, who, { type: 'draw_card', deck: 'dealSmall' }, ctx).table;
      cards.push(booksOf(table, who).state.turn!.pending!.offered!.cardId);
      table = applyCommand(table, who, { type: 'pass_card' }, ctx).table;
    }
    expect(new Set(cards).size).toBe(4);
    expect(table.drawnCardIds.dealSmall).toEqual(cards);
  });

  it('selling is open to every player at any time the rules allow - not only on their turn', () => {
    const table = playingTable();
    // p1 is not the active player; the refusal is the sell rule's (no buyer's offer), not "not your turn"
    expectError(
      () => applyCommand(table, 'p1', { type: 'sell_position', input: { title: 'EFH' } }, ctx),
      'ILLEGAL_MOVE',
    );
  });
});

describe('sitting out Downsized', () => {
  it('skips the player for two of their turns, for real', () => {
    let table = playingTable(2);
    // host stands 3 before the Downsized space (11), has already started (no opening payday)
    table = editBooks(table, 'host', (books) => ({
      ...books,
      state: { ...books.state, boardPosition: 8, turn: { phase: 'roll', count: 1 } },
    }));
    const landed = rollWhere(table, (kind) => kind === 'downsized');
    expect(booksOf(landed.table, 'host').state.unemployedRoundsLeft).toBe(2);
    expect(landed.table.activePlayerId).toBe('p1');

    // p1 plays; host is skipped (2 -> 1) and p1 plays again
    const first = autoRoll(landed.table);
    expect(types(first.events)).toEqual(
      expect.arrayContaining(['rolled', 'round_started', 'turn_skipped', 'turn_started']),
    );
    expect(first.events.find((e) => e.type === 'turn_skipped')).toMatchObject({
      playerId: 'host',
      data: { reason: 'downsized', roundsLeft: 1 },
    });
    expect(first.table.activePlayerId).toBe('p1');
    expect(booksOf(first.table, 'host').state.unemployedRoundsLeft).toBe(1);

    // the second skipped turn
    const second = autoRoll(first.table);
    expect(booksOf(second.table, 'host').state.unemployedRoundsLeft).toBe(0);
    expect(second.table.activePlayerId).toBe('p1');

    // and now the host plays again
    const third = autoRoll(second.table);
    expect(third.table.activePlayerId).toBe('host');
  });
});

describe('leaving mid-game', () => {
  it('the active player leaving passes the turn on', () => {
    const table = playingTable(3);
    const left = applyCommand(table, 'host', { type: 'leave' }, ctx);
    expect(left.table.phase).toBe('playing');
    expect(left.table.activePlayerId).toBe('p1');
    expect(types(left.events)).toEqual(['player_left', 'host_changed', 'turn_started']);
  });

  it('a player who left is skipped from then on', () => {
    let table = playingTable(3);
    table = applyCommand(table, 'p1', { type: 'leave' }, ctx).table;
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push(table.activePlayerId!);
      table = autoRoll(table).table;
    }
    expect(seen).toEqual(['host', 'p2', 'host', 'p2']);
  });
});

describe('the end of the game', () => {
  it('first-escape: the first player out of the rat race wins at once', () => {
    let table = playingTable(3);
    table = editBooks(table, 'host', escapes);
    const result = autoRoll(table);
    expect(result.table.phase).toBe('finished');
    expect(result.table.activePlayerId).toBeNull();
    expect(types(result.events)).toEqual(
      expect.arrayContaining(['rolled', 'player_escaped', 'game_finished']),
    );
    expect(result.table.result).toMatchObject({ reason: 'escaped', winnerId: 'host' });
    expect(result.table.result!.ranking[0]).toMatchObject({
      playerId: 'host',
      rank: 1,
      outcome: 'escaped',
    });
    expect(result.table.result!.ranking).toHaveLength(3);
    expectError(() => applyCommand(result.table, 'p1', { type: 'roll' }, ctx), 'WRONG_PHASE');
  });

  it('a bankrupt player is out; the others play on; the last one standing wins', () => {
    let table = playingTable(3);
    table = editBooks(table, 'host', bankrupt);
    const afterHost = autoRoll(table);
    expect(types(afterHost.events)).toContain('player_bankrupt');
    expect(afterHost.table.phase).toBe('playing');
    expect(afterHost.table.finishers).toEqual([{ playerId: 'host', outcome: 'bankrupt' }]);

    // host is skipped from now on
    const seen: string[] = [];
    let current = afterHost.table;
    for (let i = 0; i < 4; i += 1) {
      seen.push(current.activePlayerId!);
      current = autoRoll(current).table;
    }
    expect(seen).toEqual(['p1', 'p2', 'p1', 'p2']);

    // p2 goes bankrupt too -> p1 is the last standing
    const p2Out = editBooks(current, 'p2', bankrupt);
    const toP2 = current.activePlayerId === 'p2' ? p2Out : autoRoll(p2Out).table;
    const ended = autoRoll(toP2);
    expect(ended.table.phase).toBe('finished');
    expect(ended.table.result).toMatchObject({ reason: 'last-standing', winnerId: 'p1' });
    expect(ended.table.result!.ranking.map((r) => [r.playerId, r.outcome])).toEqual([
      ['p1', 'playing'],
      ['p2', 'bankrupt'], // lasted longer than the host
      ['host', 'bankrupt'],
    ]);
  });

  it('all-done: an escape does not end it; the game runs until nobody is left in the rat race', () => {
    let table = playingTable(3, { endCondition: 'all-done' });
    table = editBooks(editBooks(table, 'host', escapes), 'p1', bankrupt);
    // host rolls and escapes, p1 goes bankrupt on their roll, p2 is the only one still playing
    let result = autoRoll(table);
    expect(result.table.phase).toBe('playing');
    expect(result.table.finishers).toEqual([{ playerId: 'host', outcome: 'escaped' }]);
    result = autoRoll(result.table);
    expect(result.table.phase).toBe('playing');
    expect(result.table.activePlayerId).toBe('p2');
    // p2 escapes too -> everyone is done
    const p2Escapes = editBooks(result.table, 'p2', escapes);
    const done = autoRoll(p2Escapes);
    expect(done.table.phase).toBe('finished');
    expect(done.table.result).toMatchObject({ reason: 'all-done', winnerId: 'host' });
    expect(done.table.result!.ranking.map((r) => [r.playerId, r.outcome])).toEqual([
      ['host', 'escaped'],
      ['p2', 'escaped'],
      ['p1', 'bankrupt'],
    ]);
  });

  it('round-limit: ends after the last round, ranked by passive income', () => {
    let table = playingTable(2, { endCondition: 'round-limit', roundLimit: 2 });
    // give p1 a little passive income (not enough to escape) so the ranking has something to rank
    table = editBooks(table, 'p1', (books) => {
      const title = 'Shop Cashflow';
      return {
        ...books,
        state: {
          ...books.state,
          gameSubscriptionTitles: [...books.state.gameSubscriptionTitles, title],
        },
        subscriptions: [
          ...books.subscriptions,
          { ...books.subscriptions[0], title, amountMinor: 100, category: '@x' },
        ],
      };
    });
    const rounds: number[] = [];
    let result: CommandResult | null = null;
    for (let i = 0; i < 4 && table.phase === 'playing'; i += 1) {
      rounds.push(table.tableRound);
      result = autoRoll(table);
      table = result.table;
    }
    expect(rounds).toEqual([1, 1, 2, 2]);
    expect(table.phase).toBe('finished');
    expect(table.result).toMatchObject({ reason: 'round-limit', winnerId: 'p1' });
    expect(table.result!.ranking.map((r) => r.playerId)).toEqual(['p1', 'host']);
    expect(types(result!.events)).toContain('game_finished');
  });

  it('a finished game is shown to everyone by seat, with the ranking', () => {
    const finished = autoRoll(editBooks(playingTable(3), 'p2', escapes)).table;
    // p2 is third in the order: the two before them roll, then p2 escapes
    const done =
      finished.phase === 'finished' ? finished : autoRoll(autoRoll(finished).table).table;
    const view = projectFor(done, 'p1');
    expect(view.phase).toBe('finished');
    expect(view.result).toMatchObject({ reason: 'escaped', winnerSeat: 2 });
    expect(view.result!.ranking[0]).toMatchObject({ seat: 2, rank: 1, outcome: 'escaped' });
    expect(view.activeSeat).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"playerId"');
  });

  it('the finished table can be closed no more and moved on no more', () => {
    const table = autoRoll(editBooks(playingTable(2), 'host', escapes)).table;
    expectError(() => applyCommand(table, 'host', { type: 'close' }, ctx), 'WRONG_PHASE');
    expectError(() => applyCommand(table, 'host', { type: 'pass_card' }, ctx), 'WRONG_PHASE');
  });
});

describe('purity and replay', () => {
  it('never mutates the table it is given', () => {
    const table = deepFreeze(playingTable(3));
    const result = autoRoll(table);
    expect(result.table).not.toBe(table);
    expect(table.activePlayerId).toBe('host');
    expect(booksOf(table, 'host').state.boardPosition).toBeNull();
  });

  it('the same commands from the same table give the same game', () => {
    const play = (): Table => {
      let table = playingTable(3, {}, 99);
      for (let i = 0; i < 12 && table.phase === 'playing'; i += 1) {
        const who = table.activePlayerId!;
        const pending = booksOf(table, who).state.turn?.pending;
        // a Doodad cannot be passed at a table: it is paid
        const command: TableCommand = pending
          ? pending.offered
            ? pending.kind === 'doodad'
              ? { type: 'pay_doodad', cardId: pending.offered.cardId }
              : { type: 'pass_card' }
            : { type: 'draw_card', deck: pending.kind === 'deal' ? 'dealSmall' : pending.kind }
          : { type: 'roll' };
        table = applyCommand(table, who, command, ctx).table;
      }
      return table;
    };
    const first = play();
    expect(play()).toEqual(first);
    expect(first.version).toBeGreaterThan(5);
  });

  it('every player keeps their own books while the table plays', () => {
    let table = playingTable(3);
    for (let i = 0; i < 9; i += 1) table = autoRoll(table).table;
    const positions = table.players.map((p) => p.books!.state.boardPosition);
    expect(positions.every((p) => p !== null)).toBe(true);
    expect(CLASSIC.professions.length).toBeGreaterThan(0);
    // 3 players x 3 rolls each: every one has been paid the opening Payday exactly once or more, none shares a state object
    expect(new Set(table.players.map((p) => p.books)).size).toBe(3);
  });
});
