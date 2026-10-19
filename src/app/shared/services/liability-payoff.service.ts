import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { fromMinorUnits } from '@money/domain';
import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { ConfirmService } from './confirm.service';
import { RemoteGameHook } from './remote-game';
import { ToastService } from './toast.service';

/**
 * Paying a starting debt (the home mortgage, a car loan, a credit card debt, a student loan) off in ONE payment of the full amount
 * (JFK, 2026-10-19), from the Balance sheet's info panel and the game dashboard. It says first what it does: the monthly expense that
 * ends and the cashflow after it - and, short of cash, how much has to be borrowed (it rarely makes sense, but it is allowed) - and it
 * refuses what would put the player into bankruptcy. Solo games book it here (one Undo step); at a table it is a move for the server.
 */
@Injectable({ providedIn: 'root' })
export class LiabilityPayoffService {
  constructor(
    private game: CashflowGameService,
    private confirm: ConfirmService,
    private toast: ToastService,
    private translate: TranslateService,
  ) {}

  /** Whether a liability of the game can be paid off this way (the Bank loan is repaid in steps, a property's mortgage with it). */
  canPayOff(tag: string, isInvestment: boolean): boolean {
    return CashflowGameService.isCashflowGame() && !isInvestment && tag !== 'Bank loan';
  }

  start(tag: string): void {
    const remote = RemoteGameHook.current;
    if (remote?.viewOnly()) return;
    const plan = this.game.payoffPlan(tag);
    if (!plan.ok) {
      this.toast.show(plan.reason ?? this.translate.instant('CashflowGame.payoffTitle'), 'error');
      return;
    }
    const money = (minor: number) =>
      `${fromMinorUnits(minor).toLocaleString()} ${AppStateService.instance.currency}`;
    const t = (key: string, params: Record<string, unknown>) =>
      this.translate.instant(`CashflowGame.${key}`, params);
    const lines = [
      t('payoffConfirm', {
        tag,
        amount: money(plan.amountMinor),
        expense: plan.freedMonthlyMinor
          ? money(plan.freedMonthlyMinor)
          : this.translate.instant('CashflowGame.payoffNoExpense'),
        before: money(plan.cashflowBeforeMinor),
        after: money(plan.cashflowAfterMinor),
      }),
    ];
    if (plan.borrowMinor > 0) {
      lines.push(
        t('payoffBorrow', {
          cash: money(Math.max(0, plan.cashMinor)),
          borrow: money(plan.borrowMinor),
        }),
      );
    }
    this.confirm.confirm(
      lines.join('\n\n'),
      () => this.pay(tag),
      this.translate.instant('CashflowGame.payoffTitle'),
      'primary',
    );
  }

  private pay(tag: string): void {
    const remote = RemoteGameHook.current;
    const done = () =>
      this.toast.show(this.translate.instant('CashflowGame.payoffDone', { tag }), 'success');
    if (remote) {
      void remote.payLiability(tag).then((outcome) => {
        if (outcome.ok) done();
        else this.toast.show(outcome.message ?? 'The move did not go through.', 'error');
      });
      return;
    }
    this.game.payOffLiability(tag, {
      onSuccess: done,
      onError: (message) => this.toast.show(message, 'error'),
    });
  }
}
