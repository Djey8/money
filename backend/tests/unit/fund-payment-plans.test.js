'use strict';

/**
 * Payment-plan lifecycle on Smile/Fire projects (fund-project-repository.js).
 * CouchDB is mocked.
 */

const { createSmilePaymentPlan, repository } = require('../../repositories/smile-repository');

function writableDeps(data) {
  let document = { _id: 'user_1', _rev: '1-a', data: { meta: { schemaVersion: 2 }, ...data } };
  return {
    deps: {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    },
    current: () => document,
  };
}

function vacation() {
  return {
    smile: [
      {
        id: 'smile_1',
        title: 'Vacation',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [{ id: 'b_flight', title: 'Flight', target: 120000, amount: 0 }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    subscriptions: [],
  };
}

const today = new Date().toISOString().slice(0, 10);

describe('payment plan lifecycle', () => {
  it('activates, edits, deactivates, reactivates and deletes, keeping the subscription in step', async () => {
    const { deps, current } = writableDeps(vacation());
    const plan = await createSmilePaymentPlan(deps, 'user_1', 'smile_1', {
      planTitle: 'Monthly flight fund',
      startDate: '2026-10-01',
      targetDate: '2027-09-01',
      frequency: 'monthly',
      account: 'Smile',
    });
    expect(plan.status).toBe('planned');

    const activated = await repository.activatePaymentPlan(deps, 'user_1', 'smile_1', plan.id);
    expect(activated).toMatchObject({ status: 'active', activeSubscriptionId: expect.any(String) });
    const subscription = () => current().data.subscriptions[0];
    expect(subscription()).toMatchObject({
      title: 'Monthly flight fund',
      account: 'Smile',
      amount: -plan.amountMinor,
      startDate: '2026-10-01',
      category: '@Vacation',
      frequency: 'monthly',
    });

    const edited = await repository.updatePaymentPlan(deps, 'user_1', 'smile_1', plan.id, {
      manualAmountMinor: 15000,
    });
    expect(edited).toMatchObject({ amountMinor: 15000, manuallyAdjusted: true, status: 'active' });
    expect(subscription().amount).toBe(-15000);

    const backToCalculated = await repository.updatePaymentPlan(
      deps,
      'user_1',
      'smile_1',
      plan.id,
      {
        manualAmountMinor: null,
      },
    );
    expect(backToCalculated.amountMinor).toBe(plan.amountMinor);

    const deactivated = await repository.deactivatePaymentPlan(deps, 'user_1', 'smile_1', plan.id);
    expect(deactivated.status).toBe('inactive');
    expect(deactivated).not.toHaveProperty('activeSubscriptionId');
    expect(subscription().endDate).toBe(today);

    const reactivated = await repository.activatePaymentPlan(deps, 'user_1', 'smile_1', plan.id);
    expect(reactivated.status).toBe('active');
    expect(current().data.subscriptions).toHaveLength(1);
    expect(subscription().startDate).toBe(today);

    await repository.deletePaymentPlan(deps, 'user_1', 'smile_1', plan.id);
    expect(current().data.smile[0].plannedSubscriptions).toEqual([]);
    expect(subscription().endDate).toBe(today);
  });

  it('refuses invalid transitions and unknown plans', async () => {
    const { deps } = writableDeps(vacation());
    const plan = await createSmilePaymentPlan(deps, 'user_1', 'smile_1', {
      planTitle: 'Plan',
      startDate: '2026-10-01',
      targetDate: '2027-09-01',
      frequency: 'monthly',
      account: 'Smile',
    });
    await expect(
      repository.deactivatePaymentPlan(deps, 'user_1', 'smile_1', plan.id),
    ).rejects.toMatchObject({ code: 'PAYMENT_PLAN_INVALID' });
    await expect(
      repository.activatePaymentPlan(deps, 'user_1', 'smile_1', 'plan_missing'),
    ).rejects.toMatchObject({ code: 'PAYMENT_PLAN_NOT_FOUND' });
    await expect(
      repository.updatePaymentPlan(deps, 'user_1', 'smile_1', plan.id, {
        selectedBucketIds: ['nope'],
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PLAN_INVALID' });
  });
});
