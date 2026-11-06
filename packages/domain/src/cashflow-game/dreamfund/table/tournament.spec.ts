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

  // two tables that used to stall for ever: a bot that went bankrupt on its own roll stayed the player on the move, and a bot that had
  // said it would take a card offered by another could not after all, so the seller waited for an answer that never came
  it.each([
    ['a bankrupt player on the move', 231, ['flipper', 'scholar', 'expert--casual', 'tree']],
    ['an offer a bot cannot take', 1386, ['expert', 'sapling', 'expert--casual', 'tree']],
  ])(
    'plays on to the end: %s',
    (_name, seed, bots) => {
      const table = playBotTable({
        id: 'stall',
        seed,
        difficulty: 'easy',
        roundLimit: 40,
        bots: bots.map((botId, index) => ({
          botId,
          character: index % 2 ? 'jan-oberarzt' : 'dual-student-informatik',
        })),
      });
      expect(table.phase).toBe('finished');
    },
    120_000,
  );

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
