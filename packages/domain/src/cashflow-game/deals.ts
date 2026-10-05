import { calculateBuyInvestment, calculateBuyShare, multiplyQuantityPrice } from '../grow/actions';
import { fromMinorUnits } from '../money/minor-units';
import { applyEffectsToBooks, type BookGrowProject, type GameBooks } from './books';
import { cashOnHandMinor, loanForShortfallMinor } from './cash';
import { emptyEffects, type BookGrowUpdate, type GameEffects } from './effects';
import { textOrFallback, type GameText } from './game-text';
import { playBankLoan } from './loan';
import type { CardDeps } from './market-cards';
import { placeOneOffTransactions, upsertBookSubscription } from './rounds';
import type {
  CashflowAssetDeal,
  CashflowDealCard,
  CashflowGameState,
  CashflowProfession,
} from './types';

/**
 * The deal lifecycle as pure rules (todo/cashflow-game-pro.md slice A1(d), part 2): a Deal card becomes a planned Grow
 * project, the plan keeps a note of the bank loan it would need, executing it is a Grow buy (with the automatic loan
 * first when cash is short), and the hooks around a trade - a property's cashflow becoming a subscription, the
 * project's phase, the expense that goes when its liability is paid off, selling a card to a friend.
 *
 * Same shape as every rule: books in (minor units), a clock and the game's text in, `GameEffects` out. Nothing is
 * mutated. Deals use the app's existing Grow buy calculators and never write the Grow comment by hand; the one comment
 * a purchase carries is the canonical one those calculators generate.
 */

/** Marks the one Grow note a planned card keeps current (the bank loan needed for the buy). */
export const LOAN_NOTE_MARK = '🏦 ';

/** The card rules' dependencies, plus the plain money format the "🏦" notes use (the browser's own locale). */
export interface DealDeps extends CardDeps {
  plainMoney: (amountMinor: number) => string;
}

/** A Deal card resolved through Grow (todo/cashflow-game.md decision 10): the two shapes Grow's buy actions need, and a special asset. */
export interface DealShareInput {
  kind: 'share';
  title: string;
  /** 0 when the card leaves the count to the player - set it in the planned-deal list before buying. */
  quantity: number;
  priceMinor: number;
  /** The company / property name shown as the Grow project's subtitle (the title itself stays the ticker: Grow links a project to its position by exact title). */
  subtitle?: string;
  description?: string;
  note?: string;
  strategy?: string;
}

export interface DealInvestmentInput {
  kind: 'investment';
  title: string;
  depositMinor: number;
  mortgageMinor: number;
  /** The property's periodic income - becomes the project's planned cashflow and a real subscription. */
  cashflowMinor: number;
  subtitle?: string;
  description?: string;
  note?: string;
}

export interface DealAssetInput {
  kind: 'asset';
  title: string;
  costMinor: number;
  /** How many coins it is about. */
  coins: number;
  /** A die roll of at least this wins the coins; absent for a plain purchase. */
  successOn?: number;
  /** A winning roll pays this cash back instead of giving coins. */
  payoutMinor?: number;
  /** Rolled for at every Payday while owned. */
  recurring?: boolean;
  subtitle?: string;
  description?: string;
  note?: string;
  strategy?: string;
  successText?: string;
  failureText?: string;
}

export type DealInput = DealShareInput | DealInvestmentInput | DealAssetInput;

/** The text a card brings in the game's language, besides its numbers. */
export interface CardPlanText {
  title?: string;
  description?: string;
  note?: string;
  /** The label this language gives the card's property type (SFH, CONDO...) - becomes the project's title. */
  symbol?: string;
  strategy?: string;
  success?: string;
  failure?: string;
}

// ── Reading the books ───────────────────────────────────────────────────────────────────────────

function cashMinor(books: GameBooks): number {
  return cashOnHandMinor(books.transactions, books.allocation);
}

/** Returns the conflicting kind only when the existing project is clearly the other one - never blocks on missing/ambiguous legacy data. */
function conflictingGrowKind(project: BookGrowProject, kind: DealInput['kind']): boolean {
  if (kind === 'asset') return Boolean(project.share?.tag || project.investment?.tag);
  if (kind === 'share') return Boolean(project.investment?.tag) && !project.share?.tag;
  return Boolean(project.share?.tag) && !project.investment?.tag;
}

