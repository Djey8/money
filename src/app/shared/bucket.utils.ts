import { Transaction } from '../interfaces/transaction';

/**
 * A bucket's capacity: its actual cost once settled, otherwise its target.
 * Same rule as the domain package's `bucketCapacity` (in minor units).
 */
export function bucketCapacity(bucket: { target: number; settledAmount?: number }): number {
  return bucket.settledAmount ?? bucket.target;
}

const SETTLE_TAG = /#settle:([^:\n]+):([\d.]+)/g;

/** Index of the transaction settling `bucketTitle` of the project `projectTitle`, or -1. */
export function findSettlementIndex(
  transactions: Transaction[],
  projectTitle: string,
  bucketTitle: string,
): number {
  const category = `@${projectTitle}`.toLocaleLowerCase();
  const title = bucketTitle.toLocaleLowerCase();
  return transactions.findIndex(
    (transaction) =>
      (transaction.category || '').toLocaleLowerCase() === category &&
      [...(transaction.comment || '').matchAll(SETTLE_TAG)].some(
        (match) => match[1].toLocaleLowerCase() === title,
      ),
  );
}

export interface SettleBucketInput {
  projectTitle: string;
  bucket: { title: string; amount: number };
  actual: number;
  receipt?: string;
  account: string;
  date: string;
  time: string;
  /** Moves a surplus (saved more than the actual cost) into this bucket instead of releasing it. */
  moveSurplusTo?: string;
}

/**
 * Settles a bucket with its actual cost, in place: adds (or, when it's already
 * settled, replaces) its `#settle:` transaction, whose amount is the difference
 * to what was saved — negative tops up, positive releases a surplus. The fund
 * engine (IncomeStatementService.recalculate) re-derives that amount and the
 * bucket's settled state from it, exactly as the self-hosted API's
 * `settle_bucket` does (backend/repositories/fund-contribution-repository.js).
 */
export function settleBucketTransactions(
  transactions: Transaction[],
  input: SettleBucketInput,
): void {
  const existingIndex = findSettlementIndex(transactions, input.projectTitle, input.bucket.title);
  const existing = existingIndex >= 0 ? transactions[existingIndex] : undefined;
  // A settled bucket's amount is its previous actual cost; the savings before
  // settling are that minus the previous settlement's difference.
  const saved = round(existing ? input.bucket.amount + existing.amount : input.bucket.amount);
  const surplus = Math.max(0, round(saved - input.actual));

  const settlement: Transaction = {
    account: existing?.account || input.account,
    amount: round(-(input.actual - saved)),
    date: existing?.date || input.date,
    time: existing?.time || input.time,
    category: `@${input.projectTitle}`,
    comment: [input.receipt?.trim(), `#settle:${input.bucket.title}:${input.actual.toFixed(2)}`]
      .filter(Boolean)
      .join('\n'),
  };
  if (existing) transactions.splice(existingIndex, 1, settlement);
  else transactions.push(settlement);

  if (input.moveSurplusTo && surplus > 0) {
    transactions.push({
      account: settlement.account,
      amount: -surplus,
      date: settlement.date,
      time: settlement.time,
      category: `@${input.projectTitle}`,
      comment: `Surplus from ${input.bucket.title}\n#bucket:${input.moveSurplusTo}:${surplus.toFixed(2)}`,
    });
  }
}

/** Removes a bucket's settlement transaction; returns whether there was one. */
export function unsettleBucketTransactions(
  transactions: Transaction[],
  projectTitle: string,
  bucketTitle: string,
): boolean {
  const index = findSettlementIndex(transactions, projectTitle, bucketTitle);
  if (index < 0) return false;
  transactions.splice(index, 1);
  return true;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
