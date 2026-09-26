import { Injectable } from '@angular/core';
import {
  adjustCashflowBankLoan,
  CASHFLOW_GAME_SETS,
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowGameSet,
  CashflowGameSubscription,
  CashflowMarketCard,
  CashflowProfession,
  CashflowStarterKitSubscription,
  CashflowTransactionRecord,
  calculateBuyInvestment,
  calculateBuyShare,
  clearCashflowStatus,
  computeMonthlyCashflowMinor,
  drawRandomCard,
  findCards,
  fromMinorUnits,
  initialCashflowGameState,
  multiplyQuantityPrice,
  pickCashflowProfession,
  resolveCashflowBaby,
  resolveCashflowCharity,
  resolveCashflowDownsized,
  runCashflowPayday,
  toMinorUnits,
  undoLastCashflowPayday,
} from '@money/domain';
import { AppStateService } from './app-state.service';
import { IncomeStatementService } from './income-statement.service';
import { PersistenceService } from './persistence.service';
import { ProfileComponent } from '../../panels/profile/profile.component';
import { Transaction } from '../../interfaces/transaction';
import { Subscription } from '../../interfaces/subscription';
import { Grow } from '../../interfaces/grow';

export interface CashflowGameCallbacks {
  onSuccess: () => void;
  onError: (message: string) => void;
}

/** A Deal card resolved through the app's existing Grow feature (todo/cashflow-game.md decision 10) — not a new entity type, just the two shapes Grow's own buy actions need. */
export interface CashflowDealShareInput {
  kind: 'share';
  title: string;
  quantity: number;
  price: number;
}
export interface CashflowDealInvestmentInput {
  kind: 'investment';
  title: string;
  deposit: number;
  mortgage: number;
  /** The property's periodic income — becomes the Grow project's planned `cashflow` and a real Subscription. */
  cashflow: number;
}
export type CashflowDealInput = CashflowDealShareInput | CashflowDealInvestmentInput;

/** Which card shape each deck holds — gives `drawCard`/`findCardsInDeck` a properly narrowed return per deck (todo/cashflow-game.md decision 16). */
interface CashflowDeckCardMap {
  dealSmall: CashflowDealCard;
  dealBig: CashflowDealCard;
  market: CashflowMarketCard;
  doodad: CashflowDoodadCard;
}

export interface CashflowCardCallbacks<T> {
  onSuccess: (card: T) => void;
  onError: (message: string) => void;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toFloatTransaction(record: CashflowTransactionRecord): Transaction {
  return {
    account: record.account,
    amount: fromMinorUnits(record.amountMinor),
    date: record.date,
    time: record.time,
    category: record.category,
    comment: record.comment,
  };
}

/**
 * Replaces `GameModeService`'s two date-shifting methods with automation
 * scoped to only what the game itself creates — see todo/cashflow-game.md.
 * Everything financial (Subscription/Transaction/Asset/Investment/Share/
 * Liability) is a real entity; this service only owns
 * `AppStateService.cashflowGame`, the small game-meta state.
 */
@Injectable({ providedIn: 'root' })
export class CashflowGameService {
  readonly gameSets = CASHFLOW_GAME_SETS;

  constructor(
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService,
  ) {}

  static isCashflowGame(): boolean {
    return Boolean(ProfileComponent.mail && ProfileComponent.mail.includes('cashflow'));
  }

