'use strict';

/**
 * Keeps Smile/Fire payment plans and their subscriptions in line — the
 * plan owns its subscription (todo/fund-settlement.md, decision 1):
 *
 * - `assertNotPlanOwned`: the generic subscription endpoints refuse to edit
 *   or delete a subscription a plan owns (manage it through the plan);
 * - `reconcilePaymentPlans`: run on every rebuild of derived state, so
 *   changes made anywhere (the app, a transaction write) are picked up:
 *   an active plan whose subscription is gone becomes `inactive`; an active
 *   plan whose target buckets are all full or settled becomes `completed`
 *   and its subscription ends today.
 *
 * Plan ↔ subscription matching: the subscription id recorded at API
 * activation, else the app's own title + category + frequency match
 * (subscription-activation.service.ts) for plans the app activated.
 */

const { isEncryptedValue, bucketCapacity } = require('@money/domain');

function read(value, session) {
  if (!isEncryptedValue(value)) return value;
  if (!session) throw new Error('Encrypted data requires a configured encryption key');
  return session.decrypt(value);
}

function write(value, session) {
  return session ? session.encrypt(String(value)) : value;
}

function readPlan(raw, session) {
  return {
    title: read(raw.title, session),
    status: read(raw.status, session),
    category: read(raw.category, session),
    frequency: read(raw.frequency, session),
    activeSubscriptionId:
      raw.activeSubscriptionId !== undefined ? read(raw.activeSubscriptionId, session) : undefined,
    targetBucketIds: (raw.targetBucketIds || []).map((id) => read(id, session)),
  };
}

function readSubscription(raw, session) {
  return {
    id: read(raw.id, session),
    title: read(raw.title, session),
    category: read(raw.category, session),
    frequency: read(raw.frequency, session),
  };
}

function ownsSubscription(plan, subscription) {
  if (plan.activeSubscriptionId) return plan.activeSubscriptionId === subscription.id;
  return (
    plan.status === 'active' &&
    plan.title === subscription.title &&
    plan.category === subscription.category &&
    plan.frequency === subscription.frequency
  );
}

function eachPlan(data, session, visit) {
  for (const kind of ['smile', 'fire']) {
    for (const rawProject of data[kind] || []) {
      for (const rawPlan of rawProject.plannedSubscriptions || []) {
        const result = visit(kind, rawProject, readPlan(rawPlan, session));
        if (result !== undefined) return result;
      }
    }
  }
  return undefined;
}

/** @throws `code: 'SUBSCRIPTION_PLAN_OWNED'` when a payment plan owns `rawSubscription` */
function assertNotPlanOwned(data, rawSubscription, session) {
  const subscription = readSubscription(rawSubscription, session);
  const owner = eachPlan(data, session, (kind, rawProject, plan) =>
    plan.status === 'active' && ownsSubscription(plan, subscription)
      ? { kind, project: read(rawProject.title, session), plan: plan.title }
      : undefined,
  );
  if (owner) {
    const error = new Error(
      `This subscription belongs to the ${owner.kind} project "${owner.project}"'s payment plan "${owner.plan}". Change it through the plan (MCP manage_${owner.kind} update_payment_plan / deactivate_payment_plan / delete_payment_plan) so the plan and its subscription stay in line.`,
    );
    error.code = 'SUBSCRIPTION_PLAN_OWNED';
    throw error;
  }
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {object} funds the rebuilt fund state (`{smile, fire}` projects with derived bucket amounts)
 * @returns {object} `data` with plans (and their subscriptions) reconciled
 */
function reconcilePaymentPlans(data, funds, session) {
  let subscriptions = data.subscriptions || [];
  const decryptedSubscriptions = subscriptions.map((raw) => readSubscription(raw, session));
  const now = new Date().toISOString();
  let changed = false;

  const reconcileProjects = (kind) =>
    (data[kind] || []).map((rawProject) => {
      if (!rawProject.plannedSubscriptions || rawProject.plannedSubscriptions.length === 0) {
        return rawProject;
      }
      const title = read(rawProject.title, session);
      const fundProject = (funds[kind] || []).find((project) => project.title === title);
      let projectChanged = false;
      const plans = rawProject.plannedSubscriptions.map((rawPlan) => {
        const plan = readPlan(rawPlan, session);
        if (plan.status !== 'active') return rawPlan;
        const subscriptionIndex = decryptedSubscriptions.findIndex((sub) =>
          ownsSubscription(plan, sub),
        );
        if (subscriptionIndex === -1) {
          projectChanged = true;
          const { activeSubscriptionId: _gone, ...rest } = rawPlan;
          return {
            ...rest,
            status: write('inactive', session),
            deactivatedAt: write(now, session),
            updatedAt: write(now, session),
          };
        }
        const buckets = fundProject ? fundProject.buckets : [];
        const targets =
          plan.targetBucketIds.length > 0
            ? buckets.filter((bucket) => plan.targetBucketIds.includes(bucket.id))
            : buckets;
        const reached =
          targets.length > 0 &&
          targets.every((bucket) => bucket.amountMinor >= bucketCapacity(bucket));
        if (!reached) return rawPlan;
        projectChanged = true;
        subscriptions = subscriptions.map((raw, i) =>
          i === subscriptionIndex ? { ...raw, endDate: write(todayDate(), session) } : raw,
        );
        return {
          ...rawPlan,
          status: write('completed', session),
          completedAt: write(now, session),
          updatedAt: write(now, session),
        };
      });
      if (!projectChanged) return rawProject;
      changed = true;
      return { ...rawProject, plannedSubscriptions: plans };
    });

  const smile = reconcileProjects('smile');
  const fire = reconcileProjects('fire');
  if (!changed) return data;
  return {
    ...data,
    ...(data.smile && { smile }),
    ...(data.fire && { fire }),
    ...(data.subscriptions && { subscriptions }),
  };
}

module.exports = { assertNotPlanOwned, reconcilePaymentPlans };
