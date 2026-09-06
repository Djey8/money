import { fromMinorUnits, toMinorUnits } from '../money/minor-units';

export interface LegacyTransaction {
  id?: string;
  account: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  comment: string;
}

export interface Transaction extends Omit<LegacyTransaction, 'id'> {
  id: string;
}

export interface ApiTransaction extends Omit<Transaction, 'amount'> {
  amountMinor: number;
  currency: string;
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Transaction ${field} is required`);
  }
}

/**
 * Makes one legacy transaction addressable by the API without changing its
 * established six-field storage shape. Callers persist the returned record
 * only when deliberately backfilling IDs as part of a document write.
 */
export function normalizeTransaction(
  transaction: LegacyTransaction,
  generateId: () => string,
): Transaction {
  assertNonEmptyString(transaction.account, 'account');
  assertNonEmptyString(transaction.date, 'date');
  assertNonEmptyString(transaction.time, 'time');
  assertNonEmptyString(transaction.category, 'category');
  assertNonEmptyString(transaction.comment, 'comment');
  if (typeof transaction.amount !== 'number' || !Number.isFinite(transaction.amount)) {
    throw new Error('Transaction amount must be a finite number');
  }

  const id = transaction.id || generateId();
  assertNonEmptyString(id, 'id');
  return { ...transaction, id };
}

/** Maps a stored v1 decimal or v2 minor-unit transaction to the Pro API representation. */
export function transactionToApi(
  transaction: LegacyTransaction,
  schemaVersion: number,
  currency: string,
  generateId: () => string,
): ApiTransaction {
  const normalized = normalizeTransaction(transaction, generateId);
  const amountMinor = schemaVersion >= 2 ? normalized.amount : toMinorUnits(normalized.amount);
  if (!Number.isInteger(amountMinor)) {
    throw new Error('Transaction amount must be integer minor units for schema version 2');
  }
  assertNonEmptyString(currency, 'currency');
  return {
    id: normalized.id,
    account: normalized.account,
    amountMinor,
    currency,
    date: normalized.date,
    time: normalized.time,
    category: normalized.category,
    comment: normalized.comment,
  };
}

/** Maps an API transaction to the decimal or minor-unit representation used by a stored document. */
export function transactionFromApi(
  transaction: ApiTransaction,
  schemaVersion: number,
): Transaction {
  if (!Number.isInteger(transaction.amountMinor)) {
    throw new Error('Transaction amountMinor must be an integer');
  }
  return normalizeTransaction(
    {
      id: transaction.id,
      account: transaction.account,
      amount:
        schemaVersion >= 2 ? transaction.amountMinor : fromMinorUnits(transaction.amountMinor),
      date: transaction.date,
      time: transaction.time,
      category: transaction.category,
      comment: transaction.comment,
    },
    () => transaction.id,
  );
}