  /** Starts a new game: materializes the profession's starter kit as real entities. */
  pickProfession(gameSetId: string, professionId: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof pickCashflowProfession>;
    try {
      result = pickCashflowProfession(this.gameSets, gameSetId, professionId, todayIso());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not start the game.'));
      return;
    }

    state.allTransactions.push(toFloatTransaction(result.startingCashTransaction));

    result.starterKit.subscriptions.forEach((sub) => {
      const subscription: Subscription = {
        title: sub.title,
        account: sub.account,
        amount: fromMinorUnits(sub.amountMinor),
        startDate: todayIso(),
        endDate: '',
        category: sub.category ?? '',
        comment: sub.comment ? `${sub.comment}\n#cashflow` : '#cashflow',
        frequency: sub.frequency,
      };
      state.allSubscriptions.push(subscription);
    });
    (result.starterKit.assets ?? []).forEach((asset) =>
      state.allAssets.push({ tag: asset.tag, amount: fromMinorUnits(asset.amountMinor) }),
    );
    (result.starterKit.investments ?? []).forEach((investment) =>
      state.allInvestments.push({
        tag: investment.tag,
        amount: fromMinorUnits(investment.amountMinor),
        deposit: fromMinorUnits(investment.depositMinor),
      }),
    );
    (result.starterKit.shares ?? []).forEach((share) =>
      state.allShares.push({
        tag: share.tag,
        quantity: share.quantity,
        price: fromMinorUnits(share.priceMinor),
      }),
    );
    (result.starterKit.liabilities ?? []).forEach((liability) =>
      state.liabilities.push({
        tag: liability.tag,
        amount: fromMinorUnits(liability.amountMinor),
        investment: false,
        credit: 0,
      }),
    );

    state.cashflowGame = result.state;
    this.persistAll('start_cashflow_game', { gameSetId, professionId }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
  }

  /** Runs one Payday: one Transaction per real Subscription the game owns, dated at the game's own virtual date. */
  payday(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof runCashflowPayday>;
    try {
      result = runCashflowPayday(state.cashflowGame, this.gameSubscriptions());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not run Payday.'));
      return;
    }
    result.transactions.forEach((record) => state.allTransactions.push(toFloatTransaction(record)));
    state.cashflowGame = result.state;
    this.persistAll('cashflow_payday', { round: result.state.round }, callbacks);
  }

  /** Reverses the most recent Payday: removes exactly the transactions it created. */
  undoLastPayday(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof undoLastCashflowPayday>;
    try {
      result = undoLastCashflowPayday(state.cashflowGame);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Nothing to undo.'));
      return;
    }
    this.removeCreatedTransactions(result.removedTransactions);
    state.cashflowGame = result.state;
    this.persistAll('cashflow_undo_payday', { round: result.state.round }, callbacks);
  }

  /** Resolves a Baby space: +1 child (max 3), scales the children-expense Subscription. */
  resolveBaby(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const profession = this.currentProfession();
    if (!profession) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    let result: ReturnType<typeof resolveCashflowBaby>;
    try {
      result = resolveCashflowBaby(state.cashflowGame, profession);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Baby.'));
      return;
    }
    this.upsertSubscription(result.subscriptionUpsert);
    state.cashflowGame = result.state;
    this.persistAll('cashflow_baby', { children: result.state.children }, callbacks, {
      includeSubscriptions: true,
    });
  }

  /** Resolves a Charity space: pays 10% of total income now, unlocks the dice choice for 3 Paydays. */
  resolveCharity(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof resolveCashflowCharity>;
    try {
      result = resolveCashflowCharity(state.cashflowGame, this.gameSubscriptions());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Charity.'));
      return;
    }
    state.allTransactions.push(toFloatTransaction(result.transaction));
    state.cashflowGame = result.state;
    this.persistAll('cashflow_charity', {}, callbacks);
  }

  /** Resolves a Downsized space: pays total expenses once, sits out 2 Paydays (ends an active charity bonus). */
  resolveDownsized(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof resolveCashflowDownsized>;
    try {
      result = resolveCashflowDownsized(state.cashflowGame, this.gameSubscriptions());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Downsized.'));
      return;
    }
    state.allTransactions.push(toFloatTransaction(result.transaction));
    state.cashflowGame = result.state;
    this.persistAll('cashflow_downsized', {}, callbacks);
  }

  /** Takes (`delta > 0`) or repays (`< 0`) a bank loan in the game set's increment (a decimal amount, like everywhere else in the app); upserts the Liability + interest Subscription, recomputed from the new principal every time. */
  adjustBankLoan(delta: number, callbacks: CashflowGameCallbacks): void {
    try {
      this.applyBankLoanAdjustment(delta);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not adjust the bank loan.'));
      return;
    }
    this.persistAll('cashflow_bank_loan', { delta }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
  }

  /** The mutation `adjustBankLoan` and `dealBuy`'s auto-borrow both need — throws instead of using callbacks so a caller can chain it with other mutations before persisting once. */
  private applyBankLoanAdjustment(delta: number): void {
    const state = AppStateService.instance;
    const gameSet = this.currentGameSet();
    if (!gameSet) throw new Error('Pick a profession first.');
    const currentPrincipalMinor = toMinorUnits(
      state.liabilities.find((liability) => liability.tag === 'Bank loan')?.amount ?? 0,
    );
    const result = adjustCashflowBankLoan(
      state.cashflowGame,
      gameSet,
      currentPrincipalMinor,
      toMinorUnits(delta),
    );
    if (result.liabilityUpsert) {
      this.upsertLiability(result.liabilityUpsert.tag, result.liabilityUpsert.amountMinor);
    } else {
      this.removeLiabilityByTag('Bank loan');
    }
    if (result.subscriptionUpsert) {
      this.upsertSubscription(result.subscriptionUpsert);
    } else {
      this.removeSubscriptionByTitle('Bank loan interest');
    }
    state.cashflowGame = result.state;
  }

  /**
   * Dismisses an active Charity/Downsized reminder once the player's own
   * physical turns have played out — the app can't know when that is
   * (JFK, 2026-09-26: the "N rounds" are the board's turn order, other
   * players' turns for Downsized), so this is a plain acknowledgement, not
   * a financial action: no recalculation, just the one field.
   */
  clearStatus(status: 'charity' | 'unemployed', callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    state.cashflowGame = clearCashflowStatus(state.cashflowGame, status);
    this.persistence.writeAndSync({
      tag: 'cashflowGame',
      data: state.cashflowGame,
      localStorageKey: 'cashflowGame',
      logEvent: `cashflow_clear_${status}`,
      logMetadata: {},
      onSuccess: callbacks.onSuccess,
      onError: (error: any) => callbacks.onError(error?.message || 'Database write failed'),
    });
  }

  /**
   * The recurring "Gesamteinkommen − Gesamtausgaben" — the loss condition:
   * once negative, every future Payday drains cash (JFK, 2026-09-26).
   */
  get monthlyCashflow(): number {
    const state = AppStateService.instance;
    return fromMinorUnits(
      computeMonthlyCashflowMinor(state.cashflowGame, this.gameSubscriptions()),
    );
  }

  /**
   * Total cash on hand: the same Daily+Splurge+Smile+Fire total the Home
   * dashboard shows (each account's own transactions plus its ratio-share
   * of Income) — ratio-independent since the four shares of an Income
   * transaction always sum back to its full amount, so this is accurate
   * whatever the account's allocation setting is. The single source of
   * truth `dealBuy`'s auto-borrow decision and the dashboard both use —
   * JFK, 2026-09-26: reuse the app's own views, don't duplicate them.
   */
  get cash(): number {
    const state = AppStateService.instance;
    return (
      Math.round(
        (state.getAmount('Daily', state.daily / 100) +
          state.getAmount('Splurge', state.splurge / 100) +
          state.getAmount('Smile', state.smile / 100) +
          state.getAmount('Fire', state.fire / 100)) *
          100,
      ) / 100
    );
  }

  /**
   * Saves a Deal's numbers as a Grow project's **plan** — no money moves
   * yet, exactly Grow's own "plan" step (`docs/domain/GROW_GUIDE.md` §3).
   * JFK, 2026-09-26: "first plan (you have the option), then you make it
   * reality" — call `executeDeal` once you've decided to actually buy it.
   * Every card becomes a real Grow project this way, planned or not.
   */
  planDeal(input: CashflowDealInput, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.professionId) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    const existingProject = state.allGrowProjects.find((project) => project.title === input.title);
    if (existingProject && this.conflictingGrowKind(existingProject, input.kind)) {
      callbacks.onError(`"${input.title}" already exists as a different kind of Grow project.`);
      return;
    }
    this.upsertGrowProject(
      input.title,
      existingProject,
      input.kind === 'share'
        ? { share: { tag: input.title, quantity: input.quantity, price: input.price } }
        : {
            cashflow: input.cashflow,
            investment: { tag: input.title, deposit: input.deposit, amount: input.mortgage },
          },
    );
    this.persistAll('cashflow_deal_plan', { kind: input.kind, title: input.title }, callbacks, {
      includeGrow: true,
    });
  }

  /**
   * Buys a **planned** Deal, using exactly the app's existing Grow buy
   * mechanics (`calculateBuyShare`/`calculateBuyInvestment`), the same
   * account (`Fire`, matching `grow.component.ts`'s own `buyProject`) and
   * the same DSL comment format, not a parallel purchase system (decision
   * 10). If cash on hand doesn't cover the plan's cost, it auto-borrows the
   * shortfall (rounded up to the game set's increment) via the Bank loan
   * mechanic first — never Grow's own generic financing attachment, which
   * has no fixed interest rate to automate correctly.
   *
   * A property (`kind: investment`) additionally gets a real Subscription
   * for its cashflow, so it feeds every future Payday automatically — the
   * one thing this game adds on top of "just use Grow": JFK, 2026-09-26,
   * "the cashflow should be automatically added to your income statement
   * and a subscription." Buying more of an already-owned title later is
   * just planning the extra amount and executing again — the calculators
   * already add to whatever position exists.
   */
  executeDeal(title: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.professionId) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    const project = state.allGrowProjects.find((candidate) => candidate.title === title);
    if (!project) {
      callbacks.onError(`No planned deal called "${title}" — plan it first.`);
      return;
    }
    const virtualDate = state.cashflowGame.virtualDate as string;
    const kind: 'share' | 'investment' = project.investment?.tag ? 'investment' : 'share';

    const costMinor =
      kind === 'share'
        ? multiplyQuantityPrice(project.share.quantity, toMinorUnits(project.share.price))
        : toMinorUnits(project.investment.deposit);
    const shortfallMinor = costMinor - toMinorUnits(this.cash);
    try {
      if (shortfallMinor > 0) {
        const gameSet = this.currentGameSet();
        if (!gameSet) throw new Error('Pick a profession first.');
        const incrementMinor = gameSet.loanRule.incrementMinor;
        const borrowMinor = Math.ceil(shortfallMinor / incrementMinor) * incrementMinor;
        this.applyBankLoanAdjustment(fromMinorUnits(borrowMinor));
      }

      const buyResult =
        kind === 'share'
          ? calculateBuyShare({
              title,
              quantity: project.share.quantity,
              priceMinor: toMinorUnits(project.share.price),
              existingShareQuantity:
                state.allShares.find((share) => share.tag === title)?.quantity ?? null,
              existingGrowAmountMinor: toMinorUnits(project.amount ?? 0),
            })
          : calculateBuyInvestment({
              title,
              depositMinor: toMinorUnits(project.investment.deposit),
              mortgageMinor: toMinorUnits(project.investment.amount),
              existingInvestmentDepositMinor: this.existingMinor(
                state.allInvestments.find((investment) => investment.tag === title)?.deposit,
              ),
              existingInvestmentAmountMinor: this.existingMinor(
                state.allInvestments.find((investment) => investment.tag === title)?.amount,
              ),
              existingMortgageLiabilityAmountMinor: this.existingMinor(
                state.liabilities.find((liability) => liability.tag === `M-${title}`)?.amount,
              ),
              existingGrowAmountMinor: toMinorUnits(project.amount ?? 0),
            });

      state.allTransactions.push({
        account: 'Fire',
        amount: fromMinorUnits(buyResult.transactionAmountMinor),
        date: virtualDate,
        time: '',
        category: `@${title}`,
        comment: buyResult.comment,
      });

      if (kind === 'share') {
        const share = buyResult as ReturnType<typeof calculateBuyShare>;
        const patch = {
          tag: title,
          quantity: share.newShareQuantity,
          price: fromMinorUnits(share.newSharePriceMinor),
        };
        this.upsertEntity(state.allShares, title, () => patch);
        this.upsertGrowProject(title, project, {
          amount: fromMinorUnits(buyResult.newGrowAmountMinor),
          share: patch,
        });
      } else {
        const investment = buyResult as ReturnType<typeof calculateBuyInvestment>;
        const patch = {
          tag: title,
          deposit: fromMinorUnits(investment.newInvestmentDepositMinor),
          amount: fromMinorUnits(investment.newInvestmentAmountMinor),
        };
        this.upsertEntity(state.allInvestments, title, () => patch);
        this.upsertLiability(
          investment.mortgageLiabilityPatch.tag,
          investment.mortgageLiabilityPatch.amountMinor,
          true,
        );
        this.upsertGrowProject(title, project, {
          amount: fromMinorUnits(buyResult.newGrowAmountMinor),
          investment: patch,
        });
        this.upsertSubscription({
          title: `${title} Cashflow`,
          account: 'Income',
          amountMinor: toMinorUnits(project.cashflow),
          frequency: 'monthly',
        });
      }
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not complete this deal.'));
      return;
    }

    this.persistAll('cashflow_deal_execute', { kind, title }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** Grow projects not yet bought — planned only (todo/cashflow-game.md decision 12): the deal's plan exists, but no real Share/Investment position backs it yet. */
  get plannedDeals(): Grow[] {
    const state = AppStateService.instance;
    return state.allGrowProjects.filter((project) => {
      if (project.investment?.tag) {
        return !state.allInvestments.some((investment) => investment.tag === project.title);
      }
      if (project.share?.tag) {
        return !state.allShares.some((share) => share.tag === project.title);
      }
      return false;
    });
  }

  /**
   * Wipes every real entity the game touches — Transactions, Subscriptions,
   * Grow/Share/Investment/Asset/Liability, Smile/Fire/Mojo — and the
   * game-meta state itself, back to a blank slate. JFK, 2026-09-26: a fast
   * way to start over while playtesting; history/status don't need to
   * survive a reset. Double-gated (the whole page already is) since this is
   * the most destructive action here — never touches a non-cashflow
   * account even if somehow called on one.
   */
  resetGame(callbacks: CashflowGameCallbacks): void {
    if (!CashflowGameService.isCashflowGame()) {
      callbacks.onError('This is only available for a Cashflow game account.');
      return;
    }
    const state = AppStateService.instance;
    state.allTransactions = [];
    state.allSubscriptions = [];
    state.allGrowProjects = [];
    state.allShares = [];
    state.allInvestments = [];
    state.allAssets = [];
    state.liabilities = [];
    state.allSmileProjects = [];
    state.allFireEmergencies = [];
    state.mojo = { amount: 0, target: 0 };
    state.cashflowGame = initialCashflowGameState();

    this.persistAll('cashflow_reset', {}, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /**
   * "Find this card" (todo/cashflow-game.md decision 16): the player drew a
   * real card from their physical deck and searches the digitized deck by
   * title to load its numbers. A pure, synchronous read — nothing to
   * persist, unlike drawing.
   */
  findCardsInDeck<K extends CashflowDeckKind>(
    deckKind: K,
    query: string,
  ): CashflowDeckCardMap[K][] {
    const deck = this.currentGameSet()?.decks?.[deckKind] ?? [];
    return findCards(deck as CashflowDeckCardMap[K][], query);
  }

  /**
   * "Draw a card" (todo/cashflow-game.md decision 16): no physical deck in
   * hand — the app picks at random from whatever this deck hasn't already
   * given out since its last reshuffle, and remembers the pick so the same
   * card doesn't come up twice in a row.
   */
  drawCard<K extends CashflowDeckKind>(
    deckKind: K,
    callbacks: CashflowCardCallbacks<CashflowDeckCardMap[K]>,
  ): void {
    const state = AppStateService.instance;
    const deck = this.currentGameSet()?.decks?.[deckKind];
    if (!deck) {
      callbacks.onError(`This game set has no ${deckKind} cards yet.`);
      return;
    }
    let result: ReturnType<typeof drawRandomCard<CashflowDeckCardMap[K]>>;
    try {
      result = drawRandomCard(
        deck as CashflowDeckCardMap[K][],
        state.cashflowGame.drawnCardIds[deckKind],
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not draw a card.'));
      return;
    }
    state.cashflowGame = {
      ...state.cashflowGame,
      drawnCardIds: { ...state.cashflowGame.drawnCardIds, [deckKind]: result.drawnIds },
    };
    this.persistence.writeAndSync({
      tag: 'cashflowGame',
      data: state.cashflowGame,
      localStorageKey: 'cashflowGame',
      logEvent: 'cashflow_draw_card',
      logMetadata: { deckKind, cardId: result.card.id },
      onSuccess: () => callbacks.onSuccess(result.card),
      onError: (error: any) => callbacks.onError(error?.message || 'Database write failed'),
    });
  }

  /** Plans a drawn/found Deal card exactly as `planDeal` would from the manual form — its numbers, not re-typed. */
  applyDealCard(card: CashflowDealCard, callbacks: CashflowGameCallbacks): void {
    const input: CashflowDealInput =
      card.assetKind === 'share'
        ? {
            kind: 'share',
            title: card.title,
            quantity: card.quantity ?? 0,
            price: fromMinorUnits(card.priceMinor ?? 0),
          }
        : {
            kind: 'investment',
            title: card.title,
            deposit: fromMinorUnits(card.depositMinor ?? 0),
            mortgage: fromMinorUnits(card.mortgageMinor ?? 0),
            cashflow: fromMinorUnits(card.cashflowMinor ?? 0),
          };
    this.planDeal(input, callbacks);
  }

  /** A Doodad's mandatory one-off cost — a single Transaction, nothing else (todo/cashflow-game.md §4). */
  applyDoodadCard(card: CashflowDoodadCard, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.virtualDate) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    state.allTransactions.push({
      account: 'Daily',
      amount: -fromMinorUnits(card.costMinor),
      date: state.cashflowGame.virtualDate,
      time: '',
      category: '',
      comment: `${card.title}\n#cashflow`,
    });
    this.persistAll('cashflow_doodad', { title: card.title }, callbacks);
  }

  /** Returns the conflicting kind only when the existing project is clearly the other one — never blocks on missing/ambiguous legacy data. */
  private conflictingGrowKind(project: Grow, kind: 'share' | 'investment'): boolean {
    if (kind === 'share') return Boolean(project.investment?.tag) && !project.share?.tag;
    return Boolean(project.share?.tag) && !project.investment?.tag;
  }

  private existingMinor(amount: number | undefined): number | null {
    return amount === undefined ? null : toMinorUnits(amount);
  }

  private upsertEntity<T extends { tag: string }>(
    list: T[],
    tag: string,
    build: (existing: T | undefined) => T,
  ): void {
    const index = list.findIndex((item) => item.tag === tag);
    const next = build(index >= 0 ? list[index] : undefined);
    if (index >= 0) list.splice(index, 1, next);
    else list.push(next);
  }

  private upsertGrowProject(title: string, existing: Grow | undefined, patch: Partial<Grow>): void {
    const state = AppStateService.instance;
    if (existing) {
      Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
      return;
    }
    const now = new Date().toISOString();
    const project: Grow = {
      title,
      sub: '',
      phase: 'execute',
      description: '',
      strategy: '',
      riskScore: 0,
      risks: '',
      links: [],
      actionItems: [],
      notes: [],
      cashflow: 0,
      amount: 0,
      isAsset: false,
      share: null as any,
      investment: null as any,
      liabilitie: null as any,
      createdAt: now,
      updatedAt: now,
      type: 'income-growth',
      ...patch,
    };
    state.allGrowProjects.push(project);
  }

  private currentGameSet(): CashflowGameSet | undefined {
    const { gameSetId } = AppStateService.instance.cashflowGame;
    return gameSetId ? this.gameSets.find((set) => set.id === gameSetId) : undefined;
  }

  private currentProfession(): CashflowProfession | undefined {
    const { professionId } = AppStateService.instance.cashflowGame;
    if (!professionId) return undefined;
    return this.currentGameSet()?.professions.find((profession) => profession.id === professionId);
  }

  /** Creates or updates a Subscription by title — the "recomputed every time, never hand-edited" pattern Baby/Bank loan both use. */
  private upsertSubscription(upsert: CashflowStarterKitSubscription): void {
    const subscriptions = AppStateService.instance.allSubscriptions;
    const existing = subscriptions.find((sub) => sub.title === upsert.title);
    const amount = fromMinorUnits(upsert.amountMinor);
    if (existing) {
      existing.account = upsert.account;
      existing.amount = amount;
      existing.frequency = upsert.frequency;
      if (!existing.comment.includes('#cashflow')) {
        existing.comment = existing.comment ? `${existing.comment}\n#cashflow` : '#cashflow';
      }
    } else {
      subscriptions.push({
        title: upsert.title,
        account: upsert.account,
        amount,
        startDate: todayIso(),
        endDate: '',
        category: upsert.category ?? '',
        comment: upsert.comment ? `${upsert.comment}\n#cashflow` : '#cashflow',
        frequency: upsert.frequency,
      });
    }
  }

  /** Public: also used by `add.component.ts`'s Sell Investment handling to drop a closed position's cashflow Subscription (`grow_guide`'s sell action has no way to know it exists). */
  removeSubscriptionByTitle(title: string): void {
    const subscriptions = AppStateService.instance.allSubscriptions;
    const index = subscriptions.findIndex((sub) => sub.title === title);
    if (index >= 0) subscriptions.splice(index, 1);
  }

  private upsertLiability(tag: string, amountMinor: number, isInvestment = false): void {
    const liabilities = AppStateService.instance.liabilities;
    const existing = liabilities.find((liability) => liability.tag === tag);
    const amount = fromMinorUnits(amountMinor);
    if (existing) {
      existing.amount = amount;
    } else {
      liabilities.push({ tag, amount, investment: isInvestment, credit: 0 });
    }
  }

  private removeLiabilityByTag(tag: string): void {
    const liabilities = AppStateService.instance.liabilities;
    const index = liabilities.findIndex((liability) => liability.tag === tag);
    if (index >= 0) liabilities.splice(index, 1);
  }

  private gameSubscriptions(): CashflowGameSubscription[] {
    return AppStateService.instance.allSubscriptions.map((sub) => ({
      title: sub.title,
      account: sub.account,
      amountMinor: toMinorUnits(sub.amount),
      category: sub.category,
      comment: sub.comment,
    }));
  }

  /** Removes exactly the transactions a Payday created, one match per record — never a blanket filter. */
  private removeCreatedTransactions(records: CashflowTransactionRecord[]): void {
    const transactions = AppStateService.instance.allTransactions;
    for (const record of records) {
      const amount = fromMinorUnits(record.amountMinor);
      const index = transactions.findIndex(
        (t) =>
          t.account === record.account &&
          t.amount === amount &&
          t.date === record.date &&
          t.time === record.time &&
          t.category === record.category &&
          t.comment === record.comment,
      );
      if (index >= 0) transactions.splice(index, 1);
    }
  }

  private persistAll(
    logEvent: string,
    logMetadata: Record<string, unknown>,
    callbacks: CashflowGameCallbacks,
    options: {
      includeSubscriptions?: boolean;
      includeBalanceSheet?: boolean;
      includeGrow?: boolean;
    } = {},
  ): void {
    const state = AppStateService.instance;
    this.incomeStatement.recalculate();
    state.isSaving = true;

    const writes: { tag: string; data: unknown }[] = [
      { tag: 'transactions', data: state.allTransactions },
      { tag: 'cashflowGame', data: state.cashflowGame },
      ...this.incomeStatement.getWrites(),
      ...(options.includeSubscriptions
        ? [{ tag: 'subscriptions', data: state.allSubscriptions }]
        : []),
      ...(options.includeBalanceSheet
        ? [
            { tag: 'balance/asset/assets', data: state.allAssets },
            { tag: 'balance/asset/shares', data: state.allShares },
            { tag: 'balance/asset/investments', data: state.allInvestments },
            { tag: 'balance/liabilities', data: state.liabilities },
          ]
        : []),
      ...(options.includeGrow ? [{ tag: 'grow', data: state.allGrowProjects }] : []),
    ];
    const localStorageSaves: { key: string; data: unknown }[] = [
      { key: 'transactions', data: state.allTransactions },
      { key: 'cashflowGame', data: state.cashflowGame },
      ...(options.includeSubscriptions
        ? [{ key: 'subscriptions', data: state.allSubscriptions }]
        : []),
      ...(options.includeBalanceSheet
        ? [
            { key: 'assets', data: state.allAssets },
            { key: 'shares', data: state.allShares },
            { key: 'investments', data: state.allInvestments },
            { key: 'liabilities', data: state.liabilities },
          ]
        : []),
      ...(options.includeGrow ? [{ key: 'grow', data: state.allGrowProjects }] : []),
    ];

    this.persistence.batchWriteAndSync({
      writes,
      localStorageSaves,
      logEvent,
      logMetadata,
      onSuccess: () => {
        state.isSaving = false;
        this.incomeStatement.saveToLocalStorage();
        callbacks.onSuccess();
      },
      onError: (error: any) => {
        state.isSaving = false;
        callbacks.onError(error?.message || 'Database write failed');
      },
    });
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
