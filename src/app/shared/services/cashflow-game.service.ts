import { Injectable } from '@angular/core';
import {
  adjustCashflowBankLoan,
  CASHFLOW_GAME_SETS,
  CashflowGameSet,
  CashflowGameSubscription,
  CashflowProfession,
  CashflowStarterKitSubscription,
  CashflowTransactionRecord,
  fromMinorUnits,
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

export interface CashflowGameCallbacks {
  onSuccess: () => void;
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
    const state = AppStateService.instance;
    const gameSet = this.currentGameSet();
    if (!gameSet) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    const currentPrincipalMinor = toMinorUnits(
      state.liabilities.find((liability) => liability.tag === 'Bank loan')?.amount ?? 0,
    );
    let result: ReturnType<typeof adjustCashflowBankLoan>;
    try {
      result = adjustCashflowBankLoan(
        state.cashflowGame,
        gameSet,
        currentPrincipalMinor,
        toMinorUnits(delta),
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not adjust the bank loan.'));
      return;
    }
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
    this.persistAll('cashflow_bank_loan', { delta }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
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

  private removeSubscriptionByTitle(title: string): void {
    const subscriptions = AppStateService.instance.allSubscriptions;
    const index = subscriptions.findIndex((sub) => sub.title === title);
    if (index >= 0) subscriptions.splice(index, 1);
  }

  private upsertLiability(tag: string, amountMinor: number): void {
    const liabilities = AppStateService.instance.liabilities;
    const existing = liabilities.find((liability) => liability.tag === tag);
    const amount = fromMinorUnits(amountMinor);
    if (existing) {
      existing.amount = amount;
    } else {
      liabilities.push({ tag, amount, investment: false, credit: 0 });
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
    options: { includeSubscriptions?: boolean; includeBalanceSheet?: boolean } = {},
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
