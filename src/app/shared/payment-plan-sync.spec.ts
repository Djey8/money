import { dayBefore, plannedRemaining, syncPaymentPlans } from './payment-plan-sync';

const project = (amounts: number[]) =>
  ({
    title: 'Mountain',
    buckets: amounts.map((amount, i) => ({ id: `b${i}`, title: `B${i}`, target: 100, amount })),
    plannedSubscriptions: [
      {
        id: 'p1',
        title: 'Plan',
        status: 'active',
        category: '@Mountain',
        targetBucketIds: [],
        amount: 50,
        frequency: 'monthly',
      },
    ],
  }) as any;

const sub = (endDate: string) =>
  ({ title: 'Plan', category: '@Mountain', amount: -50, frequency: 'monthly', endDate }) as any;

describe('payment plan sync (game)', () => {
  it('a plan whose buckets are full is completed, and its subscription ends before the next Payday', () => {
    const p = project([100, 100]);
    const s = sub('2027-06-15');
    expect(syncPaymentPlans([p], [s], '2026-12-15')).toBe(true);
    expect(p.plannedSubscriptions[0].status).toBe('completed');
    expect(s.endDate).toBe('2026-12-14');
  });

  it('a plan with buckets still open keeps running; one that ran to its end is completed', () => {
    const open = project([100, 40]);
    expect(syncPaymentPlans([open], [sub('2027-06-15')], '2026-12-15')).toBe(false);
    expect(open.plannedSubscriptions[0].status).toBe('active');
    const ran = project([100, 40]);
    expect(syncPaymentPlans([ran], [sub('2026-11-15')], '2026-12-15')).toBe(true);
    expect(ran.plannedSubscriptions[0].status).toBe('completed');
  });

  it('knows what a plan still has to pay and the day before a Payday', () => {
    expect(plannedRemaining({ targetBucketIds: [] }, project([100, 40]))).toBe(60);
    expect(plannedRemaining({ targetBucketIds: ['b0'] }, project([40, 40]))).toBe(60);
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
  });
});
