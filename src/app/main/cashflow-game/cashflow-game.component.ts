import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowMarketCard,
  CashflowProfession,
  computeCashflowProfessionMonthlyCashflowMinor,
  fromMinorUnits,
} from '@money/domain';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { AppDataService } from 'src/app/shared/services/app-data.service';
import { CashflowGameService } from 'src/app/shared/services/cashflow-game.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * The Cashflow (board game) companion — see todo/cashflow-game.md decision
 * 18. An always-hosted overlay panel (same pattern as Add/Info/Menu), not a
 * routed page — "not the main place to play the game" (JFK, 2026-09-26).
 * Only reachable for an account whose email contains "cashflow"
 * (CashflowGameService.isCashflowGame()); the menu only shows the trigger to
 * open it for such an account, and `ngOnInit` refuses to load any data for
 * anyone else as a defensive backstop.
 */
@Component({
  selector: 'app-cashflow-game',
  standalone: true,
  imports: [
    TrapFocusDirective,
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    AppNumberPipe,
    AppDatePipe,
  ],
  templateUrl: './cashflow-game.component.html',
  styleUrls: ['./cashflow-game.component.css'],
})
export class CashflowGameComponent implements OnInit {
  static isOpen = false;
  static zIndex = 0;
  public classReference = CashflowGameComponent;

  public appState = AppStateService.instance;
  public gameSets = this.cashflowGameService.gameSets;

  selectedGameSetId = this.playableGameSets[0]?.id ?? '';
  selectedProfessionId = '';
  isBusy = false;
  loanIncrements = 1;

  /** The full profession card, shown at selection time and reopenable during the game (todo/cashflow-game.md decision 18). */
  viewedProfession: CashflowProfession | null = null;

  // A Deal card — resolved through the app's own Grow feature, not a new
  // purchase system (todo/cashflow-game.md decision 10).
  dealKind: 'share' | 'investment' = 'share';
  dealTitle = '';
  dealQuantity: number | null = null;
  dealPrice: number | null = null;
  dealDeposit: number | null = null;
  dealMortgage: number | null = null;
  dealCashflow: number | null = null;

  // Bringing a card into play, two ways (todo/cashflow-game.md decision 16):
  // find one you drew from a real physical deck, or have the app draw one.
  activeDeckKind: CashflowDeckKind = 'dealSmall';
  cardQuery = '';
  activeCard: CashflowDealCard | CashflowMarketCard | CashflowDoodadCard | null = null;

  constructor(
    private router: Router,
    private appData: AppDataService,
    private cashflowGameService: CashflowGameService,
    private toastService: ToastService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    if (!CashflowGameService.isCashflowGame()) return;
    this.appData.loadCashflowGameData();
    this.selectedProfessionId = this.selectedGameSet?.professions[0]?.id ?? '';
  }

  /** Bumps this panel above every other panel, same convention as Add/Info/Menu. */
  highlight(): void {
    CashflowGameComponent.zIndex = CashflowGameComponent.zIndex + 1;
  }

  closeWindow(): void {
    CashflowGameComponent.isOpen = false;
    CashflowGameComponent.zIndex = 0;
    this.viewedProfession = null;
  }

  /**
   * The `placeholder` game set (`packages/domain/src/cashflow-game/game-sets.ts`) is a test fixture only —
   * obviously-fake numbers kept around so engine/service tests stay decoupled from JFK's real, still-growing card
   * data (todo/cashflow-game.md decision 6). A player must never be able to pick it or see "Placeholder
   * profession" in this panel.
   */
  get playableGameSets() {
    return this.gameSets.filter((set) => set.id !== 'placeholder');
  }

  get selectedGameSet() {
    return this.gameSets.find((set) => set.id === this.selectedGameSetId);
  }

