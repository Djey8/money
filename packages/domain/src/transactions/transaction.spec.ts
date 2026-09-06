import { normalizeTransaction } from './transaction';

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

  it.each([
    [{ ...legacyTransaction, account: '' }, 'account'],
    [{ ...legacyTransaction, date: '' }, 'date'],
    [{ ...legacyTransaction, amount: Number.NaN }, 'amount'],
  ])('rejects invalid transaction fields', (transaction, field) => {
    expect(() => normalizeTransaction(transaction, () => 'tx_new')).toThrow(field);
  });
});