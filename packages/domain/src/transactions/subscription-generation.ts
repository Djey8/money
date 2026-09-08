import { ApiTransaction } from './transaction';
import { FundState, recalculateFundState } from './fund-state';
import { calculateOccurrences, SubscriptionFrequency } from './frequency-strategies';

/**
 * Ports `SubscriptionProcessingService.setTransactionsForSubscriptions()` for
 * `POST /subscriptions/refresh` — computes which transactions are due from
 * active subscriptions and haven't already been generated.
 *
 * The original also owns Mojo-cap, Smile-bucket-cap, and bucket-allocation
 * logic inline (`returnCorrectMojo`, `returnCorrectSmileAmount`,
 * `addToSmileProject`, `distributeAmountToBuckets`) — all of it duplicated
 * with the exact same cap-logic pattern flagged elsewhere in the app
 * (`docs/discovery/DOMAIN_MODEL.md` item 6), and `returnCorrectSmileAmount`
 * has a real bug: its `return result` sits inside the `for` loop but outside
 * the `if` that matches the category, so the cap only ever fires for
 * `allSmileProjects[0]` — every other Smile project's cap check never runs.
 * `addToSmileProject` has a second bug: it appends the `#bucket:` comment tag
 * to `allTransactions[length - 1]` *before* the new transaction is
 * constructed, so the tag lands on the previous transaction, not the one
 * being generated.
 *
 * This port doesn't re-implement any of that — it delegates entirely to
 * `recalculateFundState` (`fund-state.ts`) and `applyMojoTransaction`
 * (`mojo.ts`), the same already-centralized, already-tested engine every
 * other transaction write in this API already runs through via
 * `applyDerivedState`. That eliminates both bugs structurally (there's no
 * loop to misindex, no `#bucket:` tag to mistarget) rather than fixing them
 * in a second copy. This function only decides *which* transactions are due
 * and *whether* to skip one because its target is already fully funded —
 * the actual capped/adjusted amount that ends up stored is whatever
 * `recalculateFundState` computes when the repository layer runs the full,
 * final transaction list through it, exactly like every other transaction
 * write already does.
 *
 * One structural adaptation: the original passes an empty `time` (`''`) for
 * every generated transaction — this API's `Transaction` type requires a
 * non-empty one (`transaction.ts`'s `normalizeTransaction`), so generated
 * transactions use `'00:00'` instead. A subscription occurrence has no
 * natural time-of-day regardless, so this changes no real behavior.
 */

export interface SubscriptionForGeneration {
  title: string;
  account: string;
  amountMinor: number;
  startDate: string;
  /** `null` (or `''`) means no end date — active indefinitely. */
  endDate: string | null;
  category: string;
  comment: string;
  frequency: SubscriptionFrequency;
}

export interface GeneratedTransaction {
  account: string;
  amountMinor: number;
  date: string;
  time: string;
  category: string;
  comment: string;
}

export interface SubscriptionGenerationResult {
  transactions: GeneratedTransaction[];
  transactionsCreated: number;
  subscriptionsProcessed: number;
}

interface DedupKey {
  date: string;
  account: string;
  amountMinor: number;
  category: string;
  comment: string;
}

function buildComment(title: string, comment: string): string {
  return comment ? `${title} + ${comment}` : title;
}

function transactionExists(transactions: DedupKey[], candidate: DedupKey): boolean {
  return transactions.some(
    (t) =>
      t.date === candidate.date &&
      t.account === candidate.account &&
      t.amountMinor === candidate.amountMinor &&
      t.category === candidate.category &&
      t.comment === candidate.comment,
  );
}

/** `true` when generating a transaction for `category` would have no effect because its target (Mojo, or a matching Smile project's buckets) is already fully funded — matches the original's own pre-generation skip check, which only ever looks at whether the target is *already* at/over capacity, not whether this specific contribution would be. */
function isTargetAlreadyFull(category: string, fundState: FundState): boolean {
  if (category === '@Mojo') {
    return fundState.mojo.amountMinor >= fundState.mojo.targetMinor;
  }
  const project = fundState.smile.find((p) => `@${p.title}` === category);
  if (!project) return false;
  const totalTargetMinor = project.buckets.reduce((sum, b) => sum + b.targetMinor, 0);
  const totalAmountMinor = project.buckets.reduce((sum, b) => sum + b.amountMinor, 0);
  return totalAmountMinor >= totalTargetMinor;
}

export function generateDueSubscriptionTransactions(
  subscriptions: SubscriptionForGeneration[],
  existingTransactions: ApiTransaction[],
  fundState: FundState,
  now: Date = new Date(),
): SubscriptionGenerationResult {
  const simulatedTransactions: ApiTransaction[] = [...existingTransactions];
  let runningFundState = recalculateFundState(simulatedTransactions, fundState);
  const generated: GeneratedTransaction[] = [];
  let subscriptionsProcessed = 0;

  for (const subscription of subscriptions) {
    const startDate = new Date(subscription.startDate);
    if (startDate >= now) continue;
    subscriptionsProcessed += 1;

    const hasEndDate = Boolean(subscription.endDate);
    const endDate = hasEndDate ? new Date(subscription.endDate as string) : null;
    const boundary = endDate && endDate < now ? endDate : now;
    const frequency = subscription.frequency || 'monthly';
    const dates = calculateOccurrences(frequency, subscription.startDate, boundary);

    for (const date of dates) {
      const candidate: DedupKey = {
        date,
        account: subscription.account,
        amountMinor: subscription.amountMinor,
        category: subscription.category,
        comment: buildComment(subscription.title, subscription.comment),
      };
      if (transactionExists(simulatedTransactions, candidate)) continue;
      if (isTargetAlreadyFull(subscription.category, runningFundState)) continue;

      const newTransaction: GeneratedTransaction = {
        account: candidate.account,
        amountMinor: candidate.amountMinor,
        date: candidate.date,
        time: '00:00',
        category: candidate.category,
        comment: candidate.comment,
      };
      generated.push(newTransaction);
      simulatedTransactions.push({ ...newTransaction, id: '', currency: '' });
      runningFundState = recalculateFundState(simulatedTransactions, fundState);
    }
  }

  return {
    transactions: generated,
    transactionsCreated: generated.length,
    subscriptionsProcessed,
  };
}