/** The Bank loan a purchase of `costMinor` would need at the current cash: the shortfall rounded up to the game set's loan step. */
function loanForCostMinor(books: GameBooks, costMinor: number): number {
  return loanForShortfallMinor(
    costMinor,
    cashMinor(books),
    books.gameSet?.loanRule.incrementMinor ?? 0,
  );
}

// ── The plan's bank-loan note ───────────────────────────────────────────────────────────────────

function loanNoteText(books: GameBooks, project: BookGrowProject, deps: DealDeps): string | null {
  const cash = cashMinor(books);
  const money = deps.plainMoney;
  const loanFor = (costMinor: number) => loanForCostMinor(books, costMinor);
  if (project.share?.tag) {
    const { quantity, priceMinor } = project.share;
    if (quantity <= 0) {
      return LOAN_NOTE_MARK + deps.text('CashflowGame.noteCashShare', { cash: money(cash) });
    }
    const costMinor = Math.round(quantity * priceMinor);
    return (
      LOAN_NOTE_MARK +
      deps.text('CashflowGame.noteLoanShare', {
        quantity,
        price: money(priceMinor),
        cost: money(costMinor),
        cash: money(cash),
        loan: money(loanFor(costMinor)),
      })
    );
  }
  if (project.investment?.tag) {
    const { depositMinor } = project.investment;
    return (
      LOAN_NOTE_MARK +
      deps.text('CashflowGame.noteCashInvestment', {
        cash: money(cash),
        deposit: money(depositMinor),
        loan: money(loanFor(depositMinor)),
      })
    );
  }
  if (project.isAsset) {
    return (
      LOAN_NOTE_MARK +
      deps.text('CashflowGame.noteCashInvestment', {
        cash: money(cash),
        deposit: money(project.amountMinor),
        loan: money(loanFor(project.amountMinor)),
      })
    );
  }
  return null;
}

/**
 * The "🏦" line pre-filled into a Doodad payment (JFK, 2026-10-03): the cash on hand, the cost and the Bank loan the
 * payment would need - the same facts the Grow note gives for a purchase.
 */
export function doodadLoanNote(books: GameBooks, costMinor: number, deps: DealDeps): string {
  return (
    LOAN_NOTE_MARK +
    deps.text('CashflowGame.noteCashDoodad', {
      cash: deps.plainMoney(cashMinor(books)),
      cost: deps.plainMoney(costMinor),
      loan: deps.plainMoney(loanForCostMinor(books, costMinor)),
    })
  );
}

/**
 * Keeps the one "🏦" note of a planned card current: what the buy costs, the cash on hand and the bank loan that
 * would be taken for it (JFK, 2026-10-03: changing the quantity should *update* this note, never add a new one).
 * Only touches game-planned projects - once bought or sold the note stays as the last word. Returns the project
 * update, or null when there is nothing to change.
 *
 * A share's loan needed also goes into the project's own Loan field, so the Buy carries it - and the buy then takes it
 * as a Bank loan instead of creating a liability for the project. Grow's convention holds: Deposit = cost - Loan, and
 * the Loan never exceeds the cost even though the bank lends in whole steps. A property keeps its full Anzahlung as
 * Deposit and no Loan field (its loan is the note and the automatic Bank loan).
 */
export function syncPlanNote(
  books: GameBooks,
  project: BookGrowProject,
  deps: DealDeps,
): BookGrowUpdate | null {
  if (project.status !== 'planned') return null;
  const text = loanNoteText(books, project, deps);
  if (!text) return null;
  const index = project.notes.findIndex((note) => note.text.startsWith(LOAN_NOTE_MARK));
  const notes =
    index >= 0
      ? project.notes.map((note, i) => (i === index ? { ...note, text } : note))
      : [...project.notes, { text, createdAt: deps.clock.nowIso() }];
  const update: BookGrowUpdate = { title: project.title, notes };
  if (project.share?.tag) {
    const costMinor = Math.round(project.share.quantity * project.share.priceMinor);
    const loanMinor = Math.min(loanForCostMinor(books, costMinor), costMinor);
    update.loan =
      loanMinor > 0
        ? { tag: project.title, amountMinor: loanMinor, creditMinor: 0, investment: true }
        : null;
    update.amountMinor = costMinor - loanMinor;
  } else {
    update.loan = null;
  }
  return update;
}

