import {
  calculateBuyAsset,
  calculateSellAsset,
  calculateSellInvestment,
  calculateSellShare,
  multiplyQuantityPrice,
  normalizeQuantity,
} from '../grow/actions';
import { applyEffectsToBooks, type GameBooks } from './books';
import { cashOnHandMinor, loanForShortfallMinor } from './cash';
import { afterAssetBuy, afterAssetSell, beforeAssetBuy, sellCoins } from './asset-deals';
import { setPhaseAfterTrade, type DealDeps } from './deals';
import { emptyEffects, type BookGrowUpdate, type GameEffects } from './effects';
import { playBankLoan } from './loan';
import { marketSaleFor } from './market-cards';
import { placeOneOffTransactions } from './rounds';
import { gameTradeStep } from './trades';

/**
 * Special-asset purchases and every sale, as pure rules (todo/cashflow-game-pro.md, slice D3c): what the Add dialog does
 * with a Grow "Buy Asset" / "Sell Share" / "Sell Investment" / "Sell Asset" on a Cashflow account, without the comment
 * having to be written by hand - the comment each trade carries is the one the Grow calculators generate. Same shape as
 * every rule: books in, `GameEffects` out, nothing mutated. A purchase takes the Bank loan first when cash is short
 * (its own step); a sale that has to be paid for (a property sold for less than its mortgage) does the same.
 */

export interface TradeResult {
  /** One entry per undo step, in order: an automatic loan when cash was short, then the trade itself. */
  steps: GameEffects[];
  /** What was bought or sold. */
  kind: 'asset' | 'share' | 'investment';
  /** What the sale put into the account (negative when the sale cost money), in minor units. */
  cashMinor?: number;
}

/** Folds the hooks' follow-up changes into the trade's own effects: the later field wins, notes and states carry over. */
function mergeInto(base: GameEffects, extra: GameEffects): GameEffects {
  const growUpdates = [...base.growUpdates];
  for (const update of extra.growUpdates) {
    const index = growUpdates.findIndex((candidate) => candidate.title === update.title);
    if (index >= 0) growUpdates[index] = { ...growUpdates[index], ...update };
    else growUpdates.push(update);
  }
  return {
    ...base,
    state: extra.state,
    growUpdates,
    decisionNeeded: base.decisionNeeded || extra.decisionNeeded,
    persist: {
      subscriptions: base.persist.subscriptions || extra.persist.subscriptions,
      grow: base.persist.grow || extra.persist.grow,
      balanceSheet: base.persist.balanceSheet || extra.persist.balanceSheet,
    },
  };
}

/** The Bank loan first when `costMinor` is more than the cash on hand - its own step, rounded up to the loan step. */
function loanFirst(
  books: GameBooks,
  costMinor: number,
  deps: DealDeps,
): { steps: GameEffects[]; working: GameBooks } {
  const cash = cashOnHandMinor(books.transactions, books.allocation);
  if (!(costMinor - cash > 0)) return { steps: [], working: books };
  if (!books.gameSet) throw new Error('Pick a profession first.');
  const loan = playBankLoan(
    books,
    loanForShortfallMinor(costMinor, cash, books.gameSet.loanRule.incrementMinor),
    deps,
  );
  loan.step = { kind: 'loanAuto' };
  return { steps: [loan], working: applyEffectsToBooks(books, loan) };
}

// ── Buying a special asset ────────────────────────────────────────────────────────────────────────

/**
 * Buys a **planned** special-asset card (gold coins, the loan to a relative, Multi-Level-Marketing) like the Add dialog's
 * Buy Asset does. A dice card is paid for but does not become an asset until its roll decides it (`resolveGamble`); a plain
 * offer and a kept MLM card are owned at once. Throws for a title that is not a planned asset deal.
 */
