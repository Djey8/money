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

export interface MojoStatus extends MojoBalance {
  /** `max(0, targetMinor - amountMinor)` — 0 once the target is reached or exceeded. */
  remainingMinor: number;
  /** `amountMinor / targetMinor * 100`, or 0 when `targetMinor` is 0. Not clamped to 100 — `amountMinor` can exceed `targetMinor` for a direct deposit made on the `Mojo` account itself (only `@Mojo`-category contributions are capped, per `applyMojoTransaction`). */
  percentFilled: number;
}

/** Read-side aggregate for `GET /mojo` — the "how full is Mojo" view a UI/agent needs, on top of the raw balance `applyMojoTransaction` maintains. */
export function computeMojoStatus(mojo: MojoBalance): MojoStatus {
  const remainingMinor = Math.max(0, mojo.targetMinor - mojo.amountMinor);
  const percentFilled = mojo.targetMinor > 0 ? (mojo.amountMinor / mojo.targetMinor) * 100 : 0;
  return { ...mojo, remainingMinor, percentFilled };
}
