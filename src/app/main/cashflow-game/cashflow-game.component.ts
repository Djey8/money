import { AfterViewChecked, Component, OnDestroy } from '@angular/core';
import { CommonModule, formatNumber } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CashflowAssetDeal,
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowMarketCard,
  CashflowProfession,
  CashflowProfileTexts,
  computeCashflowProfessionMonthlyCashflowMinor,
  fromMinorUnits,
  maxRepayableMinor,
  buyerCardTypes,
  businessCardLabels,
  cardExpenseComment,
  doodadAccount,
  MARKET_COST_ACCOUNT,
  propertyCardTypes,
  moveToken,
  savedGameStatus,
  summarizeGameFinances,
  toMinorUnits,
  type SavedGameSummary,
  pickOne,
  type TurnResult,
  FREE_RULES,
  RULE_PRESETS,
  normalizeRules,
  rulesOf,
  whyCannotDraw,
  whyCannotReportRoll,
  whyCannotSkipCard,
  whyDiceFirst,
  type GameRules,
} from '@money/domain';
import { Grow } from 'src/app/interfaces/grow';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { AppDataService } from 'src/app/shared/services/app-data.service';
import {
  CashflowGameService,
  CashflowHistoryStep,
} from 'src/app/shared/services/cashflow-game.service';
import {
  CashflowCardText,
  CashflowCardTextService,
} from 'src/app/shared/services/cashflow-card-text.service';
import { CashflowCardPlanText } from 'src/app/shared/services/cashflow-game.service';
import { RemoteGameHook, type RemoteGame } from 'src/app/shared/services/remote-game';
import {
  GAME_LANGUAGES,
  AppLanguage,
  LanguageService,
} from 'src/app/shared/services/language.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { LocalService } from 'src/app/shared/services/local.service';
import { ConfirmService } from 'src/app/shared/services/confirm.service';
import { CashflowSavedGamesService } from 'src/app/shared/services/cashflow-saved-games.service';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { type ProfessionSheetNumbers } from './profession-sheets.component';
import { CharacterSheetComponent } from './character-sheet.component';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { RatRaceBoardComponent, SPACE_GLYPHS, type BoardToken } from './rat-race-board.component';
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
/** A compact, scannable summary of one card for the lookup grid. */
type CardKind = 'share' | 'investment' | 'asset';

interface CardTile {
  card: CashflowDealCard | CashflowMarketCard | CashflowDoodadCard;
  primary: string;
  secondary: string;
  value: string | null;
  range: string;
  /** Everything a search word may match: both labels and both names, lower case. */
  search: string;
  /** The price (or deposit) in whole units - a search word matches it from its start. */
  priceText: string;
}

/** How a market card is filed in the quick filter. */
type MarketKind = 'percent' | 'amount' | 'price' | 'cost' | 'split' | 'boost';

/** How long a card action may take before the spinner comes up (shorter waits just happen). */
const BUSY_SPINNER_MS = 250;

/** Where the account's own currency waits while the game plays in its own. */
const CURRENCY_BEFORE_KEY = 'currencyBeforeGame';

/** How long the big Payday popup stays before it steps aside for the small Latest line. */
const PAYDAY_POPUP_MS = 3500;

/** How long the token rests on each space while it walks, and how long a Payday flashes. */
const WALK_STEP_MS = 320;
/** The dice tumble, then rest on their number for a beat, before the token moves. */
const DICE_TUMBLE_MS = 1900;
/** The faces flicker fast at first and slow down as the dice come to rest. */
const DICE_FACE_FIRST_MS = 70;
const DICE_FACE_LAST_MS = 300;
const DICE_SETTLE_MS = 650;
const DICE_LAND_POP_MS = 900;
/** How long the die of a dice action (MLM ...) rests on its number before the result shows. */
const DICE_DECISION_REST_MS = 900;

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
    CharacterSheetComponent,
    AppDatePipe,
    RatRaceBoardComponent,
  ],
  templateUrl: './cashflow-game.component.html',
  styleUrls: ['./cashflow-game.component.css'],
})
export class CashflowGameComponent implements OnDestroy, AfterViewChecked {
  static isOpen = false;
  static zIndex = 0;
  static instance: CashflowGameComponent;
  public classReference = CashflowGameComponent;

  public appState = AppStateService.instance;
  public gameSets = this.cashflowGameService.gameSets;

  /** The custom edition is the default (JFK, 2026-10-25); the classic one is a switch away. */
  selectedGameSetId =
    (this.playableGameSets.find((set) => set.edition === 'custom') ?? this.playableGameSets[0])
      ?.id ?? '';
  selectedProfessionId = this.selectedGameSet?.professions[0]?.id ?? '';
  /**
   * A card action is under way (JFK, 2026-10-25: a press that shows nothing for a while is a press that gets pressed twice). Once the
   * wait is long enough to be noticed the app's spinner comes up over everything, so it is plain that the player has to wait - the
   * dice and the walking token show their own progress, so they keep the spinner away.
   */
  private busyFlag = false;
  private busyTimer: ReturnType<typeof setTimeout> | undefined;
  private busySpinnerShown = false;

  get isBusy(): boolean {
    return this.busyFlag;
  }

  set isBusy(busy: boolean) {
    this.busyFlag = busy;
    clearTimeout(this.busyTimer);
    if (busy) {
      this.busyTimer = setTimeout(() => this.raiseBusySpinner(), BUSY_SPINNER_MS);
    } else {
      this.dropBusySpinner();
    }
  }

  private raiseBusySpinner(): void {
    if (!this.busyFlag) return;
    if (this.walking || this.diceTumbling || this.decisionRolling) {
      // an animation is its own feedback: look again once it is over
      this.busyTimer = setTimeout(() => this.raiseBusySpinner(), BUSY_SPINNER_MS);
      return;
    }
    if (!this.appState.isSaving) {
      this.appState.isSaving = true;
      this.busySpinnerShown = true;
    }
  }

  private dropBusySpinner(): void {
    if (this.busySpinnerShown) this.appState.isSaving = false;
    this.busySpinnerShown = false;
  }
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
   * dashboard (stats, the space grid, planned deals, bank loan, history); `'dealPile'`, `'cards'`, `'bankLoan'`,
   * `'payLoan'` and `'history'` each hide everything else and show only that step, with a way back.
   */
  dashboardView:
    | 'main'
    | 'dealPile'
    | 'cards'
    | 'bankLoan'
    | 'payLoan'
    | 'history'
    | 'games'
    | 'confirmSpace'
    | 'table' = 'main';

  constructor(
    private router: Router,
    private appData: AppDataService,
    private cashflowGameService: CashflowGameService,
    private toastService: ToastService,
    private translate: TranslateService,
    private cardText: CashflowCardTextService,
    private language: LanguageService,
    readonly savedGames: CashflowSavedGamesService,
    private confirm: ConfirmService,
    private local: LocalService,
  ) {
    CashflowGameComponent.instance = this;
    // the game's money is Dream Taler or Traumtaler, whichever language the game speaks
    this.translate.onLangChange.subscribe((event) => this.applyGameCurrency(event.lang));
    document.addEventListener('click', this.onAnyClick, true);
    // the table layer floats its telling at the top only where the wheel is not there to hold it
    RemoteGameHook.ringVisible = () =>
      CashflowGameComponent.isOpen && this.dashboardView === 'main' && this.isSolo;
    // a card named in a message of the others or a line of the history opens here, to be read
    RemoteGameHook.openCard = (cardId) => {
      CashflowGameComponent.open();
      this.showHistoryCard(cardId);
    };
    // Paying a dice card (gold coins) brings the player here, to the decision.
    this.cashflowGameService.decisionNeeded$?.subscribe(() => this.showOpenDecision());
    // The game ended with a move (the winning buy made from Grow ...): the dashboard shows the result, the player need not look for it.
    this.cashflowGameService.gameEnded$?.subscribe(() => {
      CashflowGameComponent.open();
      this.backToMain();
    });
  }

  /** The lobby's entry of the route table (the self-hosted build only), or null: the link from the dashboard to Multiplayer. */
  get multiplayerLink(): { path: string; label: string } | null {
    const route = this.router.config.find((r) => r.path === 'tables' && r.data?.['gameMenu']);
    if (!route) return null;
    const entry = route.data!['gameMenu'] as { label: (lang: string) => string };
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return { path: `/${route.path}`, label: entry.label(lang) };
  }

  openMultiplayer(path: string): void {
    this.closeWindow();
    void this.router.navigate([path]);
  }

  /** Opens the game dashboard on its main view, where the open dice decision stands out. */
  showOpenDecision(): void {
    this.viewedProfession = null;
    this.choosingCharacter = false;
    this.activeCard = null;
    this.dashboardView = 'main';
    CashflowGameComponent.open();
    this.highlight();
  }

  /** Opens the panel and loads the persisted game state — called from the menu entry, by which point login has definitely finished (unlike this component's own construction, which happens at app bootstrap). */
  static open(): void {
    if (!CashflowGameService.isCashflowGame()) return;
    CashflowGameComponent.isOpen = true;
    CashflowGameComponent.instance?.appData.loadCashflowGameData();
    // The list of saved games is small and always shown on the start screen.
    CashflowGameComponent.instance?.savedGames.refresh().catch(() => undefined);
  }

  /** The list of saved games (solo and played with others), the same as the one in the solo game - for the multiplayer lobby. */
  static openGamesList(): void {
    CashflowGameComponent.open();
    const screen = CashflowGameComponent.instance;
    if (!screen) return;
    if (screen.hasActiveGame) screen.openGames();
    else screen.openStartGames();
  }

  /** Bumps this panel above every other panel, same convention as Add/Info/Menu. */
  highlight(): void {
    CashflowGameComponent.zIndex = CashflowGameComponent.zIndex + 1;
  }

  closeWindow(): void {
    this.showStartGames = false;
    this.rollResult = null;
    // A one-time message (e.g. a market card that did not apply) is gone once the panel is closed.
    this.marketNotice = null;
    this.pendingSpace = null;
    this.spaceData = null;
    this.choosingCharacter = false;
    CashflowGameComponent.isOpen = false;
    CashflowGameComponent.zIndex = 0;
    this.viewedProfession = null;
    this.dashboardView = 'main';
  }

  /**
   * The card that is open when the player acts on it, declines it or leaves the dialog is the one they saw: it goes into
   * the History with its exact id (JFK, 2026-10-07: browsing is not tracked, a card you looked at and passed on is). A
   * card drawn at random was recorded when it was drawn; the same card twice in a row adds nothing.
   */
  private recordOpenCard(): void {
    if (!this.activeCard) return;
    this.cashflowGameService.recordCardPicked(this.activeDeckKind, this.activeCard);
  }

  /** Leaves a focused sub-view (Deal pile choice, or the Cards find/draw flow) back to the main dashboard. */
  backToMain(): void {
    this.historyCardView = false;
    this.recordOpenCard();
    this.dashboardView = 'main';
    this.activeCard = null;
    this.showFriendSale = false;
    this.friendPrice = null;
    this.cardQuery = '';
  }

  /**
   * The `placeholder` game set (`packages/domain/src/cashflow-game/game-sets.ts`) is a test fixture only —
   * obviously-fake numbers kept around so engine/service tests stay decoupled from JFK's real, still-growing card
   * data (todo/cashflow-game.md decision 6). A player must never be able to pick it or see "Placeholder
   * profession" in this panel.
   */
  get playableGameSets() {
    // the classic cards and the custom edition: the other sets (a fixture, the test characters the table bots' champion book is built on) are not offered
    return this.gameSets.filter((set) => set.id === 'cashflow' || set.edition === 'custom');
  }

  get selectedGameSet() {
    return this.gameSets.find((set) => set.id === this.selectedGameSetId);
  }

  get selectedProfession(): CashflowProfession | undefined {
    return this.selectedGameSet?.professions.find(
      (profession) => profession.id === this.selectedProfessionId,
    );
  }

