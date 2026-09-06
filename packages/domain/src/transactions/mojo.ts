import { ApiTransaction } from './transaction';

export interface MojoBalance {
  amountMinor: number;
  targetMinor: number;
}

/**
 * Applies the UI's transaction-driven Mojo update order without mutating the
 * input balance. `@Mojo` contributions are capped at the target; transactions
 * made from the Mojo account are then applied as spending or adjustments.
 */
export function applyMojoTransaction(mojo: MojoBalance, transaction: ApiTransaction): MojoBalance {
  let amountMinor = mojo.amountMinor;
  if (transaction.category === '@Mojo' && amountMinor < mojo.targetMinor) {
    amountMinor = Math.min(mojo.targetMinor, amountMinor - transaction.amountMinor);
  }
  if (transaction.account === 'Mojo') amountMinor += transaction.amountMinor;
  return { ...mojo, amountMinor };
}
