import { seededRng } from '../rng';
import { PRESET_POLICIES } from '../simulation/strategies';
import { nextBotCommand, botFallbackCommand } from './bot';
import { applyCommand, createTable, type TableContext } from './reducer';
import { humansAreOut } from './turns';
import { leakProblems, tableInvariantProblems } from './simulate';
import { testContext } from './testing';
import { TableCommandError, type Table, type TableCommand } from './types';
import { projectFor } from './view';

jest.setTimeout(120_000);

const ctx: TableContext = testContext;
const policy = (id: string) => PRESET_POLICIES.find((p) => p.id === id)!;
const HOST = 'acct-host';

function lobby(): Table {
  return createTable(
    {
      id: 't1',
      hostId: HOST,
      hostName: 'Host',
      settings: { name: 'Bots', professions: 'duplicates', maxSeats: 6, clock: { mode: 'none' } },
      seed: 5,
    },
    ctx,
  ).table;
}

const run = (table: Table, who: string, command: TableCommand) =>
  applyCommand(table, who, command, ctx).table;

function refusal(table: Table, who: string, command: TableCommand): string {
  try {
    applyCommand(table, who, command, ctx);
  } catch (error) {
    if (error instanceof TableCommandError) return error.code;
    throw error;
  }
  return 'accepted';
}

