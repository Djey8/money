import { getPeriodRange } from './period-range';

// Tuesday 2026-09-15 — a fixed reference point so every period type's
// boundaries can be hand-verified rather than just re-asserting whatever
// the implementation happens to compute.
const NOW = new Date(2026, 8, 15);

describe('getPeriodRange', () => {
  it('computes the current ISO week (Monday-Sunday)', () => {
    expect(getPeriodRange('week', 0, NOW)).toEqual({
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      label: 'W38 2026',
    });
  });

  it('computes the previous week', () => {
    expect(getPeriodRange('week', -1, NOW)).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-13',
      label: 'W37 2026',
    });
  });

  it('computes a week range spanning a year boundary', () => {
    // Monday 2025-12-29 - Sunday 2026-01-04 is ISO week 1 of 2026.
    expect(getPeriodRange('week', 0, new Date(2025, 11, 30))).toEqual({
      startDate: '2025-12-29',
      endDate: '2026-01-04',
      label: 'W01 2026',
    });
  });

  it('computes the current month', () => {
    expect(getPeriodRange('month', 0, NOW)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      label: 'Sep 2026',
    });
  });

  it('computes the previous month, including a year rollback at January', () => {
    expect(getPeriodRange('month', -1, NOW)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      label: 'Aug 2026',
    });
    expect(getPeriodRange('month', -1, new Date(2026, 0, 15))).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      label: 'Dec 2025',
    });
  });

  it('computes the current quarter', () => {
    expect(getPeriodRange('quarter', 0, NOW)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      label: 'Q3 2026',
    });
  });

  it('computes the previous quarter, including a year rollback at Q1', () => {
    expect(getPeriodRange('quarter', -1, new Date(2026, 1, 1))).toEqual({
      startDate: '2025-10-01',
      endDate: '2025-12-31',
      label: 'Q4 2025',
    });
  });

  it('computes the current half-year', () => {
    expect(getPeriodRange('halfyear', 0, NOW)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      label: 'H2 2026',
    });
  });

  it('computes the previous half-year, including a year rollback at H1', () => {
    expect(getPeriodRange('halfyear', -1, new Date(2026, 2, 1))).toEqual({
      startDate: '2025-07-01',
      endDate: '2025-12-31',
      label: 'H2 2025',
    });
  });

  it('computes the current and previous year', () => {
    expect(getPeriodRange('year', 0, NOW)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      label: '2026',
    });
    expect(getPeriodRange('year', -1, NOW)).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      label: '2025',
    });
  });

  it('defaults now to the real current time when omitted', () => {
    const range = getPeriodRange('year', 0);
    expect(range.label).toBe(String(new Date().getFullYear()));
  });
});
