import { generateDueSubscriptionTransactions } from '../transactions/subscription-generation';
import {
  constructedSubscriptionComment,
  reconcileGeneratedTransactions,
  SyncSubscription,
} from '../transactions/subscription-sync';
import { SubscriptionFrequency } from '../transactions/frequency-strategies';
import { ApiTransaction } from '../transactions/transaction';

/**
 * Recurring transfers: "move 50 EUR into the shared account every week" (todo/locations.md section 19).
 *
 * A recurring transfer is NOT a subscription: it lives in its own list and only ever generates TRANSFERS, never
 * transactions, so nothing that reads subscriptions as income or expense (budget, plan, charts, exports) can see
 * it and Cashflow cannot change. It does reuse the subscription engine for the parts that are identical -
 * the occurrence dates for every frequency, recognising what it generated, and the rule that editing it moves its
 * generated transfers in place - by presenting each transfer to that engine as a transaction on a synthetic
 * "from>to" account in a synthetic "@transfer" category.
 *
 * Like the other location features it is future-minded: an edit only follows through to the transfers it
 * generated, and it never touches a transfer the user made by hand.
 */

export interface RecurringTransferRule {
  title: string;
  fromLocationId: string;
  toLocationId: string;
  /** Positive minor units. */
  amountMinor: number;
  startDate: string;
  /** `null` (or `''`) = no end date. */
  endDate: string | null;
  comment: string;
  frequency: SubscriptionFrequency;
}

/** A transfer as the engine needs to see it (integer minor units, always positive). */
export interface TransferLike {
  fromLocationId?: string | null;
  toLocationId?: string | null;
  amountMinor: number;
  date: string;
  time: string;
  comment: string;
}

export interface GeneratedTransfer {
  fromLocationId: string;
  toLocationId: string;
  amountMinor: number;
  date: string;
  time: string;
  comment: string;
}

export interface GeneratedTransferUpdate {
  /** Index into the transfers that were passed in. */
  index: number;
  fromLocationId: string;
  toLocationId: string;
  amountMinor: number;
  date: string;
  comment: string;
}

const CATEGORY = '@transfer';
const EMPTY_FUNDS = { mojo: { amountMinor: 0, targetMinor: 0 }, smile: [], fire: [] };

const accountOf = (from?: string | null, to?: string | null): string => `${from ?? ''}>${to ?? ''}`;

function asSubscription(rule: RecurringTransferRule): SyncSubscription {
  return {
    title: rule.title,
    account: accountOf(rule.fromLocationId, rule.toLocationId),
    amountMinor: rule.amountMinor,
    startDate: rule.startDate,
    endDate: rule.endDate ? rule.endDate : null,
    category: CATEGORY,
    comment: rule.comment || '',
    frequency: rule.frequency || 'monthly',
  };
}

function asTransaction(transfer: TransferLike): ApiTransaction {
  return {
    id: '',
    currency: '',
    account: accountOf(transfer.fromLocationId, transfer.toLocationId),
    amountMinor: transfer.amountMinor,
    date: transfer.date,
    time: transfer.time,
    category: CATEGORY,
    comment: transfer.comment || '',
  };
}

/** The comment a generated transfer carries (the rule's title, plus its comment when it has one). */
export function recurringTransferComment(rule: Pick<RecurringTransferRule, 'title' | 'comment'>) {
  return constructedSubscriptionComment(rule.title, rule.comment || '');
}

/**
 * The transfers that are due and do not exist yet, for every occurrence up to today (or the rule's end date).
 * An occurrence counts as existing when a transfer between the same two locations for the same amount, on that day,
 * carries the generated comment.
 */
export function generateDueTransfers(
  rules: readonly RecurringTransferRule[],
  existing: readonly TransferLike[],
  now: Date = new Date(),
): GeneratedTransfer[] {
  const result = generateDueSubscriptionTransactions(
    rules.map((rule) => ({ ...asSubscription(rule), endDate: rule.endDate || null })),
    existing.map(asTransaction),
    EMPTY_FUNDS,
    now,
  );
  return result.transactions.map((generated) => {
    const [fromLocationId, toLocationId] = generated.account.split('>');
    return {
      fromLocationId,
      toLocationId,
      amountMinor: generated.amountMinor,
      date: generated.date,
      time: generated.time,
      comment: generated.comment,
    };
  });
}

/**
 * Brings the transfers `before` generated in line with `after` (`null` when the rule is deleted: all of them go).
 * The ones `after` still has an occurrence for change in place (keeping their place in the list); the others are
 * removed. What `after` is due and lacks is left to `generateDueTransfers`.
 */
export function reconcileGeneratedTransfers(
  before: RecurringTransferRule,
  after: RecurringTransferRule | null,
  existing: readonly TransferLike[],
  now: Date = new Date(),
): { updates: GeneratedTransferUpdate[]; removals: number[] } {
  const { updates, removals } = reconcileGeneratedTransactions(
    asSubscription(before),
    after ? asSubscription(after) : null,
    existing.map(asTransaction),
    now,
  );
  return {
    updates: updates.map((update) => ({
      index: update.index,
      fromLocationId: (after as RecurringTransferRule).fromLocationId,
      toLocationId: (after as RecurringTransferRule).toLocationId,
      amountMinor: update.amountMinor,
      date: update.date,
      comment: update.comment,
    })),
    removals,
  };
}
