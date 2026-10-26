import { reportMarkdown, runBatch } from './batch';
import { simulateDreamGame } from './world';
import { DREAM_POLICIES, policyById } from './policies';

describe('the Dreamfund simulation', () => {
  it('plays a whole game: the same seed gives the same game, and no game stops with an error', () => {
    const policy = policyById('saver');
    const a = simulateDreamGame({ seed: 7, policy, maxTurns: 150 });
    const b = simulateDreamGame({ seed: 7, policy, maxTurns: 150 });
    expect(a.error).toBeUndefined();
    expect(a).toEqual(b);
    expect(a.turns).toBeGreaterThan(20);
    expect(a.paydays).toBeGreaterThan(5);
    expect(Object.keys(a.landings).length).toBeGreaterThan(3);
  });

  it('a batch over every strategy runs without engine errors and reports', () => {
    const result = runBatch({ games: 3, maxTurns: 160 });
    expect(result.records).toHaveLength(DREAM_POLICIES.length * 3);
    expect(result.errors).toEqual([]);
    const report = reportMarkdown(result);
    expect(report).toContain('| saver |');
    expect(report).toContain('| gambler |');
    console.log(report.split('\n').slice(0, 14).join('\n'));
  });
});
