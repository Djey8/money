import { applyCommand, createTable } from './reducer';
import { testContext } from './testing';
import { tableLegalActions } from './legal';
import { projectFor } from './view';
import { TableCommandError, type Table, type TableCommand, type TableErrorCode } from './types';

const ctx = testContext;

function playingTable(settings: object = {}, players = 3): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 8, ...settings },
      seed: 3,
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

const types = (events: { type: string }[]) => events.map((e) => e.type);
const ids = (table: Table, who: string) => tableLegalActions(table, who).map((a) => a.action);

describe('undoing the last turn is the table’s vote', () => {
  it('needs more than half of the people: two of three', () => {
    const table = playingTable();
    const asked = applyCommand(table, 'p1', { type: 'propose_undo' }, ctx);
    expect(types(asked.events)).toEqual(['undo_proposed']);
    expect(asked.table.undoVote).toEqual({ proposerId: 'p1', yes: ['p1'], no: [] });
    // one yes of three is not a majority yet; everybody else is asked
    expect(ids(asked.table, 'host')).toContain('vote_undo');
    expect(ids(asked.table, 'p1')).not.toContain('vote_undo');
    const second = applyCommand(asked.table, 'host', { type: 'vote_undo', yes: true }, ctx);
    expect(types(second.events)).toEqual(['undo_voted', 'undo_approved']);
    expect(second.table.undoVote).toBeNull();
  });

  it('is turned down once a majority can no longer be reached', () => {
    const asked = applyCommand(playingTable(), 'p1', { type: 'propose_undo' }, ctx);
    const one = applyCommand(asked.table, 'host', { type: 'vote_undo', yes: false }, ctx);
    expect(one.table.undoVote).not.toBeNull(); // one no of three: p2 could still make it two yes
    const two = applyCommand(one.table, 'p2', { type: 'vote_undo', yes: false }, ctx);
    expect(types(two.events)).toEqual(['undo_voted', 'undo_rejected']);
    expect(two.table.undoVote).toBeNull();
  });

  it('is decided at once when the asker is the only person (the others are bots)', () => {
    let table = playingTable({}, 3);
    table = {
      ...table,
      players: table.players.map((p) =>
        p.id === 'host' ? p : { ...p, bot: { policyId: 'all-rounder' } },
      ),
    };
    const asked = applyCommand(table, 'host', { type: 'propose_undo' }, ctx);
    expect(types(asked.events)).toEqual(['undo_proposed', 'undo_approved']);
  });

  it('does not count bots or players who are away', () => {
    let table = playingTable({}, 3);
    table = {
      ...table,
      players: table.players.map((p) => (p.id === 'p2' ? { ...p, away: true } : p)),
    };
    // two people are here: the asker and one more - both must agree
    const asked = applyCommand(table, 'p1', { type: 'propose_undo' }, ctx);
    expect(asked.table.undoVote).not.toBeNull();
    expectError(
      () => applyCommand(asked.table, 'p2', { type: 'vote_undo', yes: true }, ctx),
      'ILLEGAL_MOVE',
    );
    const done = applyCommand(asked.table, 'host', { type: 'vote_undo', yes: true }, ctx);
    expect(types(done.events)).toContain('undo_approved');
  });

  it('can be switched off when the game is set up', () => {
    const table = playingTable({ allowRewind: false });
    expect(ids(table, 'p1')).not.toContain('propose_undo');
    expectError(() => applyCommand(table, 'p1', { type: 'propose_undo' }, ctx), 'ILLEGAL_MOVE');
  });

  it('allows one vote at a time, one voice each, and is dropped when the turn changes', () => {
    const asked = applyCommand(playingTable(), 'p1', { type: 'propose_undo' }, ctx);
    expectError(
      () => applyCommand(asked.table, 'host', { type: 'propose_undo' }, ctx),
      'ILLEGAL_MOVE',
    );
    const voted = applyCommand(asked.table, 'host', { type: 'vote_undo', yes: false }, ctx);
    expectError(
      () => applyCommand(voted.table, 'host', { type: 'vote_undo', yes: true }, ctx),
      'ILLEGAL_MOVE',
    );
    // the player on the move rolls and passes: the turn moves on and the vote with it
    let table = voted.table;
    const active = table.activePlayerId!;
    table = applyCommand(table, active, { type: 'roll' }, ctx).table;
    for (let i = 0; i < 6 && table.activePlayerId === active; i += 1) {
      table = applyCommand(table, active, { type: 'pass_card' }, ctx).table;
    }
    expect(table.activePlayerId).not.toBe(active);
    expect(table.undoVote ?? null).toBeNull();
  });

  it('shows the open vote by seat to everyone', () => {
    const asked = applyCommand(playingTable(), 'p1', { type: 'propose_undo' }, ctx);
    expect(projectFor(asked.table, 'host').undo).toEqual({
      proposerSeat: 1,
      yesSeats: [1],
      noSeats: [],
      voterSeats: [0, 1, 2],
    });
  });
});
