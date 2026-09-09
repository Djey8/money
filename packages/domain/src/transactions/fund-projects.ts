import { FundBucket } from './bucket-allocations';

/**
 * Read-side aggregate for a Smile/Fire project's buckets — "how far along is
 * this project overall". Per PLAN.md D-9, this is the consolidation of a
 * `buckets.reduce((sum, b) => sum + b.target, 0)`-shaped calculation an
 * Explore pass found duplicated across ~10 UI files (`smile-projects.component.ts`,
 * `info-smile.component.ts`, `info-fire.component.ts`, `income-statement.service.ts`,
 * chart code, migration utils). Same field names/semantics as `MojoStatus`
 * (`mojo.ts`) for consistency across the API's "how full is this reserve"
 * responses.
 */
export interface FundProjectTotals {
  targetMinor: number;
  amountMinor: number;
  /** max(0, targetMinor - amountMinor). */
  remainingMinor: number;
  /**
   * amountMinor / targetMinor * 100, or 0 when targetMinor is 0. Not clamped
   * to 100 — under normal write-path usage a bucket's `amountMinor` never
   * exceeds its own `targetMinor` (both `applySmileTransaction`'s
   * `distributeEvenly` and `applyFireTransaction` cap each bucket at its
   * target, unlike Mojo's direct-account-deposit path), but this aggregate
   * reports whatever is actually stored rather than silently hiding a
   * pre-existing/manually-edited anomaly.
   */
  percentFilled: number;
}

export function computeProjectTotals(buckets: FundBucket[]): FundProjectTotals {
  const targetMinor = buckets.reduce((sum, bucket) => sum + bucket.targetMinor, 0);
  const amountMinor = buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0);
  const remainingMinor = Math.max(0, targetMinor - amountMinor);
  const percentFilled = targetMinor > 0 ? (amountMinor / targetMinor) * 100 : 0;
  return { targetMinor, amountMinor, remainingMinor, percentFilled };
}
