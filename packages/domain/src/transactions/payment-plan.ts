import { fromMinorUnits } from '../money/minor-units';

/**
 * Ports `PaymentPlannerService` (`src/app/shared/services/payment-planner.service.ts`,
 * SMILE-7 — "Payment planner for buckets", shared by Smile and Fire) for
 * `POST /{smile,fire}/{id}/payment-plan`. Only the CREATE/calculate path is
 * ported: `calculatePaymentPlan`/`validatePaymentPlan`, matching the
 * original's own `savePlan()` (the only place in the app that actually calls
 * them). The service's other methods — `validateMultiplePlans`,
 * `calculateTotalMonthlyCommitment`, `convertToMonthlyEquivalent`,
 * `parseAllocationComment` — are either unused anywhere in the app (the first
 * and last) or serve a read-only "list of plans" summary view that isn't
 * SMILE-7's own catalog entry (`calculateTotalMonthlyCommitment`, used by
 * `info-smile`/`info-fire`/`add-smile`/`add-fire` components' summary
 * displays, not by plan creation) — out of scope here.
 *
 * Money fields are integer minor units, per this package's convention;
 * `calculateNumberOfPeriods` has no money involved and is ported verbatim
 * (its calendar-month/quarter/year period counts are an intentional
 * approximation of the original business rule, not a bug — e.g. any span
 * that crosses a month boundary counts as at least 1 monthly period,
 * regardless of how many days that span covers).
 *
 * Unlike the original Angular service, this module does not generate an
 * `id`, `createdAt`, or `updatedAt` — those are assigned by the repository
 * layer at write time (`crypto.randomUUID()`, matching every other new
 * entity id in this API), keeping this module a pure function of its inputs
 * like every other calculation in this package.
 */

export type PaymentPlanFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PlanBucketInput {
  id: string;
  title: string;
  targetMinor: number;
  amountMinor: number;
}

export interface PaymentPlanAllocation {
  bucketId: string;
  bucketTitle: string;
  amountMinor: number;
}

export interface PaymentPlanInput {
  projectType: 'smile' | 'fire';
  projectTitle: string;
  planTitle: string;
  buckets: PlanBucketInput[];
  /** Bucket ids to fund; empty means "all buckets" (smart allocation across every bucket). */
  selectedBucketIds: string[];
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `YYYY-MM-DD`. */
  targetDate: string;
  frequency: PaymentPlanFrequency;
  account: string;
  /** Overrides the calculated per-period amount when provided. */
  manualAmountMinor?: number;
}

export interface PaymentPlan {
  title: string;
  status: 'planned';
  projectType: 'smile' | 'fire';
  projectTitle: string;
  account: string;
  amountMinor: number;
  startDate: string;
  endDate: string;
  category: string;
  comment: string;
  frequency: PaymentPlanFrequency;
  targetDate: string;
  targetBucketIds: string[];
  originalCalculatedAmountMinor: number;
  manuallyAdjusted: boolean;
}

export interface PaymentPlanValidation {
  valid: boolean;
  errors: string[];
}

function selectBuckets<T extends { id: string }>(buckets: T[], selectedBucketIds: string[]): T[] {
  return selectedBucketIds.length === 0
    ? buckets
    : buckets.filter((bucket) => selectedBucketIds.includes(bucket.id));
}

export function calculateMissingAmountMinor(
  buckets: PlanBucketInput[],
  selectedBucketIds: string[],
): number {
  return selectBuckets(buckets, selectedBucketIds).reduce(
    (sum, bucket) => sum + Math.max(0, bucket.targetMinor - bucket.amountMinor),
    0,
  );
}

export function calculateNumberOfPeriods(
  startDate: string,
  targetDate: string,
  frequency: PaymentPlanFrequency,
): number {
  const start = new Date(startDate);
  const end = new Date(targetDate);

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 0;

  switch (frequency) {
    case 'weekly':
      return Math.ceil(diffDays / 7);
    case 'biweekly':
      return Math.ceil(diffDays / 14);
    case 'monthly': {
      const months =
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return Math.max(1, months);
    }
    case 'quarterly': {
      const months =
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return Math.max(1, Math.ceil(months / 3));
    }
    case 'yearly': {
      return Math.max(1, end.getFullYear() - start.getFullYear());
    }
    default:
      return 1;
  }
}

