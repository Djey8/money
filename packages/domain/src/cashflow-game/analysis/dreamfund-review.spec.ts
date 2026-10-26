import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import type { GameSnapshot } from '../history';
import { describeDreamfundReview, reviewDreamfund } from './dreamfund-review';

/** A small Dreamfund game: a salary, a hustle bought in month 3, a Bank loan in month 5. */
function position(
  round: number,
  extra: { hustle?: boolean; loan?: number; reserve?: number; debts?: boolean } = {},
): GameSnapshot {
  const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories')!;
  const state = {
    gameSetId: gameSet.id,
    professionId: gameSet.professions[0].id,
    mode: 'solo',
    round,
    life: {
      relationship: 'single',
      kids: 0,
      pet: 'none',
      car: false,
      home: 'own_flat',
      location: 'home_city',
      employment: 'employed',
    },
    lineTitles: { incomeTax: 'Tax' },
    gameSubscriptionTitles: ['Salary', 'Rent', 'Tutoring Cashflow'],
    turn: { phase: 'roll', count: round * 3 },
    holdings: extra.hustle
      ? [{ cardId: 'S31', title: 'Tutoring', cashflowMinor: 24000, paidMinor: 5000, paydays: 1 }]
      : [],
  };
  const subs = [
    {
      title: 'Salary',
      account: 'Income',
      amount: 2833,
      startDate: '2026-11-01',
      endDate: '',
      category: '',
      comment: '',
      frequency: 'monthly',
    },
    {
      title: 'Rent',
      account: 'Daily',
      amount: -800,
      startDate: '2026-11-01',
      endDate: '',
      category: '',
      comment: '',
      frequency: 'monthly',
    },
    ...(extra.hustle
      ? [
          {
            title: 'Tutoring Cashflow',
            account: 'Income',
            amount: 240,
            startDate: '2026-11-01',
            endDate: '',
            category: '',
            comment: '',
            frequency: 'monthly',
          },
        ]
      : []),
  ];
  return {
    allTransactions: [
      { account: 'Daily', amount: 1000, date: '2026-11-01', time: '', category: '@x', comment: '' },
    ],
    allSubscriptions: subs,
    allGrowProjects: [],
    allShares: [],
    allInvestments: [],
    allAssets: [],
    liabilities: [
      ...(extra.loan ? [{ tag: 'Bank loan', amount: extra.loan }] : []),
      ...(extra.debts ? [{ tag: 'Eltern-Darlehen', amount: 1500 }] : []),
    ],
    allSmileProjects: [],
    allFireEmergencies: [],
    mojo: { amount: extra.reserve ?? 0, target: 1000 },
    cashflowGame: state as never,
  } as unknown as GameSnapshot;
}

describe('the Dreamfund review', () => {
  it('reads the story of a game: the milestones, what was bought, the loans, and what to do differently', () => {
    const stack = [
      { ...position(1, { debts: true }), step: { kind: 'start' as const, at: 't' } },
      { ...position(2, { debts: true }), step: { kind: 'roll' as const, at: 't' } },
      { ...position(3, { debts: true }), step: { kind: 'buyDeal' as const, at: 't' } },
      {
        ...position(4, { hustle: true, debts: true, loan: 1000 }),
        step: { kind: 'loanAuto' as const, at: 't' },
      },
      {
        ...position(5, { hustle: true, loan: 1000, reserve: 1000 }),
        step: { kind: 'roll' as const, at: 't' },
      },
    ];
    const review = reviewDreamfund(
      stack,
      position(6, { hustle: true, loan: 1000, reserve: 1000 }),
      {
        gameSets: CASHFLOW_GAME_SETS,
      },
    );
    expect(review.months).toBe(6);
    expect(review.milestones.firstIncome).toBe(4);
    expect(review.milestones.reserveFull).toBe(5);
    expect(review.milestones.debtsRepaid).toBe(5);
    expect(review.purchases.map((p) => p.title)).toEqual(['Tutoring']);
    expect(review.loans.peakMinor).toBeGreaterThan(0);
    expect(review.savingCards).toBe(0);
    expect(review.findings.some((f) => f.id === 'savings' && f.tone === 'tip')).toBe(true);
    expect(review.findings.some((f) => f.id === 'loans')).toBe(true);
    const text = describeDreamfundReview(review);
    expect(text).toContain('Dreamfund game review');
    expect(text).toContain('Tutoring');
  });
});