// ── Planning a deal ─────────────────────────────────────────────────────────────────────────────

function withAssetDeal(state: CashflowGameState, input: DealAssetInput): CashflowGameState {
  const deal: CashflowAssetDeal = {
    title: input.title,
    coins: input.coins,
    costMinor: input.costMinor,
    ...(input.successOn ? { successOn: input.successOn } : {}),
    ...(input.payoutMinor ? { payoutMinor: input.payoutMinor } : {}),
    ...(input.recurring ? { recurring: true } : {}),
    stage: 'planned',
    ...(input.successText ? { successText: input.successText } : {}),
    ...(input.failureText ? { failureText: input.failureText } : {}),
  };
  return {
    ...state,
    assetDeals: [...(state.assetDeals ?? []).filter((d) => d.title !== input.title), deal],
  };
}

/**
 * Saves a Deal's numbers as a Grow project's **plan** - no money moves yet, exactly Grow's own "plan" step
 * (`docs/domain/GROW_GUIDE.md` §3). JFK, 2026-09-26: "first plan (you have the option), then you make it reality" -
 * `executeDeal` buys it. Every card becomes a real Grow project this way, planned or not. The same card drawn again
 * (better price, more cash) only moves the price and resets the amount to buy, never the holding.
 *
 * Throws before a profession is picked, and when the title already exists as a different kind of project.
 */
export function planDeal(books: GameBooks, input: DealInput, deps: DealDeps): GameEffects {
  if (!books.state.professionId) throw new Error('Pick a profession first.');
  const existing = books.growProjects.find((project) => project.title === input.title);
  if (existing && conflictingGrowKind(existing, input.kind)) {
    throw new Error(`"${input.title}" already exists as a different kind of Grow project.`);
  }
  const isReplan = Boolean(existing && input.kind === 'share');
  const now = deps.clock.nowIso();

  // Card text and trading range are plain Grow fields; the cash / bank-loan line is a Grow *note*, kept current by
  // `syncPlanNote`.
  const newNotes = [
    ...(isReplan && input.kind === 'share'
      ? [deps.text('CashflowGame.cardDrawnAgain', { price: fromMinorUnits(input.priceMinor) })]
      : []),
    ...(input.note ? [input.note] : []),
  ].map((text) => ({ text, createdAt: now }));
  const notes = [...(existing?.notes ?? []), ...newNotes];
  const base: BookGrowUpdate = {
    title: input.title,
    create: !existing,
    createdAt: now,
    status: 'planned',
    phase: 'plan',
    ...(input.subtitle && !existing?.sub ? { sub: input.subtitle } : {}),
    updatedAt: now,
  };

  let update: BookGrowUpdate;
  let state = books.state;
  if (input.kind === 'share') {
    update = {
      ...base,
      share: { tag: input.title, quantity: input.quantity, priceMinor: input.priceMinor },
      ...(input.description && !existing?.description ? { description: input.description } : {}),
      ...(input.strategy ? { strategy: input.strategy } : {}),
      notes,
    };
  } else if (input.kind === 'investment') {
    update = {
      ...base,
      cashflowMinor: input.cashflowMinor,
      // Grow's "Deposit" is the project's amount: the card's whole Anzahlung (JFK, 2026-10-03).
      amountMinor: input.depositMinor,
      investment: {
        tag: input.title,
        depositMinor: input.depositMinor,
        amountMinor: input.mortgageMinor,
      },
      ...(input.description ? { description: input.description } : {}),
      notes,
    };
  } else {
    // A special asset (gold coins): a Grow *asset* project, the price is its Deposit.
    update = {
      ...base,
      isAsset: true,
      amountMinor: input.costMinor,
      ...(input.description ? { description: input.description } : {}),
      ...(input.strategy ? { strategy: input.strategy } : {}),
      notes: [
        ...notes,
        ...(input.coins > 0
          ? [
              {
                text: deps.text('CashflowGame.assetCoinsNote', { coins: input.coins }),
                createdAt: now,
              },
            ]
          : []),
      ],
    };
    state = withAssetDeal(state, input);
  }

  const effects = emptyEffects(state, { kind: 'planDeal', detail: input.title });
  effects.growUpdates = [update];
  effects.persist.grow = true;

  // The plan note and a share's Loan field follow the plan that was just written.
  const planned = applyEffectsToBooks({ ...books, state }, effects).growProjects.find(
    (project) => project.title === input.title,
  );
  const sync = planned ? syncPlanNote({ ...books, state }, planned, deps) : null;
  if (sync) effects.growUpdates = [{ ...update, ...sync }];
  return effects;
}

