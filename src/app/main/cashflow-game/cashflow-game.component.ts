import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { fromMinorUnits } from '@money/domain';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { AppDataService } from 'src/app/shared/services/app-data.service';
import { CashflowGameService } from 'src/app/shared/services/cashflow-game.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';

// Deferred import to break the circular chain with AppComponent, same
// pattern as every other main/ page (e.g. home.component.ts).
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

/**
 * The Cashflow (board game) dashboard — see todo/cashflow-game.md. Only
 * reachable for an account whose email contains "cashflow"
 * (CashflowGameService.isCashflowGame()); the route itself is still
 * reachable by URL for anyone, so this page checks and redirects rather
 * than relying on the menu simply not showing a link.
 */
@Component({
  selector: 'app-cashflow-game',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe, AppDatePipe],
  templateUrl: './cashflow-game.component.html',
  styleUrls: ['./cashflow-game.component.css', '../../app.component.css'],
})
export class CashflowGameComponent implements OnInit {
  public get appReference() {
    return AppComponent;
  }
  public appState = AppStateService.instance;
  public gameSets = this.cashflowGameService.gameSets;

  selectedGameSetId = this.gameSets[0]?.id ?? '';
  selectedProfessionId = '';
  isBusy = false;
  loanIncrements = 1;

  constructor(
    private router: Router,
    private appData: AppDataService,
    private cashflowGameService: CashflowGameService,
    private toastService: ToastService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    if (!CashflowGameService.isCashflowGame()) {
      this.router.navigate(['/home']);
      return;
    }
    this.appData.loadCashflowGameData();
    this.selectedProfessionId = this.selectedGameSet?.professions[0]?.id ?? '';
  }

  get selectedGameSet() {
    return this.gameSets.find((set) => set.id === this.selectedGameSetId);
  }

  get hasActiveGame(): boolean {
    return this.appState.cashflowGame.professionId !== null;
  }

  get currentProfession() {
    const game = this.appState.cashflowGame;
    if (!game.gameSetId || !game.professionId) return undefined;
    return this.gameSets
      .find((set) => set.id === game.gameSetId)
      ?.professions.find((profession) => profession.id === game.professionId);
  }

  /**
   * Total cash on hand: the same Daily+Splurge+Smile+Fire total
   * `HomeComponent.getAmounts()` shows (each account's own transactions plus
   * its ratio-share of Income) — ratio-independent since the four shares of
   * an Income transaction always sum back to its full amount, so this is
   * accurate whatever the account's allocation setting is.
   */
  get cash(): number {
    const state = this.appState;
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

  get canUndo(): boolean {
    return this.appState.cashflowGame.history.length > 0;
  }

  get currentGameSet() {
    const { gameSetId } = this.appState.cashflowGame;
    return this.gameSets.find((set) => set.id === gameSetId);
  }

  get loanIncrementAmount(): number {
    return fromMinorUnits(this.currentGameSet?.loanRule.incrementMinor ?? 0);
  }

  get currentLoanPrincipal(): number {
    return (
      this.appState.liabilities.find((liability) => liability.tag === 'Bank loan')?.amount ?? 0
    );
  }

  get canLandOnBaby(): boolean {
    return this.appState.cashflowGame.children < 3;
  }

  /** The loss condition JFK described 2026-09-26: once this goes negative, every future Payday drains cash. */
  get monthlyCashflow(): number {
    return this.cashflowGameService.monthlyCashflow;
  }

  /** `cashflowGame`'s history is stored in minor units (decision 6); the template displays decimal. */
  toDisplayAmount(amountMinor: number): number {
    return fromMinorUnits(amountMinor);
  }

  startGame(): void {
    if (!this.selectedGameSetId || !this.selectedProfessionId) return;
    this.isBusy = true;
    this.cashflowGameService.pickProfession(this.selectedGameSetId, this.selectedProfessionId, {
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.started'), 'success');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  payday(): void {
    this.isBusy = true;
    this.cashflowGameService.payday({
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.paydayDone'), 'success');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  undoPayday(): void {
    this.isBusy = true;
    this.cashflowGameService.undoLastPayday({
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.undoDone'), 'update');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  /** "Which space did you land on?" — companion mode (todo/cashflow-game.md decision 8). */
  landOnBaby(): void {
    this.runAction((callbacks) => this.cashflowGameService.resolveBaby(callbacks), 'baby');
  }

  landOnCharity(): void {
    this.runAction((callbacks) => this.cashflowGameService.resolveCharity(callbacks), 'charity');
  }

  landOnDownsized(): void {
    this.runAction(
      (callbacks) => this.cashflowGameService.resolveDownsized(callbacks),
      'downsized',
    );
  }

  /** The player, not the app, knows when their own next turns have played out (todo/cashflow-game.md §4). */
  clearCharity(): void {
    this.dismissStatus('charity');
  }

  clearUnemployed(): void {
    this.dismissStatus('unemployed');
  }

  private dismissStatus(status: 'charity' | 'unemployed'): void {
    this.cashflowGameService.clearStatus(status, {
      onSuccess: () =>
        this.toastService.show(this.translate.instant('CashflowGame.dismiss'), 'update'),
      onError: (message) => this.toastService.show(message, 'error'),
    });
  }

  borrowLoan(): void {
    this.adjustLoan(this.loanIncrements * this.loanIncrementAmount);
  }

  repayLoan(): void {
    this.adjustLoan(
      -Math.min(this.loanIncrements * this.loanIncrementAmount, this.currentLoanPrincipal),
    );
  }

  private adjustLoan(delta: number): void {
    if (!delta) return;
    this.isBusy = true;
    this.cashflowGameService.adjustBankLoan(delta, {
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.loanUpdated'), 'success');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  private runAction(
    action: (callbacks: { onSuccess: () => void; onError: (message: string) => void }) => void,
    kind: 'baby' | 'charity' | 'downsized',
  ): void {
    this.isBusy = true;
    action({
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant(`CashflowGame.${kind}Done`), 'success');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }
}
