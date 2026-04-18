import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

export type TourPosition = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'bottom-fixed';

export interface TourStep {
  /** CSS selector for the element to spotlight (null = full-screen card) */
  target: string | null;
  /** i18n key for the step title */
  titleKey: string;
  /** i18n key for the step body */
  bodyKey: string;
  /** Route to navigate to before showing this step */
  route?: string;
  /** Preferred tooltip position relative to target */
  position: TourPosition;
  /** Accent colour for this step */
  accent: string;
  /** Optional icon emoji */
  icon?: string;
  /** Action to execute when this step becomes active */
  action?: string;
}

export interface TourSection {
  id: string;
  titleKey: string;
  icon: string;
  steps: TourStep[];
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private static STORAGE_KEY = 'tour_completed';

  /** Emits when the tour should start */
  private startSubject = new Subject<void>();
  start$ = this.startSubject.asObservable();

  /** Emits action commands for panel management */
  private actionSubject = new Subject<string>();
  action$ = this.actionSubject.asObservable();

  /** All tour sections */
  sections: TourSection[] = [];

  /** Current position */
  currentSectionIndex = 0;
  currentStepIndex = 0;
  isActive = false;

  /** Set to true to skip the current menu animation */
  private _skipAnimation = false;
  private _skipResolvers: Array<() => void> = [];

  /** Signal to skip the ongoing menu animation */
  skipMenuAnimation(): void {
    this._skipAnimation = true;
    // Resolve all pending delays immediately
    for (const resolve of this._skipResolvers) resolve();
    this._skipResolvers = [];
  }

