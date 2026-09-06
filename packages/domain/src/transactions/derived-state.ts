import {
  summarizeTransactionAccounting,
  TransactionAccountingContext,
  TransactionAccountingSummary,
} from './accounting';
import { FundState, recalculateFundState } from './fund-state';
import { ApiTransaction } from './transaction';

export interface TransactionDerivedState {
  accounting: TransactionAccountingSummary;
  funds: FundState;
}

export interface TransactionDerivedStateContext extends TransactionAccountingContext {
  funds: FundState;
}

/**
 * Rebuilds every transaction-derived value required by the API write path.
 * Call this after an in-memory transaction mutation and persist its outputs
 * alongside the updated transaction collection in the same CouchDB write.
 */
export function recalculateTransactionDerivedState(
  transactions: ApiTransaction[],
  context: TransactionDerivedStateContext,
): TransactionDerivedState {
  return {
    accounting: summarizeTransactionAccounting(transactions, context),
    funds: recalculateFundState(transactions, context.funds),
  };
}
