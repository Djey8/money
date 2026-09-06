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
    const remaining = Math.max(0, bucket.targetMinor - bucket.amountMinor);
    return {
      ...bucket,
      amountMinor: bucket.amountMinor + Math.min(allocation.amountMinor, remaining),
    };
  });
}
