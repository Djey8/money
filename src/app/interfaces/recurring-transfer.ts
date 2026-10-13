import { SubscriptionFrequency } from './subscription';

/**
 * A rule that moves money between two of the user's own locations on a schedule ("50 EUR into the shared account
 * every week"). It is NOT a subscription and never creates a transaction: it only generates Transfers, so it cannot
 * change the income statement, Cashflow, the budget or any fund. It reuses the subscription frequencies.
 */
export interface RecurringTransfer {
  /** Stable id (`rtransfer_<uuid>`). */
  id: string;
  /** Becomes the comment of every transfer the rule generates. */
  title: string;
  fromLocationId: string;
  toLocationId: string;
  /** Always positive; the direction is from -> to. */
  amount: number;
  startDate: string;
  /** '' = no end date. */
  endDate: string;
  frequency: SubscriptionFrequency;
  comment: string;
}
