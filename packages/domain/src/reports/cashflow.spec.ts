import { computeCashflow } from './cashflow';
import { PeriodRange } from './period-range';
import { ApiTransaction } from '../transactions/transaction';

const currentRange: PeriodRange = { startDate: '2026-09-01', endDate: '2026-09-30', label: 'Sep 2026' };
const previousRange: PeriodRange = { startDate: '2026-08-01', endDate: '2026-08-31', label: 'Aug 2026' };

function tx(overrides: Partial<ApiTransaction>): ApiTransaction {
  return {
    id: 'tx',
    account: 'Income',
    amountMinor: 10000,
    currency: 'EUR',
    date: '2026-09-15',
    time: '09:00',
    category: '@Salary',
    comment: '',
    ...overrides,
  };
}

describe('computeCashflow', () => {
  it('counts an ordinary Income inflow and expense-account outflow as operating', () => {
    const statement = computeCashflow(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 100000 }),
        tx({ id: 't2', account: 'Daily', category: '@Food', amountMinor: -40000 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.operating.current).toBe(60000);
  });

  it('classifies a transfer from Income into Smile or Fire as investing', () => {
    const statement = computeCashflow(
      [
        tx({ id: 't1', account: 'Income', category: '@Smile', amountMinor: -20000 }),
        tx({ id: 't2', account: 'Income', category: '@Fire', amountMinor: -30000 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.investing.current).toBe(50000);
    expect(statement.operating.current).toBe(0);
  });

  it('classifies a comment containing "payback liabilitie" as financing, regardless of account', () => {
    const statement = computeCashflow(
      [tx({ account: 'Daily', amountMinor: -15000, comment: 'Payback Liabilitie Mortgage;' })],
      currentRange,
      previousRange,
    );
    expect(statement.financing.current).toBe(15000);
    expect(statement.operating.current).toBe(0);
  });

  it('matches the financing comment case-insensitively', () => {
    const statement = computeCashflow(
      [tx({ account: 'Daily', amountMinor: -15000, comment: 'PAYBACK LIABILITIE Mortgage;' })],
      currentRange,
      previousRange,
    );
    expect(statement.financing.current).toBe(15000);
  });

  it('classifies a transaction matching both financing and investing as financing (financing checked first)', () => {
    const statement = computeCashflow(
      [
        tx({
          account: 'Income',
          category: '@Fire',
          amountMinor: -20000,
          comment: 'Payback Liabilitie Mortgage;',
        }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.financing.current).toBe(20000);
    expect(statement.investing.current).toBe(0);
  });

  it('counts a direct Mojo inflow and an Income-to-Mojo transfer both as mojo', () => {
    const statement = computeCashflow(
      [
        tx({ id: 't1', account: 'Mojo', amountMinor: 5000 }),
        tx({ id: 't2', account: 'Income', category: '@Mojo', amountMinor: -3000 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.mojo.current).toBe(8000);
  });

  it('drops a transfer into Daily/Splurge entirely — not operating, investing, financing, or mojo', () => {
    const statement = computeCashflow(
      [tx({ account: 'Income', category: '@Daily', amountMinor: -10000 })],
      currentRange,
      previousRange,
    );
    expect(statement.operating.current).toBe(0);
    expect(statement.investing.current).toBe(0);
    expect(statement.financing.current).toBe(0);
    expect(statement.mojo.current).toBe(0);
  });

  it('ignores a zero-amount transaction', () => {
    const statement = computeCashflow([tx({ amountMinor: 0 })], currentRange, previousRange);
    expect(statement.operating.current).toBe(0);
  });

  it('ignores transactions outside the given period range', () => {
    const statement = computeCashflow(
      [tx({ date: '2026-10-01', amountMinor: 100000 })],
      currentRange,
      previousRange,
    );
    expect(statement.operating.current).toBe(0);
  });

  it('computes netCashflow as operating minus investing minus financing minus mojo', () => {
    const statement = computeCashflow(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 100000 }),
        tx({ id: 't2', account: 'Income', category: '@Fire', amountMinor: -20000 }),
        tx({ id: 't3', account: 'Daily', amountMinor: -15000, comment: 'Payback Liabilitie X;' }),
        tx({ id: 't4', account: 'Mojo', amountMinor: 5000 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.operating.current).toBe(100000);
    expect(statement.investing.current).toBe(20000);
    expect(statement.financing.current).toBe(15000);
    expect(statement.mojo.current).toBe(5000);
    expect(statement.netCashflow.current).toBe(100000 - 20000 - 15000 - 5000);
  });

  it('computes the previous period independently of the current one', () => {
    const statement = computeCashflow(
      [
        tx({ id: 'cur', account: 'Income', amountMinor: 100000, date: '2026-09-10' }),
        tx({ id: 'prev', account: 'Income', amountMinor: 50000, date: '2026-08-10' }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.operating.current).toBe(100000);
    expect(statement.operating.previous).toBe(50000);
    expect(statement.operating.changePercent).toBe(100);
  });
});