export function buyAssetDeal(books: GameBooks, title: string, deps: DealDeps): TradeResult {
  if (!books.state.professionId) throw new Error('Pick a profession first.');
  const project = books.growProjects.find((candidate) => candidate.title === title);
  const deal = (books.state.assetDeals ?? []).find((candidate) => candidate.title === title);
  if (!project || !project.isAsset || !deal) {
    throw new Error(`No planned asset deal called "${title}" - plan the card first.`);
  }
  if (deal.stage !== 'planned' && deal.stage !== 'awaitingRoll') {
    throw new Error(`"${title}" is already ${deal.stage}.`);
  }
  const costMinor = project.amountMinor;
  const { steps, working } = loanFirst(books, costMinor, deps);

  const hook = beforeAssetBuy(working.state, title);
  const state = hook.effects?.state ?? working.state;
  const existing = working.assets.find((asset) => asset.tag === title);
  const result = calculateBuyAsset({
    title,
    totalAmountMinor: costMinor,
    existingAssetAmountMinor: existing?.amountMinor ?? null,
    existingGrowAmountMinor: project.amountMinor,
  });

  const buy = emptyEffects(state, { kind: 'buyDeal', detail: title });
  buy.persist = { subscriptions: false, grow: true, balanceSheet: true };
  buy.appendedTransactions = placeOneOffTransactions(
    [
      {
        account: 'Fire',
        amountMinor: result.transactionAmountMinor,
        date: '',
        time: '',
        category: `@${title}`,
        comment: result.comment,
      },
    ],
    working,
    deps.clock.todayIso(),
  );
  // A dice card is paid for here but only becomes an asset once the roll is decided.
  if (!hook.gamble) buy.assetUpserts = [{ tag: title, amountMinor: result.newAssetAmountMinor }];
  const update: BookGrowUpdate = {
    title,
    status: 'bought',
    amountMinor: existing ? project.amountMinor + costMinor : costMinor,
    updatedAt: deps.clock.nowIso(),
  };
  buy.growUpdates = [update];

  const after = afterAssetBuy(applyEffectsToBooks({ ...working, state }, buy), title);
  steps.push(mergeInto(buy, after));
  return { steps, kind: 'asset' };
}

// ── Selling a position ────────────────────────────────────────────────────────────────────────────

export interface SellInput {
  /** The Grow project's title - also the tag of the position. */
  title: string;
  /** Shares or coins to sell; the whole position when absent. */
  quantity?: number;
  /** A share's or a coin's price in minor units; the position's own price (or the buyer's offer) when absent. */
  priceMinor?: number;
  /** A property's sale price in minor units, when no buyer's offer (a Market card) is waiting. */
  salePriceMinor?: number;
}

function incomeRecord(title: string, amountMinor: number, comment: string) {
  return {
    // a sale that does not cover its mortgage is paid out of your own pocket, not booked as income
    account: amountMinor >= 0 ? 'Income' : 'Daily',
    amountMinor,
    date: '',
    time: '',
    category: `@${title}`,
    comment,
  };
}

/**
 * Sells a position - a share, a property or business, or a special asset - the way the Sell button does (JFK,
 * 2026-10-03/06): a property sells to the buyer a Market card brought (its offer decides the price; the mortgage is paid
 * back out of it and what is left, deposit plus profit, is booked as income), shares at their price, gold coin by coin
 * at the buyer's price per coin. The Grow project follows (sold, completed once nothing is left), a property's monthly
 * cashflow subscription ends with it and the buyer's offer goes. Throws when there is nothing to sell or no price.
 */
export function sellPosition(books: GameBooks, input: SellInput, deps: DealDeps): TradeResult {
  const { title } = input;
  const project = books.growProjects.find((candidate) => candidate.title === title);
  if (!project) throw new Error(`No Grow project called "${title}".`);
  if (project.isAsset) return sellAsset(books, project.title, input, deps);
  if (project.investment?.tag) return sellInvestment(books, input, deps);
  if (project.share?.tag) return sellShare(books, input, deps);
  throw new Error(`"${title}" is not a share, a property or an asset.`);
}