  /** Cancellable delay — resolves immediately if skip is signalled */
  cancellableDelay(ms: number): Promise<void> {
    if (this._skipAnimation) return Promise.resolve();
    return new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this._skipResolvers = this._skipResolvers.filter(r => r !== resolve);
        resolve();
      }, ms);
      this._skipResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  constructor(private router: Router) {
    this.sections = this.buildSections();
  }

  get totalSteps(): number {
    return this.sections.reduce((sum, s) => sum + s.steps.length, 0);
  }

  get globalStepIndex(): number {
    let idx = 0;
    for (let i = 0; i < this.currentSectionIndex; i++) {
      idx += this.sections[i].steps.length;
    }
    return idx + this.currentStepIndex;
  }

  get currentSection(): TourSection {
    return this.sections[this.currentSectionIndex];
  }

  get currentStep(): TourStep {
    return this.currentSection.steps[this.currentStepIndex];
  }

  get isFirstStep(): boolean {
    return this.currentSectionIndex === 0 && this.currentStepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.currentSectionIndex === this.sections.length - 1
      && this.currentStepIndex === this.currentSection.steps.length - 1;
  }

  get progress(): number {
    return ((this.globalStepIndex + 1) / this.totalSteps) * 100;
  }

  hasCompleted(): boolean {
    return localStorage.getItem(TourService.STORAGE_KEY) === 'true';
  }

  markCompleted(): void {
    localStorage.setItem(TourService.STORAGE_KEY, 'true');
  }

  emitAction(action: string): void {
    this.actionSubject.next(action);
  }

  startTour(): void {
    this.currentSectionIndex = 0;
    this.currentStepIndex = 0;
    this.isActive = true;
    this.emitAction('closeAllPanels');
    this.startSubject.next();
  }

  async next(): Promise<void> {
    if (this.isLastStep) {
      this.finish();
      return;
    }
    if (this.currentStepIndex < this.currentSection.steps.length - 1) {
      this.currentStepIndex++;
    } else {
      this.currentSectionIndex++;
      this.currentStepIndex = 0;
    }
  }

  async prev(): Promise<void> {
    if (this.isFirstStep) return;
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    } else {
      this.currentSectionIndex--;
      this.currentStepIndex = this.currentSection.steps.length - 1;
    }
  }

  async goToSection(sectionIndex: number): Promise<void> {
    if (sectionIndex < 0 || sectionIndex >= this.sections.length) return;
    this.currentSectionIndex = sectionIndex;
    this.currentStepIndex = 0;
  }

  skip(): void {
    this.finish();
  }

  private finish(): void {
    this.isActive = false;
    this.markCompleted();
    this.emitAction('closeAllPanels');
  }

  async navigateIfNeeded(): Promise<void> {
    await this.navigateRoute();
    await this.executeAction();
  }

  /** Navigate to the current step's route via menu (if needed) */
  async navigateRoute(): Promise<void> {
    const step = this.currentStep;
    if (step.route) {
      const currentUrl = this.router.url.split('?')[0];
      if (currentUrl !== step.route) {
        await this.navigateViaMenu(step.route);
      }
    }
  }

  /** Execute the current step's action (if any) */
  async executeAction(): Promise<void> {
    const step = this.currentStep;
    if (step.action) {
      this.emitAction(step.action);
      await this.cancellableDelay(300);
      // Remove focus outline from panel elements (e.g. close button)
      // that receive focus when panels open during the tour
      (document.activeElement as HTMLElement)?.blur?.();
    }
  }

  /** Peek at the next step without advancing */
  peekNextStep(): TourStep | null {
    if (this.isLastStep) return null;
    if (this.currentStepIndex < this.currentSection.steps.length - 1) {
      return this.currentSection.steps[this.currentStepIndex + 1];
    }
    return this.sections[this.currentSectionIndex + 1].steps[0];
  }

  /** Peek at the previous step without going back */
  peekPrevStep(): TourStep | null {
    if (this.isFirstStep) return null;
    if (this.currentStepIndex > 0) {
      return this.currentSection.steps[this.currentStepIndex - 1];
    }
    const prevSection = this.sections[this.currentSectionIndex - 1];
    return prevSection.steps[prevSection.steps.length - 1];
  }

  /** Check if navigating to a step requires a route change */
  needsRouteChange(step: TourStep | null): boolean {
    if (!step?.route) return false;
    return this.router.url.split('?')[0] !== step.route;
  }

  /**
   * Opens the menu, highlights the target menu item, navigates, then closes.
   * Falls back to direct navigation if the route isn't in the menu.
   */
  /** Routes that appear as items in the navigation menu */
  private static readonly MENU_ROUTES = new Set([
    '/home', '/transactions', '/daily', '/splurge', '/smile', '/fire',
    '/cashflow', '/income', '/balance', '/subscription', '/budget', '/grow'
  ]);

  private async navigateViaMenu(route: string): Promise<void> {
    this._skipAnimation = false;
    this.emitAction('closeAllPanels');

    // Non-menu routes (e.g. /plan, /smileprojects) — navigate directly
    if (!TourService.MENU_ROUTES.has(route)) {
      await this.router.navigate([route]);
      await this.cancellableDelay(300);
      (document.activeElement as HTMLElement)?.blur?.();
      this._skipAnimation = false;
      return;
    }

    const { MenuComponent } = await import('../../panels/menu/menu.component');

    // Open the menu first so items render in the DOM
    MenuComponent.isMenu = true;
    MenuComponent.zIndex = (MenuComponent.zIndex || 0) + 1;
    this.emitAction('tourMenuOpen');
    await this.cancellableDelay(250);
    (document.activeElement as HTMLElement)?.blur?.();

    // Now query for the menu item (DOM is rendered)
    const menuItem = document.querySelector(`[data-tour-route="${route}"]`) as HTMLElement;

    if (menuItem) {
      // Highlight the target item
      menuItem.classList.add('tour-menu-highlight');
      await this.cancellableDelay(900);

      // Click animation before navigating
      menuItem.classList.remove('tour-menu-highlight');
      if (!this._skipAnimation) {
        menuItem.classList.add('tour-menu-click');
        await this.cancellableDelay(200);
        menuItem.classList.remove('tour-menu-click');
      }
      await this.router.navigate([route]);
      MenuComponent.isMenu = false;
      this.emitAction('tourMenuClose');
      await this.cancellableDelay(300);
      (document.activeElement as HTMLElement)?.blur?.();
    } else {
      // Fallback — close menu and navigate directly
      MenuComponent.isMenu = false;
      this.emitAction('tourMenuClose');
      await this.router.navigate([route]);
      await this.cancellableDelay(300);
      (document.activeElement as HTMLElement)?.blur?.();
    }
    this._skipAnimation = false;
  }

  private buildSections(): TourSection[] {
    return [
      // ========== SECTION 1: CORE ==========
      {
        id: 'core',
        titleKey: 'Tour.section.core',
        icon: '',
        steps: [
          { target: null, titleKey: 'Tour.core.welcome.title', bodyKey: 'Tour.core.welcome.body', route: '/home', position: 'center', accent: 'var(--color-primary)', icon: '👋', action: 'closeAllPanels' },
          { target: '.grid-container', titleKey: 'Tour.core.accounts.title', bodyKey: 'Tour.core.accounts.body', route: '/home', position: 'bottom', accent: 'var(--color-primary)' },
          { target: '.grid-item[aria-label="Daily"]', titleKey: 'Tour.core.daily.title', bodyKey: 'Tour.core.daily.body', route: '/home', position: 'bottom', accent: 'var(--color-cat-daily)' },
          { target: '.grid-item[aria-label="Splurge"]', titleKey: 'Tour.core.splurge.title', bodyKey: 'Tour.core.splurge.body', route: '/home', position: 'bottom', accent: 'var(--color-cat-splurge)' },
          { target: '.grid-item[aria-label="Smile"]', titleKey: 'Tour.core.smile.title', bodyKey: 'Tour.core.smile.body', route: '/home', position: 'bottom', accent: 'var(--color-cat-smile)' },
          { target: '.grid-item[aria-label="Fire"]', titleKey: 'Tour.core.fire.title', bodyKey: 'Tour.core.fire.body', route: '/home', position: 'bottom', accent: 'var(--color-cat-fire)' },
        ]
      },
      // ========== SECTION 2: FIRST TRANSACTION ==========
      {
        id: 'transaction',
        titleKey: 'Tour.section.transaction',
        icon: '',
        steps: [
          { target: null, titleKey: 'Tour.transaction.intro.title', bodyKey: 'Tour.transaction.intro.body', route: '/transactions', position: 'center', accent: 'var(--color-primary)' },
          { target: '#addbtn', titleKey: 'Tour.transaction.addBtn.title', bodyKey: 'Tour.transaction.addBtn.body', route: '/transactions', position: 'left', accent: 'var(--color-primary)' },
          { target: '#addTransaction-Container', titleKey: 'Tour.transaction.form.title', bodyKey: 'Tour.transaction.form.body', position: 'bottom', accent: 'var(--color-primary)', action: 'openAddTransaction' },
          { target: 'select#account', titleKey: 'Tour.transaction.account.title', bodyKey: 'Tour.transaction.account.body', position: 'bottom', accent: 'var(--color-primary)' },
          { target: 'input#category', titleKey: 'Tour.transaction.category.title', bodyKey: 'Tour.transaction.category.body', position: 'bottom', accent: 'var(--color-primary)' },
          { target: null, titleKey: 'Tour.transaction.done.title', bodyKey: 'Tour.transaction.done.body', route: '/transactions', position: 'center', accent: 'var(--color-success)', action: 'closeAddPanel' },
        ]
      },
      // ========== SECTION 3: INCOME & CASHFLOW ==========
      {
        id: 'income',
        titleKey: 'Tour.section.income',
        icon: '',
        steps: [
          { target: '#incomeStatement', titleKey: 'Tour.income.statement.title', bodyKey: 'Tour.income.statement.body', route: '/income', position: 'bottom-fixed', accent: 'var(--color-success)' },
          { target: '.cashflowBox', titleKey: 'Tour.income.cashflow.title', bodyKey: 'Tour.income.cashflow.body', route: '/cashflow', position: 'bottom', accent: 'var(--color-primary)' },
        ]
      },
      // ========== SECTION 4: SUBSCRIPTIONS ==========
      {
        id: 'subscriptions',
        titleKey: 'Tour.section.subscriptions',
        icon: '',
        steps: [
          { target: null, titleKey: 'Tour.sub.intro.title', bodyKey: 'Tour.sub.intro.body', route: '/subscription', position: 'center', accent: 'var(--color-warning)' },
          { target: '#addbtn', titleKey: 'Tour.sub.addBtn.title', bodyKey: 'Tour.sub.addBtn.body', route: '/subscription', position: 'left', accent: 'var(--color-warning)' },
          { target: '.cashflowBox', titleKey: 'Tour.sub.impact.title', bodyKey: 'Tour.sub.impact.body', route: '/subscription', position: 'bottom', accent: 'var(--color-warning)' },
        ]
      },
      // ========== SECTION 5: BALANCE SHEET ==========
      {
        id: 'balance',
        titleKey: 'Tour.section.balance',
        icon: '',
        steps: [
          { target: null, titleKey: 'Tour.balance.intro.title', bodyKey: 'Tour.balance.intro.body', route: '/balance', position: 'center', accent: 'var(--color-primary)' },
          { target: '#assetsBox', titleKey: 'Tour.balance.assets.title', bodyKey: 'Tour.balance.assets.body', route: '/balance', position: 'bottom-fixed', accent: 'var(--color-success)' },
          { target: null, titleKey: 'Tour.balance.types.title', bodyKey: 'Tour.balance.types.body', route: '/balance', position: 'center', accent: 'var(--color-primary)' },
          { target: '#liabilitiesBox', titleKey: 'Tour.balance.liabilities.title', bodyKey: 'Tour.balance.liabilities.body', route: '/balance', position: 'bottom-fixed', accent: 'var(--color-error)' },
        ]
      },
      // ========== SECTION 6: BUDGETS ==========
      {
        id: 'budgets',
        titleKey: 'Tour.section.budgets',
        icon: '',
        steps: [
          { target: null, titleKey: 'Tour.budget.intro.title', bodyKey: 'Tour.budget.intro.body', route: '/budget', position: 'center', accent: 'var(--color-primary)' },
          { target: '#planbtn', titleKey: 'Tour.budget.plan.title', bodyKey: 'Tour.budget.plan.body', route: '/budget', position: 'bottom', accent: 'var(--color-primary)' },
          { target: '.plan-navigation', titleKey: 'Tour.budget.planPage.title', bodyKey: 'Tour.budget.planPage.body', route: '/plan', position: 'bottom', accent: 'var(--color-primary)' },
          { target: '#dotstn', titleKey: 'Tour.budget.options.title', bodyKey: 'Tour.budget.options.body', route: '/plan', position: 'bottom', accent: 'var(--color-primary)' },
          { target: null, titleKey: 'Tour.budget.workflow.title', bodyKey: 'Tour.budget.workflow.body', route: '/plan', position: 'center', accent: 'var(--color-primary)' },
        ]
      },
      // ========== SECTION 7: SMILE PROJECTS ==========
      {
        id: 'smile',
        titleKey: 'Tour.section.smile',
        icon: 'assets/icons/smile.jpg',
        steps: [
          { target: null, titleKey: 'Tour.smile.intro.title', bodyKey: 'Tour.smile.intro.body', route: '/smile', position: 'center', accent: 'var(--color-cat-smile)', icon: 'assets/icons/smile.jpg' },
          { target: '#smilebtn', titleKey: 'Tour.smile.button.title', bodyKey: 'Tour.smile.button.body', route: '/smile', position: 'left', accent: 'var(--color-cat-smile)' },
          { target: null, titleKey: 'Tour.smile.overview.title', bodyKey: 'Tour.smile.overview.body', route: '/smileprojects', position: 'center', accent: 'var(--color-cat-smile)' },
          { target: '#addbtn', titleKey: 'Tour.smile.addBtn.title', bodyKey: 'Tour.smile.addBtn.body', route: '/smileprojects', position: 'left', accent: 'var(--color-cat-smile)' },
          { target: '#addSmile-Container', titleKey: 'Tour.smile.create.title', bodyKey: 'Tour.smile.create.body', position: 'bottom-fixed', accent: 'var(--color-cat-smile)', action: 'openAddSmile' },
          { target: '#bucketsSection', titleKey: 'Tour.smile.buckets.title', bodyKey: 'Tour.smile.buckets.body', position: 'bottom-fixed', accent: 'var(--color-cat-smile)' },
          { target: '#linksActionsSection', titleKey: 'Tour.smile.links.title', bodyKey: 'Tour.smile.links.body', position: 'bottom-fixed', accent: 'var(--color-cat-smile)' },
          { target: '#paymentPlansSection', titleKey: 'Tour.smile.payments.title', bodyKey: 'Tour.smile.payments.body', position: 'bottom-fixed', accent: 'var(--color-cat-smile)' },
        ]
      },
      // ========== SECTION 8: FIRE & SAFETY ==========
      {
        id: 'fire',
        titleKey: 'Tour.section.fire',
        icon: 'assets/icons/fire.jpg',
        steps: [
          { target: null, titleKey: 'Tour.fire.intro.title', bodyKey: 'Tour.fire.intro.body', route: '/fire', position: 'center', accent: 'var(--color-cat-fire)', icon: 'assets/icons/fire.jpg' },
          { target: '#mojoBox', titleKey: 'Tour.fire.mojo.title', bodyKey: 'Tour.fire.mojo.body', route: '/fire', position: 'bottom', accent: 'var(--color-cat-fire)' },
          { target: '#firebtn', titleKey: 'Tour.fire.emergencies.title', bodyKey: 'Tour.fire.emergencies.body', route: '/fire', position: 'left', accent: 'var(--color-cat-fire)' },
        ]
      },
      // ========== SECTION 9: GROW & AI ==========
      {
        id: 'grow',
        titleKey: 'Tour.section.grow',
        icon: '🌱',
        steps: [
          { target: null, titleKey: 'Tour.grow.intro.title', bodyKey: 'Tour.grow.intro.body', route: '/grow', position: 'center', accent: 'var(--color-success)', icon: '🌱' },
          { target: '#ai-btn', titleKey: 'Tour.grow.ai.title', bodyKey: 'Tour.grow.ai.body', route: '/grow', position: 'left', accent: 'var(--color-primary)' },
          { target: '#ai-assistant-container', titleKey: 'Tour.grow.strategy.title', bodyKey: 'Tour.grow.strategy.body', position: 'bottom-fixed', accent: 'var(--color-primary)', action: 'openAiAssistant' },
          { target: '.phase-tabs', titleKey: 'Tour.grow.phases.title', bodyKey: 'Tour.grow.phases.body', route: '/grow', position: 'bottom', accent: 'var(--color-success)', action: 'closeAiAssistant' },
        ]
      },
      // ========== SECTION 10: FINISH ==========
      {
        id: 'finish',
        titleKey: 'Tour.section.finish',
        icon: '',
        steps: [
          { target: null, titleKey: 'Tour.finish.title', bodyKey: 'Tour.finish.body', route: '/home', position: 'center', accent: 'var(--color-success)' },
        ]
      },
    ];
  }
}
