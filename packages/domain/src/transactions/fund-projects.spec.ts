import { computeProjectTotals } from './fund-projects';
import { FundBucket } from './bucket-allocations';

function bucket(overrides: Partial<FundBucket>): FundBucket {
  return { id: 'b1', title: 'Flights', targetMinor: 150000, amountMinor: 20000, ...overrides };
}

describe('computeProjectTotals', () => {
  it('sums target and amount across all buckets', () => {
    const totals = computeProjectTotals([
      bucket({ id: 'b1', targetMinor: 150000, amountMinor: 20000 }),
      bucket({ id: 'b2', targetMinor: 50000, amountMinor: 50000 }),
    ]);
    expect(totals.targetMinor).toBe(200000);
    expect(totals.amountMinor).toBe(70000);
  });

  it('computes remainingMinor and percentFilled', () => {
    const totals = computeProjectTotals([bucket({ targetMinor: 100000, amountMinor: 75000 })]);
    expect(totals.remainingMinor).toBe(25000);
    expect(totals.percentFilled).toBe(75);
  });

  it('floors remainingMinor at 0 once every bucket is at or past target', () => {
    const totals = computeProjectTotals([bucket({ targetMinor: 100000, amountMinor: 120000 })]);
    expect(totals.remainingMinor).toBe(0);
  });

  it('does not clamp percentFilled to 100 when a bucket exceeds its target', () => {
    const totals = computeProjectTotals([bucket({ targetMinor: 100000, amountMinor: 120000 })]);
    expect(totals.percentFilled).toBe(120);
  });

  it('returns an all-zero result for a project with no buckets', () => {
    expect(computeProjectTotals([])).toEqual({
      targetMinor: 0,
      amountMinor: 0,
      remainingMinor: 0,
      percentFilled: 0,
      plannedTargetMinor: 0,
    });
  });

  it('returns a zero percentFilled without dividing by zero when total target is 0', () => {
    const totals = computeProjectTotals([bucket({ targetMinor: 0, amountMinor: 0 })]);
    expect(totals.percentFilled).toBe(0);
  });
});
