import {
  calculateMissingAmountMinor,
  calculateNumberOfPeriods,
  calculateProportionalDistribution,
  generateBucketAllocationComment,
  calculatePaymentPlan,
  validatePaymentPlan,
  PlanBucketInput,
  PaymentPlan,
} from './payment-plan';

function bucket(overrides: Partial<PlanBucketInput>): PlanBucketInput {
  return { id: 'b1', title: 'Flights', targetMinor: 100000, amountMinor: 0, ...overrides };
}

describe('calculateMissingAmountMinor', () => {
  it('sums the shortfall across every bucket when none are selected', () => {
    const buckets = [
      bucket({ id: 'b1', targetMinor: 100000, amountMinor: 40000 }),
      bucket({ id: 'b2', targetMinor: 50000, amountMinor: 50000 }),
    ];
    expect(calculateMissingAmountMinor(buckets, [])).toBe(60000);
  });

  it('only sums the selected buckets', () => {
    const buckets = [
      bucket({ id: 'b1', targetMinor: 100000, amountMinor: 40000 }),
      bucket({ id: 'b2', targetMinor: 50000, amountMinor: 0 }),
    ];
    expect(calculateMissingAmountMinor(buckets, ['b2'])).toBe(50000);
  });

  it('never counts an over-funded bucket as negative', () => {
    const buckets = [bucket({ id: 'b1', targetMinor: 100000, amountMinor: 150000 })];
    expect(calculateMissingAmountMinor(buckets, [])).toBe(0);
  });
});

describe('calculateNumberOfPeriods', () => {
  it('returns 0 when the target date is not after the start date', () => {
    expect(calculateNumberOfPeriods('2026-09-07', '2026-09-07', 'monthly')).toBe(0);
    expect(calculateNumberOfPeriods('2026-09-07', '2026-08-01', 'monthly')).toBe(0);
  });

  it('counts weekly periods by ceil(days / 7)', () => {
    expect(calculateNumberOfPeriods('2026-01-01', '2026-01-15', 'weekly')).toBe(2);
  });

  it('counts biweekly periods by ceil(days / 14)', () => {
    expect(calculateNumberOfPeriods('2026-01-01', '2026-01-15', 'biweekly')).toBe(1);
  });

  it('counts monthly periods by calendar-month difference, minimum 1', () => {
    expect(calculateNumberOfPeriods('2026-01-01', '2026-04-01', 'monthly')).toBe(3);
    // Crossing a month boundary by even one day counts as a full period —
    // an intentional approximation ported from the original, not a bug.
    expect(calculateNumberOfPeriods('2026-01-31', '2026-02-01', 'monthly')).toBe(1);
  });

  it('counts quarterly periods by ceil(calendar months / 3), minimum 1', () => {
    expect(calculateNumberOfPeriods('2026-01-01', '2027-01-01', 'quarterly')).toBe(4);
    expect(calculateNumberOfPeriods('2026-01-01', '2026-02-01', 'quarterly')).toBe(1);
  });

  it('counts yearly periods by calendar-year difference, minimum 1', () => {
    expect(calculateNumberOfPeriods('2026-01-01', '2029-01-01', 'yearly')).toBe(3);
    expect(calculateNumberOfPeriods('2026-01-01', '2026-06-01', 'yearly')).toBe(1);
  });
});

describe('calculateProportionalDistribution', () => {
  it('gives a single selected bucket the entire payment, even if already full', () => {
    const buckets = [bucket({ id: 'b1', targetMinor: 100000, amountMinor: 100000 })];
    const allocations = calculateProportionalDistribution(buckets, ['b1'], 50000);
    expect(allocations).toEqual([{ bucketId: 'b1', bucketTitle: 'Flights', amountMinor: 50000 }]);
  });

  it('distributes proportionally to each bucket missing amount, remainder to the last', () => {
    const buckets = [
      bucket({ id: 'b1', title: 'Flights', targetMinor: 100000, amountMinor: 0 }), // missing 100000
      bucket({ id: 'b2', title: 'Hotel', targetMinor: 50000, amountMinor: 0 }), // missing 50000
    ];
    // Total missing 150000, split 2:1 across a 10000 payment -> 6666.67 / 3333.33, rounded.
    const allocations = calculateProportionalDistribution(buckets, [], 10000);
    expect(allocations[0]).toEqual({ bucketId: 'b1', bucketTitle: 'Flights', amountMinor: 6667 });
    expect(allocations[1]).toEqual({ bucketId: 'b2', bucketTitle: 'Hotel', amountMinor: 3333 });
    const total = allocations.reduce((sum, a) => sum + a.amountMinor, 0);
    expect(total).toBe(10000); // Exact — the last allocation absorbs all rounding.
  });

  it('splits evenly across already-full buckets when nothing is missing', () => {
    const buckets = [
      bucket({ id: 'b1', targetMinor: 100000, amountMinor: 100000 }),
      bucket({ id: 'b2', targetMinor: 100000, amountMinor: 100000 }),
      bucket({ id: 'b3', targetMinor: 100000, amountMinor: 100000 }),
    ];
    const allocations = calculateProportionalDistribution(buckets, [], 10000);
    const total = allocations.reduce((sum, a) => sum + a.amountMinor, 0);
    expect(total).toBe(10000);
    expect(allocations.map((a) => a.amountMinor)).toEqual([3333, 3333, 3334]);
  });

  it('returns an empty array when no buckets are selected out of an empty set', () => {
    expect(calculateProportionalDistribution([], [], 10000)).toEqual([]);
  });
});

