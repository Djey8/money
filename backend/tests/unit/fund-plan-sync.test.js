'use strict';

/**
 * Payment plans stay in line with their subscriptions and goals
 * (services/payment-plan-links.js, fund-project-repository.js). CouchDB is
 * mocked.
 */

const {
  createSmilePaymentPlan,
  updateSmileProject,
  repository,
} = require('../../repositories/smile-repository');
const { contributeToProject } = require('../../repositories/fund-contribution-repository');
const {
  updateSubscription,
  deleteSubscription,
} = require('../../repositories/subscription-repository');

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

function trip() {
  return {
    smile: [
      {
        id: 'smile_1',
        title: 'Trip',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [{ id: 'b_flight', title: 'Flight', target: 60000, amount: 0 }],
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
const nextYear = `${new Date().getFullYear() + 1}-12-01`;

async function activePlan(deps) {
  const plan = await createSmilePaymentPlan(deps, 'user_1', 'smile_1', {
    planTitle: 'Monthly',
    startDate: today,
    targetDate: nextYear,
    frequency: 'monthly',
    account: 'Smile',
  });
  return repository.activatePaymentPlan(deps, 'user_1', 'smile_1', plan.id);
}

describe('plan reconciliation', () => {
  it('completes a plan once its buckets are full, ending its subscription', async () => {
    const { deps, current } = writableDeps(trip());
    const plan = await activePlan(deps);

    await contributeToProject(deps, 'user_1', 'smile', 'smile_1', { amountMinor: 60000 });

    const stored = await repository.getProject(deps, 'user_1', 'smile_1');
    expect(stored.plannedSubscriptions[0]).toMatchObject({ id: plan.id, status: 'completed' });
    expect(current().data.subscriptions[0].endDate).toBe(today);
  });

  it('marks a plan inactive when its subscription disappears (e.g. deleted in the app)', async () => {
    const { deps, current } = writableDeps(trip());
    await activePlan(deps);
    // Simulate the app deleting the subscription behind the API's back.
    const document = current();
    document.data.subscriptions = [];

    await updateSmileProject(deps, 'user_1', 'smile_1', { sub: 'touch' });

    const stored = await repository.getProject(deps, 'user_1', 'smile_1');
    expect(stored.plannedSubscriptions[0].status).toBe('inactive');
  });
});

describe('a plan owns its subscription', () => {
  it('refuses editing or deleting it through the subscription endpoints', async () => {
    const { deps, current } = writableDeps(trip());
    await activePlan(deps);
    const subscriptionId = current().data.subscriptions[0].id;

    await expect(
      updateSubscription(deps, 'user_1', subscriptionId, { amountMinor: -1 }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_PLAN_OWNED' });
    await expect(deleteSubscription(deps, 'user_1', subscriptionId)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_PLAN_OWNED',
    });
  });
});

describe('bucket target changes', () => {
  it('recalculate a plan following its calculated amount, and its subscription follows', async () => {
    const { deps, current } = writableDeps(trip());
    const plan = await activePlan(deps);

    const updated = await updateSmileProject(deps, 'user_1', 'smile_1', {
      bucketsUpdate: [{ id: 'b_flight', targetMinor: 120000 }],
    });

    const recalculated = updated.plannedSubscriptions[0];
    expect(recalculated.amountMinor).toBeGreaterThan(plan.amountMinor);
    expect(current().data.subscriptions[0].amount).toBe(-recalculated.amountMinor);
  });

  it('leave a manually adjusted plan alone', async () => {
    const { deps } = writableDeps(trip());
    const plan = await activePlan(deps);
    await repository.updatePaymentPlan(deps, 'user_1', 'smile_1', plan.id, {
      manualAmountMinor: 7777,
    });

    const updated = await updateSmileProject(deps, 'user_1', 'smile_1', {
      bucketsUpdate: [{ id: 'b_flight', targetMinor: 120000 }],
    });
    expect(updated.plannedSubscriptions[0].amountMinor).toBe(7777);
  });
});
