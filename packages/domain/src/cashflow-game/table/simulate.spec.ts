import * as fs from 'fs';
import * as path from 'path';
import { PRESET_POLICIES } from '../simulation/strategies';
import {
  digestTable,
  leakProblems,
  replayScript,
  simulateTable,
  tableInvariantProblems,
  type TableScript,
  type TableSimConfig,
} from './simulate';
import { testContext } from './testing';
import type { Table, TableEvent } from './types';

jest.setTimeout(180_000);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { clock: _clock, ...context } = testContext;
const base = (over: Partial<TableSimConfig>): TableSimConfig => ({
  players: 4,
  seed: 1,
  context,
  maxCommands: 8000,
  ...over,
});
const count = (events: TableEvent[], type: TableEvent['type']) =>
  events.filter((e) => e.type === type).length;

describe("whole tables, played by the strategy lab's policies", () => {
  const sizes = [2, 4, 8, 12];
  const seeds = [1, 2, 3];
  const totals = {
    market_effect: 0,
    position_sold: 0,
    card_played: 0,
    player_bankrupt: 0,
    dice_decided: 0,
  };

  it.each(sizes.flatMap((players) => seeds.map((seed) => [players, seed])))(
    '%i players, seed %i: plays to an end with every invariant intact',
    (players, seed) => {
      const run = simulateTable(base({ players, seed }));
      expect(run.problems).toEqual([]);
      expect(run.cutOff).toBe(false);
      expect(run.table.phase).toBe('finished');
      // one accepted command per version, creation included
      expect(run.table.version).toBe(run.commands);
      expect(run.table.result!.ranking).toHaveLength(players);
      expect(run.table.result!.ranking.map((r) => r.rank)).toEqual(
        Array.from({ length: players }, (_, i) => i + 1),
      );
      for (const type of Object.keys(totals) as (keyof typeof totals)[]) {
        totals[type] += count(run.events, type);
      }
    },
  );

  it('the games between them used the whole table: Market cards, sales, purchases, bankruptcies, dice', () => {
    for (const [type, n] of Object.entries(totals)) expect([type, n > 0]).toEqual([type, true]);
  });

  it('the same config plays the same game; another seed plays another', () => {
    const a = simulateTable(base({ players: 6, seed: 42 }));
    const b = simulateTable(base({ players: 6, seed: 42 }));
    expect(digestTable(b.table)).toBe(digestTable(a.table));
    expect(b.events).toEqual(a.events);
    expect(b.script).toEqual(a.script);
    expect(digestTable(simulateTable(base({ players: 6, seed: 43 })).table)).not.toBe(
      digestTable(a.table),
    );
  });

  it('a recorded script replays to the identical table and events', () => {
    for (const config of [base({ players: 4, seed: 7 }), base({ players: 8, seed: 9 })]) {
      const run = simulateTable(config);
      const replayed = replayScript(run.script, context);
      expect(replayed.table).toEqual(run.table);
      expect(replayed.events).toEqual(run.events);
    }
  });

  it('the strict preset (Doodads must be paid, offers last one roll) plays out too', () => {
    const run = simulateTable(base({ players: 6, seed: 5, settings: { rulesBase: 'strict' } }));
    expect(run.problems).toEqual([]);
    expect(run.table.phase).toBe('finished');
  });

  it('every policy of the lab sits at a table without breaking it', () => {
    PRESET_POLICIES.forEach((policy, index) => {
      const run = simulateTable(
        base({
          players: 3,
          seed: 100 + index,
          policies: [policy, PRESET_POLICIES[0], PRESET_POLICIES[8]],
        }),
      );
      expect([policy.id, run.problems]).toEqual([policy.id, []]);
      expect(run.cutOff).toBe(false);
    });
  });
});

describe('trading the card in hand', () => {
  it('whole games with trades keep every invariant, and replay', () => {
    let trades = 0;
    for (const [players, seed] of [
      [3, 1],
      [4, 2],
      [6, 3],
      [8, 4],
    ]) {
      const run = simulateTable(base({ players, seed, trading: true }));
      expect(run.problems).toEqual([]);
      expect(run.table.phase).toBe('finished');
      trades += count(run.events, 'trade_made');
      expect(replayScript(run.script, context).table).toEqual(run.table);
    }
    expect(trades).toBeGreaterThan(0);
  });
});

