import {
  computeBudgetRowsFromSubscriptions,
  SubscriptionForBudget,
} from './budget-from-subscriptions';

const NOW = new Date('2026-04-15');

function subscription(overrides: Partial<SubscriptionForBudget> = {}): SubscriptionForBudget {
  return {
    account: 'Daily',
    amountMinor: -1000,
    startDate: '2026-01-01',
    endDate: null,
    category: '@Streaming',
    frequency: 'monthly',
    ...overrides,
  };
}

describe('computeBudgetRowsFromSubscriptions', () => {
  it('adds the full nominal amount for a monthly subscription into every active month', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [subscription({ startDate: '2026-01-01', amountMinor: -1000 })],
      NOW,
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { date: '2026-01', tag: '@Streaming', amountMinor: 1000 },
        { date: '2026-02', tag: '@Streaming', amountMinor: 1000 },
        { date: '2026-03', tag: '@Streaming', amountMinor: 1000 },
        { date: '2026-04', tag: '@Streaming', amountMinor: 1000 },
      ]),
    );
    expect(rows).toHaveLength(4);
  });

  it('amortizes a quarterly subscription to a third of its nominal amount per month (the original app never does this)', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [
        subscription({
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          amountMinor: -300,
          category: '@Insurance',
          frequency: 'quarterly',
        }),
      ],
      NOW,
    );
    expect(rows).toEqual([{ date: '2026-01', tag: '@Insurance', amountMinor: 100 }]);
  });

  it('amortizes a yearly subscription to a twelfth of its nominal amount per month', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [
        subscription({
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          amountMinor: -1200,
          category: '@Domain',
          frequency: 'yearly',
        }),
      ],
      NOW,
    );
    expect(rows).toEqual([{ date: '2026-01', tag: '@Domain', amountMinor: 100 }]);
  });

  it('scales a weekly subscription up (52/12 occurrences per month) and biweekly up (26/12)', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [
        subscription({
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          amountMinor: -1000,
          category: '@Weekly',
          frequency: 'weekly',
        }),
        subscription({
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          amountMinor: -2000,
          category: '@Biweekly',
          frequency: 'biweekly',
        }),
      ],
      NOW,
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { date: '2026-01', tag: '@Weekly', amountMinor: Math.round(1000 * (52 / 12)) },
        { date: '2026-01', tag: '@Biweekly', amountMinor: Math.round(2000 * (26 / 12)) },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it('sums multiple subscriptions sharing the same category and month', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [
        subscription({ startDate: '2026-01-01', endDate: '2026-01-01', amountMinor: -1000 }),
        subscription({ startDate: '2026-01-01', endDate: '2026-01-01', amountMinor: -500 }),
      ],
      NOW,
    );
    expect(rows).toEqual([{ date: '2026-01', tag: '@Streaming', amountMinor: 1500 }]);
  });

  it('stops at the end month when endDate is set, even if that is before now', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [subscription({ startDate: '2026-01-01', endDate: '2026-02-15' })],
      NOW,
    );
    expect(rows.map((r) => r.date).sort()).toEqual(['2026-01', '2026-02']);
  });

  it('treats an empty-string endDate the same as no end date', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [subscription({ startDate: '2026-03-01', endDate: '' as unknown as null })],
      NOW,
    );
    expect(rows.map((r) => r.date).sort()).toEqual(['2026-03', '2026-04']);
  });

  it('skips a subscription on the Income account entirely', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [subscription({ account: 'Income', startDate: '2026-01-01' })],
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it('produces no rows for a subscription whose active range is empty (endDate before startDate)', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [subscription({ startDate: '2026-03-01', endDate: '2026-01-01' })],
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it('uses the absolute value of amountMinor regardless of sign', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [subscription({ startDate: '2026-01-01', endDate: '2026-01-01', amountMinor: 1000 })],
      NOW,
    );
    expect(rows).toEqual([{ date: '2026-01', tag: '@Streaming', amountMinor: 1000 }]);
  });

  it('falls back to monthly for an unrecognized frequency', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [
        subscription({
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          amountMinor: -1000,
          frequency: 'unknown' as unknown as SubscriptionForBudget['frequency'],
        }),
      ],
      NOW,
    );
    expect(rows).toEqual([{ date: '2026-01', tag: '@Streaming', amountMinor: 1000 }]);
  });

  it('handles a category containing a space without corrupting the (date, tag) split', () => {
    const rows = computeBudgetRowsFromSubscriptions(
      [
        subscription({
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          amountMinor: -1000,
          category: '@Side job expenses',
        }),
      ],
      NOW,
    );
    expect(rows).toEqual([{ date: '2026-01', tag: '@Side job expenses', amountMinor: 1000 }]);
  });
});
