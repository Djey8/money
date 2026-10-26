'use strict';

const { reviewHistory } = require('../../services/game-review');

/** A Dreamfund game (it has a life) is reviewed as a story, not by the classic rollouts. */
function snapshot(round, withHustle) {
  return {
    allTransactions: [
      { account: 'Daily', amount: 1000, date: '2026-11-01', time: '', category: '@x', comment: '' },
    ],
    allSubscriptions: [
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
      ...(withHustle
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
    ],
    allGrowProjects: [],
    allShares: [],
    allInvestments: [],
    allAssets: [],
    liabilities: [],
    allSmileProjects: [],
    allFireEmergencies: [],
    mojo: { amount: 0, target: 1000 },
    cashflowGame: {
      gameSetId: 'jfk-stories',
      professionId: 'dual-student-informatik',
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
      lineTitles: {},
      gameSubscriptionTitles: ['Salary', 'Rent', 'Tutoring Cashflow'],
      turn: { phase: 'roll', count: round * 3 },
      holdings: withHustle
        ? [{ cardId: 'S31', title: 'Tutoring', cashflowMinor: 24000, paidMinor: 5000, paydays: 1 }]
        : [],
    },
  };
}

describe('reviewHistory for a Dreamfund game', () => {
  it('returns the story of the game and a text, without a worker', async () => {
    const stack = [
      { ...snapshot(1, false), step: { kind: 'start', at: 't' } },
      { ...snapshot(2, false), step: { kind: 'roll', at: 't' } },
    ];
    const result = await reviewHistory(stack, snapshot(3, true), { money: (m) => String(m) });
    expect(result.reviewable).toBe(true);
    expect(result.kind).toBe('dreamfund');
    expect(result.review.purchases.map((p) => p.title)).toEqual(['Tutoring']);
    expect(result.text).toContain('Dreamfund game review');
  });
});