describe('players who do not answer', () => {
  it('a slow player is timed out and then marked away; the table still finishes', () => {
    const run = simulateTable(
      base({ players: 4, seed: 11, slowSeats: [1], settings: { awayAfterTimeouts: 2 } }),
    );
    expect(run.problems).toEqual([]);
    expect(run.timeouts).toBeGreaterThanOrEqual(2);
    expect(count(run.events, 'turn_timeout')).toBe(run.timeouts);
    expect(count(run.events, 'player_away')).toBe(1);
    expect(run.table.phase).toBe('finished');
    // a script with timeouts replays exactly
    expect(replayScript(run.script, context).table).toEqual(run.table);
  });

  it('works on a bank clock with an increment too', () => {
    const run = simulateTable(
      base({
        players: 4,
        seed: 12,
        slowSeats: [2],
        settings: { clock: { mode: 'bank', bankSeconds: 300, incrementSeconds: 5 } },
      }),
    );
    expect(run.problems).toEqual([]);
    expect(run.timeouts).toBeGreaterThan(0);
    expect(run.table.phase).toBe('finished');
  });

  it('a table where everybody is passive ends under a round limit', () => {
    const run = simulateTable(
      base({
        players: 4,
        seed: 13,
        slowSeats: [0, 1, 2, 3],
        settings: { awayAfterTimeouts: 20, endCondition: 'round-limit', roundLimit: 6 },
      }),
    );
    expect(run.problems).toEqual([]);
    expect(run.table.phase).toBe('finished');
    expect(run.table.result!.reason).toBe('round-limit');
    expect(run.table.tableRound).toBeLessThanOrEqual(6);
    // nobody bought or sold anything: only the passive turn was ever played
    expect(count(run.events, 'card_played')).toBe(0);
    expect(count(run.events, 'position_sold')).toBe(0);
    expect(count(run.events, 'loan_changed')).toBe(0);
  });

  it('a table where everybody is away closes instead of playing itself out', () => {
    const run = simulateTable(
      base({ players: 3, seed: 14, slowSeats: [0, 1, 2], settings: { awayAfterTimeouts: 1 } }),
    );
    expect(run.problems).toEqual([]);
    expect(run.table.phase).toBe('abandoned');
    expect(
      run.events.find((e) => e.type === 'table_closed' && e.data?.reason === 'everyone_away'),
    ).toBeDefined();
  });
});

describe('the invariant checks catch a broken table', () => {
  const table = simulateTable(base({ players: 3, seed: 3, maxCommands: 40 })).table;

  it('is silent on a healthy table', () => {
    expect(tableInvariantProblems(table, null)).toEqual([]);
    expect(leakProblems(table)).toEqual([]);
  });

  it('notices a skipped version, a repeated pile card, and a dead player on the move', () => {
    expect(tableInvariantProblems({ ...table, version: table.version + 2 }, table)).toEqual([
      expect.stringContaining('version'),
    ]);
    const card = 'classic-small-efh';
    expect(
      tableInvariantProblems(
        { ...table, drawnCardIds: { ...table.drawnCardIds, dealSmall: [card, card] } },
        null,
      ).join(' '),
    ).toContain('twice');
    const dead: Table = {
      ...table,
      players: table.players.map((p) =>
        p.id === table.activePlayerId ? { ...p, status: 'left' as const } : p,
      ),
    };
    expect(tableInvariantProblems(dead, null).join(' ')).toContain('left');
  });

  it('notices fractional money', () => {
    const broken: Table = {
      ...table,
      players: table.players.map((p, i) =>
        i === 0 && p.books
          ? {
              ...p,
              books: {
                ...p.books,
                transactions: [
                  ...p.books.transactions,
                  { ...p.books.transactions[0], amountMinor: 10.5 },
                ],
              },
            }
          : p,
      ),
    };
    expect(tableInvariantProblems(broken, null).join(' ')).toContain('whole minor units');
  });
});

describe('the golden game', () => {
  /** 4 players, the lab's presets, a slow seat: the game the server's and the bot harness's tests replay. */
  const config = base({
    players: 4,
    seed: 20261015,
    slowSeats: [3],
    settings: { awayAfterTimeouts: 3 },
  });
  const fixture = path.join(__dirname, 'fixtures', 'golden-4p.json');
  // The digest of the table this script ends in. When the rules change on purpose, regenerate with UPDATE_GOLDEN=1.
  const GOLDEN_DIGEST = 'd807e938';

  it('replays from the committed script to the pinned table', () => {
    const run = simulateTable(config);
    if (process.env.UPDATE_GOLDEN === '1') {
      fs.writeFileSync(
        fixture,
        JSON.stringify({ digest: digestTable(run.table), script: run.script }),
      );
    }
    const stored = JSON.parse(fs.readFileSync(fixture, 'utf-8')) as {
      digest: string;
      script: TableScript;
    };
    expect(run.problems).toEqual([]);
    // the committed script is still the game this config plays ...
    expect(stored.script).toEqual(JSON.parse(JSON.stringify(run.script)));
    // ... and it still ends where it ended
    const replayed = replayScript(stored.script, context);
    expect(digestTable(replayed.table)).toBe(stored.digest);
    expect(stored.digest).toBe(GOLDEN_DIGEST);
    expect(replayed.table.phase).toBe('finished');
  });
});
