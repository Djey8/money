import { computeGrowPnl } from './grow-pnl';

describe('computeGrowPnl', () => {
  it('nets buy/sell/dividend transactions into a single cashflow figure, matching getGrowProjectsGV', () => {
    const pnl = computeGrowPnl('MSFT', [
      { category: '@MSFT', amountMinor: -415000 }, // buy
      { category: '@MSFT', amountMinor: 5000 }, // dividend
      { category: '@MSFT', amountMinor: 450000 }, // sell
    ]);
    expect(pnl.netCashflowMinor).toBe(-415000 + 5000 + 450000);
    expect(pnl.investedMinor).toBe(415000);
    expect(pnl.returnedMinor).toBe(455000);
    expect(pnl.transactionCount).toBe(3);
  });

  it('invested + net always equals returned', () => {
    const pnl = computeGrowPnl('Car', [
      { category: '@Car', amountMinor: -150000 },
      { category: '@Car', amountMinor: 120000 },
    ]);
    expect(pnl.investedMinor + pnl.netCashflowMinor).toBe(pnl.returnedMinor);
  });

  it('matches by category with the leading @ stripped, case-sensitively, ignoring unrelated transactions', () => {
    const pnl = computeGrowPnl('Rental Flat', [
      { category: '@Rental Flat', amountMinor: -2000000 },
      { category: '@Groceries', amountMinor: -5000 },
      { category: '@rental flat', amountMinor: 999999 },
    ]);
    expect(pnl.transactionCount).toBe(1);
    expect(pnl.netCashflowMinor).toBe(-2000000);
  });

  it('returns all zeros for a project with no matching transactions', () => {
    const pnl = computeGrowPnl('Untouched', []);
    expect(pnl).toEqual({
      title: 'Untouched',
      netCashflowMinor: 0,
      investedMinor: 0,
      returnedMinor: 0,
      transactionCount: 0,
    });
  });

  it('does not filter by account, matching the original having no account check at all', () => {
    const pnl = computeGrowPnl('MSFT', [
      { category: '@MSFT', amountMinor: -100 },
      { category: '@MSFT', amountMinor: 50 },
    ]);
    expect(pnl.transactionCount).toBe(2);
  });
});
