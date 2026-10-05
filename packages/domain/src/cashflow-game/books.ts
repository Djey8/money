import type { CashAllocation } from './cash';
import type {
  BookAsset,
  BookGrowLoan,
  BookInvestment,
  BookLiability,
  BookShare,
  BookSubscription,
  GameEffects,
} from './effects';
import type { CashflowGameSet, CashflowGameState, CashflowTransactionRecord } from './types';

/**
 * Everything the game's rules can read of an account, in integer minor units (todo/cashflow-game-pro.md, A1(d)). A
 * rule reads the slice it needs; the deal rules - which buy, borrow and date things in one go - read all of it, and
 * `applyEffectsToBooks` lets a rule that does several things in a row (a loan, then the purchase it paid for) see the
 * result of each before deciding the next, without mutating anything.
 */

/** A Grow project, as far as the game reads and writes it. */
export interface BookGrowProject {
  title: string;
  sub: string;
  phase: string;
  status: string;
  description: string;
  strategy: string;
  notes: { text: string; createdAt: string }[];
  cashflowMinor: number;
  /** Grow's "Deposit" or amount invested. */
  amountMinor: number;
  isAsset: boolean;
  share: BookShare | null;
  investment: BookInvestment | null;
  loan: BookGrowLoan | null;
  updatedAt: string;
}

export interface GameBooks {
  state: CashflowGameState;
  /** The account's Daily / Splurge / Smile / Fire split, which "cash on hand" depends on. */
  allocation: CashAllocation;
  /** The running game's set (it holds the loan rule); undefined before a profession is picked. */
  gameSet: CashflowGameSet | undefined;
  subscriptions: BookSubscription[];
  transactions: CashflowTransactionRecord[];
  liabilities: BookLiability[];
  shares: BookShare[];
  investments: BookInvestment[];
  assets: BookAsset[];
  growProjects: BookGrowProject[];
}

function upsertBy<T>(list: T[], item: T, key: (value: T) => string): T[] {
  const index = list.findIndex((candidate) => key(candidate) === key(item));
  return index >= 0
    ? list.map((candidate, i) => (i === index ? item : candidate))
    : [...list, item];
}

function newGrowProject(title: string, createdAt: string): BookGrowProject {
  return {
    title,
    sub: '',
    phase: 'execute',
    status: '',
    description: '',
    strategy: '',
    notes: [],
    cashflowMinor: 0,
    amountMinor: 0,
    isAsset: false,
    share: null,
    investment: null,
    loan: null,
    updatedAt: createdAt,
  };
}

/**
 * The books after a rule's effects: the same arithmetic the Angular service does on its entities and the API will do
 * on the account it loaded, as a pure function. Returns new books; the input is untouched.
 */
export function applyEffectsToBooks(books: GameBooks, effects: GameEffects): GameBooks {
  const transactions = books.transactions.map((transaction, index) => {
    const moved = effects.transactionDates.find((change) => change.index === index);
    return moved ? { ...transaction, date: moved.date } : transaction;
  });

  let subscriptions = books.subscriptions;
  for (const upsert of effects.subscriptionUpserts) {
    subscriptions = upsertBy(subscriptions, upsert, (sub) => sub.title);
  }
  const removedSubscriptions = new Set(effects.subscriptionRemovals);
  subscriptions = subscriptions.filter((sub) => !removedSubscriptions.has(sub.title));

  let liabilities = books.liabilities;
  for (const upsert of effects.liabilityUpserts) {
    liabilities = upsertBy(liabilities, upsert, (liability) => liability.tag);
  }
  const removedLiabilities = new Set(effects.liabilityRemovals);
  liabilities = liabilities.filter((liability) => !removedLiabilities.has(liability.tag));

  let shares = books.shares;
  for (const upsert of effects.shareUpserts)
    shares = upsertBy(shares, upsert, (share) => share.tag);
  shares = shares.map((share) => {
    const price = effects.sharePrices.find((candidate) => candidate.tag === share.tag);
    return price ? { ...share, priceMinor: price.priceMinor } : share;
  });

  let investments = books.investments;
  for (const upsert of effects.investmentUpserts) {
    investments = upsertBy(investments, upsert, (investment) => investment.tag);
  }

  let assets = books.assets;
  for (const upsert of effects.assetUpserts)
    assets = upsertBy(assets, upsert, (asset) => asset.tag);
  const removedAssets = new Set(effects.assetRemovals);
  assets = assets.filter((asset) => !removedAssets.has(asset.tag));

  let growProjects = books.growProjects;
  for (const update of effects.growUpdates) {
    const existing = growProjects.find((project) => project.title === update.title);
    if (!existing && !update.create) continue;
    const base =
      existing ?? newGrowProject(update.title, update.createdAt ?? update.updatedAt ?? '');
    const next: BookGrowProject = {
      ...base,
      ...(update.sub !== undefined ? { sub: update.sub } : {}),
      ...(update.phase !== undefined ? { phase: update.phase } : {}),
      ...(update.status !== undefined ? { status: update.status } : {}),
      ...(update.description !== undefined ? { description: update.description } : {}),
      ...(update.strategy !== undefined ? { strategy: update.strategy } : {}),
      ...(update.isAsset !== undefined ? { isAsset: update.isAsset } : {}),
      ...(update.amountMinor !== undefined ? { amountMinor: update.amountMinor } : {}),
      ...(update.cashflowMinor !== undefined ? { cashflowMinor: update.cashflowMinor } : {}),
      ...(update.share !== undefined ? { share: update.share } : {}),
      ...(update.investment !== undefined ? { investment: update.investment } : {}),
      ...(update.loan !== undefined ? { loan: update.loan } : {}),
      ...(update.notes !== undefined ? { notes: update.notes } : {}),
      ...(update.updatedAt !== undefined ? { updatedAt: update.updatedAt } : {}),
    };
    if (update.sharePriceMinor !== undefined && next.share) {
      next.share = { ...next.share, priceMinor: update.sharePriceMinor };
    }
    growProjects = upsertBy(growProjects, next, (project) => project.title);
  }

  return {
    ...books,
    state: effects.state,
    transactions: [...transactions, ...effects.appendedTransactions],
    subscriptions,
    liabilities,
    shares,
    investments,
    assets,
    growProjects,
  };
}
