import { Fire } from '../interfaces/fire';
import { Smile } from '../interfaces/smile';
import { Subscription } from '../interfaces/subscription';

/** The buckets a plan pays into: the ones it names, or all of them. */
export function plannedBuckets(plan: { targetBucketIds: string[] }, project: Smile | Fire) {
  const ids = plan.targetBucketIds ?? [];
  return ids.length === 0 ? project.buckets : project.buckets.filter((b) => ids.includes(b.id));
}

/** What the buckets of a plan still miss. */
export function plannedRemaining(plan: { targetBucketIds: string[] }, project: Smile | Fire) {
  const missing = plannedBuckets(plan, project).reduce(
    (sum, bucket) => sum + Math.max(0, Number(bucket.target) - Number(bucket.amount)),
    0,
  );
  return Math.round(missing * 100) / 100;
}

/** The day before a game day, as an ISO date. */
export function dayBefore(day: string): string {
  return new Date(Date.parse(day) - 86_400_000).toISOString().split('T')[0];
}

/**
 * A game's payment plans finish by themselves (JFK, 2026-10-26): once what a plan pays into is full - or its subscription has run to its
 * end - the plan is completed and its subscription ends before the next Payday, so it shows as an ended subscription. `day` is the game's
 * date (the next Payday). Returns whether anything changed.
 */
export function syncPaymentPlans(
  projects: (Smile | Fire)[],
  subscriptions: Subscription[],
  day: string,
): boolean {
  let changed = false;
  for (const project of projects) {
    for (const plan of project.plannedSubscriptions ?? []) {
      if (plan.status !== 'active') continue;
      const sub = subscriptions.find(
        (candidate) => candidate.title === plan.title && candidate.category === plan.category,
      );
      const buckets = plannedBuckets(plan, project);
      const full =
        buckets.length > 0 && buckets.every((b) => Number(b.amount) + 0.005 >= Number(b.target));
      const ran = !!sub?.endDate && sub.endDate < day;
      if (!full && !ran) continue;
      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
      plan.updatedAt = plan.completedAt;
      if (sub && (!sub.endDate || sub.endDate >= day)) sub.endDate = dayBefore(day);
      changed = true;
    }
  }
  return changed;
}