  /**
   * The panel opens wide on a big screen for the views that have something to show beside each other: the dashboard
   * (the ring beside the dice and the decision) and the card lists. Phones ignore it - there the panel is a full sheet.
   */
  get wideLayout(): boolean {
    return (
      this.hasActiveGame &&
      !this.viewedProfession &&
      (this.dashboardView === 'main' || this.dashboardView === 'cards')
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

  /** Whether there's any past action left to undo — not tied to Payday specifically (todo/cashflow-game.md decision 40). */
  get canUndo(): boolean {
    return this.cashflowGameService.canUndo;
  }

  get currentGameSet() {
    const { gameSetId } = this.appState.cashflowGame;
    return this.gameSets.find((set) => set.id === gameSetId);
  }

  /** The open card was picked from the History to be read again: no action of the game is offered with it. */
  historyCardView = false;

  /**
   * A card of the History is brought back on screen to read (JFK, 2026-10-17: cards go by quickly at the top, the History keeps
   * the id of each one): the card as it was dealt, with none of its buttons.
   */
  showHistoryCard(cardId: string): void {
    const decks = this.currentGameSet?.decks;
    if (!decks) return;
    for (const kind of ['dealSmall', 'dealBig', 'market', 'doodad'] as const) {
      const card = (decks[kind] as { id: string }[] | undefined)?.find((c) => c.id === cardId);
      if (!card) continue;
      this.activeDeckKind = kind;
      this.changeDeck();
      void this.cardText.ensureLoaded();
      this.historyCardView = true;
      this.activeCard = card as typeof this.activeCard;
      this.dashboardView = 'cards';
      return;
    }
  }

  /** What a card in the History was (a picked card, or the card a pass left), by its id. */
  cardLabelOf(cardId: string): string {
    const decks = this.currentGameSet?.decks;
    const card = [
      ...(decks?.dealSmall ?? []),
      ...(decks?.dealBig ?? []),
      ...(decks?.market ?? []),
      ...(decks?.doodad ?? []),
    ].find((candidate) => candidate.id === cardId) as
      { symbol?: string; title: string } | undefined;
    if (!card) return '';
    return (
      (card.symbol ? this.cardText.symbolFor(card.symbol) : undefined) ?? card.symbol ?? card.title
    );
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

  /** Sum of the card's starting liabilities (the Starting Scenario's Liabilities total). */
  professionTotalLiabilities(profession: CashflowProfession): number {
    return fromMinorUnits(
      (profession.starterKit.liabilities ?? []).reduce((sum, line) => sum + line.amountMinor, 0),
    );
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

  /**
   * The profession card's own printed content, live-translated into the currently-selected
   * language — safe to translate on the fly since this is static, never-user-edited reference data
   * from game-sets.ts, unlike the real Subscriptions/Transactions it seeds (todo/cashflow-game.md
   * decision 48, JFK 2026-09-29+: "can we have all of these values multi language? once you select
   * a different language everything is translated?").
   */
  professionTitle(profession: CashflowProfession): string {
    return this.cashflowGameService.translateProfessionTitle(profession);
  }

  expenseLineTitle(profession: CashflowProfession, line: { title: string; key?: string }): string {
    return this.cashflowGameService.translateExpenseLineTitle(profession, line);
  }

  liabilityTag(profession: CashflowProfession, liability: { tag: string; key?: string }): string {
    return this.cashflowGameService.translateLiabilityTag(profession, liability);
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
  /**
   * `pickProfession()` always builds `gameSubscriptionTitles` as
   * `[salaryTitle, ...expenseTitles]` and Baby/Bank-loan only ever append past that, so index 0 is
   * always the Salary Subscription's *actual stored* title — reconstructing it by hand
   * (`${profession.title} Salary`) broke the moment decision 48 made that title translated
   * (`{{profession}} Salary` in English, `{{profession}} Gehalt` in German, ...), since
   * `profession.title` itself is never translated and "Salary" was hardcoded English regardless of
   * language (JFK, 2026-09-30: "the Salary is not working its showing 0... the cashflow calculation
   * is not working").
   */
  get liveSalary(): number {
    return fromMinorUnits(this.liveFinances.salaryMinor);
  }

  /**
   * The game's monthly money picture, from the same domain function a saved game's summary and the Pro
   * API use - one definition of salary, passive income, expenses and "out of the rat race" for all three
   * (todo/cashflow-game-pro-inventory.md U1). Exact minor units, so a tie between passive income and
   * expenses is a tie and not a float-rounding coin toss.
   */
  private get liveFinances() {
    return summarizeGameFinances(
      this.appState.cashflowGame,
      this.appState.allSubscriptions.map((sub) => ({
        title: sub.title,
        amountMinor: toMinorUnits(sub.amount),
      })),
    );
  }

  /**
   * What each bought property / franchise pays every month - read from the game's `<name> Cashflow`
   * Subscriptions (JFK, 2026-10-03), so only deals actually bought count, not ones still being planned.
   * Shares/trading are a liquidity tool here, not passive income (decision 10/11).
   */
  get livePassiveIncomeLines(): { name: string; amount: number }[] {
    const gameTitles = this.appState.cashflowGame.gameSubscriptionTitles;
    return this.appState.allSubscriptions
      .filter(
        (sub) =>
          gameTitles.includes(sub.title) && sub.title.endsWith(' Cashflow') && sub.amount > 0,
      )
      .map((sub) => ({ name: sub.title.replace(/ Cashflow$/, ''), amount: sub.amount }));
  }

  get livePassiveIncome(): number {
    return fromMinorUnits(this.liveFinances.passiveIncomeMinor);
  }

  /** Cash plus everything listed under Assets. */
  get liveTotalAssets(): number {
    return this.cash + this.liveAssetLines.reduce((sum, line) => sum + line.amount, 0);
  }

  get liveTotalLiabilities(): number {
    return this.liveLiabilities.reduce((sum, liability) => sum + Number(liability.amount), 0);
  }

  /** Everything owned besides cash, by name: properties at their full cost (deposit + mortgage, so the mortgage liability balances), shares at quantity x latest price, and plain assets. */
  get liveAssetLines(): { name: string; amount: number }[] {
    const state = this.appState;
    return [
      ...state.allInvestments.map((investment) => ({
        name: investment.tag,
        amount: Number(investment.deposit) + Number(investment.amount),
      })),
      ...state.allShares.map((share) => ({
        name: `${share.tag} · ${share.quantity}`,
        amount: Number(share.quantity) * Number(share.price),
      })),
      ...state.allAssets.map((asset) => {
        const coins = (state.cashflowGame.assetDeals ?? []).find(
          (deal) => deal.title === asset.tag && deal.stage === 'owned',
        )?.coins;
        return {
          name: coins ? `${asset.tag} · ${coins}` : asset.tag,
          amount: Number(asset.amount),
        };
      }),
    ];
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
    return fromMinorUnits(this.liveFinances.expensesMinor);
  }

  /**
   * Out of the rat race (JFK, 2026-10-03): the passive income - what the bought properties and
   * businesses pay every month - covers every monthly expense. Shown as a banner; the game goes on.
   */
  get escapedRatRace(): boolean {
    return this.hasActiveGame && this.liveFinances.escapedRatRace;
  }

  get liveCashflow(): number {
    const finances = this.liveFinances;
    return fromMinorUnits(
      finances.salaryMinor + finances.passiveIncomeMinor - finances.expensesMinor,
    );
  }

  /** Every current liability — the whole account is the game (decision 2), no filtering needed. */
  get liveLiabilities() {
    return this.appState.liabilities;
  }

  /**
   * The numbers of the profession panel's three sheets (Cashflow, Income Statement, Balance Sheet), for the card's printed start or
   * the running game. One object per content, so the sheets are not drawn again on every check.
   */
  private sheetsCache: { key: string; value: ProfessionSheetNumbers } | null = null;

  get professionSheets(): ProfessionSheetNumbers | null {
    const profession = this.viewedProfession;
    if (!profession) return null;
    const value =
      this.professionCardView === 'live' && this.hasActiveGame
        ? this.liveSheets()
        : this.startSheets(profession);
    const key = JSON.stringify(value);
    if (this.sheetsCache?.key !== key) this.sheetsCache = { key, value };
    return this.sheetsCache.value;
  }

  private startSheets(profession: CashflowProfession): ProfessionSheetNumbers {
    const salary = this.toDisplayAmount(profession.salaryMinor);
    const expenses = this.professionTotalExpenses(profession);
    const liabilities = (profession.starterKit.liabilities ?? []).map((line) => ({
      name: this.liabilityTag(profession, line),
      amount: this.toDisplayAmount(line.amountMinor),
    }));
    const savings = this.toDisplayAmount(profession.savingsMinor);
    const kit = profession.starterKit;
    // what the character already owns besides the cash: shares at their price, plain assets
    const owned = [
      ...(kit.shares ?? []).map((share) => ({
        name: `${share.tag} · ${share.quantity}`,
        amount: this.toDisplayAmount(share.quantity * share.priceMinor),
      })),
      ...(kit.assets ?? []).map((asset) => ({
        name: asset.tag,
        amount: this.toDisplayAmount(asset.amountMinor),
      })),
    ];
    const assetsTotal = savings + owned.reduce((sum, line) => sum + line.amount, 0);
    return {
      cashIncome: salary,
      cashPassive: this.professionStartingPassive,
      cashExpenses: expenses,
      cashTotal: this.professionMonthlyCashflow(profession),
      revenue: [{ name: this.translate.instant('CashflowGame.salary'), amount: salary }],
      revenueTotal: salary,
      expenses: profession.expenses.map((line) => ({
        name: this.expenseLineTitle(profession, line),
        amount: this.toDisplayAmount(line.amountMinor),
      })),
      expensesTotal: expenses,
      assets: [{ name: this.translate.instant('CashflowGame.savings'), amount: savings }, ...owned],
      assetsTotal,
      liabilities,
      liabilitiesTotal: this.professionTotalLiabilities(profession),
    };
  }

  private liveSheets(): ProfessionSheetNumbers {
    const passive = this.livePassiveIncome;
    return {
      cashIncome: this.liveTotalIncome,
      cashPassive: passive,
      cashExpenses: this.liveTotalExpenses,
      cashTotal: this.liveCashflow,
      revenue: [
        { name: this.translate.instant('CashflowGame.salary'), amount: this.liveSalary },
        ...(passive
          ? [{ name: this.translate.instant('CashflowGame.passiveIncome'), amount: passive }]
          : []),
        ...this.livePassiveIncomeLines.map((line) => ({ ...line, sub: true })),
      ],
      revenueTotal: this.liveTotalIncome,
      expenses: this.liveExpenseLines.map((line) => ({ name: line.title, amount: line.amount })),
      expensesTotal: -this.liveTotalExpenses,
      assets: [
        { name: this.translate.instant('CashflowGame.cashOnHand'), amount: this.cash },
        ...this.liveAssetLines,
      ],
      assetsTotal: this.liveTotalAssets,
      liabilities: this.liveLiabilities.map((liability, index) => ({
        name: liability.tag,
        amount: Number(liability.amount),
        index,
      })),
      liabilitiesTotal: this.liveTotalLiabilities,
    };
  }

  private goalChecksCache: { key: string; value: Record<string, boolean> } | null = null;

  /** What of the winning list of the character is met in the running game (the dream follows with the project). */
  get goalChecks(): Record<string, boolean> {
    const open = (aliases: string[]) =>
      this.appState.liabilities.some(
        (liability) =>
          Number(liability.amount) > 0 &&
          aliases.some((alias) => alias.toLowerCase() === liability.tag.toLowerCase()),
      );
    const alias = (key: string, ...raw: string[]) => [
      ...raw,
      this.translate.instant(`CashflowGame.liabilityTag.${key}`),
    ];
    const value = {
      parentsLoan: !open(
        alias('parentsLoan', 'Eltern-Darlehen', 'Loan from parents', 'Darlehen der Eltern'),
      ),
      carLoan: !open(alias('carLoan', 'Autokredit', 'Car Loan')),
      dream: false,
      independence: this.escapedRatRace,
    };
    const key = JSON.stringify(value);
    if (this.goalChecksCache?.key !== key) this.goalChecksCache = { key, value };
    return this.goalChecksCache.value;
  }

  /** The balance item (a liability) opens in the Info panel, from where it can be paid back. */
  async openLiability(index: number): Promise<void> {
    const liability = this.appState.liabilities[index];
    if (!liability) return;
    const module = await import('src/app/panels/info/info-liabilitie/info-liabilitie.component');
    module.InfoLiabilitieComponent.setInfoLiabilitieComponent(
      index,
      liability.tag,
      liability.amount,
      liability.credit,
      liability.investment,
    );
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

  /**
   * "Start game" on the profession card itself (JFK, 2026-10-03): after shuffling or viewing a
   * profession you can start with it without going back first. The card closes and the usual
   * "which language do you want to play in?" step follows.
   */
  startFromCard(profession: CashflowProfession): void {
    this.selectedProfessionId = profession.id;
    this.closeProfessionCard();
    this.toCharacter();
  }

  /** "you pick one of the professions, or you shuffle for a profession" (JFK, 2026-09-26). */
  shuffleProfession(): void {
    const professions = this.selectedGameSet?.professions ?? [];
    if (!professions.length) return;
    const pick = pickOne(professions, this.cashflowGameService.rng);
    this.selectedProfessionId = pick.id;
  }

  /**
   * Starting a game first asks which language to play in (JFK, 2026-10-03), like the beginner tour:
   * the choice switches the whole app and its Settings, and the names the game hands out - property
   * labels, Grow projects, card texts - follow it for the rest of the game.
   */
  readonly gameLanguages = GAME_LANGUAGES;
  choosingCharacter = false;

  /** The language the app currently speaks - preselected when the question opens. */
  get gameLanguage(): string {
    return this.language.current;
  }

  /** Step 2 of a new game: the character. */
  toCharacter(): void {
    if (!this.selectedGameSetId || !this.selectedProfessionId) return;
    this.choosingCharacter = true;
    this.characterChosen = false;
  }

  /** Back: from a character to the grid, from the grid to the setup. */
  backToSetup(): void {
    if (this.choosingCharacter && this.characterChosen) {
      this.characterChosen = false;
      return;
    }
    this.choosingCharacter = false;
  }

  /** The grid of characters is gone and one is shown. */
  characterChosen = false;
  /** Everybody to choose from: the custom edition's own characters, then the test characters as examples; or the classic professions. */
  get characterOptions(): {
    setId: string;
    profession: CashflowProfession;
    name: string;
    tagline: string;
  }[] {
    const custom =
      this.selectedGameSet?.edition === 'custom' || this.selectedGameSetId === 'custom-jfk';
    const sets = custom
      ? this.gameSets.filter((set) => set.edition === 'custom' || set.id === 'custom-jfk')
      : this.gameSets.filter((set) => set.id === this.selectedGameSetId);
    return sets.flatMap((set) =>
      set.professions.map((profession) => {
        const story = this.profileOf(profession);
        const salary = `${this.toDisplayAmount(profession.salaryMinor).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${this.appState.currency}`;
        return {
          setId: set.id,
          profession,
          name: story?.name ?? this.professionTitle(profession),
          tagline: story?.tagline ?? salary,
        };
      }),
    );
  }

  /** The lists are rebuilt on every check: the rows are told apart by what they are, so they are not drawn again each time. */
  trackOption = (_index: number, option: { setId: string; profession: { id: string } }): string =>
    `${option.setId}/${option.profession.id}`;
  trackPanel = (_index: number, panel: { id: string }): string => panel.id;

  /** The money the numbers of the chosen character are shown in: Dream Taler / Traumtaler for the custom edition, as it will be in the game. */
  get setupCurrency(): string {
    return this.selectedGameSet?.edition === 'custom'
      ? this.language.current === 'de'
        ? 'TT'
        : 'DT'
      : this.appState.currency;
  }

  pickCharacter(option: { setId: string; profession: CashflowProfession }): void {
    this.selectedGameSetId = option.setId;
    this.selectedProfessionId = option.profession.id;
    this.characterChosen = true;
  }

  /** The editions on offer, the custom one first. The physical board only plays the classic one. */
  get editionOptions() {
    return [...this.playableGameSets].sort(
      (a, b) => Number(b.edition === 'custom') - Number(a.edition === 'custom'),
    );
  }

  setPlayMode(mode: 'companion' | 'solo'): void {
    this.playMode = mode;
    if (mode === 'companion') {
      const classic = this.playableGameSets.find((set) => set.edition !== 'custom');
      if (classic) this.chooseEdition(classic.id);
    }
  }

  chooseEdition(gameSetId: string): void {
    this.selectedGameSetId = gameSetId;
    this.selectedProfessionId = this.selectedGameSet?.professions[0]?.id ?? '';
    this.characterChosen = false;
  }

  /** Who a character is, in the language of the game (English where it has no text in that language). */
  profileOf(profession: CashflowProfession | undefined | null): CashflowProfileTexts | null {
    const texts = profession?.profile?.texts;
    if (!texts) return null;
    return texts[this.language.current] ?? texts['en'];
  }

  private setupSheetsCache: { key: string; value: ProfessionSheetNumbers } | null = null;

  /** The chosen character's printed numbers, as the three sheets. */
  get setupSheets(): ProfessionSheetNumbers | null {
    const profession = this.selectedProfession;
    if (!profession) return null;
    const value = this.startSheets(profession);
    const key = JSON.stringify(value);
    if (this.setupSheetsCache?.key !== key) this.setupSheetsCache = { key, value };
    return this.setupSheetsCache.value;
  }

  /** Switches at once (so the question and the whole app already speak it) and waits for its texts. */
  async chooseLanguage(code: AppLanguage['code']): Promise<void> {
    this.isBusy = true;
    try {
      await this.language.use(code);
    } finally {
      this.isBusy = false;
    }
  }

  startGame(): void {
    if (!this.selectedGameSetId || !this.selectedProfessionId) return;
    this.isBusy = true;
    const mode = this.playMode;
    let rules: GameRules;
    try {
      rules = this.currentRules();
    } catch (error) {
      this.isBusy = false;
      this.toastService.show(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    this.cashflowGameService.pickProfession(
      this.selectedGameSetId,
      this.selectedProfessionId,
      {
        onSuccess: () => {
          this.isBusy = false;
          this.choosingCharacter = false;
          this.applyGameCurrency();
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
      },
      mode,
      rules,
    );
  }

  // ── Solo mode: the app rolls and walks the token (todo/cashflow-game-pro.md, Phase C) ─────────────

  /** Chosen with the language when a game starts; a running game keeps the mode it began with. */
  playMode: 'companion' | 'solo' = 'solo';

  // ── The rules a new game is played under (JFK, 2026-10-10) ─────────────────────────────────────

  /** What the start panel is set to: a preset, or single settings changed from one. */
  ruleDraft: GameRules = { ...FREE_RULES };
  /** The two amount limits as typed (empty: no limit), in the game's currency. */
  maxLoanText = '';
  maxFreeText = '';
  showAdvancedRules = false;
  readonly presetIds = ['free', 'guided', 'strict'] as const;

  choosePreset(id: 'free' | 'guided' | 'strict'): void {
    this.ruleDraft = { ...RULE_PRESETS[id] };
    this.maxLoanText =
      this.ruleDraft.maxLoanMinor === null ? '' : String(this.ruleDraft.maxLoanMinor / 100);
    this.maxFreeText =
      this.ruleDraft.maxFreeAmountMinor === null
        ? ''
        : String(this.ruleDraft.maxFreeAmountMinor / 100);
  }

  private limitMinor(text: string): number | null {
    const value = parseFloat(String(text).replace(',', '.'));
    return Number.isFinite(value) && text.trim() !== ''
      ? Math.max(0, Math.round(value * 100))
      : null;
  }

  /** The rules as set now, complete and valid (a changed preset becomes 'custom'). */
  currentRules(): GameRules {
    return normalizeRules({
      ...this.ruleDraft,
      maxLoanMinor: this.limitMinor(this.maxLoanText),
      maxFreeAmountMinor: this.limitMinor(this.maxFreeText),
    });
  }

  get rulePresetNow(): GameRules['preset'] {
    return this.currentRules().preset;
  }

  /** The game being played deals one card per space and nothing can be browsed or swapped (solo, 'offered-once'). */
  get cardsOfferedOnly(): boolean {
    const game = this.appState.cashflowGame;
    return game.mode === 'solo' && rulesOf(game).cardChoice === 'offered-once';
  }

  /** How many buttons the decision panel shows: Open the card, Done, Pass - Pass and Done go when the rules take them away. */
  get decisionButtonCount(): number {
    return 1 + (this.mustPayDoodad ? 0 : 1) + (this.cannotPassNow ? 0 : 1);
  }

  /** The card of this space was played: it is ticked off (Done), not passed. */
  get cannotPassNow(): boolean {
    return (
      whyCannotSkipCard(CashflowGameService.effectiveGame(this.appState.cashflowGame), 'passed') !==
      null
    );
  }

  /** Under the dice-first rule an open dice decision is rolled before the card of the space is picked. */
  get diceFirstRefusal(): string | null {
    return whyDiceFirst(this.appState.cashflowGame);
  }

  /** The rules do not let the player claim a roll made with a real die: only the app's roll counts. */
  get reportRollsForbidden(): boolean {
    return whyCannotReportRoll(this.appState.cashflowGame) !== null;
  }

  /** The rules keep the open space until it is dealt with: a Doodad has to be paid, not passed or ticked off. */
  get mustPayDoodad(): boolean {
    // 'done' is only refused for a payment that is due; a played card refuses only the pass (that is no payment)
    return whyCannotSkipCard(this.appState.cashflowGame, 'done') !== null;
  }

  /** Why no further card can be drawn on this space, or null. */
  get drawRefusal(): string | null {
    return whyCannotDraw(this.appState.cashflowGame);
  }

  readonly board = this.cashflowGameService.board;

  /** The dice of the last roll, for the die faces on the dashboard. */
  lastDice: number[] = [];
  /** True only while the dice tumble after a roll; before and after they rest still on their number. */
  diceTumbling = false;
  private tumbleFaces: number[] = [];
  /** True for a moment as the dice land, for one small pop - never again when they come back into view. */
  diceLanded = false;
  /** How many dice the player rolls while Charity lasts: two unless they choose one (JFK, 2026-10-06). */
  diceChoice: 1 | 2 = 2;
  /** True while the token walks to where the roll took it. */
  walking = false;
  /** What the Payday(s) of the last roll paid: shown big until the next roll or until it is closed. */
  paydayBanner: {
    count: number;
    incomeMinor: number;
    expensesMinor: number;
    netMinor: number;
  } | null = null;
  /** The Payday popup is big and covers the board: after a few seconds it steps aside and this small "Latest" line above the board keeps the numbers (JFK, 2026-10-25). */
  paydayLatest: typeof this.paydayBanner = null;
  private paydayTimer: ReturnType<typeof setTimeout> | undefined;
  private paydaySummary: typeof this.paydayBanner = null;
  private skipWalking = false;
  /** Where the token is drawn while it walks; undefined means "where the game says it is". */
  private walkingAt: number | null | undefined = undefined;

  get isSolo(): boolean {
    return this.appState.cashflowGame.mode === 'solo';
  }

  get soloTurn() {
    return this.cashflowGameService.soloTurn;
  }

  get gameOver(): boolean {
    return !!this.remoteOver || (this.isSolo && this.soloTurn.phase === 'over' && !this.walking);
  }

  /** The menu entries are rebuilt on every look: they are matched by their id, so a click always finds its button. */
  trackById(_: number, entry: { id: string }): string {
    return entry.id;
  }

  runTableMenuItem(item: { id: string; confirm?: string; label?: string }): void {
    if (item.confirm) {
      // asked in the app's own dialog, not the browser's
      this.confirm.confirm(
        item.confirm,
        () => void this.remote?.runTableMenu(item.id),
        item.label ?? 'Info.delete',
        'delete',
      );
      return;
    }
    void this.remote?.runTableMenu(item.id);
  }

  /** A game with others that has ended (finished or closed): how it ended for the player. */
  get remoteOver() {
    return this.remote?.over() ?? null;
  }

  /** The faces on show: random ones while the dice tumble, otherwise the last roll (also after a reload). */
  get shownDice(): number[] {
    // another player's roll being told: their dice, in the same dice
    const other = RemoteGameHook.otherDice?.();
    if (other) return other.faces;
    // while it is somebody else's turn the dice are theirs: none are shown unless their roll is being told
    if (this.remote?.turnBanner()) return [];
    if (this.diceTumbling) return this.tumbleFaces;
    if (this.decisionOutcome) return this.decisionFaces ?? [];
    if (this.decisionFaces) return this.decisionFaces;
    // The die of a dice action is one die, whatever the last board roll was (two under Charity): never the board's dice here
    if (this.firstDiceDecision)
      return [this.lastDice[0] ?? this.appState.cashflowGame.turn?.lastRoll?.[0] ?? 1];
    if (this.lastDice.length) return this.lastDice;
    return this.appState.cashflowGame.turn?.lastRoll ?? [];
  }

  /** Keeps each die's element while its face changes, so the tumble is one animation and not one per face. */
  trackByIndex(index: number): number {
    return index;
  }

  /** The token as shown: stepping along while it walks, otherwise on the game's own position. */
  get tokenPosition(): number | null {
    return this.walkingAt !== undefined ? this.walkingAt : this.appState.cashflowGame.boardPosition;
  }

  /**
   * The dice may only be pressed when nothing is still loading or being stored (JFK, 2026-10-10: on a phone the button
   * worked before the turn had finished loading) and no dice action of a card is open - those come first.
   */
  get canRoll(): boolean {
    return (
      (!this.remote || this.remote.canAct()) &&
      !this.isBusy &&
      !this.walking &&
      !this.appState.isLoading &&
      !this.appState.isSaving &&
      !this.hasOpenDiceAction &&
      this.cashflowGameService.cannotRollBecause === null
    );
  }

  /** What the roll button says: the roll itself while the dice tumble, the move while the token walks (the button is off then). */
  get rollButtonKey(): string {
    if (this.diceTumbling) return 'CashflowGame.solo.rolling';
    return this.walking ? 'CashflowGame.solo.moving' : 'CashflowGame.solo.roll';
  }

  /** A paid dice card (Multi-Level-Marketing, ...) waits for its roll: it is done before the next turn. */
  get hasOpenDiceAction(): boolean {
    return this.visibleDecisions.length > 0;
  }

  /** Charity lets the player pick 1 or 2 dice; otherwise it is always one. */
  get canChooseDice(): boolean {
    return this.appState.cashflowGame.charityRoundsLeft > 0;
  }

  /** "Space 7 of 24", or "At START". */
  get positionText(): string {
    const position = this.tokenPosition;
    return position === null
      ? this.translate.instant('CashflowGame.solo.positionStart')
      : this.translate.instant('CashflowGame.solo.position', {
          n: position + 1,
          total: this.board.length,
        });
  }

  /** How many spaces until the token next enters a Payday space. */
  get spacesToPayday(): number {
    const position = this.tokenPosition;
    const first = position === null ? 0 : position + 1;
    for (let step = 0; step < this.board.length; step++) {
      if (this.board[(first + step) % this.board.length].kind === 'payday') return step + 1;
    }
    return 0;
  }

  get paydayText(): string {
    const count = this.spacesToPayday;
    return count === 1
      ? this.translate.instant('CashflowGame.solo.nextPaydayOne')
      : this.translate.instant('CashflowGame.solo.nextPayday', { count });
  }

  /** The name of the card space the turn is waiting on, in the game's words. */
  get pendingSpaceName(): string {
    const kind = this.soloTurn.pending?.kind;
    const key: Record<string, string> = {
      deal: 'CashflowGame.spaceDeals',
      doodad: 'CashflowGame.deckDoodad',
      market: 'CashflowGame.deckMarket',
    };
    return kind ? this.translate.instant(key[kind]) : '';
  }

  /** How the finished game ended, with its closing numbers. */
  get soloSummary() {
    return this.cashflowGameService.soloSummary();
  }

  /** The game being played somewhere else (a shared table), or null for a normal solo game: its moves are sent, not worked out here. */
  get remote(): RemoteGame | null {
    return RemoteGameHook.current;
  }

  /** The box that tells what the others do, laid in the wheel (a game with others only). */
  get stageBox() {
    return RemoteGameHook.stage;
  }

  /** The tokens of everyone at the table, or none for a solo game (the board then draws the single token). */
  get boardTokens(): BoardToken[] {
    return RemoteGameHook.tokens?.(this.tokenPosition) ?? [];
  }

  /** The dice are tumbling: the player's own, or another player's roll being told. */
  get dieTumbling(): boolean {
    return this.diceTumbling || !!RemoteGameHook.otherDice?.()?.tumbling;
  }

  /** Another player's books are on screen: read only, no action of the game is offered. */
  get viewOnly(): boolean {
    return !!this.remote?.viewOnly();
  }

  /** What waits for the player at the place of the roll button: End turn, or Continue after selling; null when nothing does. */
  get remoteGate() {
    // not before the token has walked and the roll has been shown to the end
    if (this.walking) return null;
    return this.remote?.gate() ?? null;
  }

  /** Whose turn it is while it is not the player's own, for the place of the roll button. */
  get turnBanner() {
    return this.remote?.turnBanner() ?? null;
  }

  proceedGate(): void {
    void this.remoteMove((remote) => remote.proceed());
  }

  /** The online layer shown on top of the screen while a game is played with others (a generic hook; the shared code knows nothing of it). */
  get onlineLayer() {
    return RemoteGameHook.layer;
  }

  /** A remote move: busy while it is on its way; a refusal is shown as the toast every refusal is. Returns whether it went through. */
  private async remoteMove(
    run: (remote: RemoteGame) => ReturnType<RemoteGame['roll']>,
  ): Promise<{ type: string; seat: number | null; data?: Record<string, unknown> }[] | null> {
    const remote = this.remote;
    if (!remote) return null;
    this.isBusy = true;
    try {
      const outcome = await run(remote);
      if (!outcome.ok) {
        this.toastService.show(outcome.message ?? 'The move did not go through.', 'error');
        return null;
      }
      // the books of the new situation are on screen before whatever follows looks at them (the Grow page after a plan)
      if (!RemoteGameHook.holdUpdates) RemoteGameHook.resume?.();
      return outcome.events;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * A roll made elsewhere, shown exactly as a solo roll is: the dice tumble and come to rest on the faces the other end rolled, the
   * token walks space by space (a Payday flashing as it is entered), and only then do the new books appear - the screen is kept
   * on the books from before the roll until the token has landed (`holdUpdates`), so nothing shows before the animation settles.
   */
  private async rollRemote(dice: 1 | 2): Promise<void> {
    const from = this.appState.cashflowGame.boardPosition;
    this.clearPayday();
    RemoteGameHook.holdUpdates = true;
    this.walking = true;
    this.walkingAt = from;
    this.skipWalking = this.reducedMotion;
    try {
      const events = await this.remoteMove((remote) => remote.roll(dice));
      const rolled = events?.find((event) => event.type === 'rolled');
      if (!rolled) return;
      const data = rolled.data ?? {};
      const faces = (data['dice'] as number[] | undefined) ?? [];
      const total = Number(data['total'] ?? 0);
      this.isBusy = true;
      this.lastDice = faces;
      this.clearPayday();
      await this.tumbleDice(faces.length || dice);
      // the dice are at rest: the history line may say what was rolled (where the token lands follows when it has landed)
      RemoteGameHook.diceRested = true;
      const paydays = Number(data['paydays'] ?? 0);
      this.paydaySummary = paydays
        ? {
            count: paydays,
            incomeMinor: Number(data['paydayIncomeMinor'] ?? 0),
            expensesMinor: Number(data['paydayExpensesMinor'] ?? 0),
            netMinor:
              Number(data['paydayIncomeMinor'] ?? 0) - Number(data['paydayExpensesMinor'] ?? 0),
          }
        : null;
      // The Payday banner comes when the token gets there (JFK, 2026-10-25): not while it is still walking. The opening Payday of
      // the first roll has no space of its own: it is told when the token has landed.
      let paydayTold = false;
      const move = total > 0 ? moveToken(this.board, from, total) : null;
      for (const space of move?.entered ?? []) {
        if (this.skipWalking) break;
        await this.pause(WALK_STEP_MS);
        this.walkingAt = space.index;
        if (space.kind === 'payday') {
          this.showPayday();
          paydayTold = true;
        }
      }
      if ((this.skipWalking && paydays > 0) || (data['openingPayday'] && !paydayTold)) {
        this.showPayday();
      }
      this.walkingAt = typeof data['to'] === 'number' ? (data['to'] as number) : undefined;
      // the token is on its tile: now the books of the new situation appear
      RemoteGameHook.holdUpdates = false;
      RemoteGameHook.resume?.();
      if (data['landed'] === 'charity') this.diceChoice = 2;
    } finally {
      RemoteGameHook.holdUpdates = false;
      RemoteGameHook.resume?.();
      this.walkingAt = undefined;
      this.walking = false;
      this.isBusy = false;
    }
  }

  /** Rolls the dice: the engine decides, this only shows it - the die faces, then the token walking there. */
  rollSolo(): void {
    if (!this.canRoll) return;
    if (this.remote) {
      void this.rollRemote(this.canChooseDice && this.diceChoice === 2 ? 2 : 1);
      return;
    }
    const from = this.appState.cashflowGame.boardPosition;
    const dice = this.canChooseDice ? this.diceChoice : 1;
    // Busy for the whole reveal: nothing else may change the books between the roll and its being applied.
    this.isBusy = true;
    // The turn is only worked out here; it is applied once the totem has settled (see `walkTo`).
    const result = this.cashflowGameService.planTurn(dice, {
      onSuccess: () => undefined,
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
    if (!result) return;
    this.lastDice = result.roll.dice;
    this.clearPayday(); // the last roll's Payday is done with once the next roll starts
    this.paydaySummary = this.summarisePaydays(result);
    void this.walkTo(from, result);
  }

  /** Skips the rest of the walk. */
  skipWalk(): void {
    this.skipWalking = true;
    this.decisionSkip = true;
  }

  private get reducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Brings up the Payday banner (the roll's own numbers) - once the token enters a Payday space, or at the opening. */
  private showPayday(): void {
    clearTimeout(this.paydayTimer);
    this.paydayLatest = null;
    this.paydayBanner = this.paydaySummary;
    this.paydayTimer = setTimeout(() => this.dismissPayday(), PAYDAY_POPUP_MS);
  }

  /** The big popup is done: the numbers stay as the small Latest line until the next roll. */
  dismissPayday(): void {
    clearTimeout(this.paydayTimer);
    if (this.paydayBanner) this.paydayLatest = this.paydayBanner;
    this.paydayBanner = null;
  }

  /** A new roll starts: the last Payday is history, in both forms. */
  private clearPayday(): void {
    clearTimeout(this.paydayTimer);
    this.paydayBanner = null;
    this.paydayLatest = null;
  }

  /**
   * The info banners - the Payday popup, a market card's notice - go with the next thing the player does (JFK,
   * 2026-10-06), not with a close button. Listens in the capture phase, so it runs before the click's own handler:
   * a notice that handler raises is not swept away by the same click.
   */
  dismissInfoBanners(): void {
    this.dismissPayday();
    this.marketNotice = null;
    this.mlmBanner = null;
  }

  private readonly onAnyClick = (event?: Event): void => {
    if (!this.paydayBanner && !this.marketNotice && !this.mlmBanner) return;
    // A Payday and the bonus roll of a kept Multi-Level-Marketing card are one game turn (JFK, 2026-10-06): pressing that
    // roll keeps the Payday box on screen, and the outcome joins it - the next action after that clears both.
    const target = event?.target as Element | null | undefined;
    if (this.mlmRollIsDue && target?.closest?.('.cf-decision')) return;
    this.dismissInfoBanners();
  };

  /** A Payday is on show and a kept MLM card is waiting for its roll. */
  private get mlmRollIsDue(): boolean {
    return (
      (this.paydayBanner !== null || this.paydayLatest !== null) &&
      (this.cashflowGameService.openDecisions ?? []).some((deal) => deal.recurring && deal.rollDue)
    );
  }

  ngOnDestroy(): void {
    clearTimeout(this.paydayTimer);
    clearTimeout(this.busyTimer);
    this.dropBusySpinner();
    document.removeEventListener('click', this.onAnyClick, true);
    this.fitObserver?.disconnect();
    if (RemoteGameHook.ringVisible) RemoteGameHook.ringVisible = null;
    RemoteGameHook.openCard = null;
  }

  private fitQueued = false;
  private fitObserver: ResizeObserver | null = null;
  private fitWatching: Element | null = null;

  ngAfterViewChecked(): void {
    this.queueFit();
  }

  private queueFit(): void {
    if (this.fitQueued || typeof requestAnimationFrame === 'undefined') return;
    this.fitQueued = true;
    requestAnimationFrame(() => {
      this.fitQueued = false;
      this.fitBoard();
    });
  }

  /**
   * On a big landscape screen the dashboard is one page: the wheel takes exactly the height that is left once everything else is
   * on screen (the dice and the roll button, a dice card's gold box, the buttons of a decision, the table's bar above) - so it
   * never has to be scrolled, whatever shows or hides. Smaller or upright screens keep the one column and scroll as before.
   */
  private fitBoard(): void {
    const panel = document.querySelector('app-cashflow-game .cf-panel--dash') as HTMLElement | null;
    if (panel !== this.fitWatching) {
      this.fitObserver?.disconnect();
      this.fitWatching = panel;
      if (panel && typeof ResizeObserver !== 'undefined') {
        this.fitObserver ??= new ResizeObserver(() => this.queueFit());
        this.fitObserver.observe(panel);
        const watch = panel.querySelector('.cf-solo');
        if (watch) this.fitObserver.observe(watch);
      }
    }
    if (!panel) return;
    const card = panel.querySelector('.cf-solo') as HTMLElement | null;
    const board = card?.querySelector('app-rat-race-board') as HTMLElement | null;
    const dash = panel.querySelector('.cf-dashboard--main') as HTMLElement | null;
    const wide =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 900px) and (min-height: 521px) and (orientation: landscape)')
        .matches;
    if (!wide || !card || !board || !dash || !board.offsetWidth) {
      panel.style.removeProperty('--cf-board-max');
      return;
    }
    const style = getComputedStyle(panel);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    // the panel may be 96% of the window tall; what is not the dashboard (header, the table's bar) is taken off first
    const chrome = panel.scrollHeight - padding - dash.offsetHeight;
    const room = window.innerHeight * 0.96 - padding - chrome - 2;
    const nonBoard = card.offsetHeight - board.offsetHeight;
    const aspect = board.offsetHeight / board.offsetWidth;
    const width = Math.max(180, Math.min(600, Math.floor((room - nonBoard) / aspect)));
    const held = parseFloat(panel.style.getPropertyValue('--cf-board-max'));
    if (!Number.isFinite(held) || Math.abs(held - width) > 1.5) {
      panel.style.setProperty('--cf-board-max', `${width}px`);
    }
  }

  /** An amount with its sign, for the Payday popup: "+2.500,00 €", "−2.200,00 €". */
  signedCardAmount(minor: number): string {
    return `${minor < 0 ? '−' : ''}${this.cardAmount(minor, true)}`;
  }

  /** What the Paydays of a roll paid in all: the income, the expenses, and what is left of the month. */
  private summarisePaydays(result: TurnResult): typeof this.paydayBanner {
    const count = (result.openingPayday ? 1 : 0) + result.move.paydays;
    if (!count) return null;
    let incomeMinor = 0;
    let expensesMinor = 0;
    // the Payday effects come first, in order; whatever the landing space did follows them
    for (const effects of (result.effects ?? []).slice(0, count)) {
      for (const transaction of effects.appendedTransactions) {
        if (transaction.amountMinor > 0) incomeMinor += transaction.amountMinor;
        else expensesMinor -= transaction.amountMinor;
      }
    }
    return { count, incomeMinor, expensesMinor, netMinor: incomeMinor - expensesMinor };
  }

  /**
   * The whole reveal, in order: the dice tumble and come to rest on their number, a beat later the token walks space
   * by space (a Payday flashing as it is entered), it rests on its landing, and only then does the landing speak - a
   * card waits for the player to open it, nothing opens by itself (JFK, 2026-10-06).
   */
  private async walkTo(from: number | null, result: TurnResult): Promise<void> {
    this.walking = true;
    this.skipWalking = this.reducedMotion;
    this.walkingAt = from;
    await this.tumbleDice(result.roll.dice.length);
    // The Payday banner comes when the token gets there, not while it is still walking; the opening Payday of the first roll has no
    // space of its own, so it is told when the token has landed (JFK, 2026-10-25).
    let paydayTold = false;
    for (const space of result.move.entered) {
      if (this.skipWalking) break;
      await this.pause(WALK_STEP_MS);
      this.walkingAt = space.index;
      if (space.kind === 'payday') {
        this.showPayday();
        paydayTold = true;
      }
    }
    if ((this.skipWalking && result.move.paydays > 0) || (result.openingPayday && !paydayTold)) {
      this.showPayday();
    }
    // The totem is on its tile: only now does the roll take effect - Charity's dice choice, the child, the spanner, the
    // cash - and the dialog or the action comes at once (JFK, 2026-10-06: nothing before the animation has settled).
    this.walkingAt = result.move.to;
    this.applyTurn(result);
    this.walkingAt = undefined;
    this.walking = false;
    this.afterLanding(result);
  }

  /** Applies the planned turn to the game and tells about what only now has happened. */
  private applyTurn(result: TurnResult): void {
    try {
      this.cashflowGameService.commitTurn(result, {
        onSuccess: () => {
          this.isBusy = false;
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      });
    } catch (err: unknown) {
      this.isBusy = false;
      this.toastService.show(
        err instanceof Error ? err.message : 'Could not apply the roll.',
        'error',
      );
      return;
    }
    // landing on Charity opens its three turns with two dice selected; the player may switch to one
    if (result.move.landed.kind === 'charity') this.diceChoice = 2;
    // a space that had to borrow first (Charity, Downsized with too little cash) says so
    const borrowedMinor = (result.autoLoansMinor ?? []).reduce((sum, loan) => sum + loan, 0);
    if (borrowedMinor > 0) {
      this.toastService.show(
        this.cashflowGameService.autoLoanMessage(this.toDisplayAmount(borrowedMinor)),
        'update',
      );
    }
  }

  /**
   * The dice are thrown: they bounce and turn while the faces flicker, slowing down as they come to rest; then they
   * land on the real roll (the engine already decided it) with one small pop, and stay still from then on.
   */
  private async tumbleDice(count: number): Promise<void> {
    if (this.reducedMotion) return;
    this.diceTumbling = true;
    const started = Date.now();
    let previous: number[] = [];
    while (Date.now() - started < DICE_TUMBLE_MS && !this.skipWalking) {
      const progress = (Date.now() - started) / DICE_TUMBLE_MS;
      let faces: number[];
      do {
        faces = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
      } while (faces.join() === previous.join() && count === 1); // a die never "flickers" to the same face
      previous = this.tumbleFaces = faces;
      await this.pause(DICE_FACE_FIRST_MS + (DICE_FACE_LAST_MS - DICE_FACE_FIRST_MS) * progress);
    }
    this.diceTumbling = false;
    if (!this.skipWalking) {
      this.diceLanded = true;
      setTimeout(() => (this.diceLanded = false), DICE_LAND_POP_MS);
      await this.pause(DICE_SETTLE_MS);
    }
  }

  /** What the landing leaves: the end of the game, a card waiting in the dialog, or a space resolved on the spot. */
  private afterLanding(result: TurnResult): void {
    const turn = this.appState.cashflowGame.turn;
    if (turn?.phase === 'over') {
      this.dashboardView = 'main';
      return;
    }
    // A card space shows its dialog ("You landed on Deals - open the card, done, or pass"); the card opens on request.
    if (turn?.phase === 'decide' && turn.pending) return;
    const spoken: Record<string, string> = {
      baby: 'CashflowGame.solo.landedBaby',
      charity: 'CashflowGame.solo.landedCharity',
      downsized: 'CashflowGame.solo.landedDownsized',
    };
    const key = spoken[result.move.landed.kind];
    if (key) this.toastService.show(this.translate.instant(key), 'update');
  }

  /** Opens the card flow for the space the token is waiting on (Deals asks for the pile first). */
  openSoloDecision(): void {
    const kind = this.soloTurn.pending?.kind;
    const picked = this.appState.cashflowGame.turn?.pending?.offered;
    if (picked) {
      // The card of this space was picked: opening it again goes straight to it, no Small or Big to choose again.
      this.activeDeckKind = picked.deck;
      this.changeDeck();
      this.openCards();
      return;
    }
    if (kind === 'deal') this.landOnDeals();
    else if (kind === 'doodad') this.landOnDoodad();
    else if (kind === 'market') this.landOnMarket();
  }

  /** The card was dealt with (or there was nothing to do): the next roll is open. */
  finishSoloDecision(how: 'done' | 'passed'): void {
    // the card closes at once and the spinner says the table is working on it (JFK, 2026-10-25)
    if (this.remote) {
      this.backToMain();
      void this.remoteMove((remote) => (how === 'passed' ? remote.pass() : remote.finish()));
      return;
    }
    this.isBusy = true;
    this.backToMain();
    this.cashflowGameService.settleSoloDecision(how, {
      onSuccess: () => {
        this.isBusy = false;
        this.backToMain();
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  /**
   * Wipes the game being played without saving it - for a game started with the wrong settings - and returns to the start
   * panel (JFK, 2026-10-06). Asks first, with the same wording and confirmation as the reset in Settings.
   */
  resetCurrentGame(): void {
    const remote = this.remote;
    // a game that is over has nothing to give up: this is the way out, to the app's home
    if (remote && this.remoteOver) {
      RemoteGameHook.leaveHome?.();
      return;
    }
    if (remote) {
      // at a table this is giving up the seat: the player loses, the others play on
      const words = remote.resignWords();
      this.confirm.confirm(
        words.confirm,
        () => {
          void this.remoteMove((r) => r.resign()).then((events) => {
            if (events) RemoteGameHook.leaveGame?.();
          });
        },
        words.label,
        'delete',
      );
      return;
    }
    this.confirm.confirm(
      this.translate.instant('CashflowGame.resetConfirm'),
      () => {
        this.isBusy = true;
        this.cashflowGameService.resetGame({
          onSuccess: () => {
            this.isBusy = false;
            this.toastService.show(this.translate.instant('CashflowGame.resetDone'), 'delete');
            this.backToStartPanel();
          },
          onError: (message) => {
            this.isBusy = false;
            this.toastService.show(message, 'error');
          },
        });
      },
      'CashflowGame.resetConfirmButton',
      'delete',
    );
  }

  /** Everything the page was showing about the finished game goes: the start panel is what is left. */
  /**
   * A game of the custom edition is played in Dream Taler (DT), in German in Traumtaler (TT) - the amounts everywhere show it while the
   * game is on, and the currency of the account comes back when it is gone (JFK, 2026-10-25).
   */
  private applyGameCurrency(lang: string = this.language.current): void {
    const game = this.appState.cashflowGame;
    const set = this.gameSets.find((candidate) => candidate.id === game.gameSetId);
    if (!game.professionId || set?.edition !== 'custom') {
      this.restoreCurrency();
      return;
    }
    const code = lang === 'de' ? 'TT' : 'DT';
    if (this.appState.currency === code) return;
    if (
      !['DT', 'TT'].includes(this.appState.currency) &&
      !this.local.getData(CURRENCY_BEFORE_KEY)
    ) {
      this.local.saveData(CURRENCY_BEFORE_KEY, this.appState.currency);
    }
    this.appState.currency = code;
    this.local.saveData('currency', code);
  }

  private restoreCurrency(): void {
    const before = this.local.getData(CURRENCY_BEFORE_KEY);
    if (!before) return;
    this.appState.currency = before;
    this.local.saveData('currency', before);
    this.local.removeData(CURRENCY_BEFORE_KEY);
  }

  private backToStartPanel(): void {
    this.applyGameCurrency();
    this.dashboardView = 'main';
    this.viewedProfession = null;
    this.choosingCharacter = false;
    this.showStartGames = false;
    this.pendingSpace = null;
    this.spaceData = null;
    this.rollResult = null;
    this.marketNotice = null;
    this.clearPayday();
    this.lastDice = [];
    this.diceTumbling = false;
    this.backToMain();
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

  /**
   * The banner after an undo says what was undone (JFK, 2026-10-03: it only ever said "Payday"):
   * the newest `count` History steps, named as the History names them. Read before the undo, while
   * the steps still exist; falls back to a plain "Undone" when there is nothing to name.
   */
  private undoneMessage(count: number): string {
    const steps = this.cashflowGameService.historySteps().slice(0, count);
    if (!steps.length) return this.translate.instant('CashflowGame.undoDone');
    const names = steps.map((step) => {
      const caption = this.translate.instant(`CashflowGame.step.${step.kind}`);
      return step.detail ? `${caption} · ${step.detail}` : caption;
    });
    if (names.length === 1) {
      return this.translate.instant('CashflowGame.undoneOne', { what: names[0] });
    }
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ', …' : '');
    return this.translate.instant('CashflowGame.undoneMany', { count: names.length, what: shown });
  }

  /** Reverts the single most recent action, whichever one it was — Payday, Baby, Charity, Downsized, a bank loan move, a Deal, a Doodad, or Reset (todo/cashflow-game.md decision 40). */
  undoLastAction(): void {
    if (this.remote) {
      // at a table undoing is the table's vote: this only asks
      void this.remoteMove((remote) => remote.askUndo());
      return;
    }
    this.isBusy = true;
    const message = this.undoneMessage(1);
    this.cashflowGameService.undoLastAction({
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(message, 'update');
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
  /** Baby / Charity / Downsized first explain what they do and ask for a go-ahead (JFK, 2026-10-03), like the cards. */
  pendingSpace: 'baby' | 'charity' | 'downsized' | null = null;

  landOnBaby(): void {
    this.askToPlaySpace('baby');
  }

  landOnCharity(): void {
    this.askToPlaySpace('charity');
  }

  landOnDownsized(): void {
    this.askToPlaySpace('downsized');
  }

  /** What the pending space will do, worked out once when the confirmation opens. */
  private spaceData: { amountMinor: number; children?: number } | null = null;

  private askToPlaySpace(kind: 'baby' | 'charity' | 'downsized'): void {
    this.pendingSpace = kind;
    this.spaceData = this.cashflowGameService.spacePreview(kind);
    this.dashboardView = 'confirmSpace';
  }

  /** What the pending space is about to do, with the real numbers - empty while none is pending. */
  get spaceExplanation(): string {
    const kind = this.pendingSpace;
    if (!kind) return '';
    const preview = this.spaceData;
    return this.translate.instant(`CashflowGame.space.${kind}`, {
      amount: preview ? this.cardAmount(preview.amountMinor) : '',
      children: preview?.children ?? this.appState.cashflowGame.children,
    });
  }

  /** The effect / cost of the pending space as the big figures every card shows (JFK, 2026-10-03). */
  get spaceFacts(): { label: string; value: string }[] {
    const kind = this.pendingSpace;
    if (!kind) return [];
    const t = (key: string) => this.translate.instant(`CashflowGame.${key}`);
    const amount = this.spaceData ? this.cardAmount(this.spaceData.amountMinor) : '-';
    if (kind === 'baby') {
      const children = this.spaceData?.children ?? this.appState.cashflowGame.children + 1;
      return [
        { label: t('spaceFactChildren'), value: `${children} / 3` },
        { label: t('spaceFactMonthly'), value: `+${amount}` },
      ];
    }
    if (kind === 'charity') {
      return [
        { label: t('spaceFactPayNow'), value: amount },
        { label: t('spaceFactDice'), value: t('spaceValueDice') },
      ];
    }
    return [
      { label: t('spaceFactPayNow'), value: amount },
      { label: t('spaceFactSkip'), value: t('spaceValueSkip') },
    ];
  }

  /** "Play" on the confirmation: now it really happens. */
  confirmSpace(): void {
    const kind = this.pendingSpace;
    if (!kind) return;
    this.pendingSpace = null;
    const service = this.cashflowGameService;
    this.runAction(
      (callbacks) =>
        kind === 'baby'
          ? service.resolveBaby(callbacks)
          : kind === 'charity'
            ? service.resolveCharity(callbacks)
            : service.resolveDownsized(callbacks),
      kind,
    );
  }

  cancelSpace(): void {
    this.pendingSpace = null;
    this.spaceData = null;
    this.backToMain();
  }

  /** Green "Deals" space — the physical board doesn't distinguish Small/Big, so ask which pile first. */
  landOnDeals(): void {
    this.dashboardView = 'dealPile';
  }

  /** Small/Big Deal are the same green space on the board — the player says which pile they drew from. */
  chooseDealPile(kind: 'dealSmall' | 'dealBig'): void {
    this.activeDeckKind = kind;
    this.changeDeck();
    this.openCards();
  }

  /** Card text is lazy-loaded, per language, the first time a pile opens (keeps the normal app's i18n load small). */
  private openCards(): void {
    this.marketNotice = null;
    this.dashboardView = 'cards';
    void this.cardText.ensureLoaded();
    this.dealOfferedCard();
  }

  /**
   * Under 'offered-once' the pile is not browsed: the one card of the space is drawn at once, or - when the page was
   * reloaded with a card on offer - brought back, so the player cannot swap it by leaving and coming back.
   */
  private dealOfferedCard(): void {
    const offered = this.appState.cashflowGame.turn?.pending?.offered;
    if (!offered) {
      if (this.cardsOfferedOnly && !this.drawRefusal && !this.diceFirstRefusal)
        this.drawActiveCard();
      return;
    }
    this.activeDeckKind = offered.deck;
    const card = this.cashflowGameService
      .browseCards(offered.deck, '')
      .find((candidate: { id: string }) => candidate.id === offered.cardId);
    if (card) this.activeCard = card as typeof this.activeCard;
  }

  /** Red "Schnickschnack" space. */
  landOnDoodad(): void {
    this.activeDeckKind = 'doodad';
    this.changeDeck();
    this.openCards();
  }

  /** Blue "Der Markt" space. */
  landOnMarket(): void {
    this.activeDeckKind = 'market';
    this.changeDeck();
    this.openCards();
  }

  /** The tile of the space the open deck belongs to - the symbol on its ring cell - so a Deal, a Doodad and a Market card screen are told apart at a glance. */
  get activeTileKind(): 'deal' | 'doodad' | 'market' {
    return this.activeDeckKind === 'doodad'
      ? 'doodad'
      : this.activeDeckKind === 'market'
        ? 'market'
        : 'deal';
  }

  tileGlyph(kind: 'deal' | 'doodad' | 'market'): string {
    return SPACE_GLYPHS[kind];
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

  /** Translated flavor text/note for the open card — empty until the language file has loaded. */
  get activeCardText(): CashflowCardText {
    return this.activeCard ? this.cardText.textFor(this.activeCard.id) : {};
  }

  /**
   * What the Grow project gets from a card (JFK, 2026-09-30): the description is the card itself -
   * name, symbol, today's price, its text and the rule line; the trading range is strategy.
   */
  private planText(card: CashflowDealCard): CashflowCardPlanText {
    const text = this.cardText.textFor(card.id);
    const money = (minor?: number) =>
      `${this.toDisplayAmount(minor ?? 0).toLocaleString()} ${this.appState.currency}`;
    const isShare = card.assetKind === 'share';
    if (card.assetKind === 'asset') {
      const t = (key: string, params?: object) =>
        this.translate.instant(`CashflowGame.${key}`, params);
      const name = text.title ?? card.title;
      const isDice = Boolean(card.successOn);
      const facts = [
        `${t('dealCost')}: ${money(card.costMinor)}`,
        card.payoutMinor
          ? `${t(card.recurring ? 'cardPaydayPayout' : 'cardPayout')}: ${money(card.payoutMinor)}`
          : `${t('cardCoins')}: ${card.quantity ?? 0}`,
        isDice ? this.diceWinLabel(card.successOn!) : '',
      ]
        .filter(Boolean)
        .join('\n');
      return {
        title: name,
        description: [
          name,
          text.description,
          isDice ? '' : this.cardText.sharedText('investmentRule'),
          facts,
        ]
          .filter(Boolean)
          .join('\n\n'),
        note: text.note,
        symbol: this.cardText.symbolFor(card.symbol),
        strategy: isDice ? this.diceWinLabel(card.successOn!) : undefined,
        success: text.success,
        failure: text.failure,
      };
    }
    if (!isShare) {
      const t = (key: string) => this.translate.instant(`CashflowGame.${key}`);
      const deposit = card.depositMinor ?? 0;
      const mortgage = card.mortgageMinor ?? 0;
      const numbers = [
        `${t('dealCost')}: ${money(deposit + mortgage)}`,
        `${t('dealDeposit')}: ${money(deposit)}`,
        `${t('dealMortgage')}: ${money(mortgage)}`,
        `${t('dealCashflow')}: +${money(card.cashflowMinor)}`,
      ].join('\n');
      const investmentDescription = [
        text.heading ? `${text.heading}\n${text.title ?? card.title}` : (text.title ?? card.title),
        text.description,
        this.cardText.sharedText('investmentRule'),
        numbers,
      ]
        .filter(Boolean)
        .join('\n\n');
      return {
        title: text.title ?? card.title,
        description: investmentDescription,
        note: text.note,
        symbol: this.cardText.symbolFor(card.symbol),
      };
    }
    const description = [
      isShare ? `${card.title} (${card.symbol ?? card.title})` : card.title,
      text.description,
      isShare ? this.cardText.sharedText('shareRule') : '',
      isShare
        ? `${this.translate.instant('CashflowGame.cardPriceToday')}: ${money(card.priceMinor)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const strategy =
      card.rangeMinMinor !== undefined && card.rangeMaxMinor !== undefined
        ? `${this.translate.instant('CashflowGame.cardTradingRange')}: ${money(card.rangeMinMinor)} - ${money(card.rangeMaxMinor)}`
        : undefined;
    return { description, note: text.note, strategy };
  }

  /** The line every stock card prints ("Only you may buy at this price…"), stored once per language. */
  get shareRuleText(): string {
    return this.cardText.sharedText('shareRule');
  }

  /** The open card's heading in the current language - investment cards carry a translated title ("Single-family home for sale"). */
  get activeCardTitle(): string {
    if (!this.activeCard) return '';
    if (this.activeDeckKind === 'doodad' || this.activeDeckKind === 'market') {
      const name = this.activeCardText.title ?? this.activeCard.title;
      // A star card is the jackpot of the pile.
      return (this.activeCard as CashflowMarketCard).star ? `${name} ★` : name;
    }
    if (!this.isInvestmentCard && !this.isAssetCard) return this.activeCard.title;
    // A Super Deal card's printed heading replaces the plain name ("You've found a Super Deal!").
    return this.activeCardText.heading ?? this.activeCardText.title ?? this.activeCard.title;
  }

  /** What a dice card wins on: "Win on a 6" for the top face, "Win on 4-6" for a range. */
  diceWinLabel(successOn: number): string {
    return this.translate.instant(
      successOn >= 6 ? 'CashflowGame.cardDiceWin' : 'CashflowGame.cardDiceWinRange',
      { n: successOn },
    );
  }

  /** The open-decision line: what the roll wins (coins, or a repaid loan). */
  decisionText(deal: CashflowAssetDeal): string {
    if (deal.split) {
      const share = this.appState.allShares.find(
        (candidate) => candidate.tag === deal.split?.shareTag,
      );
      return this.translate.instant('CashflowGame.diceSplitText', {
        share: deal.split.shareTag,
        qty: share?.quantity ?? 0,
      });
    }
    if (deal.recurring) {
      return this.translate.instant('CashflowGame.diceWinsOnPayday', {
        n: deal.successOn,
        amount: this.cardAmount(
          (deal.payoutMinor ?? 0) * this.cashflowGameService.paydayRollCount(deal),
        ),
      });
    }
    if (deal.payoutMinor) {
      return this.translate.instant('CashflowGame.diceWinsOnPayout', {
        n: deal.successOn,
        amount: this.cardAmount(deal.payoutMinor),
      });
    }
    return this.translate.instant('CashflowGame.diceWinsOn', {
      n: deal.successOn,
      coins: deal.coins,
    });
  }

  /** A special-asset card (gold coins): a price and a number of coins, sometimes decided by a die. */
  get isAssetCard(): boolean {
    return this.isDealDeck && (this.activeCard as CashflowDealCard | null)?.assetKind === 'asset';
  }

  get isInvestmentCard(): boolean {
    return (
      this.isDealDeck && (this.activeCard as CashflowDealCard | null)?.assetKind === 'investment'
    );
  }

  /** The line every investment card prints ("Use this offer yourself or sell it to another player."). */
  get investmentRuleText(): string {
    return this.cardText.sharedText('investmentRule');
  }

  /** The Grow project of the open stock card's share while the player still holds some, or undefined (then the card is planned). */
  /** The card open on screen has been planned and its project still exists: it is only read now. */
  get activeCardProject(): Grow | null {
    const card = this.activeCard as { id?: string } | null;
    return card?.id ? CashflowGameService.heldProjectFor(card.id) : null;
  }

  /** The card open on screen was played on this space: it is read, nothing more can be done with it. */
  /** At a table: the card in hand has been played already (a Market card takes effect as it is opened) and waits to be ticked off. */
  get cardInHandPlayed(): boolean {
    if (!this.remote || this.historyCardView || this.remote.viewOnly()) return false;
    const pending = this.appState.cashflowGame.turn?.pending;
    const card = this.activeCard as { id?: string } | null;
    return !!pending?.played && !!card?.id && pending.offered?.cardId === card.id;
  }

  get activeCardReadOnly(): boolean {
    // a card brought back from the history is only read, whatever became of it
    if (this.historyCardView) return true;
    const card = this.activeCard as { id?: string } | null;
    return !!card?.id && CashflowGameService.isPlayedCard(card.id);
  }

  get activeShareProject(): Grow | undefined {
    if (!this.isShareCard) return undefined;
    const card = this.activeCard as CashflowDealCard;
    return this.cashflowGameService.heldShareProjectFor(card.symbol ?? card.title);
  }

  /**
   * A stock card for a share the player still holds sets the market price instead of planning
   * (JFK, 2026-10-03): Grow and the share asset take the card's price, a note records it, and the
   * player lands on the project to buy or sell at it - or not.
   */
  private updateActiveSharePrice(): void {
    const card = this.activeCard as CashflowDealCard;
    this.isBusy = true;
    this.cashflowGameService.updateSharePrice(
      card,
      { description: this.cardText.textFor(card.id).description },
      {
        onSuccess: (title) => {
          this.isBusy = false;
          this.toastService.show(this.translate.instant('CashflowGame.priceUpdated'), 'success');
          this.backToMain();
          // Financials with Buy / Sell, no edit mode: the share count is already set.
          void this.openPlannedInGrow(title, 'investment');
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      },
    );
    this.backToMain();
  }

  /** A stock card (as opposed to a property) — has a ticker symbol and a trading range. */
  get isShareCard(): boolean {
    return this.isDealDeck && (this.activeCard as CashflowDealCard | null)?.assetKind === 'share';
  }

  /** Sell the open card to another player for a one-off price — revealed by its own button, same collapsed pattern as card search. */
  showFriendSale = false;
  friendPrice: number | null = null;

  /** Closes the sale panel without selling - no deal found (JFK, 2026-09-30). */
  cancelFriendSale(): void {
    this.showFriendSale = false;
    this.friendPrice = null;
  }

  sellActiveCardToFriend(): void {
    // a share card belongs to whoever drew it: only property and asset cards can be sold (JFK, 2026-10-06)
    if (!this.activeCard || this.friendPrice === null || this.isShareCard) return;
    if (this.remote) {
      const priceMinor = Math.round(this.friendPrice * 100);
      void this.remoteMove((remote) => remote.offerTrade(priceMinor)).then((events) => {
        if (events) {
          this.friendPrice = null;
          this.showFriendSale = false;
          this.toastService.show(this.translate.instant('CashflowGame.cardOffered'), 'success');
        }
      });
      return;
    }
    this.recordOpenCard();
    this.isBusy = true;
    this.cashflowGameService.sellCardToFriend(
      this.activeCard as CashflowDealCard,
      this.friendPrice,
      {
        onSuccess: () => {
          this.isBusy = false;
          this.toastService.show(this.translate.instant('CashflowGame.cardSold'), 'success');
          this.backToMain();
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      },
      this.cardText.symbolFor((this.activeCard as CashflowDealCard).symbol),
    );
  }

  /** Paid dice cards waiting for their roll. */
  get openDecisions(): CashflowAssetDeal[] {
    return this.cashflowGameService.openDecisions;
  }

  /**
   * What the dashboard shows of them: nothing while the totem is still moving. A Payday passed on the way brings a kept
   * Multi-Level-Marketing card's roll with it, and its dialog comes once the totem has moved over the Payday tile and
   * come to rest - not at once, while the token is still walking (JFK, 2026-10-06).
   */
  get visibleDecisions(): CashflowAssetDeal[] {
    return this.walking ? [] : this.openDecisions;
  }

  /** The app rolls the die. */
  rollDice(deal: CashflowAssetDeal): void {
    const roll = this.cashflowGameService.rollDie();
    // A stock split doubles on 1-3 (and halves on 4-6); every other card wins on a high roll.
    this.settleDecision(deal, deal.split ? roll <= 3 : roll >= (deal.successOn ?? 6), roll);
  }

  /** The die of a dice action (MLM, a sister's loan ...) while it rolls and rests; null when no such die is on show. */
  decisionFaces: number[] | null = null;

  /**
   * What a dice action rolled, told in the dice panel itself - under the die that stays on its number - until the player
   * continues (JFK, 2026-10-11: not in a separate box below). Gold, a market dice card, a split and MLM alike.
   */
  decisionOutcome: {
    title: string;
    roll?: number;
    won: boolean;
    headline: string;
    text: string;
  } | null = null;

  /** The dice panel is on screen: a dice action waits for its roll, or tells what it rolled. */
  get diceActionOpen(): boolean {
    return !!this.firstDiceDecision || !!this.decisionOutcome;
  }

  dismissDecisionOutcome(): void {
    this.decisionOutcome = null;
    this.decisionFaces = null;
  }

  /**
   * In a solo game an open dice action takes the place of the roll panel (JFK, 2026-10-11): the die tumbles and lands on the
   * roll, rests there for a moment, and then the result shows and the normal panel is back.
   */
  get firstDiceDecision(): CashflowAssetDeal | null {
    // at a table the roll is settled by the server before the die has tumbled: the card stays in its box until it is told
    return this.isSolo ? (this.rollingDecision ?? this.visibleDecisions[0] ?? null) : null;
  }

  /** The dice action being rolled at a table: its box stays where it is while the die tumbles (no switching to the roll panel). */
  private rollingDecision: CashflowAssetDeal | null = null;

  /** The cards of open dice actions shown as cards of their own (a companion game; a solo game has the dice panel). */
  get decisionCards(): CashflowAssetDeal[] {
    return this.isSolo ? [] : this.visibleDecisions;
  }

  /**
   * The die of a dice action is on its way (from the press of the button until it has come to rest): the button says so and a skip
   * button shows, as at the normal roll (JFK, 2026-10-25) - there is no doubt whether it was pressed.
   */
  decisionRolling = false;
  private decisionSkip = false;

  async rollDecisionDice(deal: CashflowAssetDeal): Promise<void> {
    if (this.isBusy || this.decisionFaces || this.decisionRolling) return;
    this.decisionRolling = true;
    this.decisionSkip = false;
    try {
      await this.rollDecisionDiceNow(deal);
    } finally {
      this.decisionRolling = false;
    }
  }

  private async rollDecisionDiceNow(deal: CashflowAssetDeal): Promise<void> {
    if (this.remote) {
      const payoutTotal = (deal.payoutMinor ?? 0) * this.cashflowGameService.paydayRollCount(deal);
      this.rollingDecision = deal;
      const events = await this.remoteMove((remote) => remote.rollDecision(deal.title));
      const decided = events?.find((event) => event.type === 'dice_decided');
      const face = decided?.data?.['roll'];
      if (typeof face === 'number') {
        this.decisionFaces = [face];
        this.skipWalking = this.decisionSkip;
        await this.tumbleDice(1);
        await this.pause(DICE_DECISION_REST_MS);
        // as in the solo game: the die stays on its number, with what it came to, until the player continues
        this.tellDecisionOutcome(deal, decided?.data?.['won'] === true, face, payoutTotal);
      }
      this.rollingDecision = null;
      return;
    }
    this.isBusy = true;
    const roll = this.cashflowGameService.rollDie();
    this.decisionFaces = [roll];
    this.skipWalking = this.decisionSkip;
    await this.tumbleDice(1);
    await this.pause(DICE_DECISION_REST_MS);
    this.isBusy = false;
    // The die stays on its number until the result has been read (dismissDecisionOutcome).
    // A stock split doubles on 1-3 (and halves on 4-6); every other card wins on a high roll.
    this.settleDecision(deal, deal.split ? roll <= 3 : roll >= (deal.successOn ?? 6), roll);
  }

  /** The player rolled a real die and says how it went. */
  reportRoll(deal: CashflowAssetDeal, won: boolean): void {
    const refused = whyCannotReportRoll(this.appState.cashflowGame);
    if (refused) {
      this.toastService.show(CashflowGameService.ruleText(refused), 'error');
      return;
    }
    this.settleDecision(deal, won);
  }

  /**
   * What the app's die showed, kept on screen until the player moves on (JFK, 2026-10-03: the toast
   * at the bottom is too small and too quick to read). Only set for a roll made in the app - a roll
   * reported from a real die has no number to show.
   */
  rollResult: {
    roll: number;
    won: boolean;
    headline: string;
    text: string;
  } | null = null;

  /** The outcome of a kept Multi-Level-Marketing card's Payday roll, as an info box next to the Payday box. */
  mlmBanner: { won: boolean; text: string } | null = null;

  /** The nine spots of a die face, true where a pip sits: three rows of three, read left to right. */
  dieCells(face: number): boolean[] {
    const pips: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const on = new Set(pips[face] ?? []);
    return Array.from({ length: 9 }, (_, cell) => on.has(cell));
  }

  /** Back to the dashboard from the dice result. */
  dismissRollResult(): void {
    this.rollResult = null;
  }

  /** What a rolled die came to, told in the dice panel (and the toast): the same for a roll made here and one made at a table. */
  private tellDecisionOutcome(
    deal: CashflowAssetDeal,
    won: boolean,
    roll: number | undefined,
    payoutTotal: number,
  ): void {
    const rolled = roll ? `${this.translate.instant('CashflowGame.diceRolled', { roll })} ` : '';
    const result = deal.split
      ? ((won ? deal.successText : deal.failureText) ?? '')
      : this.translate.instant(
          won
            ? deal.payoutMinor
              ? 'CashflowGame.diceWonPayoutToast'
              : 'CashflowGame.diceWonToast'
            : 'CashflowGame.diceLostToast',
          {
            coins: deal.coins,
            amount: deal.payoutMinor ? this.cardAmount(payoutTotal) : '',
          },
        );
    this.toastService.show(`${rolled}${result}`, won ? 'success' : 'update');
    if (this.isSolo) {
      this.decisionOutcome = {
        title: deal.split?.shareTag ?? deal.title,
        ...(roll ? { roll } : {}),
        won,
        headline: result,
        text: deal.recurring ? '' : ((won ? deal.successText : deal.failureText) ?? ''),
      };
    }
    if (deal.recurring) {
      // the Payday bonus of a kept MLM card: a box beside the Payday box in a companion game; a solo game tells it in the
      // dice panel (decisionOutcome), where it is read once and gone (JFK, 2026-10-11: no second banner)
      if (!this.isSolo) this.mlmBanner = { won, text: `${rolled}${result}`.trim() };
    } else if (roll && !this.isSolo) {
      this.rollResult = {
        roll,
        won,
        headline: result,
        text: (won ? deal.successText : deal.failureText) ?? '',
      };
    }
  }

  private settleDecision(deal: CashflowAssetDeal, won: boolean, roll?: number): void {
    this.isBusy = true;
    // A Payday roll pays once per kept card; counted before the roll clears it.
    const payoutTotal = (deal.payoutMinor ?? 0) * this.cashflowGameService.paydayRollCount(deal);
    this.cashflowGameService.resolveGamble(
      deal.title,
      { won, roll },
      {
        onSuccess: () => {
          this.isBusy = false;
          this.tellDecisionOutcome(deal, won, roll, payoutTotal);
        },
        onError: (message) => {
          this.isBusy = false;
          this.decisionFaces = null;
          this.toastService.show(message, 'error');
        },
      },
    );
  }

  get isDealDeck(): boolean {
    return this.activeDeckKind === 'dealSmall' || this.activeDeckKind === 'dealBig';
  }

  /**
   * An amount as the printed card shows it: "50.000 €", no ",00" on whole amounts and no sign - only
   * Cashflow gets the "+" (`signed`). The shared `appNumber` pipe prefixes every positive with "+",
   * which reads as noise on a card full of costs.
   */
  cardAmount(minor: number, signed = false): string {
    const amount = this.toDisplayAmount(minor);
    const locale = this.appState.isEuropeanFormat ? 'de-DE' : 'en-US';
    const text = formatNumber(Math.abs(amount), locale, '1.0-2');
    return `${signed && amount > 0 ? '+' : ''}${text} ${this.appState.currency}`;
  }

  /** One compact tile of the lookup grid - only the facts you scan for when matching a physical card. */
  private tileFor(card: CashflowDealCard | CashflowMarketCard | CashflowDoodadCard): CardTile {
    const any = card as any;
    const money = (minor?: number) =>
      minor === undefined ? null : this.toDisplayAmount(minor).toLocaleString();
    const name = this.cardText.textFor(card.id).title ?? card.title;
    // The label in the language picked for the game (SFH in English), the deck's own (EFH) kept for search.
    const label: string = any.symbol
      ? (this.cardText.symbolFor(any.symbol) ?? any.symbol)
      : any.sells
        ? this.marketTypeLabel(any.sells)
        : any.splits
          ? any.splits.symbol
          : name;
    // A market buyer card is told apart by its offer: "+20%" or "+20.000 €".
    const offer: string = any.sells
      ? this.marketOfferText(any.sells)
      : any.boost
        ? `+${this.cardAmount(any.boost.addMinor)}`
        : '';
    const priceText = any.pays
      ? String(any.pays.costMinor / 100)
      : any.boost
        ? String(any.boost.addMinor / 100)
        : any.sells
          ? String(
              any.sells.plusPercent ??
                (any.sells.plusMinor ??
                  any.sells.priceMinor ??
                  any.sells.pricePerUnitMinor ??
                  any.sells.pricePerCoinMinor ??
                  0) / 100,
            )
          : String((any.priceMinor ?? any.depositMinor ?? any.costMinor ?? 0) / 100);
    return {
      card,
      primary: `${label}${any.superDeal || any.star ? ' ★' : ''}`,
      secondary: (any.symbol || any.sells || any.splits) && label !== name ? name : '',
      search: [label, any.symbol, any.sells?.family, name, card.title, offer]
        .join(' ')
        .toLowerCase(),
      priceText,
      value: money(any.priceMinor ?? any.costMinor ?? any.pays?.costMinor ?? any.depositMinor),
      range:
        this.activeDeckKind === 'doodad'
          ? (any.account ?? '')
          : any.splits
            ? '🎲 ×2 / ÷2'
            : any.sells || any.boost
              ? offer
              : any.rangeMinMinor !== undefined
                ? `${money(any.rangeMinMinor)} - ${money(any.rangeMaxMinor)}`
                : any.assetKind === 'asset'
                  ? `${any.quantity ? `×${any.quantity}` : ''}${any.successOn ? ' 🎲' : ''}${any.payoutMinor ? ` ${money(any.payoutMinor)}` : ''}`.trim()
                  : any.cashflowMinor !== undefined
                    ? `+${money(any.cashflowMinor)}`
                    : '',
    };
  }

  private tilesKey = '';
  private tilesCache: CardTile[] = [];

  /** Quick filter under the search: only one card kind at a time; null shows everything. */
  cardKindFilter: CardKind | null = null;
  private kindsKey = '';
  private kindsCache: CardKind[] = [];

  /**
   * Which kinds the open Deal pile actually holds - the quick filter only appears when there is more
   * than one to choose between (Small Deal: Share + Investment; Big Deal has only Investments, so no
   * filter there).
   */
  get cardKinds(): CardKind[] {
    if (!this.isDealDeck) return [];
    const key = `${this.appState.cashflowGame.gameSetId}|${this.activeDeckKind}`;
    if (key !== this.kindsKey) {
      this.kindsKey = key;
      const present = new Set(
        this.cashflowGameService
          .browseCards(this.activeDeckKind, '')
          .map((card) => (card as CashflowDealCard).assetKind),
      );
      this.kindsCache = (['share', 'investment', 'asset'] as CardKind[]).filter((kind) =>
        present.has(kind),
      );
    }
    return this.kindsCache;
  }

  /**
   * A dropdown picks one value or "all" (empty) - the same as tapping a chip, including what a chip clears with it. On a
   * phone the quick filters are dropdowns: a row of chips ran off the screen.
   */
  private pickFilter<T extends string>(
    current: T | null,
    value: string,
    toggle: (value: T) => void,
  ): void {
    if (!value) {
      if (current !== null) toggle(current); // tapping the active chip clears it
    } else if (current !== value) {
      toggle(value as T);
    }
  }

  pickCardKind(value: string): void {
    this.pickFilter(this.cardKindFilter, value, (kind) => this.toggleCardKind(kind));
  }

  pickCardFamily(value: string): void {
    this.pickFilter(this.cardFamilyFilter, value, (family) => this.toggleCardFamily(family));
  }

  pickMarketFamily(value: string): void {
    this.pickFilter(this.marketFamilyFilter, value, (family) => this.toggleMarketFamily(family));
  }

  pickMarketOffer(value: string): void {
    this.pickFilter(this.marketOfferFilter, value, (kind) => this.toggleMarketOffer(kind));
  }

  pickDoodadAccount(value: string): void {
    this.pickFilter(this.doodadAccountFilter, value, (account) =>
      this.toggleDoodadAccount(account),
    );
  }

  pickDoodadGroup(value: string): void {
    this.pickFilter(this.doodadGroupFilter, value, (group) => this.toggleDoodadGroup(group));
  }

  /** Tapping the active filter again clears it. */
  toggleCardKind(kind: CardKind): void {
    this.cardKindFilter = this.cardKindFilter === kind ? null : kind;
    // A type chosen under the previous kind may not exist under this one.
    if (this.cardFamilyFilter && !this.cardFamilies.includes(this.cardFamilyFilter)) {
      this.cardFamilyFilter = null;
    }
  }

  /** The second row of quick filters: the types of property / business / asset in the open pile. */
  cardFamilyFilter: string | null = null;
  private familiesKey = '';
  private familiesCache: string[] = [];

  /** A card's type - its label without the unit count: MFH4 and MFH8 are both "MFH". Shares have none (they are told apart by ticker). */
  private familyOf(card: CashflowDealCard): string {
    return (card.symbol ?? card.title).replace(/\d+$/, '');
  }

  /**
   * The types present in the open pile under the current kind filter, in the order the pile lists
   * them. Shown only when there is more than one to choose between (the Big Deal has no Share /
   * Investment choice at all, only types).
   */
  get cardFamilies(): string[] {
    if (!this.isDealDeck) return [];
    const key = `${this.appState.cashflowGame.gameSetId}|${this.activeDeckKind}|${this.cardKindFilter}`;
    if (key !== this.familiesKey) {
      this.familiesKey = key;
      const seen = new Set<string>();
      for (const card of this.cashflowGameService.browseCards(this.activeDeckKind, '')) {
        const deal = card as CashflowDealCard;
        if (deal.assetKind === 'share') continue;
        if (this.cardKindFilter && deal.assetKind !== this.cardKindFilter) continue;
        seen.add(this.familyOf(deal));
      }
      this.familiesCache = [...seen];
    }
    return this.familiesCache;
  }

  familyLabel(family: string): string {
    return this.cardText.familyName(family);
  }

  toggleCardFamily(family: string): void {
    this.cardFamilyFilter = this.cardFamilyFilter === family ? null : family;
  }

  /** Market quick filters: the property type a buyer wants, and whether the offer is a percentage or a fixed amount. */
  marketFamilyFilter: string | null = null;
  marketOfferFilter: MarketKind | null = null;

  private get marketCards(): CashflowMarketCard[] {
    return this.activeDeckKind === 'market'
      ? (this.cashflowGameService.browseCards('market', '') as CashflowMarketCard[])
      : [];
  }

  /** The property types the pile has buyers for (EFH...), in pile order. */
  get marketFamilies(): string[] {
    return [
      ...new Set(
        this.marketCards.map((card) => card.sells?.family).filter((f): f is string => !!f),
      ),
    ];
  }

  /** Percentage / fixed amount, only the kinds present under the chosen type, and only when there is a choice. */
  get marketOfferKinds(): MarketKind[] {
    const kinds = new Set<MarketKind>();
    for (const card of this.marketCards) {
      if (!card.sells) {
        // A card without a property type (costs, splits, boosts) has nothing to filter by type.
        if (!this.marketFamilyFilter) kinds.add(this.marketCardKind(card));
        continue;
      }
      if (this.marketFamilyFilter && card.sells.family !== this.marketFamilyFilter) continue;
      kinds.add(this.marketKind(card.sells));
    }
    return kinds.size > 1 ? [...kinds] : [];
  }

  toggleMarketFamily(family: string): void {
    this.marketFamilyFilter = this.marketFamilyFilter === family ? null : family;
    // An offer kind chosen earlier may not exist for this type.
    if (this.marketOfferFilter && !this.marketOfferKinds.includes(this.marketOfferFilter)) {
      this.marketOfferFilter = null;
    }
  }

  /** How a buyer's offer is made: a percentage, a fixed profit, or a price (for the whole property / per unit). */
  marketKind(sells: NonNullable<CashflowMarketCard['sells']>): 'percent' | 'amount' | 'price' {
    return sells.plusPercent !== undefined
      ? 'percent'
      : sells.plusMinor !== undefined
        ? 'amount'
        : 'price';
  }

  /** The word that completes a chip's translation key (marketOfferPercent, marketOfferCost...). */
  marketKindWord(kind: MarketKind): string {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  /** The offer kind a market card is filed under in the quick filter. */
  marketCardKind(card: CashflowMarketCard): MarketKind {
    if (card.sells) return this.marketKind(card.sells);
    if (card.pays) return 'cost';
    if (card.splits) return 'split';
    return 'boost';
  }

  toggleMarketOffer(kind: MarketKind): void {
    this.marketOfferFilter = this.marketOfferFilter === kind ? null : kind;
  }

  /** Schnickschnack quick filters: the suggested account and the spending group (= the transaction's category). */
  doodadAccountFilter: string | null = null;
  doodadGroupFilter: string | null = null;

  /** The Doodads of the open pile - empty for any other pile. */
  private get doodadCards(): CashflowDoodadCard[] {
    return this.activeDeckKind === 'doodad'
      ? (this.cashflowGameService.browseCards('doodad', '') as CashflowDoodadCard[])
      : [];
  }

  /** The accounts the pile suggests, in the order the cards first name them (shown only when there is a choice). */
  get doodadAccounts(): string[] {
    const accounts = new Set(this.doodadCards.map((card) => card.account ?? 'Splurge'));
    return accounts.size > 1 ? [...accounts] : [];
  }

  /** The spending groups present under the account filter, so a chip never leads to an empty list. */
  get doodadGroups(): string[] {
    const groups = new Set<string>();
    for (const card of this.doodadCards) {
      if (this.doodadAccountFilter && (card.account ?? 'Splurge') !== this.doodadAccountFilter) {
        continue;
      }
      if (card.group) groups.add(card.group);
    }
    return groups.size > 1 ? [...groups] : [];
  }

  doodadGroupLabel(group: string): string {
    return this.cardText.groupName(group);
  }

  toggleDoodadAccount(account: string): void {
    this.doodadAccountFilter = this.doodadAccountFilter === account ? null : account;
    // A group chosen earlier may have no card under this account.
    if (this.doodadGroupFilter && !this.doodadGroups.includes(this.doodadGroupFilter)) {
      this.doodadGroupFilter = null;
    }
  }

  toggleDoodadGroup(group: string): void {
    this.doodadGroupFilter = this.doodadGroupFilter === group ? null : group;
  }

  /** The lookup grid: everything in the open deck, narrowing as the player types. Memoised so typing stays instant however big the catalog gets. */
  get cardTiles(): CardTile[] {
    // `cardText.version` is part of the key: the tiles are built from translated text, which
    // arrives a moment after the pile opens - without it they would keep the untranslated names.
    const key = `${this.appState.cashflowGame.gameSetId}|${this.activeDeckKind}|${this.cardQuery}|${this.cardKindFilter}|${this.cardFamilyFilter}|${this.doodadAccountFilter}|${this.doodadGroupFilter}|${this.marketFamilyFilter}|${this.marketOfferFilter}|${this.translate.currentLang}|${this.cardText.version}`;
    if (key !== this.tilesKey) {
      this.tilesKey = key;
      // Search matches the label and name in the picked language as well as the deck's own, so
      // both "sfh" and "efh" find a single-family home.
      const words = this.cardQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      this.tilesCache = this.cashflowGameService
        .browseCards(this.activeDeckKind, '')
        .filter(
          (card) =>
            !this.cardKindFilter || (card as CashflowDealCard).assetKind === this.cardKindFilter,
        )
        .filter(
          (card) =>
            !this.cardFamilyFilter ||
            ((card as CashflowDealCard).assetKind !== 'share' &&
              this.familyOf(card as CashflowDealCard) === this.cardFamilyFilter),
        )
        .filter((card) => {
          if (this.activeDeckKind !== 'market') return true;
          const sells = (card as CashflowMarketCard).sells;
          return (
            (!this.marketFamilyFilter || sells?.family === this.marketFamilyFilter) &&
            (!this.marketOfferFilter ||
              this.marketCardKind(card as CashflowMarketCard) === this.marketOfferFilter)
          );
        })
        .filter((card) => {
          const doodad = card as CashflowDoodadCard;
          if (this.activeDeckKind !== 'doodad') return true;
          return (
            (!this.doodadAccountFilter ||
              (doodad.account ?? 'Splurge') === this.doodadAccountFilter) &&
            (!this.doodadGroupFilter || doodad.group === this.doodadGroupFilter)
          );
        })
        .map((card) => this.tileFor(card))
        .filter((tile) =>
          words.every((word) => tile.search.includes(word) || tile.priceText.startsWith(word)),
        );
    }
    return this.tilesCache;
  }

  get cardSearchResults(): (CashflowDealCard | CashflowMarketCard | CashflowDoodadCard)[] {
    if (!this.cardQuery.trim()) return [];
    return this.cashflowGameService.findCardsInDeck(this.activeDeckKind, this.cardQuery);
  }

  changeDeck(): void {
    this.cardKindFilter = null;
    this.cardFamilyFilter = null;
    this.doodadAccountFilter = null;
    this.doodadGroupFilter = null;
    this.marketFamilyFilter = null;
    this.marketOfferFilter = null;
    this.activeCard = null;
    this.cardQuery = '';
  }

  selectCard(card: CashflowDealCard | CashflowMarketCard | CashflowDoodadCard): void {
    // browsing is not tracked: the card counts once it is acted on or declined (recordOpenCard)
    this.activeCard = card;
    this.cardQuery = '';
  }

  /** Declining a Deal card ends the turn's card business - straight back to the main dashboard (JFK, 2026-09-30). */
  declineActiveCard(): void {
    if (this.remote) {
      void this.remoteMove((remote) => remote.pass()).then(() => this.backToMain());
      return;
    }
    // declining uses the card up: back on the dashboard it can be looked at again, or ticked off with Done
    this.recordOpenCard();
    this.cashflowGameService.declineCard({
      onSuccess: () => this.backToMain(),
      onError: (message) => this.toastService.show(message, 'error'),
    });
  }

  clearActiveCard(): void {
    this.activeCard = null;
  }

  /** "In this app we pick randomly a card" (JFK, 2026-09-26) — no physical deck needed. */
  drawActiveCard(): void {
    // the pile is shuffled in view first (a moment), then the card pops up - never an empty card frame
    this.drawing = true;
    const started = Date.now();
    if (this.remote) {
      void this.remoteMove((remote) => remote.draw(this.activeDeckKind)).then((events) => {
        if (!events) {
          this.drawing = false;
          return;
        }
        const offered = this.appState.cashflowGame.turn?.pending?.offered;
        const card = offered
          ? this.cashflowGameService
              .browseCards(offered.deck, '')
              .find((candidate: { id: string }) => candidate.id === offered.cardId)
          : undefined;
        void this.revealCard(card as typeof this.activeCard | undefined, started);
      });
      return;
    }
    this.isBusy = true;
    this.cashflowGameService.drawCard(
      this.activeDeckKind,
      {
        onSuccess: (card) => {
          this.isBusy = false;
          void this.revealCard(card, started);
        },
        onError: (message) => {
          this.isBusy = false;
          this.drawing = false;
          this.toastService.show(message, 'error');
        },
      },
      { labelFor: (symbol) => this.cardText.symbolFor(symbol) },
    );
  }

  /** The card is being drawn: the pile shuffles on screen. */
  drawing = false;

  /** How long the pile shuffles at least, so the player sees it (0 in the tests). */
  static shuffleMs = 650;

  private async revealCard(
    card: typeof this.activeCard | undefined,
    started: number,
  ): Promise<void> {
    const left = CashflowGameComponent.shuffleMs - (Date.now() - started);
    if (left > 0) await this.pause(left);
    if (card) this.activeCard = card;
    this.drawing = false;
  }

  /** Deal: plans it. Doodad: pays its cost now. Market: nothing to apply — see CASHFLOW_GAME_GUIDE.md §4/§6. */
  applyActiveCard(): void {
    if (!this.activeCard) return;
    if (this.remote) {
      const card = this.activeCard;
      // as in the solo game: the card becomes a planned Grow project, which is bought (and its share count set) over there
      this.backToMain();
      void this.remoteMove((remote) => remote.plan(card.id)).then((events) => {
        const played = events?.find((event) => event.type === 'card_played');
        if (!played) return;
        const title = String(
          played.data?.['title'] ?? (card as CashflowDealCard).symbol ?? card.title,
        );
        this.toastService.show(this.translate.instant('CashflowGame.cardApplied'), 'success');
        const kind = (card as CashflowDealCard).assetKind;
        this.backToMain();
        void this.openPlannedInGrow(title, kind);
      });
      return;
    }
    this.recordOpenCard();
    if (this.activeShareProject) {
      this.updateActiveSharePrice();
      return;
    }
    const plannedCard = this.isDealDeck ? (this.activeCard as CashflowDealCard) : null;
    const callbacks = {
      onSuccess: (plannedTitle?: string) => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.cardApplied'), 'success');
        const planned = plannedCard;
        this.backToMain();
        if (planned) {
          void this.openPlannedInGrow(
            plannedTitle ?? planned.symbol ?? planned.title,
            planned.assetKind,
          );
        }
      },
      onError: (message: string) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    };
    this.isBusy = true;
    if (this.isDealDeck) {
      this.cashflowGameService.applyDealCard(
        this.activeCard as CashflowDealCard,
        callbacks,
        this.planText(this.activeCard as CashflowDealCard),
      );
      // the card closes at once; the spinner says the plan is being made
      this.backToMain();
    } else {
      this.isBusy = false;
    }
  }

  /** A buyer's offer as printed: "+20%" or "+20.000 €". */
  marketOfferText(sells: NonNullable<CashflowMarketCard['sells']>): string {
    if (sells.plusPercent !== undefined) return `+${sells.plusPercent}%`;
    if (sells.plusMinor !== undefined) return `+${this.cardAmount(sells.plusMinor)}`;
    if (sells.priceMinor !== undefined) return this.cardAmount(sells.priceMinor);
    if (sells.pricePerCoinMinor !== undefined) {
      return `${this.cardAmount(sells.pricePerCoinMinor)} ${this.translate.instant('CashflowGame.marketPerCoin')}`;
    }
    return `${this.cardAmount(sells.pricePerUnitMinor ?? 0)} ${this.translate.instant('CashflowGame.marketPerUnit')}`;
  }

  /** The line under a buyer card's offer: what the number is on top of / for. */
  marketHintKey(sells: NonNullable<CashflowMarketCard['sells']>): string {
    if (sells.priceMinor !== undefined) return 'CashflowGame.marketFixedPrice';
    if (sells.pricePerUnitMinor !== undefined) return 'CashflowGame.marketForEveryUnit';
    if (sells.pricePerCoinMinor !== undefined) return 'CashflowGame.marketForEveryCoin';
    return 'CashflowGame.marketOnTop';
  }

  /** The property type a buyer card is about, as the game names it (SFH in English). */
  marketTypeLabel(sells: NonNullable<CashflowMarketCard['sells']>): string {
    const symbol = sells.symbols?.[0] ?? sells.family;
    // APT4 / APT8 are both "APT": the unit count belongs to the building, not to the type.
    return (this.cardText.symbolFor(symbol) ?? symbol).replace(/\d+$/, '');
  }

  /** The open market card when it is a buyer card, else null. */
  get activeMarket(): CashflowMarketCard | null {
    return this.activeDeckKind === 'market' && this.activeCard
      ? (this.activeCard as CashflowMarketCard)
      : null;
  }

  /** Shown on the dashboard after a market card that does not apply to the player ("you own no such property"). */
  marketNotice: string | null = null;

  /**
   * Plays the open market buyer card (JFK, 2026-10-03): every property of that type the player owns
   * gets the offer, and the player lands on the Grow page to pick which to sell. A card that does not
   * apply to them - they own none of that type - only says so here.
   */
  playActiveMarket(): void {
    // at a table the Market card took effect for everyone when it was opened: playing it is ticking it off
    if (this.remote) {
      this.finishSoloDecision('done');
      return;
    }
    const card = this.activeMarket;
    if (!card?.sells) return;
    this.recordOpenCard();
    const symbols = card.sells.symbols ?? [card.sells.family];
    const families = [...new Set(symbols.map((symbol) => symbol.replace(/\d+$/, '')))];
    this.isBusy = true;
    this.cashflowGameService.playMarketCard(
      card,
      {
        title: this.activeCardTitle,
        // APH24: the number in a symbol is the unit count (WE) - the domain reads it.
        types: buyerCardTypes(card, (symbol) => this.cardText.symbolFor(symbol)),
      },
      {
        onSuccess: (matched) => {
          this.isBusy = false;
          if (matched.length) {
            this.toastService.show(
              this.translate.instant('CashflowGame.marketOffersAdded', { count: matched.length }),
              'success',
            );
            this.closeWindow();
            void this.router.navigate(['/grow']);
          } else {
            this.marketNotice = this.translate.instant('CashflowGame.marketNoMatch', {
              type: families.map((family) => this.cardText.familyName(family)).join(' / '),
            });
            this.backToMain();
          }
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      },
    );
    this.backToMain();
  }

  /** Plays the open stock split card: with the share a dice decision opens, without it the card does not apply. */
  playActiveMarketSplit(): void {
    // at a table the Market card took effect for everyone when it was opened: playing it is ticking it off
    if (this.remote) {
      this.finishSoloDecision('done');
      return;
    }
    const card = this.activeMarket;
    if (!card?.splits) return;
    this.recordOpenCard();
    const symbol = card.splits.symbol;
    this.isBusy = true;
    this.cashflowGameService.playShareSplitCard(
      card,
      { title: this.activeCardTitle, labels: [symbol] },
      {
        onSuccess: (share) => {
          this.isBusy = false;
          if (!share) {
            this.marketNotice = this.translate.instant('CashflowGame.marketNoShare', {
              share: symbol,
            });
          }
          this.backToMain();
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      },
    );
    this.backToMain();
  }

  /** Plays the open cashflow boost card: raises the cashflow of every investment under its limit. */
  playActiveMarketBoost(): void {
    // at a table the Market card took effect for everyone when it was opened: playing it is ticking it off
    if (this.remote) {
      this.finishSoloDecision('done');
      return;
    }
    const card = this.activeMarket;
    if (!card?.boost) return;
    this.recordOpenCard();
    const boost = card.boost;
    this.isBusy = true;
    this.cashflowGameService.playBoostCard(
      card,
      {
        title: this.activeCardTitle,
        businessLabels: boost.onlyBusinesses
          ? businessCardLabels((symbol) => this.cardText.symbolFor(symbol))
          : undefined,
      },
      {
        onSuccess: (changed) => {
          this.isBusy = false;
          this.marketNotice = changed.length
            ? this.translate.instant('CashflowGame.marketBoostDone', {
                add: this.cardAmount(boost.addMinor),
                count: changed.length,
                names: changed.map((entry) => entry.title).join(', '),
              })
            : this.translate.instant('CashflowGame.marketBoostNone', {
                max: this.cardAmount(boost.maxCashflowMinor),
              });
          this.backToMain();
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      },
    );
  }

  /** The open Doodad card, or null when another kind of card is open. */
  get activeDoodad(): CashflowDoodadCard | null {
    return this.activeDeckKind === 'doodad' && this.activeCard
      ? (this.activeCard as CashflowDoodadCard)
      : null;
  }

  /** The category the open Doodad's payment will carry: its spending group in the game's language. */
  get doodadCategory(): string {
    const card = this.activeDoodad;
    if (!card) return '';
    return card.group
      ? this.cardText.groupName(card.group)
      : (this.activeCardText.title ?? card.title);
  }

  /** The line a Doodad card prints under its title ("Take a bank loan if you have to"). */
  get doodadHint(): string {
    const hint = this.activeDoodad?.hint;
    // A card's own printed line ("Maybe you get a shiny gold tooth!") stands in when it has no loan / child hint.
    if (!hint) return this.activeDoodad ? (this.activeCardText.description ?? '') : '';
    const key = {
      loan: 'doodadLoanHint',
      child: 'doodadChildHint',
      loanChild: 'doodadLoanChildHint',
    }[hint];
    return this.cardText.sharedText(key);
  }

  /**
   * Pays the open Doodad through the Add dialog (JFK, 2026-10-03): nothing is booked here. The dialog
   * opens pre-filled - the suggested account, the group as category, the cost, and a comment with a
   * light-hearted line, the cash/loan note and the #doodad tag - and the player can change any of it.
   * The dialog books the payment (taking a Bank loan first when cash is short) as one undo step.
   */
  async payActiveDoodad(): Promise<void> {
    const card = this.activeDoodad;
    if (!card) return;
    const text = this.activeCardText;
    // What was bought, the joke, the cash / loan note, then the tag - the domain composes them, so the
    // game page and the Pro API write the same comment.
    const comment = cardExpenseComment(
      'doodad',
      { title: this.activeCardTitle, flavor: text.comment },
      this.cashflowGameService.doodadLoanNote(card.costMinor),
    );
    await this.openAddDialog({
      account: doodadAccount(card),
      category: this.doodadCategory,
      costMinor: card.costMinor,
      comment,
    });
  }

  /** Opens the normal Add dialog pre-filled as an expense; the player can change any of it. */
  private async openAddDialog(prefill: {
    account: string;
    category: string;
    costMinor: number;
    comment: string;
  }): Promise<void> {
    const { AddComponent } = await import('src/app/panels/add/add.component');
    const { MenuComponent } = await import('src/app/panels/menu/menu.component');
    const { InfoComponent } = await import('src/app/panels/info/info.component');
    this.closeWindow();
    AppComponent?.gotoTop();
    AddComponent.selectedOption = prefill.account;
    AddComponent.categoryTextField = `@${prefill.category}`;
    AddComponent.amountTextField = String(-this.toDisplayAmount(prefill.costMinor));
    AddComponent.commentTextField = prefill.comment;
    AddComponent.isLiabilitie = false;
    AddComponent.loanTextField = '';
    AddComponent.creditTextField = '';
    AddComponent.url = this.router.url;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  /**
   * Pays a Market card that costs money to property owners (JFK, 2026-10-03). Without a property the
   * card does not apply - only a message says so. Otherwise the Add dialog opens pre-filled: Fire, the
   * cost, the next free date, the first property's name as category, and a comment saying what
   * happened, with the cash / loan note and the #market tag. The player can change all of it.
   */
  playActiveMarketCost(): void {
    const card = this.activeMarket;
    // at a table the cost applies to the person who drew the card, who pays it through the normal Add dialog (the game waits for
    // it, a clock that runs out pays it for them); without a property the card is ignored and only ticked off
    if (this.remote) {
      if (!card?.pays) return;
      const property = this.cashflowGameService.marketCostProperty(
        card,
        propertyCardTypes((symbol) => this.cardText.symbolFor(symbol)),
      );
      if (!property) {
        this.marketNotice = this.translate.instant('CashflowGame.marketNoProperty');
        this.finishSoloDecision('done');
        return;
      }
      const flavor = (this.activeCardText.comment ?? '').split('{property}').join(property);
      void this.openAddDialog({
        account: MARKET_COST_ACCOUNT,
        category: property,
        costMinor: card.pays.costMinor,
        comment: cardExpenseComment(
          'marketCost',
          { title: this.activeCardTitle, flavor },
          this.cashflowGameService.doodadLoanNote(card.pays.costMinor),
        ),
      });
      return;
    }
    if (!card?.pays) return;
    this.recordOpenCard();
    const pays = card.pays;
    this.isBusy = true;
    this.cashflowGameService.playMarketCostCard(
      card,
      {
        title: this.activeCardTitle,
        types: propertyCardTypes((symbol) => this.cardText.symbolFor(symbol)),
      },
      {
        onSuccess: (property) => {
          this.isBusy = false;
          if (!property) {
            this.marketNotice = this.translate.instant('CashflowGame.marketNoProperty');
            this.backToMain();
            return;
          }
          const what = (this.activeCardText.comment ?? '').split('{property}').join(property);
          void this.openAddDialog({
            account: MARKET_COST_ACCOUNT,
            category: property,
            costMinor: pays.costMinor,
            comment: cardExpenseComment(
              'marketCost',
              { title: this.activeCardTitle, flavor: what },
              this.cashflowGameService.doodadLoanNote(pays.costMinor),
            ),
          });
        },
        onError: (message) => {
          this.isBusy = false;
          this.toastService.show(message, 'error');
        },
      },
    );
  }

  /**
   * A planned card lives in Grow from here on (JFK, 2026-09-30): close the game panel, go to the Grow
   * page and open the new project's info, where the player sets the share count and buys or sells
   * with Grow's normal tools.
   */
  private async openPlannedInGrow(
    title: string,
    kind: CashflowDealCard['assetKind'] = 'share',
  ): Promise<void> {
    const { InfoGrowComponent } = await import('src/app/panels/info/info-grow/info-grow.component');
    this.closeWindow();
    await this.router.navigate(['/grow']);
    const index = this.appState.allGrowProjects.findIndex((project) => project.title === title);
    if (index < 0) return;
    InfoGrowComponent.setInfoGrowComponent(index, this.appState.allGrowProjects[index]);
    if (kind !== 'share') {
      // A property/franchise card has every number already (deposit, mortgage, cashflow) - no editing,
      // just the Financials overview and the Buy button.
      InfoGrowComponent.activeTab = 'financials';
    } else {
      // Straight into edit mode with Financials open, where the share count is set.
      InfoGrowComponent.openEditWithFinancials();
    }
  }

  // ---------------------------------------------------------------- saved games
  // (JFK, 2026-10-04: one account, several games - the account's own data is the game being played,
  // the others are saved snapshots that can be continued, renamed, exported or deleted.)

  /** The game being renamed in the list, and the text typed so far. */
  renamingId: string | null = null;
  renameText = '';

  /** The one game opened in the list (the others show a single line); a game being renamed counts as open. */
  openGameId: string | null = null;

  isGameOpen(game: SavedGameSummary): boolean {
    return this.openGameId === game.id || this.renamingId === game.id;
  }

  toggleGame(game: SavedGameSummary): void {
    this.openGameId = this.openGameId === game.id ? null : game.id;
  }

  /** The start screen's list of games played so far: closed by default, opened with the button under Start. */
  showStartGames = false;

  openStartGames(): void {
    this.renamingId = null;
    this.showStartGames = true;
    void this.refreshGames();
  }

  closeStartGames(): void {
    this.showStartGames = false;
  }

  openGames(): void {
    this.renamingId = null;
    this.dashboardView = 'games';
    void this.refreshGames();
  }

  private async refreshGames(): Promise<void> {
    try {
      await this.savedGames.refresh();
    } catch (err) {
      this.toastService.show(this.savedGameError(err), 'error');
    }
  }

  private savedGameError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  /** Runs one saved-games action with the busy state and a toast for how it went. */
  private async runSavedGames(work: () => Promise<void>, doneKey?: string): Promise<boolean> {
    this.isBusy = true;
    try {
      await work();
      if (doneKey)
        this.toastService.show(this.translate.instant(`CashflowGame.${doneKey}`), 'success');
      return true;
    } catch (err) {
      this.toastService.show(this.savedGameError(err), 'error');
      return false;
    } finally {
      this.isBusy = false;
    }
  }

  gameStatus(game: SavedGameSummary): string {
    return savedGameStatus(game);
  }

  /** The game in the list that is the one being played right now. */
  isLiveGame(game: SavedGameSummary): boolean {
    return this.hasActiveGame && game.id === this.savedGames.currentGameId;
  }

  gameProfession(game: SavedGameSummary): string {
    const set = this.cashflowGameService.gameSets.find(
      (candidate) => candidate.id === game.gameSetId,
    );
    const profession = set?.professions.find((candidate) => candidate.id === game.professionId);
    return profession ? this.professionTitle(profession) : '';
  }

  saveGameNow(): void {
    // a game played with others is filed by the table, in the player's saved games, as a game that has ended
    if (this.remote) {
      void this.remoteMove((remote) => remote.saveGame()).then((events) => {
        if (events)
          this.toastService.show(this.translate.instant('CashflowGame.gameSaved'), 'success');
      });
      return;
    }
    void this.runSavedGames(async () => {
      await this.savedGames.saveCurrent();
    }, 'gameSaved').then((saved) => {
      if (saved && this.savedGames.tooMany) {
        this.toastService.show(
          this.translate.instant('CashflowGame.tooManyGames', {
            count: this.savedGames.games.length,
          }),
          'update',
        );
      }
    });
  }

  /** What a game played with others came to for the player: first place, a place, bankruptcy, gave up. */
  tableResultLabel(mp: { rank: number | null; outcome?: string }): string {
    if (mp.outcome === 'left') return this.translate.instant('CashflowGame.mpGaveUp');
    if (mp.outcome === 'bankrupt') return this.translate.instant('CashflowGame.mpBankrupt');
    if (mp.rank === 1) return this.translate.instant('CashflowGame.mpFirst');
    if (mp.rank) return this.translate.instant('CashflowGame.mpPlace', { rank: mp.rank });
    return '';
  }

  /** The saved games played alone, and - apart - the ones played at a table with others. */
  get soloGames(): SavedGameSummary[] {
    return this.savedGames.games.filter((game) => !game.multiplayer);
  }

  get tableGames(): SavedGameSummary[] {
    return this.savedGames.games.filter((game) => !!game.multiplayer);
  }

  /** Back to the lobby after a game played with others: the app reloads on the player's own account. */
  backToLobby(): void {
    RemoteGameHook.leaveGame?.();
  }

  /** Saves the game being played and clears the account for the next one. */
  newGame(): void {
    this.confirm.confirm(
      this.translate.instant('CashflowGame.newGameConfirm'),
      () => {
        void this.runSavedGames(async () => {
          await this.savedGames.startNewGame();
          this.backToMain();
        }, 'newGameDone');
      },
      'CashflowGame.newGame',
      'primary',
    );
  }

  /** Makes a saved game the one being played (the game being played is saved first). */
  continueGame(game: SavedGameSummary): void {
    // a game played with others is looked at where it was played: the table, read only, with all its players and its history
    const table = game.multiplayer?.roomId;
    if (table) {
      this.closeWindow();
      void this.router.navigate(['/tables', table]);
      return;
    }
    const load = () => {
      void this.runSavedGames(async () => {
        await this.savedGames.loadGame(game.id);
        // The game's cards and labels follow the language it was played in.
        if (game.language && game.language !== this.language.current) {
          await this.language.use(game.language as Parameters<LanguageService['use']>[0]);
        }
        this.viewedProfession = null;
        this.showStartGames = false;
        this.backToMain();
      }, 'gameLoaded');
    };
    if (this.isLiveGame(game)) {
      // Loading the game that is already being played throws away what changed since its last save.
      this.confirm.confirm(
        this.translate.instant('CashflowGame.reloadConfirm'),
        load,
        'CashflowGame.continueGame',
        'primary',
      );
    } else {
      load();
    }
  }

  startRename(game: SavedGameSummary): void {
    this.renamingId = game.id;
    this.renameText = game.name;
  }

  cancelRename(): void {
    this.renamingId = null;
  }

  saveRename(): void {
    const id = this.renamingId;
    if (!id) return;
    void this.runSavedGames(async () => {
      await this.savedGames.renameGame(id, this.renameText);
      this.renamingId = null;
    });
  }

  deleteSavedGame(game: SavedGameSummary): void {
    this.confirm.confirm(
      this.translate.instant('CashflowGame.deleteGameConfirm', { name: game.name }),
      () => {
        void this.runSavedGames(async () => {
          await this.savedGames.deleteGame(game.id);
        }, 'gameDeleted');
      },
      'CashflowGame.deleteGame',
      'delete',
    );
  }

  /** Downloads the game as a file - a backup, or a way to move it to another account. */
  exportSavedGame(game: SavedGameSummary): void {
    void this.runSavedGames(async () => {
      const { fileName, text } = await this.savedGames.exportGame(game.id);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  importSavedGame(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void this.runSavedGames(async () => {
      await this.savedGames.importGame(await file.text());
    }, 'importDone').then(() => (input.value = ''));
  }

  /** Bank Loan and Payback Loan are each hidden behind their own trigger, with a Back button, like Deal pile/Cards (JFK, 2026-09-29). */
  openBankLoan(): void {
    this.loanIncrements = 1; // always a fresh start, never the number left from the last time (JFK, 2026-10-06)
    this.dashboardView = 'bankLoan';
  }

  /** Only reachable once there's actually a loan to pay back — the trigger button itself is `*ngIf`'d on that. */
  openPayLoan(): void {
    this.loanIncrements = 1;
    this.dashboardView = 'payLoan';
  }

  /** History is hidden behind its own trigger too, same pattern (JFK, 2026-09-29: "can you hide the history behind a button"). */
  openHistory(): void {
    this.refreshHistory();
    this.dashboardView = 'history';
  }

  trackLine(_index: number, line: { id: number }): number {
    return line.id;
  }

  /** The history of a game played with others: everybody's moves, newest first. */
  get remoteHistory() {
    return this.remote?.history() ?? [];
  }

  /** The History list: one line per undo step, newest first. */
  historySteps: CashflowHistoryStep[] = [];
  private expandedSteps = new Set<string>();

  private refreshHistory(): void {
    this.historySteps = this.cashflowGameService.historySteps();
  }

  /** The History button shows once there is anything to show: a step to undo, or older saved rounds. */
  get hasHistory(): boolean {
    return (
      !!this.remote ||
      this.cashflowGameService.canUndo ||
      this.appState.cashflowGame.history.length > 0
    );
  }

  toggleStep(id: string): void {
    if (this.expandedSteps.has(id)) this.expandedSteps.delete(id);
    else this.expandedSteps.add(id);
  }

  isStepOpen(id: string): boolean {
    return this.expandedSteps.has(id);
  }

  /** Undo this step and every newer one - the newest line undoes just itself. */
  undoThrough(index: number): void {
    this.isBusy = true;
    const message = this.undoneMessage(index + 1);
    this.cashflowGameService.undoSteps(index + 1, {
      onSuccess: () => {
        this.isBusy = false;
        this.refreshHistory();
        this.toastService.show(message, 'update');
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

  /**
   * The most that can be repaid now (JFK, 2026-10-07): the whole loan, or the whole loan steps the cash on hand covers -
   * repaying never takes the account below zero. The rule itself is `maxRepayableMinor` in the domain.
   */
  get maxLoanRepayment(): number {
    return fromMinorUnits(
      maxRepayableMinor(
        toMinorUnits(this.cash),
        toMinorUnits(this.currentLoanPrincipal),
        toMinorUnits(this.loanIncrementAmount),
      ),
    );
  }

  /** Cash is what holds the repayment back, not the size of the loan. */
  get repaymentLimitedByCash(): boolean {
    return this.currentLoanPrincipal > 0 && this.maxLoanRepayment < this.currentLoanPrincipal;
  }

  /** Pre-fills the number of steps that clears the loan - or as much of it as the cash allows (JFK, 2026-10-03/07): 4,000 owed in 1,000 steps -> 4, with 2,500 cash -> 2. The player still presses Repay. */
  settleAllLoan(): void {
    if (this.currentLoanPrincipal <= 0 || !this.loanIncrementAmount) return;
    this.loanIncrements = Math.max(1, Math.ceil(this.maxLoanRepayment / this.loanIncrementAmount));
  }

  repayLoan(): void {
    this.adjustLoan(
      -Math.min(this.loanIncrements * this.loanIncrementAmount, this.maxLoanRepayment),
    );
  }

  private adjustLoan(delta: number): void {
    if (!delta) return;
    if (this.remote) {
      void this.remoteMove((remote) => remote.bankLoan(Math.round(delta * 100))).then((events) => {
        if (events) {
          this.toastService.show(this.translate.instant('CashflowGame.loanUpdated'), 'success');
          this.loanIncrements = 1;
          this.backToMain();
        }
      });
      return;
    }
    this.isBusy = true;
    this.cashflowGameService.adjustBankLoan(delta, {
      onSuccess: () => {
        this.isBusy = false;
        this.toastService.show(this.translate.instant('CashflowGame.loanUpdated'), 'success');
        this.loanIncrements = 1; // the next settle starts at 1 again, not at the 2 of the last one
        this.backToMain();
      },
      onError: (message) => {
        this.isBusy = false;
        this.toastService.show(message, 'error');
      },
    });
  }

  private runAction(
    action: (callbacks: {
      onSuccess: () => void;
      onError: (message: string) => void;
      onLoan?: (loanMinor: number) => void;
    }) => void,
    kind: 'baby' | 'charity' | 'downsized',
  ): void {
    this.isBusy = true;
    action({
      onLoan: (loanMinor) =>
        this.toastService.show(
          this.cashflowGameService.autoLoanMessage(this.toDisplayAmount(loanMinor)),
          'update',
        ),
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