  get selectedProfession(): CashflowProfession | undefined {
    return this.selectedGameSet?.professions.find(
      (profession) => profession.id === this.selectedProfessionId,
    );
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

  get cash(): number {
    return this.cashflowGameService.cash;
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

  /** What you need in hand right now for the deal as entered — the deposit for a property, the full price for shares. */
  get dealCost(): number {
    if (this.dealKind === 'share') return (this.dealQuantity ?? 0) * (this.dealPrice ?? 0);
    return this.dealDeposit ?? 0;
  }

  get dealShortfall(): number {
    return Math.max(0, this.dealCost - this.cash);
  }

  get canSubmitDeal(): boolean {
    if (!this.dealTitle.trim()) return false;
    return this.dealKind === 'share'
      ? Boolean(this.dealQuantity) && Boolean(this.dealPrice)
      : this.dealDeposit !== null && this.dealMortgage !== null && this.dealCashflow !== null;
  }

  /** The loss condition JFK described 2026-09-26: once this goes negative, every future Payday drains cash. */
  get monthlyCashflow(): number {
    return this.cashflowGameService.monthlyCashflow;
  }

  /** `cashflowGame`'s history is stored in minor units (decision 6); the template displays decimal. */
  toDisplayAmount(amountMinor: number): number {
    return fromMinorUnits(amountMinor);
  }

  /** Sum of every "Ausgaben" line on the card — shown as its own figure alongside the itemized list. */
  professionTotalExpenses(profession: CashflowProfession): number {
    return fromMinorUnits(profession.expenses.reduce((sum, line) => sum + line.amountMinor, 0));
  }

  /** Salary minus total expenses — what the starting-cash rule adds once (JFK, 2026-09-26). */
  professionMonthlyCashflow(profession: CashflowProfession): number {
    return fromMinorUnits(computeCashflowProfessionMonthlyCashflowMinor(profession));
  }

  /** Ersparnisse + one month's cashflow — the computed starting-cash figure shown on the profession card. */
  professionStartingCash(profession: CashflowProfession): number {
    return fromMinorUnits(
      profession.savingsMinor + computeCashflowProfessionMonthlyCashflowMinor(profession),
    );
  }

  /** "you can also just take one and it would be very nice to also see the attributes" (JFK, 2026-09-26). */
  openProfessionCard(profession: CashflowProfession): void {
    this.viewedProfession = profession;
  }

  closeProfessionCard(): void {
    this.viewedProfession = null;
  }

  /** "you pick one of the professions, or you shuffle for a profession" (JFK, 2026-09-26). */
  shuffleProfession(): void {
    const professions = this.selectedGameSet?.professions ?? [];
    if (!professions.length) return;
    const pick = professions[Math.floor(Math.random() * professions.length)];
    this.selectedProfessionId = pick.id;
    this.viewedProfession = pick;
  }

  startGame(): void {
    if (!this.selectedGameSetId || !this.selectedProfessionId) return;
    this.isBusy = true;
    this.cashflowGameService.pickProfession(this.selectedGameSetId, this.selectedProfessionId, {
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.started'), 'success');
        this.closeWindow();
        this.router.navigate(['/home']);
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

  get plannedDeals() {
    return this.cashflowGameService.plannedDeals;
  }

  get isDealDeck(): boolean {
    return this.activeDeckKind === 'dealSmall' || this.activeDeckKind === 'dealBig';
  }

  get cardSearchResults(): (CashflowDealCard | CashflowMarketCard | CashflowDoodadCard)[] {
    if (!this.cardQuery.trim()) return [];
    return this.cashflowGameService.findCardsInDeck(this.activeDeckKind, this.cardQuery);
  }

  changeDeck(): void {
    this.activeCard = null;
    this.cardQuery = '';
  }

  selectCard(card: CashflowDealCard | CashflowMarketCard | CashflowDoodadCard): void {
    this.activeCard = card;
    this.cardQuery = '';
  }

  clearActiveCard(): void {
    this.activeCard = null;
  }

  /** "In this app we pick randomly a card" (JFK, 2026-09-26) — no physical deck needed. */
  drawActiveCard(): void {
    this.isBusy = true;
    this.cashflowGameService.drawCard(this.activeDeckKind, {
      onSuccess: (card) => {
        this.isBusy = false;
        this.activeCard = card;
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  /** Deal: plans it. Doodad: pays its cost now. Market: nothing to apply — see CASHFLOW_GAME_GUIDE.md §4/§6. */
  applyActiveCard(): void {
    if (!this.activeCard) return;
    const callbacks = {
      onSuccess: () => {
        this.isBusy = false;
        this.activeCard = null;
        this.toastService.show(this.translate.instant('CashflowGame.cardApplied'), 'success');
      },
      onError: (message: string) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    };
    this.isBusy = true;
    if (this.isDealDeck) {
      this.cashflowGameService.applyDealCard(this.activeCard as CashflowDealCard, callbacks);
    } else if (this.activeDeckKind === 'doodad') {
      this.cashflowGameService.applyDoodadCard(this.activeCard as CashflowDoodadCard, callbacks);
    } else {
      this.isBusy = false;
    }
  }

  /** Saves the deal's numbers as a Grow project's plan — no money moves yet (todo/cashflow-game.md decision 12). */
  submitDeal(): void {
    if (!this.canSubmitDeal) return;
    const input =
      this.dealKind === 'share'
        ? {
            kind: 'share' as const,
            title: this.dealTitle.trim(),
            quantity: this.dealQuantity as number,
            price: this.dealPrice as number,
          }
        : {
            kind: 'investment' as const,
            title: this.dealTitle.trim(),
            deposit: this.dealDeposit as number,
            mortgage: this.dealMortgage as number,
            cashflow: this.dealCashflow as number,
          };
    this.isBusy = true;
    this.cashflowGameService.planDeal(input, {
      onSuccess: () => {
        this.isBusy = false;
        this.dealTitle = '';
        this.dealQuantity = null;
        this.dealPrice = null;
        this.dealDeposit = null;
        this.dealMortgage = null;
        this.dealCashflow = null;
        this.toastService.show(this.translate.instant('CashflowGame.dealPlanned'), 'success');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  /** "You have the option" (JFK, 2026-09-26) — buys a planned deal, auto-borrowing any shortfall. */
  executeDeal(title: string): void {
    this.isBusy = true;
    this.cashflowGameService.executeDeal(title, {
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.dealDone'), 'success');
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
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