// ── Executing a deal ────────────────────────────────────────────────────────────────────────────

/**
 * Registers an investment's monthly cashflow with Payday: its cashflow becomes a real Subscription AND is listed with
 * the game - Payday only acts on `gameSubscriptionTitles`, so a Subscription that isn't listed would never pay out.
 * Safe to run again; it refreshes the amount. Null when the project pays nothing. No History step: the caller's own
 * step (the purchase) covers it.
 */
export function registerInvestmentIncome(
  books: Pick<GameBooks, 'state' | 'subscriptions' | 'growProjects'>,
  title: string,
  deps: Pick<DealDeps, 'clock'>,
): GameEffects | null {
  const project = books.growProjects.find((candidate) => candidate.title === title);
  if (!project || project.cashflowMinor <= 0) return null;
  const subscriptionTitle = `${title} Cashflow`;
  const effects = emptyEffects(
    {
      ...books.state,
      gameSubscriptionTitles: books.state.gameSubscriptionTitles.includes(subscriptionTitle)
        ? books.state.gameSubscriptionTitles
        : [...books.state.gameSubscriptionTitles, subscriptionTitle],
    },
    null,
  );
  effects.subscriptionUpserts = [
    upsertBookSubscription(
      books.subscriptions,
      {
        title: subscriptionTitle,
        account: 'Income',
        amountMinor: project.cashflowMinor,
        frequency: 'monthly',
        category: `@${title}`,
      },
      deps.clock.todayIso(),
    ),
  ];
  effects.persist.subscriptions = true;
  return effects;
}

export interface ExecuteDealResult {
  /** One entry per undo step, in order: the automatic loan (when cash was short), then the purchase. */
  steps: GameEffects[];
  kind: 'share' | 'investment';
}

/**
 * Buys a **planned** Deal, with exactly the app's existing Grow buy mechanics (`calculateBuyShare` /
 * `calculateBuyInvestment`), on the `Fire` account like Grow's own buy. If cash on hand does not cover the plan's cost,
 * the shortfall (rounded up to the loan step) is borrowed through the Bank loan first - never Grow's own generic
 * financing, which has no fixed interest rate to automate correctly. Taking the loan and buying with it are two
 * separate moves (JFK, 2026-09-30), so they are two steps: one Undo takes back the purchase, the next the loan.
 *
 * A property additionally gets a real Subscription for its cashflow, so it feeds every future Payday automatically
 * (JFK, 2026-09-26). Buying more of an owned title later is just planning the extra amount and executing again.
 *
 * Everything is decided before anything is returned, so a refused deal changes nothing - there is no half a deal to
 * roll back. Throws before a profession is picked, for an unknown title, and for a share count that is not a whole
 * number above zero.
 */
