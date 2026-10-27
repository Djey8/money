import { applyDreamCommand, createDreamTable, passiveCommands } from './reducer';
import { reviewDreamTable } from './review';
import type { DreamTable } from './types';

const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };

function played(rounds: number): DreamTable {
  let t = createDreamTable(
    {
      id: 'r',
      hostId: 'host',
      hostName: 'Hanna',
      seed: 4,
      settings: { name: 'Review', professions: 'random', turnOrder: 'seat', difficulty: 'hard' },
    },
    ctx,
  ).table;
  t = applyDreamCommand(
    t,
    'host',
    { type: 'add_bot', name: 'Expert', policyId: 'expert' },
    ctx,
  ).table;
  t = applyDreamCommand(t, 'host', { type: 'start' }, ctx).table;
  for (let guard = 0; guard < rounds * 30 && t.tableRound <= rounds; guard += 1) {
    const who = t.activePlayerId!;
    for (const command of passiveCommands(t, who)) {
      try {
        t = applyDreamCommand(t, who, command, ctx).table;
        break;
      } catch {
        // the next passive move
      }
    }
  }
  return t;
}

describe('the review of a Dreamfund table', () => {
  it('is a small page: every player with the goals in percent, the pace against the simulation, what to watch and a summary', () => {
    const review = reviewDreamTable(played(30));
    expect(review.difficulty).toBe('hard');
    expect(review.players).toHaveLength(2);
    expect(review.players.map((p) => p.rank)).toEqual([1, 2]);
    for (const player of review.players) {
      for (const goal of Object.values(player.goals)) {
        expect(goal).toBeGreaterThanOrEqual(0);
        expect(goal).toBeLessThanOrEqual(100);
      }
      expect(player.character).toBeTruthy();
      expect(Array.isArray(player.watch)).toBe(true);
    }
    expect(review.players.find((p) => p.strategy === 'expert')).toBeTruthy();
    expect(review.summary[0]).toMatch(/Round \d+: .* leads/);
    // small: an agent pays for every token
    expect(JSON.stringify(review).length).toBeLessThan(6000);
  });
});
