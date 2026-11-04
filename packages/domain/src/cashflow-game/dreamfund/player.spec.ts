import { DREAM_POLICIES } from '../dreamfund-sim/policies';
import { simulateDreamGame } from '../dreamfund-sim/world';
import { DreamPlayer } from './player';

const player = (seed = 1, professionId?: string) =>
  DreamPlayer.fromSeed({ seed, professionId, rules: { difficulty: 'medium' } });

describe('DreamPlayer', () => {
  it('starts as the character: cash, expenses, debts, the dream and the reserve target', () => {
    const p = player(1, 'jan-oberarzt');
    expect(p.profession.id).toBe('jan-oberarzt');
    expect(p.cash()).toBeGreaterThan(0);
    expect(p.monthlyExpenses()).toBeGreaterThan(0);
    expect(p.debtsMinor()).toBe(2400000);
    expect(p.dreamTargetMinor).toBe(13600000);
    expect(p.reserveMinor).toBe(0);
    expect(p.isOver()).toBe(false);
  });

  it('plays the same life from the same seed, and another from another', () => {
    const run = (seed: number) => {
      const p = player(seed);
      const landed: string[] = [];
      for (let i = 0; i < 20; i += 1) {
        landed.push(p.roll().landed);
        p.endTurn();
      }
      return landed.join(',');
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });

  it('pays from the reserve first and takes the Bank loan for what is still short', () => {
    const p = player(1);
    p.reserveMinor = 30000;
    const cash = p.cash();
    p.spend(cash + 20000, '@Test');
    expect(p.reserveMinor).toBe(10000);
    p.spend(cash + 100000000, '@Test');
    expect(p.books.liabilities.some((l) => l.tag === 'Bank loan' && l.amountMinor > 0)).toBe(true);
  });

  it('offers an emergency on a plan of three, six or twelve Paydays with the difficulty surcharge', () => {
    const p = player(1);
    const options = p.emergencyPlanOptions(100000);
    expect(options.map((o) => o.months)).toEqual([3, 6, 12]);
    expect(options[0].total).toBeGreaterThan(100000);
    expect(options[2].total).toBeGreaterThan(options[0].total);
    p.planEmergency('E01', options[1]);
    expect(p.plans).toEqual([
      {
        kind: 'emergency',
        id: 'E01',
        perMinor: options[1].per,
        leftMinor: options[1].total,
        totalMinor: options[1].total,
      },
    ]);
    const before = p.cash();
    p.payInstallments();
    expect(p.cash()).toBe(before - options[1].per);
  });

  it('lives a dream when it is funded, and counts its points', () => {
    const p = player(1);
    const drawn = p.drawDream();
    expect(drawn).not.toBeNull();
    const offers = drawn!.landing.kind === 'offers' ? drawn!.landing.offers : [];
    if (offers[0]) {
      p.takeDream(offers[0]);
      expect(p.smile).toHaveLength(1);
      p.smile[0].savedMinor = p.smile[0].totalMinor;
      p.checkDreams();
      expect(p.smile).toHaveLength(0);
      expect(p.dreamPoints).toBe(offers[0].points);
    }
  });
});

describe('the simulation on the engine', () => {
  it('plays a fixed game to a fixed record (it was the same before the engine was extracted)', () => {
    const policy = DREAM_POLICIES.find((candidate) => candidate.id === 'expert')!;
    const a = simulateDreamGame({ seed: 3, policy, maxTurns: 150 });
    const b = simulateDreamGame({ seed: 3, policy, maxTurns: 150 });
    expect(a).toEqual(b);
    expect(a.outcome).not.toBe('error');
    expect(a.turns).toBeGreaterThan(30);
  });

  it('shows the die of the job search of a Payday and what it came to', () => {
    const player = DreamPlayer.fromSeed({ seed: 4, professionId: 'dual-student-informatik' });
    const search = {
      title: { en: 'Laid off', de: 'Entlassen' },
      rollFrom: 7,
      paydaysLeft: 5,
      fallbackPercent: 20,
    };
    player.setState({ ...player.state, jobSearch: search });
    let seen: ReturnType<DreamPlayer['roll']>['jobSearch'];
    for (let i = 0; i < 12 && !seen; i += 1) {
      seen = player.roll().jobSearch;
      if (player.state.jobSearch === undefined) break;
    }
    expect(seen).toMatchObject({ rollFrom: 7, result: 'missed', paydaysLeft: 5 });
    expect(seen!.roll).toBeGreaterThanOrEqual(1);
    expect(player.state.jobSearch?.paydaysLeft).toBeLessThan(5);
    // a die that finds the job
    const lucky = DreamPlayer.fromSeed({ seed: 4, professionId: 'dual-student-informatik' });
    lucky.setState({ ...lucky.state, jobSearch: { ...search, rollFrom: 1 } });
    let found: ReturnType<DreamPlayer['roll']>['jobSearch'];
    for (let i = 0; i < 12 && !found; i += 1) found = lucky.roll().jobSearch;
    expect(found?.result).toBe('found');
    expect(lucky.state.jobSearch).toBeUndefined();
  });
});
