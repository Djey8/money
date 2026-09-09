'use strict';

const { EncryptionSession } = require('@money/domain');
const { applyDerivedState } = require('../../services/transaction-derived-state');

const transaction = (overrides = {}) => ({
  id: 'tx_1',
  account: 'Income',
  amountMinor: 100000,
  currency: 'EUR',
  date: '2026-09-06',
  time: '09:00',
  category: '@Salary',
  comment: '',
  ...overrides,
});

describe('transaction derived-state adapter', () => {
  it('writes ledger and Mojo outputs to v1 storage without mutating input data', () => {
    const data = { mojo: { amount: 100, target: 200 }, smile: [], fire: [] };
    const result = applyDerivedState(
      data,
      [
        transaction(),
        transaction({ id: 'tx_2', account: 'Fire', amountMinor: -5000, category: '@Mojo' }),
      ],
      null,
      1,
    );
    expect(result.data.income.revenue.revenues).toEqual([{ tag: 'Salary', amount: 1000 }]);
    expect(result.data.mojo.amount).toBe(50);
    expect(data).toEqual({ mojo: { amount: 100, target: 200 }, smile: [], fire: [] });
  });

  it('writes v2 minor-unit values unchanged', () => {
    const result = applyDerivedState(
      { meta: { schemaVersion: 2 }, mojo: { amount: 0, target: 10000 }, smile: [], fire: [] },
      [transaction({ amountMinor: 12345 })],
      null,
      2,
    );
    expect(result.data.income.revenue.revenues[0].amount).toBe(12345);
  });

  it('preserves per-field encryption while rebuilding derived values', () => {
    const session = new EncryptionSession('secret');
    const result = applyDerivedState(
      {
        mojo: { amount: session.encrypt('0'), target: session.encrypt('100') },
        smile: [],
        fire: [],
      },
      [transaction({ amountMinor: 1200, category: '@Salary' })],
      session,
      1,
    );
    expect(session.decrypt(result.data.income.revenue.revenues[0].tag)).toBe('Salary');
    expect(session.decrypt(result.data.income.revenue.revenues[0].amount)).toBe('12');
    expect(session.decrypt(result.data.mojo.amount)).toBe('0');
  });
});
