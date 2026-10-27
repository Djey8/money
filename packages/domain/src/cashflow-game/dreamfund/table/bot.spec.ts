import { TableCommandError } from '../../table/types';
import { dreamBotCommands, runDreamBots } from './bot';
import { applyDreamCommand, createDreamTable, passiveCommands, dreamStandings } from './reducer';
import type { DreamTable } from './types';

const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };

function tableWithBots(settings: Record<string, unknown> = {}, seed = 5): DreamTable {
  let t = createDreamTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Hanna',
      seed,
      settings: { name: 'Bots', professions: 'random', turnOrder: 'seat', ...settings },
    },
    ctx,
  ).table;
  t = applyDreamCommand(
    t,
    'host',
    { type: 'add_bot', name: 'Expert', policyId: 'expert' },
    ctx,
  ).table;
  t = applyDreamCommand(
    t,
    'host',
    { type: 'add_bot', name: 'Saver', policyId: 'saver' },
    ctx,
  ).table;
  t = applyDreamCommand(
    t,
    'host',
    { type: 'add_bot', name: 'Sapling', policyId: 'sapling' },
    ctx,
  ).table;
  return applyDreamCommand(t, 'host', { type: 'start' }, ctx).table;
}

/** The people at the table play passively, the bots with their strategies, until the game ends. */
function playOut(t: DreamTable, maxRounds: number): DreamTable {
  let current = t;
  for (let guard = 0; guard < maxRounds * 40 && current.phase === 'playing'; guard += 1) {
    current = runDreamBots(current, ctx).table;
    if (current.phase !== 'playing') break;
    const who = current.activePlayerId!;
    if (current.players.find((p) => p.id === who)?.bot) throw new Error('a bot is stuck');
    let moved = false;
    for (const command of passiveCommands(current, who)) {
      try {
        current = applyDreamCommand(current, who, command, ctx).table;
        moved = true;
        break;
      } catch (error) {
        if (!(error instanceof TableCommandError)) throw error;
      }
    }
    if (!moved) throw new Error('the person is stuck');
  }
  return current;
}

describe('the bots of a Dreamfund table', () => {
  it('have nothing to do when it is not their turn and no Harvest card waits for them', () => {
    const t = tableWithBots();
    const waiting = t.players.find((p) => p.bot && p.id !== t.activePlayerId)!;
    expect(dreamBotCommands(t, waiting.id)).toEqual([]);
    expect(dreamBotCommands(t, 'host')).toEqual([]);
  });

  it('play a whole table to its end with the commands a person sends', () => {
    const t = playOut(tableWithBots({ endCondition: 'round-limit', roundLimit: 60 }), 80);
    expect(t.phase).toBe('finished');
    expect(t.result?.reason).toBe('round-limit');
    const ranking = dreamStandings(t);
    expect(ranking).toHaveLength(4);
    const byName = (name: string) =>
      ranking.find((r) => t.players.find((p) => p.id === r.playerId)!.name === name)!;
    // a strategy that invests gets further than a person who only rolls
    expect(byName('Expert').score).toBeGreaterThan(byName('Hanna').score);
    expect(byName('Expert').reserveMinor + byName('Expert').passiveMinor).toBeGreaterThan(0);
  });

  it('play the same game from the same seed', () => {
    const a = playOut(tableWithBots({ endCondition: 'round-limit', roundLimit: 25 }, 9), 40);
    const b = playOut(tableWithBots({ endCondition: 'round-limit', roundLimit: 25 }, 9), 40);
    expect(a.players.map((p) => p.life)).toEqual(b.players.map((p) => p.life));
  });
});
