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
      realizedGainMinor: 0,
      dividendsMinor: 0,
      cashflowIncomeMinor: 0,
      sharePosition: null,
      valuationSource: 'last-entered-price',
      incompleteHistory: false,
    });
  });

  it('does not filter by account, matching the original having no account check at all', () => {
    const pnl = computeGrowPnl('MSFT', [
      { category: '@MSFT', amountMinor: -100 },
      { category: '@MSFT', amountMinor: 50 },
    ]);
    expect(pnl.transactionCount).toBe(2);
  });

  describe('trade breakdown (average cost)', () => {
    const trades = [
      {
        category: '@SOL',
        amountMinor: -40000,
        date: '2026-03-01',
        time: '10:00',
        comment: 'Buy Share SOL 4 x 100;',
      },
      {
        category: '@SOL',
        amountMinor: -30000,
        date: '2026-04-01',
        time: '10:00',
        comment: 'Buy Share SOL 2 x 150;',
      },
      {
        category: '@SOL',
        amountMinor: 45000,
        date: '2026-05-01',
        time: '10:00',
        comment: 'Sell Share SOL 3 x 150;',
      },
      {
        category: '@SOL',
        amountMinor: 300,
        date: '2026-05-02',
        time: '10:00',
        comment: 'Dividende Share SOL 3 x 1;',
      },
    ];

    it('realizes gains against the average cost and values the rest at the last entered price', () => {
      // 6 units cost 700 (avg 116.67); selling 3 at 150 removes cost 350 -> gain 100.
      const pnl = computeGrowPnl('SOL', trades, { quantity: 3, priceMinor: 9000 });
      expect(pnl.realizedGainMinor).toBe(10000);
      expect(pnl.dividendsMinor).toBe(300);
      expect(pnl.sharePosition).toEqual({
        quantity: 3,
        costBasisMinor: 35000,
        averageCostMinor: 11667,
        lastPriceMinor: 9000,
        marketValueMinor: 27000,
        unrealizedGainMinor: -8000,
      });
      expect(pnl.incompleteHistory).toBe(false);
    });

    it('flags history the trades cannot explain instead of inventing a cost basis', () => {
      const sellOnly = [
        {
          category: '@SOL',
          amountMinor: 1000,
          date: '2026-05-01',
          time: '10:00',
          comment: 'Sell Share SOL 1 x 10;',
        },
      ];
      const pnl = computeGrowPnl('SOL', sellOnly, { quantity: 3.54, priceMinor: 8833 });
      expect(pnl.incompleteHistory).toBe(true);
      expect(pnl.realizedGainMinor).toBe(1000);
      expect(pnl.sharePosition?.costBasisMinor).toBe(0);
    });

    it('nets CASHFLOW statements, credit included', () => {
      const pnl = computeGrowPnl('Flat', [
        { category: '@Flat', amountMinor: 13000, comment: 'CASHFLOW 150 - CREDIT 20;' },
      ]);
      expect(pnl.cashflowIncomeMinor).toBe(13000);
    });
  });
});