describe('generateBucketAllocationComment', () => {
  it('formats one #bucket tag per allocation with a 2-decimal amount', () => {
    const comment = generateBucketAllocationComment([
      { bucketId: 'b1', bucketTitle: 'Flights', amountMinor: 6667 },
      { bucketId: 'b2', bucketTitle: 'Hotel', amountMinor: 3333 },
    ]);
    expect(comment).toBe('#bucket:Flights:66.67 #bucket:Hotel:33.33');
  });

  it('returns an empty string for no allocations', () => {
    expect(generateBucketAllocationComment([])).toBe('');
  });
});

describe('calculatePaymentPlan', () => {
  const buckets = [bucket({ id: 'b1', title: 'Flights', targetMinor: 300000, amountMinor: 0 })];

  it('calculates the per-period amount from the missing total and period count', () => {
    const plan = calculatePaymentPlan({
      projectType: 'smile',
      projectTitle: 'Summer Vacation',
      planTitle: 'Flight Fund',
      buckets,
      selectedBucketIds: [],
      startDate: '2026-01-01',
      targetDate: '2026-04-01',
      frequency: 'monthly',
      account: 'Daily',
    });
    expect(plan.originalCalculatedAmountMinor).toBe(100000); // 300000 / 3 periods
    expect(plan.amountMinor).toBe(100000);
    expect(plan.manuallyAdjusted).toBe(false);
    expect(plan.status).toBe('planned');
    expect(plan.category).toBe('@Summer Vacation');
    expect(plan.endDate).toBe('2026-04-01');
    expect(plan.comment).toBe('#bucket:Flights:1000.00');
  });

  it('uses the manual amount when provided and flags manuallyAdjusted', () => {
    const plan = calculatePaymentPlan({
      projectType: 'fire',
      projectTitle: 'Emergency Fund',
      planTitle: 'Top-up',
      buckets,
      selectedBucketIds: [],
      startDate: '2026-01-01',
      targetDate: '2026-04-01',
      frequency: 'monthly',
      account: 'Daily',
      manualAmountMinor: 50000,
    });
    expect(plan.amountMinor).toBe(50000);
    expect(plan.originalCalculatedAmountMinor).toBe(100000);
    expect(plan.manuallyAdjusted).toBe(true);
  });

  it('does not flag manuallyAdjusted when the manual amount matches the calculated one', () => {
    const plan = calculatePaymentPlan({
      projectType: 'smile',
      projectTitle: 'Summer Vacation',
      planTitle: 'Flight Fund',
      buckets,
      selectedBucketIds: [],
      startDate: '2026-01-01',
      targetDate: '2026-04-01',
      frequency: 'monthly',
      account: 'Daily',
      manualAmountMinor: 100000,
    });
    expect(plan.manuallyAdjusted).toBe(false);
  });

  it('uses the full missing amount as a single lump sum when there are 0 periods', () => {
    const plan = calculatePaymentPlan({
      projectType: 'smile',
      projectTitle: 'Summer Vacation',
      planTitle: 'Flight Fund',
      buckets,
      selectedBucketIds: [],
      startDate: '2026-09-07',
      targetDate: '2026-09-07',
      frequency: 'monthly',
      account: 'Daily',
    });
    expect(plan.originalCalculatedAmountMinor).toBe(300000);
  });
});

describe('validatePaymentPlan', () => {
  function validPlan(overrides: Partial<PaymentPlan> = {}): PaymentPlan {
    return {
      title: 'Flight Fund',
      status: 'planned',
      projectType: 'smile',
      projectTitle: 'Summer Vacation',
      account: 'Daily',
      amountMinor: 10000,
      startDate: '2026-01-01',
      endDate: '2026-04-01',
      category: '@Summer Vacation',
      comment: '#bucket:Flights:100.00',
      frequency: 'monthly',
      targetDate: '2026-04-01',
      targetBucketIds: [],
      originalCalculatedAmountMinor: 10000,
      manuallyAdjusted: false,
      ...overrides,
    };
  }

  it('accepts a well-formed plan', () => {
    expect(validatePaymentPlan(validPlan())).toEqual({ valid: true, errors: [] });
  });

  it('rejects a blank title', () => {
    expect(validatePaymentPlan(validPlan({ title: '  ' })).errors).toContain(
      'Plan title is required',
    );
  });

  it('rejects a non-positive amount', () => {
    expect(validatePaymentPlan(validPlan({ amountMinor: 0 })).errors).toContain(
      'Payment amount must be greater than zero',
    );
  });

  it('rejects a target date that is not after the start date', () => {
    expect(
      validatePaymentPlan(validPlan({ startDate: '2026-04-01', targetDate: '2026-01-01' })).errors,
    ).toContain('Target date must be after start date');
  });

  it('rejects a blank account', () => {
    expect(validatePaymentPlan(validPlan({ account: '' })).errors).toContain('Account is required');
  });

  it('collects every violated rule at once', () => {
    const result = validatePaymentPlan(
      validPlan({ title: '', amountMinor: 0, account: '', startDate: '', targetDate: '' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Plan title is required',
        'Payment amount must be greater than zero',
        'Start date is required',
        'Target date is required',
        'Account is required',
      ]),
    );
  });
});
