import { applyBucketAllocations, FundBucket, parseBucketAllocations } from './bucket-allocations';
import { fromMinorUnits } from '../money/minor-units';
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

export interface RecalculatedFundState extends FundState {
  transactions: ApiTransaction[];
}

function emptyProjects(projects: FundProject[]): FundProject[] {
  return projects.map((project) => ({
    ...project,
    buckets: project.buckets.map((bucket) => ({ ...bucket, amountMinor: 0 })),
  }));
}

/**
 * Splits an amount evenly across buckets, capped at each bucket's own
 * remaining target. Capacity a full bucket can't absorb is re-offered to the
 * buckets that still have room (in further passes) rather than dropped, so
 * the total applied only falls short of the requested amount when every
 * bucket combined lacks the capacity for it.
 */
export function distributeEvenly(buckets: FundBucket[], amountMinor: number): FundBucket[] {
  if (buckets.length === 0) return buckets;
  const applied = buckets.map(() => 0);
  const room = buckets.map((bucket) => Math.max(0, bucket.targetMinor - bucket.amountMinor));
  let remaining = Math.abs(amountMinor);
  let open = room.map((_, index) => index).filter((index) => room[index] > 0);
  while (remaining > 0 && open.length > 0) {
    const share = Math.floor(remaining / open.length);
    if (share === 0) {
      for (const index of open) {
        if (remaining === 0) break;
        applied[index] += 1;
        room[index] -= 1;
        remaining -= 1;
      }
    } else {
      for (const index of open) {
        const take = Math.min(share, room[index]);
        applied[index] += take;
        room[index] -= take;
        remaining -= take;
      }
    }
    open = open.filter((index) => room[index] > 0);
  }
  return buckets.map((bucket, index) => ({
    ...bucket,
    amountMinor: bucket.amountMinor + applied[index],
  }));
}

function applySmileTransaction(
  project: FundProject,
  transaction: ApiTransaction,
): { project: FundProject; transaction: ApiTransaction } {
  const allocations = parseBucketAllocations(transaction.comment);
  const buckets =
    allocations.length > 0
      ? applyBucketAllocations(project.buckets, allocations)
      : distributeEvenly(project.buckets, transaction.amountMinor);
  const appliedAmountMinor = buckets.reduce(
    (sum, bucket, index) => sum + bucket.amountMinor - project.buckets[index].amountMinor,
    0,
  );
  if (appliedAmountMinor === Math.abs(transaction.amountMinor)) {
    return { project: { ...project, buckets }, transaction };
  }
  if (allocations.length === 0) {
    return {
      project: { ...project, buckets },
      transaction: {
        ...transaction,
        amountMinor: transaction.amountMinor < 0 ? -appliedAmountMinor : appliedAmountMinor,
      },
    };
  }
  const appliedTags = buckets
    .map((bucket, index) => ({
      bucket,
      applied: bucket.amountMinor - project.buckets[index].amountMinor,
    }))
    .filter(({ applied }) => applied > 0)
    .map(({ bucket, applied }) => `#bucket:${bucket.title}:${fromMinorUnits(applied).toFixed(2)}`)
    .join(' ');
  const cleanComment = transaction.comment.replace(/#bucket:([^:]+):([\d.]+)/g, '').trim();
  return {
    project: { ...project, buckets },
    transaction: {
      ...transaction,
      amountMinor: transaction.amountMinor < 0 ? -appliedAmountMinor : appliedAmountMinor,
      comment: [cleanComment, appliedTags].filter(Boolean).join('\n'),
    },
  };
}

function matchesFireProject(project: FundProject, category: string): boolean {
  return (
    category === `@${project.title}` ||
    project.buckets.some((bucket) => category === `@${bucket.title}`)
  );
}

function applyFireTransaction(
  project: FundProject,
  transaction: ApiTransaction,
): { project: FundProject; transaction: ApiTransaction } {
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
  const appliedAmountMinor = buckets.reduce(
    (sum, bucket, index) => sum + bucket.amountMinor - project.buckets[index].amountMinor,
    0,
  );
  const transactionAdjusted = appliedAmountMinor !== Math.abs(transaction.amountMinor);
  const appliedTags =
    allocations.length > 0
      ? buckets
          .map((bucket, index) => ({
            bucket,
            applied: bucket.amountMinor - project.buckets[index].amountMinor,
          }))
          .filter(({ applied }) => applied > 0)
          .map(
            ({ bucket, applied }) =>
              `#bucket:${bucket.title}:${fromMinorUnits(applied).toFixed(2)}`,
          )
          .join(' ')
      : '';
  const cleanComment = transaction.comment.replace(/#bucket:([^:]+):([\d.]+)/g, '').trim();
  return {
    project: {
      ...project,
      buckets,
      phase: completed ? 'completed' : project.phase,
      completionDate:
        completed && !project.completionDate ? transaction.date : project.completionDate,
    },
    transaction: transactionAdjusted
      ? {
          ...transaction,
          amountMinor: transaction.amountMinor < 0 ? -appliedAmountMinor : appliedAmountMinor,
          comment:
            allocations.length > 0
              ? [cleanComment, appliedTags].filter(Boolean).join('\n')
              : transaction.comment,
        }
      : transaction,
  };
}

/** Rebuilds transaction-driven fund balances from scratch without mutating stored project inputs. */
export function recalculateFundState(
  transactions: ApiTransaction[],
  state: FundState,
): RecalculatedFundState {
  let mojo: MojoBalance = { ...state.mojo, amountMinor: 0 };
  let smile = emptyProjects(state.smile);
  let fire = emptyProjects(state.fire);
  const effectiveTransactions: ApiTransaction[] = [];
  for (const originalTransaction of transactions) {
    let transaction = originalTransaction;
    if (transaction.amountMinor === 0) continue;
    mojo = applyMojoTransaction(mojo, transaction);
    smile = smile.map((project) => {
      if (transaction.category !== `@${project.title}` || project.buckets.length === 0) {
        return project;
      }
      const applied = applySmileTransaction(project, transaction);
      transaction = applied.transaction;
      return applied.project;
    });
    fire = fire.map((project) => {
      if (!matchesFireProject(project, transaction.category) || project.buckets.length === 0) {
        return project;
      }
      const applied = applyFireTransaction(project, transaction);
      transaction = applied.transaction;
      return applied.project;
    });
    effectiveTransactions.push(transaction);
  }
  return { mojo, smile, fire, transactions: effectiveTransactions };
}
