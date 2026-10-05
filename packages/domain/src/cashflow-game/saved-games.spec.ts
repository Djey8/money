import {
  savedGameStatus,
  sortSavedGames,
  summarizeGameFinances,
  type SavedGameSummary,
} from './saved-games';

const titles = ['Janitor Salary', 'Rent', 'Bank loan interest', 'SFH Cashflow', 'APT4 Cashflow'];

describe('summarizeGameFinances', () => {
  const subs = [
    { title: 'Janitor Salary', amountMinor: 300000 },
    { title: 'Rent', amountMinor: -120000 },
    { title: 'Bank loan interest', amountMinor: -30000 },
    { title: 'SFH Cashflow', amountMinor: 20000 },
    { title: 'APT4 Cashflow', amountMinor: 80000 },
    { title: 'Not a game subscription', amountMinor: -999999 },
  ];

  it('splits salary, passive income and expenses, and ignores subscriptions outside the game', () => {
    const summary = summarizeGameFinances({ gameSubscriptionTitles: titles }, subs);

    expect(summary).toMatchObject({
      salaryMinor: 300000,
      passiveIncomeMinor: 100000,
      expensesMinor: 150000,
      monthlyCashflowMinor: 250000,
    });
  });

  it('escaped the rat race once passive income covers every expense - the salary does not count', () => {
    expect(summarizeGameFinances({ gameSubscriptionTitles: titles }, subs).escapedRatRace).toBe(
      false,
    );

    const rich = subs.map((sub) =>
      sub.title === 'APT4 Cashflow' ? { ...sub, amountMinor: 130000 } : sub,
    );
    expect(summarizeGameFinances({ gameSubscriptionTitles: titles }, rich).escapedRatRace).toBe(
      true,
    );
  });

  it('bankrupt means a negative monthly cashflow; no expenses never counts as escaped', () => {
    const broke = [
      { title: 'Janitor Salary', amountMinor: 100000 },
      { title: 'Rent', amountMinor: -150000 },
    ];
    expect(
      summarizeGameFinances({ gameSubscriptionTitles: ['Janitor Salary', 'Rent'] }, broke).bankrupt,
    ).toBe(true);

    const none = summarizeGameFinances({ gameSubscriptionTitles: [] }, []);
    expect(none).toMatchObject({ escapedRatRace: false, bankrupt: false, monthlyCashflowMinor: 0 });
  });
});

describe('savedGameStatus and sortSavedGames', () => {
  const base = { escapedRatRace: false, bankrupt: false };

  it('ended beats escaped beats bankrupt beats playing', () => {
    expect(savedGameStatus({ ...base, endedAt: '2026-10-04', escapedRatRace: true })).toBe('ended');
    expect(savedGameStatus({ ...base, escapedRatRace: true, bankrupt: true })).toBe('escaped');
    expect(savedGameStatus({ ...base, bankrupt: true })).toBe('bankrupt');
    expect(savedGameStatus(base)).toBe('playing');
  });

  it('orders the most recently saved game first, without touching the input', () => {
    const games = [
      { id: 'a', updatedAt: '2026-10-01T10:00:00Z' },
      { id: 'b', updatedAt: '2026-10-03T10:00:00Z' },
      { id: 'c', updatedAt: '2026-10-02T10:00:00Z' },
    ] as SavedGameSummary[];

    expect(sortSavedGames(games).map((g) => g.id)).toEqual(['b', 'c', 'a']);
    expect(games.map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });
});