export function executeDeal(
  books: GameBooks,
  title: string,
  quantity: number | undefined,
  deps: DealDeps,
): ExecuteDealResult {
  if (!books.state.professionId) throw new Error('Pick a profession first.');
  const project = books.growProjects.find((candidate) => candidate.title === title);
  if (!project) throw new Error(`No planned deal called "${title}" — plan it first.`);
  const kind: 'share' | 'investment' = project.investment?.tag ? 'investment' : 'share';

  // A stock card leaves the count to the player (JFK, 2026-09-30), so the buy can carry it.
  const shareQuantity = kind === 'share' ? (quantity ?? project.share?.quantity ?? 0) : 0;
  if (kind === 'share' && !(Number.isInteger(shareQuantity) && shareQuantity > 0)) {
    throw new Error('Enter how many shares you want to buy.');
  }
  const share = project.share;
  const investment = project.investment;
  if (kind === 'share' ? !share : !investment) {
    throw new Error(`"${title}" is not a share or a property deal.`);
  }
  const costMinor =
    kind === 'share'
      ? multiplyQuantityPrice(shareQuantity, share!.priceMinor)
      : investment!.depositMinor;
  const cash = cashMinor(books);

  const steps: GameEffects[] = [];
  let working = books;
  if (costMinor - cash > 0) {
    if (!books.gameSet) throw new Error('Pick a profession first.');
    const loan = playBankLoan(
      working,
      loanForShortfallMinor(costMinor, cash, books.gameSet.loanRule.incrementMinor),
      deps,
    );
    loan.step = { kind: 'loanAuto' };
    steps.push(loan);
    working = applyEffectsToBooks(working, loan);
  }

  const now = deps.clock.nowIso();
  const existingShare = working.shares.find((candidate) => candidate.tag === title);
  const existingInvestment = working.investments.find((candidate) => candidate.tag === title);
  const existingMortgage = working.liabilities.find((liability) => liability.tag === `M-${title}`);
  const buy = emptyEffects(working.state, { kind: 'buyDeal', detail: title });
  buy.persist = { subscriptions: true, grow: true, balanceSheet: true };

  if (kind === 'share') {
    const result = calculateBuyShare({
      title,
      quantity: shareQuantity,
      priceMinor: share!.priceMinor,
      existingShareQuantity: existingShare?.quantity ?? null,
      existingGrowAmountMinor: project.amountMinor,
    });
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
    const position = {
      tag: title,
      quantity: result.newShareQuantity,
      priceMinor: result.newSharePriceMinor,
    };
    buy.shareUpserts = [position];
    buy.growUpdates = [
      { title, amountMinor: result.newGrowAmountMinor, share: position, updatedAt: now },
    ];
  } else {
    const result = calculateBuyInvestment({
      title,
      depositMinor: investment!.depositMinor,
      mortgageMinor: investment!.amountMinor,
      existingInvestmentDepositMinor: existingInvestment?.depositMinor ?? null,
      existingInvestmentAmountMinor: existingInvestment?.amountMinor ?? null,
      existingMortgageLiabilityAmountMinor: existingMortgage?.amountMinor ?? null,
      existingGrowAmountMinor: project.amountMinor,
    });
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
    const position = {
      tag: title,
      depositMinor: result.newInvestmentDepositMinor,
      amountMinor: result.newInvestmentAmountMinor,
    };
    buy.investmentUpserts = [position];
    buy.liabilityUpserts = [
      {
        tag: result.mortgageLiabilityPatch.tag,
        amountMinor: result.mortgageLiabilityPatch.amountMinor,
        investment: true,
      },
    ];
    buy.growUpdates = [
      { title, amountMinor: result.newGrowAmountMinor, investment: position, updatedAt: now },
    ];
    // Its monthly cashflow starts paying at the next Payday.
    const income = registerInvestmentIncome(working, title, deps);
    if (income) {
      buy.subscriptionUpserts = income.subscriptionUpserts;
      buy.state = income.state;
    }
  }
  steps.push(buy);
  return { steps, kind };
}

// ── Cards and the list of planned deals ─────────────────────────────────────────────────────────

/** Grow projects not yet bought - planned only (todo/cashflow-game.md decision 12): the plan exists, but no real position backs it yet. */
export function plannedDeals(
  books: Pick<GameBooks, 'growProjects' | 'shares' | 'investments'>,
): BookGrowProject[] {
  return books.growProjects.filter((project) => {
    if (project.investment?.tag) {
      return !books.investments.some((investment) => investment.tag === project.title);
    }
    if (project.share?.tag) return !books.shares.some((share) => share.tag === project.title);
    return false;
  });
}

