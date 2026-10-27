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

describe('the levels of a bot', () => {
  it('splits an id into the strategy and the level, and refuses what does not exist', async () => {
    const { splitDreamBotId, dreamBotId } = await import('./bot-levels');
    expect(splitDreamBotId('expert')).toEqual({ base: 'expert', level: 'master' });
    expect(splitDreamBotId('expert--casual')).toEqual({ base: 'expert', level: 'casual' });
    expect(splitDreamBotId('expert--genius')).toBeNull();
    expect(splitDreamBotId('nobody')).toBeNull();
    expect(dreamBotId('saver', 'beginner')).toBe('saver--beginner');
    expect(dreamBotId('saver', 'master')).toBe('saver');
  });

  it('seat a bot of a level, refuse an unknown one, and a beginner slips where a master does not', () => {
    let t = createDreamTable(
      {
        id: 't',
        hostId: 'host',
        hostName: 'Hanna',
        seed: 2,
        settings: { name: 'L', professions: 'random' },
      },
      ctx,
    ).table;
    t = applyDreamCommand(
      t,
      'host',
      { type: 'add_bot', name: 'Casual', policyId: 'expert--casual' },
      ctx,
    ).table;
    expect(t.players[1].bot?.policyId).toBe('expert--casual');
    expect(() =>
      applyDreamCommand(t, 'host', { type: 'add_bot', name: 'X', policyId: 'expert--genius' }, ctx),
    ).toThrow(/Unknown bot/);
  });

  it('slip as often as the level says: never for a master, always at a chance of one', async () => {
    const { withDreamMistakes } = await import('./bot-levels');
    const { DREAM_POLICIES } = await import('../../dreamfund-sim/policies');
    const policy = DREAM_POLICIES.find((p) => p.id === 'expert')!;
    const view = {
      cashMinor: 0,
      monthlyExpensesMinor: 0,
      passiveMinor: 0,
      reserveMinor: 0,
      reserveTargetMinor: 0,
      round: 1,
      debtsMinor: 0,
      dreamFundedMinor: 0,
      dreamTargetMinor: 0,
      spendableMinor: 0,
      markets: {},
      holdingsCount: 0,
      difficulty: 'medium' as const,
    };
    const holding = { title: 'X', tag: 'tech' };
    const coin = () => 0.01;
    expect(withDreamMistakes(policy, 0, coin)).toBe(policy);
    const always = withDreamMistakes(policy, 1, coin);
    for (const index of [0.8, 1, 1.3]) {
      expect(always.sellWindow(view, holding, index)).toBe(
        !policy.sellWindow(view, holding, index),
      );
    }
    const never = withDreamMistakes(policy, 0.0001, () => 0.5);
    expect(never.sellWindow(view, holding, 1.3)).toBe(policy.sellWindow(view, holding, 1.3));
  });
});
