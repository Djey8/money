import { fromMinorUnits, toMinorUnits } from '../money/minor-units';
import { LocationLeg } from '../locations/location-split';

/** A stored split: money that went to a location other than the main one (decimal or minor, like `amount`). */
export interface StoredLocationSplit {
  locationId: string;
  amount: number;
}

export interface LegacyTransaction {
  id?: string;
  account: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  comment: string;
  /** Where the money physically moved (a MoneyLocation id). Absent = not tracked. */
  locationId?: string;
  /**
   * Money that went to OTHER locations; the main one (`locationId`) gets the rest. Absent = not split.
   * Only the other amounts are stored, so the parts always add up (see locations/location-split.ts).
   */
  locationSplits?: StoredLocationSplit[];
}

export interface Transaction extends Omit<LegacyTransaction, 'id'> {
  id: string;
}

export interface ApiTransaction extends Omit<Transaction, 'amount' | 'locationSplits'> {
  amountMinor: number;
  currency: string;
  locationSplits?: LocationLeg[];
}

function splitsToApi(
  splits: StoredLocationSplit[] | undefined,
  schemaVersion: number,
): LocationLeg[] | undefined {
  if (!Array.isArray(splits) || splits.length === 0) return undefined;
  return splits.map((split) => ({
    locationId: split.locationId,
    amountMinor: schemaVersion >= 2 ? Number(split.amount) : toMinorUnits(Number(split.amount)),
  }));
}

function splitsFromApi(
  legs: LocationLeg[] | undefined,
  schemaVersion: number,
): StoredLocationSplit[] | undefined {
  if (!Array.isArray(legs) || legs.length === 0) return undefined;
  return legs.map((leg) => ({
    locationId: leg.locationId,
    amount: schemaVersion >= 2 ? leg.amountMinor : fromMinorUnits(leg.amountMinor),
  }));
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Transaction ${field} is required`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') throw new Error(`Transaction ${field} must be a string`);
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
  assertString(transaction.category, 'category');
  assertString(transaction.comment, 'comment');
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
    // Optional and never written as null: the stored document encrypts every value as a string.
    ...(normalized.locationId ? { locationId: normalized.locationId } : {}),
    ...(splitsToApi(normalized.locationSplits, schemaVersion)
      ? { locationSplits: splitsToApi(normalized.locationSplits, schemaVersion) }
      : {}),
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
      ...(transaction.locationId ? { locationId: transaction.locationId } : {}),
      ...(splitsFromApi(transaction.locationSplits, schemaVersion)
        ? { locationSplits: splitsFromApi(transaction.locationSplits, schemaVersion) }
        : {}),
    },
    () => transaction.id,
  );
}