function toRoman(value: number): string {
  const numerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = value;
  let result = '';
  for (const [amount, numeral] of numerals) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }
  return result;
}

/**
 * The first free label for another copy of an investment: the bare abbreviation, then `-II`, `-III`... Hyphenated,
 * never spaced - Grow's buy comment ("Buy Investment EFH 3000 47000;") is read by spaces, so a space in a label would
 * corrupt the purchase.
 */
export function nextInvestmentLabel(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let copy = 2; ; copy++) {
    const label = `${base}-${toRoman(copy)}`;
    if (!taken.has(label)) return label;
  }
}

/** Every label already used by a Grow project, a property or an asset. */
export function takenDealLabels(
  books: Pick<GameBooks, 'growProjects' | 'investments' | 'assets'>,
): Set<string> {
  return new Set([
    ...books.growProjects.map((project) => project.title),
    ...books.investments.map((investment) => investment.tag),
    ...books.assets.map((asset) => asset.tag),
  ]);
}

/** A drawn or found Deal card, as the input `planDeal` takes - its numbers, not re-typed. */
export function dealInputFromCard(
  card: CashflowDealCard,
  text: CardPlanText,
  taken: Set<string>,
): DealInput {
  if (card.assetKind === 'share') {
    return {
      kind: 'share',
      // The ticker identifies the position; a card without one (placeholders) falls back to its name.
      title: card.symbol ?? card.title,
      subtitle: card.title,
      quantity: card.quantity ?? 0,
      priceMinor: card.priceMinor ?? 0,
      description: text.description,
      note: text.note,
      strategy: text.strategy,
    };
  }
  if (card.assetKind === 'asset') {
    return {
      kind: 'asset',
      // Every special-asset card is its own deal: GOLD, then GOLD-II...
      title: nextInvestmentLabel(text.symbol ?? card.symbol ?? card.title, taken),
      subtitle: text.title ?? card.title,
      costMinor: card.costMinor ?? 0,
      coins: card.quantity ?? 0,
      successOn: card.successOn,
      payoutMinor: card.payoutMinor || undefined,
      recurring: card.recurring,
      description: text.description,
      note: text.note,
      strategy: text.strategy,
      successText: text.success,
      failureText: text.failure,
    };
  }
  return {
    kind: 'investment',
    // Every investment card is its own deal: EFH, then EFH-II, EFH-III...
    title: nextInvestmentLabel(text.symbol ?? card.symbol ?? card.title, taken),
    subtitle: text.title ?? card.title,
    depositMinor: card.depositMinor ?? 0,
    mortgageMinor: card.mortgageMinor ?? 0,
    cashflowMinor: card.cashflowMinor ?? 0,
    description: text.description,
    note: text.note,
  };
}

// ── Hooks around a trade ────────────────────────────────────────────────────────────────────────

/**
 * Moves a card-deal's Grow project through the phases as the player trades (JFK, 2026-10-03): planned = **plan**,
 * bought = **execute**, and once the last share / property / asset is sold = **completed**. Selling only part of a
 * share position keeps it in execute. A sold property takes any market offer for it along. Null when there is no such
 * project. No History step: the trade's own step covers it.
 */
export function setPhaseAfterTrade(
  books: Pick<GameBooks, 'state' | 'growProjects' | 'shares' | 'investments' | 'assets'>,
  title: string,
  trade: 'buy' | 'sell',
): GameEffects | null {
  const project = books.growProjects.find((candidate) => candidate.title === title);
  if (!project) return null;
  const stillHeld =
    books.shares.some((share) => share.tag === title) ||
    books.investments.some((investment) => investment.tag === title) ||
    books.assets.some((asset) => asset.tag === title);
  const sold = trade === 'sell' && !stillHeld;
  const offers = books.state.marketOffers ?? [];
  const effects = emptyEffects(
    sold && offers.some((offer) => offer.title === title)
      ? { ...books.state, marketOffers: offers.filter((offer) => offer.title !== title) }
      : books.state,
    null,
  );
  effects.growUpdates = [{ title, phase: sold ? 'completed' : 'execute' }];
  effects.persist.grow = true;
  return effects;
}

