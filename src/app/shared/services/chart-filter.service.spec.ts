import { ChartFilterService } from './chart-filter.service';

describe('ChartFilterService', () => {

  // --- defaultState -------------------------------------------------------

  describe('defaultState()', () => {
    it('returns an object with filterType "all"', () => {
      const state = ChartFilterService.defaultState();
      expect(state.filterType).toBe('all');
    });

    it('returns selectedIndex 0', () => {
      expect(ChartFilterService.defaultState().selectedIndex).toBe(0);
    });

    it('returns barGrouping "month"', () => {
      expect(ChartFilterService.defaultState().barGrouping).toBe('month');
    });

    it('returns all search fields enabled', () => {
      const { searchFields } = ChartFilterService.defaultState();
      expect(searchFields.account).toBe(true);
      expect(searchFields.amount).toBe(true);
      expect(searchFields.date).toBe(true);
      expect(searchFields.time).toBe(true);
      expect(searchFields.category).toBe(true);
      expect(searchFields.comment).toBe(true);
    });

    it('returns empty arrays for selectedAccounts and selectedCategories', () => {
      const state = ChartFilterService.defaultState();
      expect(state.selectedAccounts).toEqual([]);
      expect(state.selectedCategories).toEqual([]);
    });
  });

  // --- getDateRange -------------------------------------------------------

  describe('getDateRange()', () => {
    it('returns null for "all"', () => {
      expect(ChartFilterService.getDateRange('all', 0)).toBeNull();
    });

    it('returns a date range for "month"', () => {
      const range = ChartFilterService.getDateRange('month', 0);
      expect(range).not.toBeNull();
      expect(range!.startDate).toBeInstanceOf(Date);
      expect(range!.endDate).toBeInstanceOf(Date);
      // Current month: start should be 1st
      expect(range!.startDate.getDate()).toBe(1);
    });

    it('returns previous month with index -1', () => {
      const now = new Date();
      const range = ChartFilterService.getDateRange('month', -1);
      const expected = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      expect(range!.startDate.getMonth()).toBe(expected.getMonth());
    });

    it('returns correct week range', () => {
      const range = ChartFilterService.getDateRange('week', 0);
      expect(range).not.toBeNull();
      // endDate has time set to 23:59:59.999, so diff is ~7 days
      const diffMs = range!.endDate.getTime() - range!.startDate.getTime();
      const days = diffMs / (1000 * 60 * 60 * 24);
      expect(days).toBeGreaterThanOrEqual(6);
      expect(days).toBeLessThan(8);
    });

    it('returns correct quarter range', () => {
      const range = ChartFilterService.getDateRange('quarter', 0);
      expect(range).not.toBeNull();
      const startMonth = range!.startDate.getMonth();
      expect(startMonth % 3).toBe(0); // Quarter starts on month 0,3,6,9
    });

    it('returns correct year range', () => {
      const range = ChartFilterService.getDateRange('year', 0);
      const now = new Date();
      expect(range!.startDate.getFullYear()).toBe(now.getFullYear());
      expect(range!.startDate.getMonth()).toBe(0);  // January
      expect(range!.endDate.getMonth()).toBe(11);    // December
    });

    it('returns null for unknown filter type', () => {
      expect(ChartFilterService.getDateRange('unknown', 0)).toBeNull();
    });
  });

  // --- formatDateRange ----------------------------------------------------

  describe('formatDateRange()', () => {
    it('formats month range', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 0, 31);
      expect(ChartFilterService.formatDateRange('month', start, end)).toBe('Jan 2026');
    });

    it('formats quarter range', () => {
      const start = new Date(2026, 3, 1);  // April = Q2
      const end = new Date(2026, 5, 30);
      expect(ChartFilterService.formatDateRange('quarter', start, end)).toBe('Q2 2026');
    });

    it('formats year range', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 11, 31);
      expect(ChartFilterService.formatDateRange('year', start, end)).toBe('2026');
    });

    it('formats week range', () => {
      const start = new Date(2026, 0, 5);
      const end = new Date(2026, 0, 11);
      expect(ChartFilterService.formatDateRange('week', start, end)).toBe('5 Jan - 11 Jan 2026');
    });
  });
});
