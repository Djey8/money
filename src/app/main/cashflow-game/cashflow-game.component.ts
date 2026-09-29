import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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

// Deferred import to break the circular chain with AppComponent, same pattern as every other panel.
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

/**
 * The Cashflow (board game) companion — see todo/cashflow-game.md decision
 * 18. An always-hosted overlay panel (same pattern as Add/Info/Menu), not a
 * routed page — "not the main place to play the game" (JFK, 2026-09-26).
 * Only reachable for an account whose email contains "cashflow"
 * (CashflowGameService.isCashflowGame()). Because it's now hosted eagerly at
 * app bootstrap (like every other panel) rather than created when a route
 * activates, its constructor can run before login/profile data has loaded —
 * so nothing here may depend on `isCashflowGame()` being accurate at
 * construction time. Defaults that don't need auth (game-set/profession
 * pre-selection) are plain field initializers; the one thing that does need
 * auth (loading the persisted game state) is deferred to `open()`, called
 * only once the player actually clicks the menu entry — by which point the
 * menu's own `*ngIf="isCashflowGame()"` has already re-evaluated correctly.
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
export class CashflowGameComponent {
  static isOpen = false;
  static zIndex = 0;
  static instance: CashflowGameComponent;
  public classReference = CashflowGameComponent;

  public appState = AppStateService.instance;
  public gameSets = this.cashflowGameService.gameSets;

  selectedGameSetId = this.playableGameSets[0]?.id ?? '';
  selectedProfessionId = this.selectedGameSet?.professions[0]?.id ?? '';
  isBusy = false;
  loanIncrements = 1;

  /** The full profession card, shown at selection time and reopenable during the game (todo/cashflow-game.md decision 18). */
  viewedProfession: CashflowProfession | null = null;

  // Bringing a card into play, two ways (todo/cashflow-game.md decision 16):
  // find one you drew from a real physical deck, or have the app draw one.
  activeDeckKind: CashflowDeckKind = 'dealSmall';
  cardQuery = '';
  activeCard: CashflowDealCard | CashflowMarketCard | CashflowDoodadCard | null = null;

  /**
   * Which focused sub-view the active-game dashboard shows (JFK, 2026-09-26: "when you click one then the panel
   * cleans from the current view and only shows this the selection of dealing the card"). `'main'` is the normal
   * dashboard (stats, the space grid, planned deals, bank loan, history); `'dealPile'`, `'cards'`, `'bankLoan'`
   * and `'payLoan'` each hide everything else and show only that step, with a way back.
   */
  dashboardView: 'main' | 'dealPile' | 'cards' | 'bankLoan' | 'payLoan' = 'main';

  /** The find-a-specific-card UI starts collapsed — Draw is the primary action, find is secondary (JFK, 2026-09-26). */
  showCardFind = false;

  constructor(
    private router: Router,
    private appData: AppDataService,
    private cashflowGameService: CashflowGameService,
    private toastService: ToastService,
    private translate: TranslateService,
  ) {
    CashflowGameComponent.instance = this;
  }

  /** Opens the panel and loads the persisted game state — called from the menu entry, by which point login has definitely finished (unlike this component's own construction, which happens at app bootstrap). */
  static open(): void {
    if (!CashflowGameService.isCashflowGame()) return;
    CashflowGameComponent.isOpen = true;
    CashflowGameComponent.instance?.appData.loadCashflowGameData();
  }

  /** Bumps this panel above every other panel, same convention as Add/Info/Menu. */
  highlight(): void {
    CashflowGameComponent.zIndex = CashflowGameComponent.zIndex + 1;
  }

  closeWindow(): void {
    CashflowGameComponent.isOpen = false;
    CashflowGameComponent.zIndex = 0;
    this.viewedProfession = null;
    this.dashboardView = 'main';
  }

  /** Leaves a focused sub-view (Deal pile choice, or the Cards find/draw flow) back to the main dashboard. */
  backToMain(): void {
    this.dashboardView = 'main';
    this.activeCard = null;
    this.cardQuery = '';
    this.showCardFind = false;
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

  /** A profession always starts with zero passive income — no investments owned yet (2026-09-29). */
  readonly professionStartingPassive = 0;

  /**
   * Live Income Statement/Balance Sheet — the same shape as the printed starting card, but read from the actual
   * running game, since the player's numbers move as they play (JFK, 2026-09-26: "on a live game you can have
   * more Incomes or more expenses and maybe you payed back some Liabilities... so the live data from the current
   * game"). Only meaningful once a game is running.
   */

  /** The Salary subscription's current amount — may differ from the printed card if the player edited its category/amount (decision 16), which is allowed and persists. */
  get liveSalary(): number {
    const title = `${this.currentProfession?.title} Salary`;
    return this.appState.allSubscriptions.find((sub) => sub.title === title)?.amount ?? 0;
  }

  /** Property (investment-kind) Grow project cashflow only — shares/trading are a liquidity tool here, not passive income (decision 10/11). */
  get livePassiveIncome(): number {
    return this.appState.allGrowProjects
      .filter((project) => project.investment?.tag)
      .reduce((sum, project) => sum + (project.cashflow ?? 0), 0);
  }

  get liveTotalIncome(): number {
    return this.liveSalary + this.livePassiveIncome;
  }

  /** Every current game expense subscription, itemized — mirrors the profession card's own expense lines, live. */
  get liveExpenseLines(): { title: string; amount: number }[] {
    const gameTitles = this.appState.cashflowGame.gameSubscriptionTitles;
    return this.appState.allSubscriptions
      .filter((sub) => gameTitles.includes(sub.title) && sub.amount < 0)
      .map((sub) => ({ title: sub.title, amount: sub.amount }));
  }

  get liveTotalExpenses(): number {
    return this.liveExpenseLines.reduce((sum, line) => sum + Math.abs(line.amount), 0);
  }

  get liveCashflow(): number {
    return this.liveTotalIncome - this.liveTotalExpenses;
  }

  /** Every current liability — the whole account is the game (decision 2), no filtering needed. */
  get liveLiabilities() {
    return this.appState.liabilities;
  }

  /**
   * Which half of the profession card shows — never both stacked at once (JFK, 2026-09-29: "in a live game the
   * active view should be just the Current Game panel and we can add a switch to visualize the start data NOT
   * both at the same time"). Defaults to Live once a game exists; there's nothing to toggle before that.
   */
  professionCardView: 'start' | 'live' = 'start';

  /** "you can also just take one and it would be very nice to also see the attributes" (JFK, 2026-09-26). */
  openProfessionCard(profession: CashflowProfession): void {
    this.viewedProfession = profession;
    this.professionCardView = this.hasActiveGame ? 'live' : 'start';
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
    this.openProfessionCard(pick);
  }

  startGame(): void {
    if (!this.selectedGameSetId || !this.selectedProfessionId) return;
    this.isBusy = true;
    this.cashflowGameService.pickProfession(this.selectedGameSetId, this.selectedProfessionId, {
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.started'), 'success');
        this.closeWindow();
        // A plain router.navigate — no reload needed. Home and the other pages that hold their own
        // snapshot subscribe to transactionsUpdated$/subscriptionsUpdated$ (fired by
        // CashflowGameService.persistAll on every successful write), so they refresh whether or not
        // this navigation itself is a no-op (e.g. already being on /home).
        this.router.navigate(['/home']);
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  /** A short hop out to the app's own hamburger menu, instead of duplicating a list of links here. */
  openMenu(): void {
    this.closeWindow();
    AppComponent?.openNavBar();
  }

  /** The main, repeated-every-round Payday button — stays open for quickly running several rounds in a row. */
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

  /**
   * "Which space did you land on?" — companion mode (todo/cashflow-game.md decision 8). Baby/Charity/Downsized
   * apply immediately and close the panel (Payday itself is the main button above, not repeated here — decision
   * 38); the card spaces (Deals/Doodad/Market) below need the player to say which card they got first, so they
   * open a focused sub-view instead (JFK, 2026-09-26).
   */
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

  /** Green "Deals" space — the physical board doesn't distinguish Small/Big, so ask which pile first. */
  landOnDeals(): void {
    this.dashboardView = 'dealPile';
  }

  /** Small/Big Deal are the same green space on the board — the player says which pile they drew from. */
  chooseDealPile(kind: 'dealSmall' | 'dealBig'): void {
    this.activeDeckKind = kind;
    this.changeDeck();
    this.dashboardView = 'cards';
  }

  /** Red "Schnickschnack" space. */
  landOnDoodad(): void {
    this.activeDeckKind = 'doodad';
    this.changeDeck();
    this.dashboardView = 'cards';
  }

  /** Blue "Der Markt" space. */
  landOnMarket(): void {
    this.activeDeckKind = 'market';
    this.changeDeck();
    this.dashboardView = 'cards';
  }

  /** The active deck's translated name, next to the Cards section heading — the deck picker is now the space buttons above, not a separate dropdown. */
  get activeDeckLabel(): string {
    const key: Record<CashflowDeckKind, string> = {
      dealSmall: 'CashflowGame.deckDealSmall',
      dealBig: 'CashflowGame.deckDealBig',
      market: 'CashflowGame.deckMarket',
      doodad: 'CashflowGame.deckDoodad',
    };
    return this.translate.instant(key[this.activeDeckKind]);
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
        this.toastService.show(this.translate.instant('CashflowGame.cardApplied'), 'success');
        this.backToMain();
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

  /** Bank Loan and Payback Loan are each hidden behind their own trigger, with a Back button, like Deal pile/Cards (JFK, 2026-09-29). */
  openBankLoan(): void {
    this.dashboardView = 'bankLoan';
  }

  /** Only reachable once there's actually a loan to pay back — the trigger button itself is `*ngIf`'d on that. */
  openPayLoan(): void {
    this.dashboardView = 'payLoan';
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
        this.backToMain();
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
        this.closeWindow();
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }
}
