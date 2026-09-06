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