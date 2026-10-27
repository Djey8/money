import { playBotTable, runBotTournament } from './tournament';

describe('the bot tournament of the Dreamfund', () => {
  it('plays a table of bots only, to its end', () => {
    const table = playBotTable({
      id: 't',
      seed: 7,
      difficulty: 'medium',
      roundLimit: 6,
      bots: [
        { botId: 'expert', character: 'jan-oberarzt' },
        { botId: 'saver--casual', character: 'peter-busfahrer' },
      ],
    });
    expect(table.phase).toBe('finished');
    expect(table.result?.ranking).toHaveLength(2);
    expect(table.players.every((p) => p.bot)).toBe(true);
  });

  it('rates every bot, the same for the same seed', () => {
    const run = () =>
      runBotTournament({
        difficulty: 'easy',
        tables: 3,
        seats: 2,
        roundLimit: 4,
        seed: 3,
        strategies: ['expert', 'saver'],
        levels: ['master', 'beginner'],
      });
    const first = run();
    expect(first).toHaveLength(4);
    expect(first.reduce((n, b) => n + b.games, 0)).toBe(6);
    expect(run()).toEqual(first);
    // ratings only move between the bots: the table's total stays
    expect(first.reduce((n, b) => n + b.rating, 0)).toBeCloseTo(4 * 1500, 0);
  });
});
