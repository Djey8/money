import { paramPolicy } from '../simulation/strategies';
import type { PolicyView, TableAwareness } from '../simulation/policy';
import type { CashflowDealCard } from '../types';
import { tableAwareness } from './awareness';
import { playMatch } from './tournament';
import { PRESET_POLICIES } from '../simulation/strategies';
import type { Table } from './types';

const sub = (title: string, amountMinor: number) => ({ title, amountMinor });
const player = (
  id: string,
  passive: number,
  expenses: number,
  over: Record<string, unknown> = {},
) => ({
  id,
  status: 'active',
  books: {
    state: { professionId: 'p', gameSubscriptionTitles: ['Salary', 'Rent', 'X Cashflow'] },
    subscriptions: [sub('Salary', 500000), sub('Rent', -expenses), sub('X Cashflow', passive)],
  },
  ...over,
});

describe('tableAwareness', () => {
  it('reads the race from the public books: each rival, the leader, and my own coverage', () => {
    const table = {
      players: [
        player('me', 50000, 100000),
        player('a', 80000, 100000),
        player('b', 20000, 100000),
      ],
    } as unknown as Table;
    const view = tableAwareness(table, 'me');
    expect(view.myCoverage).toBeCloseTo(0.5);
    expect(view.rivals.map((r) => r.coverage)).toEqual([0.8, 0.2]);
    expect(view.leaderCoverage).toBeCloseTo(0.8);
    expect(view.seats).toBe(3);
  });

  it('ignores players who left or have no books, and a bankrupt rival does not lead', () => {
    const table = {
      players: [
        player('me', 0, 100000),
        player('gone', 90000, 100000, { status: 'left' }),
        player('nobooks', 0, 0, { books: null }),
        player('broke', 95000, 100000000),
      ],
    } as unknown as Table;
    const view = tableAwareness(table, 'me');
    expect(view.rivals).toHaveLength(1);
    expect(view.leaderCoverage).toBeLessThan(0.01);
  });
});

describe('race-aware policies', () => {
  const card = {
    id: 'c',
    title: 'House',
    assetKind: 'investment',
    depositMinor: 1000000,
    cashflowMinor: 20000, // 2% a month
  } as CashflowDealCard;
  const view = (table?: TableAwareness): PolicyView =>
    ({
      books: {},
      cashMinor: 1100000,
      finances: {},
      bankLoanMinor: 0,
      loanStepMinor: 100000,
      loanInterestPercent: 10,
      round: 1,
      turn: 1,
      children: 0,
      charityRoundsLeft: 0,
      ...(table ? { table } : {}),
    }) as unknown as PolicyView;
  const race = (mine: number, leader: number): TableAwareness => ({
    rivals: [{ coverage: leader, escaped: false, bankrupt: false }],
    leaderCoverage: leader,
    myCoverage: mine,
    seats: 2,
  });

  const careful = {
    minMonthlyReturn: 0.03,
    reserveMinor: 200000,
  };
  const policy = paramPolicy('t', 't', '', {
    ...careful,
    catchUp: { gap: 0.2, minMonthlyReturnFactor: 0.5, loanCoverageFactor: 1, reserveFactor: 0 },
    protectLead: { gap: 0.2, minMonthlyReturnFactor: 2, loanCoverageFactor: 1, reserveFactor: 1 },
  });

  it('passes a 2% card when level, but takes it when a rival is well ahead', () => {
    expect(policy.deal(view(race(0.3, 0.3)), card).buy).toBe(false);
    expect(policy.deal(view(race(0.2, 0.6)), card).buy).toBe(true);
  });

  it('is stricter still when it leads', () => {
    const looser = paramPolicy('t2', 't2', '', {
      minMonthlyReturn: 0.015,
      reserveMinor: 0,
      protectLead: { gap: 0.2, minMonthlyReturnFactor: 2, loanCoverageFactor: 1, reserveFactor: 1 },
    });
    expect(looser.deal(view(race(0.3, 0.3)), card).buy).toBe(true);
    expect(looser.deal(view(race(0.8, 0.3)), card).buy).toBe(false);
  });

  it('plays alone exactly as before: no table, no change', () => {
    expect(policy.deal(view(), card).buy).toBe(false);
  });

  it('a race-aware policy plays a whole table to an end', () => {
    const aware = paramPolicy('aware', 'aware', '', {
      minMonthlyReturn: 0.03,
      reserveMinor: 100000,
      loans: 'bridge',
      catchUp: {
        gap: 0.15,
        minMonthlyReturnFactor: 0.5,
        loanCoverageFactor: 0.7,
        reserveFactor: 0.3,
      },
    });
    const match = playMatch({
      seed: 4,
      policies: [aware, PRESET_POLICIES.find((p) => p.id === 'all-rounder')!],
      professionIds: ['lehrer', 'lehrer'],
    });
    expect(match.problems).toEqual([]);
    expect(match.cutOff).toBe(false);
  });
});