function finishSale(
  books: GameBooks,
  sale: GameEffects,
  title: string,
  steps: GameEffects[],
): GameEffects[] {
  const after = setPhaseAfterTrade(applyEffectsToBooks(books, sale), title, 'sell');
  steps.push(after ? mergeInto(sale, after) : sale);
  return steps;
}

function sellShare(books: GameBooks, input: SellInput, deps: DealDeps): TradeResult {
  const { title } = input;
  const held = books.shares.find((share) => share.tag === title);
  if (!held || !(held.quantity > 0)) throw new Error(`You hold no ${title} shares.`);
  const quantity = input.quantity ?? held.quantity;
  if (!(quantity > 0) || quantity > held.quantity) {
    throw new Error(`You hold ${held.quantity} ${title} shares; ${quantity} cannot be sold.`);
  }
  const priceMinor = input.priceMinor ?? held.priceMinor;
  const result = calculateSellShare(title, quantity, priceMinor, held.quantity);
  const sale = emptyEffects(books.state, gameTradeStep(result.comment, `@${title}`));
  sale.persist = { subscriptions: false, grow: true, balanceSheet: true };
  sale.appendedTransactions = placeOneOffTransactions(
    [incomeRecord(title, result.transactionAmountMinor, result.comment)],
    books,
    deps.clock.todayIso(),
  );
  const left = result.newShareQuantity;
  const project = books.growProjects.find((candidate) => candidate.title === title);
  if (left <= 0) sale.shareRemovals = [title];
  else sale.shareUpserts = [{ tag: title, quantity: left, priceMinor }];
  sale.growUpdates = [
    {
      title,
      status: 'sold',
      share: project?.share
        ? {
            ...project.share,
            quantity: normalizeQuantity(project.share.quantity - quantity),
            priceMinor,
          }
        : undefined,
      updatedAt: deps.clock.nowIso(),
    },
  ];
  return {
    steps: finishSale(books, sale, title, []),
    kind: 'share',
    cashMinor: result.transactionAmountMinor,
  };
}

function sellInvestment(books: GameBooks, input: SellInput, deps: DealDeps): TradeResult {
  const { title } = input;
  const position = books.investments.find((investment) => investment.tag === title);
  if (!position) throw new Error(`You own no ${title}.`);
  const project = books.growProjects.find((candidate) => candidate.title === title)!;
  const offer = marketSaleFor(books.state, books.investments, title);
  const salePriceMinor = input.salePriceMinor ?? offer?.salePriceMinor;
  if (salePriceMinor === undefined) {
    throw new Error(
      `No buyer for ${title}: play a Market card with an offer for it first, or give salePriceMinor.`,
    );
  }
  const netCashMinor = salePriceMinor - position.amountMinor;
  const mortgage = books.liabilities.find((liability) => liability.tag === `M-${title}`);
  const payback = project.loan
    ? { amountMinor: project.loan.amountMinor, creditMinor: project.loan.creditMinor }
    : undefined;
  const result = calculateSellInvestment({
    title,
    depositMinor: position.depositMinor,
    mortgageMinor: position.amountMinor,
    existingInvestmentDepositMinor: position.depositMinor,
    existingInvestmentAmountMinor: position.amountMinor,
    existingMortgageLiabilityAmountMinor: mortgage?.amountMinor ?? 0,
    existingGrowAmountMinor: project.amountMinor,
    payback,
  });

  // A sale that costs money (the mortgage is more than the price) is paid first, with the Bank loan if cash is short.
  const { steps, working } = loanFirst(books, netCashMinor < 0 ? -netCashMinor : 0, deps);
  const sale = emptyEffects(working.state, gameTradeStep(result.comment, `@${title}`));
  sale.persist = { subscriptions: true, grow: true, balanceSheet: true };
  sale.appendedTransactions = placeOneOffTransactions(
    [incomeRecord(title, netCashMinor, result.comment)],
    working,
    deps.clock.todayIso(),
  );
  sale.investmentRemovals = [title];
  if (mortgage) {
    if (result.newMortgageLiabilityAmountMinor > 0) {
      sale.liabilityUpserts = [
        {
          tag: mortgage.tag,
          amountMinor: result.newMortgageLiabilityAmountMinor,
          investment: true,
        },
      ];
    } else {
      sale.liabilityRemovals = [mortgage.tag];
    }
  }
  // the property's monthly cashflow stops with the property
  if (working.subscriptions.some((sub) => sub.title === `${title} Cashflow`)) {
    sale.subscriptionRemovals = [`${title} Cashflow`];
  }
  sale.growUpdates = [
    {
      title,
      status: 'sold',
      amountMinor: result.newGrowAmountMinor,
      investment: { tag: title, depositMinor: 0, amountMinor: 0 },
      ...(payback ? { loan: null } : {}),
      updatedAt: deps.clock.nowIso(),
    },
  ];
  return {
    steps: finishSale(working, sale, title, steps),
    kind: 'investment',
    cashMinor: netCashMinor,
  };
}

