import { TransactionFilterService } from './transaction-filter.service';
import { Transaction } from '../../interfaces/transaction';
import { IncomeFilter } from '../../interfaces/income-filter';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return { account: 'Daily', amount: -50, date: '2026-01-15', time: '10:30', category: 'Food', comment: '', ...overrides };
}

function defaultFilter(overrides: Partial<IncomeFilter> = {}): IncomeFilter {
  return {
    startDate: '', endDate: '',
    selectedAccounts: [], selectedTags: [],
    sortBy: 'none', sortOrder: 'desc',
    searchText: '',
    searchFields: { account: true, amount: true, date: true, time: true, category: true, comment: true },
    ...overrides,
  };
}

describe('TransactionFilterService', () => {
  let service: TransactionFilterService;

  beforeEach(() => {
    service = new TransactionFilterService();
  });

  // --- parseAsDate ---------------------------------------------------------

  describe('parseAsDate()', () => {
    it('parses dd.mm.yyyy', () => {
      expect(TransactionFilterService.parseAsDate('25.12.2025')).toBe('2025-12-25');
    });

    it('parses dd.mm.yy (2-digit year)', () => {
      expect(TransactionFilterService.parseAsDate('1.2.25')).toBe('2025-02-01');
    });

    it('parses dd/mm/yyyy', () => {
      expect(TransactionFilterService.parseAsDate('05/03/2026')).toBe('2026-03-05');
    });

    it('parses dd/mm/yy', () => {
      expect(TransactionFilterService.parseAsDate('5/3/26')).toBe('2026-03-05');
    });

    it('parses yyyy-mm-dd (ISO)', () => {
      expect(TransactionFilterService.parseAsDate('2026-1-5')).toBe('2026-01-05');
    });

    it('returns null for non-date input', () => {
      expect(TransactionFilterService.parseAsDate('hello')).toBeNull();
    });
  });

  // --- parseAsTime ---------------------------------------------------------

  describe('parseAsTime()', () => {
    it('parses 24h hh:mm', () => {
      expect(TransactionFilterService.parseAsTime('9:30')).toBe('09:30');
    });

    it('parses 14:00', () => {
      expect(TransactionFilterService.parseAsTime('14:00')).toBe('14:00');
    });

    it('parses hh:mmam', () => {
      expect(TransactionFilterService.parseAsTime('9:30am')).toBe('09:30');
    });

    it('parses hh:mmpm', () => {
      expect(TransactionFilterService.parseAsTime('2:00pm')).toBe('14:00');
    });

    it('handles 12pm as noon', () => {
      expect(TransactionFilterService.parseAsTime('12:00pm')).toBe('12:00');
    });

    it('handles 12am as midnight', () => {
      expect(TransactionFilterService.parseAsTime('12:00am')).toBe('00:00');
    });

    it('parses Xpm shorthand', () => {
      expect(TransactionFilterService.parseAsTime('3pm')).toBe('15:00');
    });

    it('parses Xam shorthand', () => {
      expect(TransactionFilterService.parseAsTime('11am')).toBe('11:00');
    });

    it('returns null for non-time input', () => {
      expect(TransactionFilterService.parseAsTime('hello')).toBeNull();
    });
  });

  // --- checkSearchTermMatch ------------------------------------------------

  describe('checkSearchTermMatch()', () => {
    const allFields = { account: true, amount: true, date: true, time: true, category: true, comment: true };

    it('matches account text', () => {
      const t = tx({ account: 'Daily' });
      expect(TransactionFilterService.checkSearchTermMatch(t, 'daily', allFields)).toBe(true);
    });

    it('matches amount text', () => {
      const t = tx({ amount: -123.45 });
      expect(TransactionFilterService.checkSearchTermMatch(t, '123', allFields)).toBe(true);
    });

    it('matches category without @ prefix', () => {
      const t = tx({ category: '@Rent' });
      expect(TransactionFilterService.checkSearchTermMatch(t, 'rent', allFields)).toBe(true);
    });

    it('matches comment text', () => {
      const t = tx({ comment: 'Grocery shopping' });
      expect(TransactionFilterService.checkSearchTermMatch(t, 'grocery', allFields)).toBe(true);
    });

    it('returns false when field is disabled', () => {
      const t = tx({ account: 'Daily' });
      const fields = { ...allFields, account: false };
      expect(TransactionFilterService.checkSearchTermMatch(t, 'daily', fields)).toBe(false);
    });

    it('matches date (dd.mm.yyyy format)', () => {
      const t = tx({ date: '2026-01-15' });
      expect(TransactionFilterService.checkSearchTermMatch(t, '15.01.2026', allFields)).toBe(true);
    });

    it('uses > operator for date comparison', () => {
      const t = tx({ date: '2026-01-15' });
      expect(TransactionFilterService.checkSearchTermMatch(t, '>01.01.2026', allFields)).toBe(true);
      expect(TransactionFilterService.checkSearchTermMatch(t, '>01.02.2026', allFields)).toBe(false);
    });

    it('uses > operator for amount comparison', () => {
      const t = tx({ amount: -50 });
      expect(TransactionFilterService.checkSearchTermMatch(t, '>-100', allFields)).toBe(true);
    });

    it('uses < operator for amount comparison', () => {
      const t = tx({ amount: -50 });
      expect(TransactionFilterService.checkSearchTermMatch(t, '<0', allFields)).toBe(true);
    });

    it('uses >= and <= for amount', () => {
      const t = tx({ amount: 100 });
      expect(TransactionFilterService.checkSearchTermMatch(t, '>=100', allFields)).toBe(true);
      expect(TransactionFilterService.checkSearchTermMatch(t, '<=100', allFields)).toBe(true);
      expect(TransactionFilterService.checkSearchTermMatch(t, '>100', allFields)).toBe(false);
    });

    it('matches time with comparison operator', () => {
      const t = tx({ time: '14:30' });
      expect(TransactionFilterService.checkSearchTermMatch(t, '>10:00', allFields)).toBe(true);
      expect(TransactionFilterService.checkSearchTermMatch(t, '<10:00', allFields)).toBe(false);
    });

    it('returns false for time match when transaction has no time', () => {
      const t = tx({ time: '' });
      expect(TransactionFilterService.checkSearchTermMatch(t, '10:00', allFields)).toBe(false);
    });
  });

  // --- applyFilters --------------------------------------------------------

  describe('applyFilters()', () => {
    const transactions: Transaction[] = [
      tx({ account: 'Daily', amount: -50, date: '2026-01-10', category: 'Food', comment: 'Lunch' }),
      tx({ account: 'Splurge', amount: -200, date: '2026-01-15', category: 'Fun', comment: 'Concert' }),
      tx({ account: 'Income', amount: 3000, date: '2026-01-01', category: '@Salary', comment: 'January' }),
      tx({ account: 'Daily', amount: -30, date: '2026-02-05', category: 'Transport', comment: 'Bus' }),
    ];

    it('returns all transactions with no filters', () => {
      expect(service.applyFilters(transactions, defaultFilter())).toHaveLength(4);
    });

    it('filters by date range', () => {
      const f = defaultFilter({ startDate: '2026-01-05', endDate: '2026-01-20' });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.account)).toEqual(['Daily', 'Splurge']);
    });

    it('filters by selectedAccounts', () => {
      const f = defaultFilter({ selectedAccounts: ['Daily'] });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(2);
      result.forEach(t => expect(t.account).toBe('Daily'));
    });

    it('filters by selectedTags', () => {
      const f = defaultFilter({ selectedTags: ['Salary'] });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('Income');
    });

    it('filters by allowedAccounts', () => {
      const result = service.applyFilters(transactions, defaultFilter(), ['Daily']);
      expect(result).toHaveLength(2);
    });

    it('filters by plain search text', () => {
      const f = defaultFilter({ searchText: 'Concert' });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(1);
      expect(result[0].comment).toBe('Concert');
    });

    it('supports AND operator', () => {
      const f = defaultFilter({ searchText: 'daily and food' });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Food');
    });

    it('supports OR operator', () => {
      const f = defaultFilter({ searchText: 'food or fun' });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(2);
    });

    it('supports NOT operator', () => {
      const f = defaultFilter({ searchText: 'daily and not food' });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Transport');
    });

    it('combines date range + search text', () => {
      const f = defaultFilter({ startDate: '2026-01-01', endDate: '2026-01-31', searchText: 'daily' });
      const result = service.applyFilters(transactions, f);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-01-10');
    });
  });
});
