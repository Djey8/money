import { computeBalanceSheet, BalanceSheetInput } from './balance-sheet';

function input(overrides: Partial<BalanceSheetInput> = {}): BalanceSheetInput {
  return {
    assets: [],
    shares: [],
    investments: [],
    properties: [],
    liabilities: [],
    ...overrides,
  };
}

describe('computeBalanceSheet', () => {
  it('sums plain assets into cash', () => {
    const sheet = computeBalanceSheet(
      input({ assets: [{ amountMinor: 500000 }, { amountMinor: 300000 }] }),
    );
    expect(sheet.assets.cash).toBe(800000);
  });

  it('values shares as quantity times price', () => {
    const sheet = computeBalanceSheet(input({ shares: [{ quantity: 10, priceMinor: 41500 }] }));
    expect(sheet.assets.shares).toBe(415000);
  });

  it('sums an investment as its amount plus its deposit', () => {
    const sheet = computeBalanceSheet(
      input({ investments: [{ amountMinor: 18000000, depositMinor: 3000000 }] }),
    );
    expect(sheet.assets.investments).toBe(21000000);
  });

  it('sums plain properties', () => {
    const sheet = computeBalanceSheet(input({ properties: [{ amountMinor: 8000000 }] }));
    expect(sheet.assets.properties).toBe(8000000);
  });

  it('sums liability amounts into debts, ignoring nothing else about them', () => {
    const sheet = computeBalanceSheet(input({ liabilities: [{ amountMinor: 15000000 }] }));
    expect(sheet.liabilities.debts).toBe(15000000);
    expect(sheet.liabilities.total).toBe(15000000);
  });

  it('computes assets.total as the sum of all four asset categories', () => {
    const sheet = computeBalanceSheet(
      input({
        assets: [{ amountMinor: 100000 }],
        shares: [{ quantity: 2, priceMinor: 50000 }],
        investments: [{ amountMinor: 200000, depositMinor: 0 }],
        properties: [{ amountMinor: 300000 }],
      }),
    );
    expect(sheet.assets.total).toBe(100000 + 100000 + 200000 + 300000);
  });

  it('computes equity and netWorth as total assets minus total liabilities', () => {
    const sheet = computeBalanceSheet(
      input({
        assets: [{ amountMinor: 1000000 }],
        liabilities: [{ amountMinor: 400000 }],
      }),
    );
    expect(sheet.equity).toBe(600000);
    expect(sheet.netWorth).toBe(600000);
  });

  it('returns an all-zero snapshot with no entries', () => {
    const sheet = computeBalanceSheet(input());
    expect(sheet.assets.total).toBe(0);
    expect(sheet.liabilities.total).toBe(0);
    expect(sheet.equity).toBe(0);
  });

  it('allows equity to go negative when liabilities exceed assets', () => {
    const sheet = computeBalanceSheet(
      input({ assets: [{ amountMinor: 100000 }], liabilities: [{ amountMinor: 500000 }] }),
    );
    expect(sheet.equity).toBe(-400000);
    expect(sheet.netWorth).toBe(-400000);
  });
});