function sellAsset(books: GameBooks, title: string, input: SellInput, deps: DealDeps): TradeResult {
  const asset = books.assets.find((candidate) => candidate.tag === title);
  if (!asset) throw new Error(`You own no ${title}.`);
  const offer = marketSaleFor(books.state, books.investments, title);
  const deal = (books.state.assetDeals ?? []).find(
    (candidate) => candidate.title === title && candidate.stage === 'owned',
  );
  const coins = deal?.coins ?? 0;
  let quantity = 1;
  let priceMinor: number;
  let totalMinor: number;
  if (coins > 0) {
    quantity = input.quantity ?? coins;
    if (!(quantity > 0) || quantity > coins) {
      throw new Error(`You own ${coins} coins of ${title}; ${quantity} cannot be sold.`);
    }
    // coins sell at the buyer's price per coin, else at what each cost
    priceMinor =
      input.priceMinor ?? offer?.pricePerCoinMinor ?? Math.round(asset.amountMinor / coins);
    totalMinor = multiplyQuantityPrice(quantity, priceMinor);
  } else {
    priceMinor = input.priceMinor ?? asset.amountMinor;
    totalMinor = priceMinor;
  }
  const result = calculateSellAsset(title, totalMinor, asset.amountMinor, {
    quantity,
    priceMinor,
  });
  const sale = emptyEffects(books.state, gameTradeStep(result.comment, `@${title}`));
  sale.persist = { subscriptions: false, grow: true, balanceSheet: true };
  sale.appendedTransactions = placeOneOffTransactions(
    [incomeRecord(title, result.transactionAmountMinor, result.comment)],
    books,
    deps.clock.todayIso(),
  );
  const coinsSale = coins > 0 ? sellCoins(books, title, quantity, priceMinor, deps) : null;
  if (coinsSale?.sold && coinsSale.effects) {
    sale.state = coinsSale.effects.state;
    sale.assetUpserts = coinsSale.effects.assetUpserts;
    sale.assetRemovals = coinsSale.effects.assetRemovals;
    sale.growUpdates = coinsSale.effects.growUpdates;
  } else if (result.newAssetAmountMinor > 0) {
    sale.assetUpserts = [{ tag: title, amountMinor: result.newAssetAmountMinor }];
  } else {
    sale.assetRemovals = [title];
  }
  const update = sale.growUpdates.find((candidate) => candidate.title === title);
  if (update) update.status = 'sold';
  else sale.growUpdates = [{ title, status: 'sold', updatedAt: deps.clock.nowIso() }];

  const after = afterAssetSell(applyEffectsToBooks(books, sale), title);
  return {
    steps: [mergeInto(sale, after)],
    kind: 'asset',
    cashMinor: result.transactionAmountMinor,
  };
}
