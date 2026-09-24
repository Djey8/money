import { toMinorUnits } from '../money/minor-units';

export interface BucketAllocation {
  bucketTitle: string;
  amountMinor: number;
}

export interface FundBucket {
  id: string;
  title: string;
  targetMinor: number;
  amountMinor: number;
  /**
   * Derived during replay from a `#settle:` transaction (see
   * `parseSettlements`): the actual cost paid. While set it replaces
   * `targetMinor` as the bucket's capacity; `targetMinor` stays the planned
   * amount, so plan vs. actual remains visible.
   */
  settledMinor?: number;
  settledDate?: string;
}

/** A bucket's effective capacity: the actual cost once settled, else its planned target. */
export function bucketCapacity(bucket: FundBucket): number {
  return bucket.settledMinor ?? bucket.targetMinor;
}

export interface BucketSettlement {
  bucketTitle: string;
  actualMinor: number;
}

const SETTLE_TAG = /#settle:([^:]+):([\d.]+)/g;

/**
 * `#settle:<Bucket>:<actual>` marks the transaction that settles a bucket:
 * the real bill was paid, `actual` replaces the planned target, and the
 * transaction itself carries only the difference to what was saved.
 */
export function parseSettlements(comment: string): BucketSettlement[] {
  const settlements: BucketSettlement[] = [];
  for (const match of (comment || '').matchAll(SETTLE_TAG)) {
    const amount = Number(match[2]);
    if (Number.isFinite(amount) && amount >= 0) {
      settlements.push({ bucketTitle: match[1], actualMinor: toMinorUnits(amount) });
    }
  }
  return settlements;
}

const BUCKET_TAG = /#bucket:([^:]+):([\d.]+)/g;

/** Parses legacy decimal bucket tags into integer minor units for API/domain use. */
export function parseBucketAllocations(comment: string): BucketAllocation[] {
  const allocations: BucketAllocation[] = [];
  for (const match of comment.matchAll(BUCKET_TAG)) {
    const amount = Number(match[2]);
    if (Number.isFinite(amount) && amount > 0) {
      allocations.push({ bucketTitle: match[1], amountMinor: toMinorUnits(amount) });
    }
  }
  return allocations;
}

/** Applies named allocations up to each bucket's remaining target without mutating the input. */
export function applyBucketAllocations(
  buckets: FundBucket[],
  allocations: BucketAllocation[],
): FundBucket[] {
  return buckets.map((bucket) => {
    const allocation = allocations.find(
      (candidate) => candidate.bucketTitle.toLocaleLowerCase() === bucket.title.toLocaleLowerCase(),
    );
    if (!allocation) return { ...bucket };
    const remaining = Math.max(0, bucketCapacity(bucket) - bucket.amountMinor);
    return {
      ...bucket,
      amountMinor: bucket.amountMinor + Math.min(allocation.amountMinor, remaining),
    };
  });
}
