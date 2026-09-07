import { normalizeTransaction, transactionFromApi, transactionToApi } from './transaction';

const legacyTransaction = {
  account: 'Daily',
  amount: -12.5,
  date: '2026-09-06',
  time: '09:30',
  category: '@Groceries',
  comment: 'Weekly shop',
};

describe('normalizeTransaction', () => {
  it('preserves a stable legacy id without generating another', () => {
    const generateId = jest.fn(() => 'tx_generated');
    expect(normalizeTransaction({ ...legacyTransaction, id: 'tx_existing' }, generateId)).toEqual({
      ...legacyTransaction,
      id: 'tx_existing',
    });
    expect(generateId).not.toHaveBeenCalled();
  });

  it('assigns an id to a legacy record that does not have one', () => {
    expect(normalizeTransaction(legacyTransaction, () => 'tx_new')).toEqual({
      ...legacyTransaction,
      id: 'tx_new',
    });
  });

  it('preserves an empty legacy comment', () => {
    expect(
      normalizeTransaction({ ...legacyTransaction, comment: '' }, () => 'tx_new'),
    ).toMatchObject({
      comment: '',
    });
  });

  it('preserves an empty legacy category', () => {
    expect(
      normalizeTransaction({ ...legacyTransaction, category: '' }, () => 'tx_new'),
    ).toMatchObject({
      category: '',
    });
  });

  it.each([
    [{ ...legacyTransaction, account: '' }, 'account'],
    [{ ...legacyTransaction, date: '' }, 'date'],
    [{ ...legacyTransaction, amount: Number.NaN }, 'amount'],
  ])('rejects invalid transaction fields', (transaction, field) => {
    expect(() => normalizeTransaction(transaction, () => 'tx_new')).toThrow(field);
  });
});

describe('transaction API storage mappings', () => {
  it('converts a v1 decimal record to integer minor units without mutating the input', () => {
    const stored = { ...legacyTransaction, amount: -12.5 };
    expect(transactionToApi(stored, 1, 'EUR', () => 'tx_1')).toMatchObject({
      id: 'tx_1',
      amountMinor: -1250,
      currency: 'EUR',
    });
    expect(stored).toEqual({ ...legacyTransaction, amount: -12.5 });
  });

  it('preserves v2 minor units and maps API values back to v1 storage decimals', () => {
    const api = transactionToApi(
      { ...legacyTransaction, id: 'tx_2', amount: -1250 },
      2,
      'USD',
      () => {
        throw new Error('should not generate');
      },
    );
    expect(api.amountMinor).toBe(-1250);
    expect(transactionFromApi(api, 1).amount).toBe(-12.5);
  });

  it('rejects a non-integer v2 amount or API minor amount', () => {
    expect(() =>
      transactionToApi({ ...legacyTransaction, amount: 12.5 }, 2, 'EUR', () => 'tx_3'),
    ).toThrow(/integer minor units/);
    expect(() =>
      transactionFromApi(
        { ...transactionToApi(legacyTransaction, 1, 'EUR', () => 'tx_4'), amountMinor: 1.5 },
        1,
      ),
    ).toThrow(/amountMinor/);
  });
});