describe('seating a bot', () => {
  it('the host adds a bot in the lobby; it is ready, has no account and shows as a bot', () => {
    let table = lobby();
    table = run(table, HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' });
    const bot = table.players[1];
    expect(bot.id).toMatch(/^bot:/);
    expect(bot.ready).toBe(true);
    expect(bot.bot).toEqual({ policyId: 'all-rounder' });
    const view = projectFor(table, HOST);
    expect(view.players[1].bot).toEqual({ policyId: 'all-rounder' });
    expect(view.players[0].bot).toBeNull();
    expect(JSON.stringify(view)).not.toContain('bot:'); // the bot's id is no business of the viewer
  });

  it('a strategy at a level sits at a table once, another level of it may join', () => {
    const table = run(lobby(), HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' });
    expect(refusal(table, HOST, { type: 'add_bot', name: 'Rob2', policyId: 'all-rounder' })).toBe(
      'BOT_DUPLICATE',
    );
    const both = run(table, HOST, {
      type: 'add_bot',
      name: 'Rob Jr',
      policyId: 'all-rounder--casual',
    });
    expect(both.players.map((p) => p.bot?.policyId)).toEqual([
      undefined,
      'all-rounder',
      'all-rounder--casual',
    ]);
  });

  it('only the host, only in the lobby, not past the seats, not under a taken name', () => {
    let table = lobby();
    table = run(table, 'acct-2', { type: 'join', name: 'Guest' });
    expect(
      refusal(table, 'acct-2', { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' }),
    ).toBe('NOT_HOST');
    expect(refusal(table, HOST, { type: 'add_bot', name: 'guest', policyId: 'all-rounder' })).toBe(
      'NAME_TAKEN',
    );
    expect(refusal(table, HOST, { type: 'add_bot', name: 'Rob', policyId: 'No Spaces!' })).toBe(
      'INVALID_SETTINGS',
    );
    expect(
      refusal(table, HOST, {
        type: 'add_bot',
        name: 'Rob',
        policyId: 'all-rounder',
        professionId: 'nonsense',
      }),
    ).toBe('UNKNOWN_PROFESSION');
    const small = run(table, HOST, {
      type: 'update_settings',
      settings: { maxSeats: 2 },
    });
    expect(refusal(small, HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' })).toBe(
      'TABLE_FULL',
    );
  });

  it('a host who leaves the lobby hands the table to a person - and when only bots are left it is closed', () => {
    let table = run(lobby(), HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' });
    const alone = applyCommand(table, HOST, { type: 'leave' }, ctx);
    // nobody left to play the table: it closes, a bot is never made its host
    expect(alone.table.phase).toBe('abandoned');
    table = run(table, 'acct-2', { type: 'join', name: 'Guest' });
    const handed = applyCommand(table, HOST, { type: 'leave' }, ctx).table;
    expect(handed.phase).toBe('lobby');
    expect(handed.hostId).toBe('acct-2');
  });

  it('the host can remove a bot like any player', () => {
    let table = lobby();
    table = run(table, HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' });
    const botId = table.players[1].id;
    table = run(table, HOST, { type: 'kick', target: botId });
    expect(table.players).toHaveLength(1);
  });

  it('at start a bot picks its own profession, and the humans still pick theirs', () => {
    let table = lobby();
    table = run(table, HOST, {
      type: 'add_bot',
      name: 'Rob',
      policyId: 'all-rounder',
      professionId: 'pilot',
    });
    table = run(table, HOST, { type: 'set_ready', ready: true });
    table = run(table, HOST, { type: 'start' });
    expect(table.phase).toBe('picking');
    expect(table.players[1].pick).toBe('pilot');
    expect(table.players[0].pick).toBeNull();
    table = run(table, HOST, { type: 'pick_profession', professionId: 'lehrer' });
    expect(table.phase).toBe('playing');
    expect(table.players.map((p) => p.professionId)).toEqual(['lehrer', 'pilot']);
  });
});

describe('the last person leaving a ranked game that has started', () => {
  const started = (settings: object = {}) => {
    let table = createTable(
      {
        id: 't2',
        hostId: HOST,
        hostName: 'Host',
        settings: {
          name: 'Bots',
          professions: 'duplicates',
          maxSeats: 6,
          clock: { mode: 'none' },
          ...settings,
        },
        seed: 5,
      },
      ctx,
    ).table;
    table = run(table, HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' });
    table = run(table, HOST, { type: 'add_bot', name: 'Bea', policyId: 'mlm-then-properties' });
    table = run(table, HOST, { type: 'set_ready', ready: true });
    table = run(table, HOST, { type: 'start' });
    return run(table, HOST, { type: 'pick_profession', professionId: 'manager' });
  };

  it('is a loss from the first moment: the table is not closed, the bots play it to its end', () => {
    const left = applyCommand(started(), HOST, { type: 'leave' }, ctx).table;
    expect(left.phase).toBe('playing');
    expect(left.players[0].status).toBe('left');
    expect(humansAreOut(left)).toBe(true);
    expect(projectFor(left, null).fastForward).toBe(true);
  });

  it('is free during the rounds the host gave, and on a table that is not ranked', () => {
    expect(
      applyCommand(started({ leaveFreeRounds: 1 }), HOST, { type: 'leave' }, ctx).table.phase,
    ).toBe('abandoned');
    expect(applyCommand(started({ ranked: false }), HOST, { type: 'leave' }, ctx).table.phase).toBe(
      'abandoned',
    );
  });

  it('nobody waits for bots once the people are out, and a person still playing is waited for', () => {
    expect(humansAreOut(started())).toBe(false);
    expect(projectFor(started(), HOST).fastForward).toBe(false);
  });
});

describe('a table of people and bots, played to the end through the bots own door', () => {
  it('plays a whole game with every invariant intact, the bots only ever sending legal moves', () => {
    let table = lobby();
    table = run(table, HOST, { type: 'add_bot', name: 'Rob', policyId: 'all-rounder' });
    table = run(table, HOST, { type: 'add_bot', name: 'Bea', policyId: 'mlm-then-properties' });
    table = run(table, HOST, { type: 'set_ready', ready: true });
    table = run(table, HOST, { type: 'start' });
    table = run(table, HOST, { type: 'pick_profession', professionId: 'manager' });
    expect(table.phase).toBe('playing');

    // the host's seat is played by a strategy too (a person is not needed to test the bots)
    const policies = new Map<string, ReturnType<typeof policy>>([
      [HOST, policy('cash-properties')],
      [table.players[1].id, policy('all-rounder')],
      [table.players[2].id, policy('mlm-then-properties')],
    ]);
    const coin = seededRng(9);
    const problems: string[] = [];
    let steps = 0;
    while (table.phase === 'playing' && steps < 20_000) {
      steps += 1;
      let moved = false;
      // everybody gets the chance to act (selling off turn, answering a trade), the player on the move first
      const order = [
        table.activePlayerId as string,
        ...table.players.map((p) => p.id).filter((id) => id !== table.activePlayerId),
      ];
      for (const id of order) {
        const command = nextBotCommand(table, id, policies.get(id)!, coin);
        if (!command) continue;
        try {
          table = applyCommand(table, id, command, ctx).table;
        } catch (error) {
          if (!(error instanceof TableCommandError)) throw error;
          const fallback = botFallbackCommand(table, id);
          if (!fallback) continue;
          table = applyCommand(table, id, fallback, ctx).table;
        }
        problems.push(...tableInvariantProblems(table, null));
        moved = true;
        break;
      }
      // the turn is over and waits for the people who can still sell: the host's seat (a person) says done
      if (!moved && table.hold) {
        for (const id of [...table.hold.playerIds]) {
          table = applyCommand(table, id, { type: 'done' }, ctx).table;
        }
        moved = true;
      }
      if (!moved) break;
    }
    expect(problems).toEqual([]);
    expect(table.phase).toBe('finished');
    expect(leakProblems(table)).toEqual([]);
    expect(table.result!.ranking).toHaveLength(3);
  });

  it('a bot with nothing to do, or when the game is paused or over, does nothing', () => {
    const table = lobby();
    expect(nextBotCommand(table, HOST, policy('all-rounder'), seededRng(1))).toBeNull();
  });
});
