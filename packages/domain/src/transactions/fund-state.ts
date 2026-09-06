import { applyBucketAllocations, FundBucket, parseBucketAllocations } from './bucket-allocations';
import { applyMojoTransaction, MojoBalance } from './mojo';
import { ApiTransaction } from './transaction';

export interface FundProject {
  title: string;
  phase?: string;
  completionDate?: string;
  buckets: FundBucket[];
}

export interface FundState {
  mojo: MojoBalance;
  smile: FundProject[];
  fire: FundProject[];
}

function emptyProjects(projects: FundProject[]): FundProject[] {
  return projects.map((project) => ({
    ...project,
    buckets: project.buckets.map((bucket) => ({ ...bucket, amountMinor: 0 })),
  }));
}

function distributeEvenly(buckets: FundBucket[], amountMinor: number): FundBucket[] {
  if (buckets.length === 0) return buckets;
  let remaining = Math.abs(amountMinor);
  return buckets.map((bucket, index) => {
    const bucketsLeft = buckets.length - index;
    const requested = Math.floor(remaining / bucketsLeft);
    const applied = Math.min(requested, Math.max(0, bucket.targetMinor - bucket.amountMinor));
    remaining -= requested;
    return { ...bucket, amountMinor: bucket.amountMinor + applied };
  });
}

function applySmileTransaction(project: FundProject, transaction: ApiTransaction): FundProject {
  const allocations = parseBucketAllocations(transaction.comment);
  return {
    ...project,
    buckets:
      allocations.length > 0
        ? applyBucketAllocations(project.buckets, allocations)
        : distributeEvenly(project.buckets, transaction.amountMinor),
  };
}

function matchesFireProject(project: FundProject, category: string): boolean {
  return (
    category === `@${project.title}` ||
    project.buckets.some((bucket) => category === `@${bucket.title}`)
  );
}

function applyFireTransaction(project: FundProject, transaction: ApiTransaction): FundProject {
  const allocations = parseBucketAllocations(transaction.comment);
  const buckets =
    allocations.length > 0
      ? applyBucketAllocations(project.buckets, allocations)
      : project.buckets.map((bucket, index) => {
          const isTarget =
            transaction.category === `@${bucket.title}` ||
            (transaction.category === `@${project.title}` && index === 0);
          if (!isTarget) return { ...bucket };
          const contribution = Math.min(
            Math.abs(transaction.amountMinor),
            bucket.targetMinor - bucket.amountMinor,
          );
          return { ...bucket, amountMinor: bucket.amountMinor + Math.max(0, contribution) };
        });
  const completed =
    buckets.length > 0 && buckets.every((bucket) => bucket.amountMinor >= bucket.targetMinor);
  return {
    ...project,
    buckets,
    phase: completed ? 'completed' : project.phase,
    completionDate:
      completed && !project.completionDate ? transaction.date : project.completionDate,
  };
}

/** Rebuilds transaction-driven fund balances from scratch without mutating stored project inputs. */
export function recalculateFundState(transactions: ApiTransaction[], state: FundState): FundState {
  let mojo: MojoBalance = { ...state.mojo, amountMinor: 0 };
  let smile = emptyProjects(state.smile);
  let fire = emptyProjects(state.fire);
  for (const transaction of transactions) {
    if (transaction.amountMinor === 0) continue;
    mojo = applyMojoTransaction(mojo, transaction);
    smile = smile.map((project) =>
      transaction.category === `@${project.title}`
        ? applySmileTransaction(project, transaction)
        : project,
    );
    fire = fire.map((project) =>
      matchesFireProject(project, transaction.category)
        ? applyFireTransaction(project, transaction)
        : project,
    );
  }
  return { mojo, smile, fire };
}