/** Which monthly expense line a starting liability's payments are (profession card keys). */
export const LIABILITY_EXPENSE_KEYS: Record<string, string> = {
  mortgage: 'mortgageRent',
  carLoan: 'carLoan',
  creditCardDebt: 'creditCard',
  studentLoanDebt: 'studentLoan',
  bankLoan: 'bankLoanPayment',
};

/** The game subscription that pays a liability off over time, or null when it has none (e.g. a liability the player added by hand). */
function expenseTitleForLiability(
  state: CashflowGameState,
  profession: CashflowProfession | undefined,
  liabilityTag: string,
  text: GameText,
): string | null {
  if (liabilityTag === 'Bank loan') return 'Bank loan interest';
  if (!profession) return null;
  // The liability was named in whichever language was active at game start, so match it against the current
  // translation and the card's original text.
  const liability = (profession.starterKit.liabilities ?? []).find((candidate) =>
    [
      candidate.key
        ? textOrFallback(text, `CashflowGame.liabilityTag.${candidate.key}`, candidate.tag)
        : candidate.tag,
      candidate.tag,
    ].includes(liabilityTag),
  );
  const expenseKey = liability?.key ? LIABILITY_EXPENSE_KEYS[liability.key] : undefined;
  const line = expenseKey
    ? profession.expenses.find((expense) => expense.key === expenseKey)
    : undefined;
  if (!line) return null;
  const translated = line.key
    ? textOrFallback(text, `CashflowGame.expenseLine.${line.key}`, line.title)
    : line.title;
  return (
    [translated, line.title].find((title) => state.gameSubscriptionTitles.includes(title)) ?? null
  );
}

export interface PaidLiabilityResult {
  /** The title of the monthly expense that ended, or null when nothing changed. */
  title: string | null;
  effects: GameEffects | null;
}

/**
 * Paying a starting liability off (car loan, credit card, student loan, home mortgage...) also ends the monthly
 * expense that went with it (JFK, 2026-10-03). Does nothing while any of it is still owed. The subscription leaves
 * the game too, so Payday stops charging it - and because the Add dialog took an undo step first, one Undo brings both
 * the debt and its expense back.
 */
export function removeExpenseForPaidLiability(
  books: Pick<GameBooks, 'state' | 'liabilities'>,
  profession: CashflowProfession | undefined,
  liabilityTag: string,
  text: GameText,
): PaidLiabilityResult {
  if (books.liabilities.some((liability) => liability.tag === liabilityTag)) {
    return { title: null, effects: null };
  }
  const title = expenseTitleForLiability(books.state, profession, liabilityTag, text);
  if (!title) return { title: null, effects: null };
  const effects = emptyEffects(
    {
      ...books.state,
      gameSubscriptionTitles: books.state.gameSubscriptionTitles.filter((t) => t !== title),
    },
    null,
  );
  effects.subscriptionRemovals = [title];
  effects.persist.subscriptions = true;
  return { title, effects };
}

/**
 * Selling a drawn card to another player for a one-time price (JFK, 2026-09-30): plain income, not a Grow sale - no
 * position exists yet. The category names the card, so History and the transaction list show which card was traded.
 * Throws before a game has started and for a price that is not above zero.
 */
export function sellCardToFriend(
  books: Pick<GameBooks, 'state' | 'subscriptions' | 'transactions'>,
  card: Pick<CashflowDealCard, 'title' | 'symbol'>,
  amountMinor: number,
  label: string | undefined,
  deps: Pick<DealDeps, 'clock'>,
): GameEffects {
  if (!books.state.virtualDate) throw new Error('Pick a profession first.');
  if (!(amountMinor > 0)) throw new Error('Enter the price your friend pays.');
  const name = label ?? card.symbol ?? card.title;
  const effects = emptyEffects(books.state, { kind: 'cardSale', detail: name });
  effects.appendedTransactions = placeOneOffTransactions(
    [
      {
        account: 'Daily',
        amountMinor,
        date: '',
        time: '',
        category: `@${name} card sale`,
        comment: `Sold the ${name} card to a friend\n#cashflow`,
      },
    ],
    books,
    deps.clock.todayIso(),
  );
  return effects;
}