/**
 * Proportional distribution of `paymentAmountMinor` across the funded buckets
 * by each bucket's missing amount. Integer minor units avoid the original's
 * decimal-rounding-then-remainder-correction dance entirely: every allocation
 * but the last is `Math.round`ed, and the last always takes whatever's left,
 * so the allocations sum to exactly `paymentAmountMinor` with no drift.
 */
export function calculateProportionalDistribution(
  buckets: PlanBucketInput[],
  selectedBucketIds: string[],
  paymentAmountMinor: number,
): PaymentPlanAllocation[] {
  const bucketsToFund = selectBuckets(buckets, selectedBucketIds);
  if (bucketsToFund.length === 0) return [];

  if (bucketsToFund.length === 1) {
    return [
      {
        bucketId: bucketsToFund[0].id,
        bucketTitle: bucketsToFund[0].title,
        amountMinor: paymentAmountMinor,
      },
    ];
  }

  const missingAmounts = bucketsToFund.map((bucket) => ({
    ...bucket,
    missingMinor: Math.max(0, bucket.targetMinor - bucket.amountMinor),
  }));
  const totalMissingMinor = missingAmounts.reduce((sum, bucket) => sum + bucket.missingMinor, 0);

  if (totalMissingMinor === 0) {
    const perBucket = Math.round(paymentAmountMinor / bucketsToFund.length);
    let remaining = paymentAmountMinor;
    return bucketsToFund.map((bucket, index) => {
      const amountMinor = index === bucketsToFund.length - 1 ? remaining : perBucket;
      remaining -= amountMinor;
      return { bucketId: bucket.id, bucketTitle: bucket.title, amountMinor };
    });
  }

  const allocations: PaymentPlanAllocation[] = [];
  let remaining = paymentAmountMinor;
  missingAmounts.forEach((bucket, index) => {
    const amountMinor =
      index === missingAmounts.length - 1
        ? remaining
        : Math.round(paymentAmountMinor * (bucket.missingMinor / totalMissingMinor));
    allocations.push({ bucketId: bucket.id, bucketTitle: bucket.title, amountMinor });
    remaining -= amountMinor;
  });

  return allocations;
}

/** `#bucket:Title:Amount` tags, one per allocation — the same DSL `parseBucketAllocations` (bucket-allocations.ts) reads. */
export function generateBucketAllocationComment(allocations: PaymentPlanAllocation[]): string {
  return allocations
    .map(
      (allocation) =>
        `#bucket:${allocation.bucketTitle}:${fromMinorUnits(allocation.amountMinor).toFixed(2)}`,
    )
    .join(' ');
}

export function calculatePaymentPlan(input: PaymentPlanInput): PaymentPlan {
  const totalMissingMinor = calculateMissingAmountMinor(input.buckets, input.selectedBucketIds);
  const periods = calculateNumberOfPeriods(input.startDate, input.targetDate, input.frequency);
  const originalCalculatedAmountMinor =
    periods > 0 ? Math.round(totalMissingMinor / periods) : totalMissingMinor;
  const amountMinor = input.manualAmountMinor ?? originalCalculatedAmountMinor;

  const allocations = calculateProportionalDistribution(
    input.buckets,
    input.selectedBucketIds,
    amountMinor,
  );

  return {
    title: input.planTitle,
    status: 'planned',
    projectType: input.projectType,
    projectTitle: input.projectTitle,
    account: input.account,
    amountMinor,
    startDate: input.startDate,
    endDate: input.targetDate,
    category: `@${input.projectTitle}`,
    comment: generateBucketAllocationComment(allocations),
    frequency: input.frequency,
    targetDate: input.targetDate,
    targetBucketIds: [...input.selectedBucketIds],
    originalCalculatedAmountMinor,
    manuallyAdjusted:
      input.manualAmountMinor !== undefined &&
      input.manualAmountMinor !== originalCalculatedAmountMinor,
  };
}

export function validatePaymentPlan(plan: PaymentPlan): PaymentPlanValidation {
  const errors: string[] = [];

  if (!plan.title || plan.title.trim() === '') errors.push('Plan title is required');
  if (plan.amountMinor <= 0) errors.push('Payment amount must be greater than zero');
  if (!plan.startDate) errors.push('Start date is required');
  if (!plan.targetDate) errors.push('Target date is required');
  if (plan.startDate && plan.targetDate && plan.targetDate <= plan.startDate) {
    errors.push('Target date must be after start date');
  }
  if (!plan.account || plan.account.trim() === '') errors.push('Account is required');
  if (!plan.frequency) errors.push('Frequency is required');

  return { valid: errors.length === 0, errors };
}
