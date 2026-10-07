import { fixedClock, formatLocalIsoDate, systemClock } from './clock';
import { identityText, textOrFallback, type GameText } from './game-text';
import {
  dateFromSubscriptionDay,
  gameSubscriptionDays,
  isGameTransaction,
  nextSmartDate,
  shiftedGameTransactionDates,
  usedDaysThisMonth,
} from './scheduling';

describe('Clock', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(formatLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatLocalIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('the system clock reads the real time, in the same shape', () => {
    expect(systemClock.todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(systemClock.nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('a fixed clock always says the same thing', () => {
    const clock = fixedClock('2026-10-05');
    expect(clock.todayIso()).toBe('2026-10-05');
    expect(clock.todayIso()).toBe('2026-10-05');
    expect(clock.nowIso()).toBe('2026-10-05T12:00:00.000Z');
    expect(fixedClock('2026-10-05', '2026-10-05T01:02:03.000Z').nowIso()).toBe(
      '2026-10-05T01:02:03.000Z',
    );
  });
});

describe('GameText', () => {
  it('textOrFallback uses the translation, or the fallback when the catalog does not know the key', () => {
    const catalog: GameText = (key) => (key === 'known' ? 'Bekannt' : key);
    expect(textOrFallback(catalog, 'known', 'Fallback')).toBe('Bekannt');
    expect(textOrFallback(catalog, 'missing', 'Fallback')).toBe('Fallback');
  });

  it('identityText never translates', () => {
    expect(identityText('CashflowGame.Round')).toBe('CashflowGame.Round');
    expect(textOrFallback(identityText, 'a.b', 'Raw')).toBe('Raw');
  });
});

describe('nextSmartDate', () => {
  const OCTOBER = '2026-10-15'; // 31 days

  it('takes 1, 3, 5 ... 27, then 2, 4, 6 ... 28, then 29-31', () => {
    const used = new Set<number>();
    const days = Array.from({ length: 31 }, () => Number(nextSmartDate(used, OCTOBER).slice(8)));
    expect(days.slice(0, 14)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27]);
    expect(days.slice(14, 28)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]);
    expect(days.slice(28)).toEqual([29, 30, 31]);
  });

  it('dates it in the month of "today", with the day added to the used set', () => {
    const used = new Set<number>();
    expect(nextSmartDate(used, OCTOBER)).toBe('2026-10-01');
    expect([...used]).toEqual([1]);
  });

  it('skips days that are already taken', () => {
    expect(nextSmartDate(new Set([1, 3]), OCTOBER)).toBe('2026-10-05');
  });

  it('never goes past the real length of a short month', () => {
    const used = new Set<number>();
    const days = Array.from({ length: 28 }, () =>
      Number(nextSmartDate(used, '2026-02-10').slice(8)),
    );
    expect(Math.max(...days)).toBe(28);
    expect(new Set(days).size).toBe(28);
  });

  it('reuses a day rather than refusing when the whole month is taken', () => {
    const used = new Set(Array.from({ length: 28 }, (_, i) => i + 1));
    const date = nextSmartDate(used, '2026-02-10');
    expect(date).toMatch(/^2026-02-(0[1-9]|[12]\d)$/);
  });
});

describe('gameSubscriptionDays / usedDaysThisMonth', () => {
  const subscriptions = [
    { startDate: '2026-03-01', comment: 'x\n#cashflow' },
    { startDate: '2025-12-17', comment: '#cashflow' }, // an earlier month still pays on the 17th
    { startDate: '2026-10-09', comment: 'not a game subscription' },
    { startDate: undefined, comment: '#cashflow' },
  ];

  it('collects the days of #cashflow subscriptions only, whatever month they started in', () => {
    expect([...gameSubscriptionDays(subscriptions)].sort((a, b) => a - b)).toEqual([1, 17]);
  });

  it('adds every transaction dated in this real month, and none from other months', () => {
    const days = usedDaysThisMonth(
      subscriptions,
      [{ date: '2026-10-04' }, { date: '2026-09-04' }, { date: '2026-10-22' }, {}],
      '2026-10-15',
    );
    expect([...days].sort((a, b) => a - b)).toEqual([1, 4, 17, 22]);
  });
});

describe('dateFromSubscriptionDay', () => {
  it('puts the subscription’s day into the month of today', () => {
    expect(dateFromSubscriptionDay('2026-03-17', '2026-10-05')).toBe('2026-10-17');
  });

  it('clamps a day that does not exist in the month to its last day', () => {
    expect(dateFromSubscriptionDay('2026-01-31', '2026-02-10')).toBe('2026-02-28');
    expect(dateFromSubscriptionDay('2026-01-31', '2026-04-10')).toBe('2026-04-30');
    expect(dateFromSubscriptionDay('2026-01-31', '2028-02-10')).toBe('2028-02-29');
  });

  it('counts a missing subscription or an unreadable day as the 1st', () => {
    expect(dateFromSubscriptionDay(undefined, '2026-10-05')).toBe('2026-10-01');
    expect(dateFromSubscriptionDay('2026-03-xx', '2026-10-05')).toBe('2026-10-01');
  });
});

describe('isGameTransaction / shiftedGameTransactionDates', () => {
  it('recognizes #cashflow transactions and old untagged Grow trades, and nothing else', () => {
    expect(isGameTransaction({ comment: 'Salary\n#cashflow' })).toBe(true);
    expect(isGameTransaction({ comment: 'Buy Share OK4U 250 x 10;' })).toBe(true);
    expect(isGameTransaction({ comment: 'Sell Investment EFH 1 x 2;' })).toBe(true);
    expect(isGameTransaction({ comment: 'Dividende Share OK4U 3' })).toBe(true);
    expect(isGameTransaction({ comment: 'Payback Liabilitie Car 100' })).toBe(true);
    expect(isGameTransaction({ comment: 'Groceries' })).toBe(false);
    expect(isGameTransaction({ comment: 'I wanted to Buy Share later' })).toBe(false);
    expect(isGameTransaction({})).toBe(false);
  });

  it('moves only game transactions, by position, clamping the day to the month', () => {
    const changes = shiftedGameTransactionDates(
      [
        { date: '2026-10-31', comment: '#cashflow' },
        { date: '2026-10-05', comment: 'plain' },
        { date: '2026-03-15', comment: 'Buy Asset GOLD 1 x 5;' },
      ],
      -1,
    );
    expect(changes).toEqual([
      { index: 0, date: '2026-09-30' },
      { index: 2, date: '2026-02-15' },
    ]);
  });

  it('moves forward as well, across a year boundary', () => {
    expect(shiftedGameTransactionDates([{ date: '2026-12-15', comment: '#cashflow' }], 1)).toEqual([
      { index: 0, date: '2027-01-15' },
    ]);
  });
});
