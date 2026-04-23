import { Component, AfterViewInit, AfterViewChecked, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import * as d3 from 'd3';
import * as sankey from 'd3-sankey'
import { D3VisualizationService } from '../shared/services/d3-visualization.service';
import { ChartFilterService, ChartFilterState } from '../shared/services/chart-filter.service';
import { HostListener } from '@angular/core';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import { AppStateService } from '../shared/services/app-state.service';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('../app.component').then(m => AppComponent = m.AppComponent));
let SettingsComponent: any; setTimeout(() => import('src/app/panels/settings/settings.component').then(m => SettingsComponent = m.SettingsComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let HomeComponent: any; setTimeout(() => import('../main/home/home.component').then(m => HomeComponent = m.HomeComponent));
let IncomeComponent: any; setTimeout(() => import('../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let BalanceComponent: any; setTimeout(() => import('../main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let SmileProjectsComponent: any; setTimeout(() => import('../main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('../main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let GrowComponent: any; setTimeout(() => import('../main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let FireComponent: any; setTimeout(() => import('../main/fire/fire.component').then(m => FireComponent = m.FireComponent));

// Extracted module imports
import { createKPI, createNetWorthTrendChart, createExpenseIncomeRatio, createIncomeStreamsBreakdown, createSavingsRate as createSavingsRateKPI, createBurnRate, createTopSpendingCategories, createRecurringVsOneTimeChart, createHeatmapCalendar } from './charts/kpi-charts';
import { createZoomableChart, createHistogramChart, createCashflowBarChart, createCategoryBubbleChart, createChart as createAccountChart, showTransactionDetails, createPieChart } from './charts/core-charts';
import { createBIDashboard, createAnalyticsLevelSelector, createAnalyticsPlaceholder, createTimeFilter, showOutlierAnalysis, detectOutliers, createTransactionDetailsTable, updateTransactionTable } from './bi/bi-dashboard';
import { createExplorativeAnalytics, updateExplorativeView, updateBreadcrumbNavigation, getExplorativeFilteredTransactions, checkExplorativeSearchTerm } from './analytics/explorative';
import { createPraediktiveAnalytics, refreshPredictiveMetrics, getPredictiveHistoricalData, calculatePredictions, calculateARIMAPredictions } from './analytics/predictive';
import { addMonths, calculateSavingsRate, calculateBudgetCompliance, calculateFixedCostsRatio, getMonthlyData, getFilteredTransactions } from './stats-calculations';
import { createPraeskriptiveAnalytics, refreshScenario } from './analytics/prescriptive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';


@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css', '../app.component.css', '../shared/styles/filter-styles.css']
})
export class StatsComponent implements AfterViewInit, AfterViewChecked, OnDestroy {

  // Mapping of KPI keys to corresponding render functions
  kpiFunctions: Record<string, () => void> = {
    "savings-rate": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "savings-rate";
      StatsComponent.createSavingsRate();
    },
    "burn-rate": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "burn-rate";
      StatsComponent.createBurnRate();
    },
    "expense-income-ratio": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "expense-income-ratio";
      StatsComponent.createExpenseIncomeRatio();
    },
    "top-spending": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "top-spending";
      StatsComponent.createTopSpendingCategories();
    },
    "recurring-vs-one-time": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "recurring-vs-one-time";
      StatsComponent.createRecurringVsOneTimeChart();
    },
    "net-worth-trend": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "net-worth-trend";
      StatsComponent.createNetWorthTrendChart();
    },
    "icome-streams-breakdown": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "icome-streams-breakdown";
      StatsComponent.createIncomeStreamsBreakdown();
    },
    "heatmap-calendar": () => {
      StatsComponent.isKPI = true;
      StatsComponent.activeKPI = "heatmap-calendar";
      StatsComponent.createHeatmapCalendar();
    }
    // Add more KPI functions as needed
  };
  
  static modus: string = "home";

  static screenWidth: number;
  static screenHeight: number;

  static accounts = ['Menu.daily', 'Menu.splurge', 'Menu.smile', 'Menu.fire'];
  // Add a static variable to store the translated values
  static translatedValues: string[] = [];

  static incomeNames = [ 
    'Income.Revenue', 'Income.Interests', 'Balance.Investments', 'Income.Revenue',
    'Menu.daily', 'Menu.splurge', 'Menu.smile', 'Menu.fire', 'Income.Mojo', 'Cashflow.Expenses'
  ];

  static translatedIncomeValues: string[] = [];

  static isStatment: boolean = false;
  static isStatistic: boolean = false;
  static isBIDashboard: boolean = false;
  static activeBIDashboard: number = 1; // 1, 2, 3, or 4
  static activeAnalyticsLevel: string = 'deskriptive'; // 'deskriptive', 'explorative', 'praediktive', 'praeskriptive'
  static dashboard4CostTypeFilter: string = 'all'; // 'all', 'fixed', 'variable' - selected cost type from pie chart
  static dashboard4SelectedCategory: string = ''; // Selected category for transaction detail view
  static dashboard4SortColumn: string = 'amount'; // 'category', 'type', 'count', 'amount', 'percentage'
  static dashboard4SortOrder: string = 'desc'; // 'asc', 'desc'
  static dashboard4TransactionSortColumn: string = 'date'; // 'date', 'account', 'amount', 'comment'
  static dashboard4TransactionSortOrder: string = 'desc'; // 'asc', 'desc'
  static savedBIAnalyticsLevel: string = 'deskriptive'; // Saved analytics level when leaving BI mode
  static filterPanelMoved: boolean = false; // Track if filter panel has been moved
  static lastScreenWidth: number = 0; // Track screen width to detect resize
  static lastScreenHeight: number = 0; // Track screen height to detect resize

  public get appReference() { return AppComponent; }
  public classReference = StatsComponent;
  public incomeReference = IncomeComponent;
  public settingsReference = SettingsComponent;
  public balanceReference = BalanceComponent;

  static selectedYear: string = "all";
  static period: string = "all";
  static Index: number = 0;
  static numCategories: number = 5;
  static viewMode = "year";

  static activeKPI = "net-worth-trend";  
  static isKPI = false;

  isChecked = true;
  static selectedMode = "year" 
  static selectedMonth = "all"
  static filterType = "all" // "month", "quarter", "year", "custom", "all"
  static customDateStart = ""
  static customDateEnd = ""
  static selectedCategory = "" // Selected category for filtering transaction details
  static showOnlyOutliers = false // Filter to show only outlier transactions
  static iqrThreshold = parseFloat(localStorage.getItem('iqrThreshold') || '1.5') // IQR multiplier for outlier detection
  static savedScrollPosition = 0 // Saved scroll position for dashboard refresh
  
  // Explorative Analytics filters
  static explorativeSelectedAccounts: string[] = [] // Selected accounts for filtering
  static explorativeSelectedCategories: string[] = [] // Selected categories for filtering
  static explorativeAmountMin: number = -9999 // Minimum amount filter (negative for expenses)
  static explorativeAmountMax: number = 0 // Maximum amount filter (0 for expenses)
  static explorativeSearchText: string = "" // Search text for transactions
  static explorativeSearchFields = { // Search field toggles
    account: true,
    amount: true,
    date: true,
    time: true,
    category: true,
    comment: true
  }
  static explorativeSearchHelpVisible: boolean = false // Toggle search help panel
  static explorativeBreadcrumbs: Array<{level: string, value: string}> = [] // Navigation breadcrumbs
  static explorativeDrilldownLevel: string = "overview" // Current drill-down level: overview, account, category, transaction
  static explorativeDrilldownAccount: string = "" // Selected account for drill-down
  static explorativeDrilldownCategory: string = "" // Selected category for drill-down
  static explorativeSortBy: string = "amount" // Sort by: amount, frequency, date
  static explorativeSortOrder: string = "desc" // Sort order: asc, desc
  static explorativeComparisonMode: boolean = false // Toggle period comparison
  static explorativeTableSortColumn: string = "date" // Table sort column: date, account, category, amount
  static explorativeTableSortOrder: string = "desc" // Table sort order: asc, desc
  static dashboard3TableSortColumn: string = "date" // Dashboard 3 table sort column
  static dashboard3TableSortOrder: string = "desc" // Dashboard 3 table sort order: asc, desc
  static periodComparisonSortColumn: string = "period" // Period comparison sort column
  static periodComparisonSortOrder: string = "asc" // Period comparison sort order: asc, desc
  
  // Prädiktive Analytics settings
  static predictiveMonthsHistory: number = 12 // Number of historical months to use for prediction
  static predictiveMonthsFuture: number = 3 // Number of months to predict into future
  static predictiveAlpha: number = 0.3 // Exponential smoothing parameter (0-1)
  static predictiveMojoGoal: number = 10000 // Mojo savings goal in currency
  static predictiveSelectedMetric: string = "savings-rate" // Which metric to predict
  static predictiveSelectedCategory: string = "" // Selected category for category-spending predictions
  
  // Präskriptive Analytics settings
  static selectedScenario: string = "optimize-savings-rate" // Selected scenario: optimize-savings-rate, accelerate-mojo, savings-goal-simulator
  static savingsOptimizationMethod: string = "reduce-category" // Sub-scenario: reduce-category, increase-income
  
  // Category reduction - support multiple categories
  static categoryReductions: Array<{category: string, method: string, percent: number, amount: number}> = [
    {category: "", method: "percentage", percent: 10, amount: 50}
  ];
  
  // Income increase - support multiple increases
  static incomeIncreases: Array<{method: string, amount: number, percent: number}> = [
    {method: "fixed", amount: 500, percent: 10}
  ];
  
  // Legacy single values for backward compatibility
  static scenarioCategory: string = "" // Category for reduction scenario
  static categoryReductionMethod: string = "percentage" // Method for category reduction: percentage or fixed
  static scenarioReductionPercent: number = 10 // Percentage to reduce category spending
  static scenarioReductionAmount: number = 50 // Fixed amount to reduce category spending
  static incomeIncreaseMethod: string = "fixed" // Method for income increase: percentage or fixed
  static scenarioIncomeIncrease: number = 500 // Additional monthly income amount
  static scenarioIncreasePercent: number = 10 // Percentage to increase income
  static mojoIncreaseMethod: string = "fixed" // Method for Mojo increase: fixed or percentage
  static mojoIncreaseAmount: number = 100 // Additional Mojo contribution (fixed amount)
  static mojoIncreasePercent: number = 10 // Percentage to increase Mojo contribution
  static savingsGoalAmount: number = 10000 // Target savings goal
  
  static incomeVsExpensesChartMode = "line" // "line" or "bar"
  static showAverageView = false; // Toggle between total and average view for KPIs
  static isSwitch = false;

  // Chart filter state
  static chartFilterVisible = false;
  static chartFilterAdvanced = false;
  static chartSearchHelpVisible = false;
  static chartFilter: ChartFilterState = ChartFilterService.defaultState();

  /** Modes that support chart filtering (all except BI which has its own filters) */
  static chartFilterModes = ['kpi', 'cashflow', 'category', 'daily', 'splurge', 'smile', 'fire', 'home', 'income', 'statement', 'histogram'];

  /**
   * Dynamic page title — derived from the active view flags.
   * Statement mode wins over BI which wins over the default Statistics title.
   */
  static get pageTitle(): string {
    if (StatsComponent.isStatment) return 'Stats.financialStatement';
    if (StatsComponent.isBIDashboard) return 'Menu.bi';
    return 'Stats.title';
  }
  static translateService: TranslateService;
  static d3Service: D3VisualizationService;
  static currentInstance: StatsComponent | null = null;
  static resizeTimeout: any = null; // Timeout for debouncing window resize events
  static lastWindowWidth: number = 0; // Track last window width
  static lastWindowHeight: number = 0; // Track last window height

  /**
   * Constructs a new StatsComponent.
   * @param router - The router service.
   * @param translate - The translation service.
   * @param cdr - The change detector ref.
   */
  constructor(private router: Router, private translate: TranslateService, public cdr: ChangeDetectorRef, d3Service: D3VisualizationService) {
    MenuComponent.openStats = true;
    StatsComponent.translateService = translate;
    StatsComponent.d3Service = d3Service;
    // Reset all filters to defaults when entering stats from outside
    StatsComponent.chartFilter = ChartFilterService.defaultState();
    StatsComponent.chartFilterVisible = false;
    StatsComponent.chartFilterAdvanced = false;
    StatsComponent.chartSearchHelpVisible = false;
    StatsComponent.explorativeSearchText = "";
    StatsComponent.explorativeSearchHelpVisible = false;
    StatsComponent.explorativeSelectedAccounts = [];
    StatsComponent.explorativeSelectedCategories = [];
    StatsComponent.explorativeDrilldownLevel = "overview";
    StatsComponent.explorativeDrilldownAccount = "";
    StatsComponent.explorativeDrilldownCategory = "";
    StatsComponent.explorativeBreadcrumbs = [];
    // initialize the chart 
    this.openChart();
    StatsComponent.currentInstance = this;

    // subscribe to language changes
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      // Do something with event.lang
      this.openChart();
      
      // Recreate BI dashboards when language changes
      if (StatsComponent.modus === "bi" && StatsComponent.activeBIDashboard) {
        StatsComponent.createBIDashboard(StatsComponent.activeBIDashboard);
      }
    });

  }

  // Instance-level properties for Angular template binding
  isExplorativeAdvancedFilterExpanded = false;

  // Getters and setters to bind to static properties
  get customDateStart() { return StatsComponent.customDateStart; }
  set customDateStart(value: string) { StatsComponent.customDateStart = value; }

  get customDateEnd() { return StatsComponent.customDateEnd; }
  set customDateEnd(value: string) { StatsComponent.customDateEnd = value; }

  get explorativeAmountMin() { return StatsComponent.explorativeAmountMin; }
  set explorativeAmountMin(value: number) { StatsComponent.explorativeAmountMin = value; }

  get explorativeAmountMax() { return StatsComponent.explorativeAmountMax; }
  set explorativeAmountMax(value: number) { StatsComponent.explorativeAmountMax = value; }

  get explorativeSearchText() { return StatsComponent.explorativeSearchText; }
  set explorativeSearchText(value: string) { StatsComponent.explorativeSearchText = value; }

  get explorativeSearchInDate() { return StatsComponent.explorativeSearchFields.date; }
  set explorativeSearchInDate(value: boolean) { StatsComponent.explorativeSearchFields.date = value; }

  get explorativeSearchInAmount() { return StatsComponent.explorativeSearchFields.amount; }
  set explorativeSearchInAmount(value: boolean) { StatsComponent.explorativeSearchFields.amount = value; }

  get explorativeSearchInDescription() { return StatsComponent.explorativeSearchFields.comment; }
  set explorativeSearchInDescription(value: boolean) { StatsComponent.explorativeSearchFields.comment = value; }

  get explorativeSearchInAccount() { return StatsComponent.explorativeSearchFields.account; }
  set explorativeSearchInAccount(value: boolean) { StatsComponent.explorativeSearchFields.account = value; }

  get explorativeSearchInCategory() { return StatsComponent.explorativeSearchFields.category; }
  set explorativeSearchInCategory(value: boolean) { StatsComponent.explorativeSearchFields.category = value; }

  get explorativeSearchHelpVisible() { return StatsComponent.explorativeSearchHelpVisible; }
  set explorativeSearchHelpVisible(value: boolean) { StatsComponent.explorativeSearchHelpVisible = value; }

  // Chart filter bindings
  get chartFilterVisible() { return StatsComponent.chartFilterVisible; }
  get chartFilterAdvanced() { return StatsComponent.chartFilterAdvanced; }
  get chartSearchHelpVisible() { return StatsComponent.chartSearchHelpVisible; }
  get chartFilter() { return StatsComponent.chartFilter; }
  get showChartFilter() {
    // Hide filter for heatmap calendar KPI (has its own navigation)
    if (StatsComponent.modus === 'kpi' && StatsComponent.activeKPI === 'heatmap-calendar') {
      return false;
    }
    return StatsComponent.chartFilterModes.includes(StatsComponent.modus);
  }

  toggleChartFilter(): void {
    StatsComponent.chartFilterVisible = !StatsComponent.chartFilterVisible;
  }

  closeChartFilter(): void {
    StatsComponent.chartFilterVisible = false;
  }

  toggleChartFilterAdvanced(): void {
    StatsComponent.chartFilterAdvanced = !StatsComponent.chartFilterAdvanced;
  }

  selectChartPeriod(period: 'all' | 'week' | 'month' | 'quarter' | 'year'): void {
    StatsComponent.chartFilter.filterType = period;
    StatsComponent.chartFilter.selectedIndex = 0;
    this.applyChartFilter();
  }

  selectChartCustom(): void {
    StatsComponent.chartFilter.filterType = 'custom';
    if (!StatsComponent.chartFilter.customDateStart) {
      const dates = AppStateService.instance.allTransactions.map(t => t.date).filter(d => d).sort();
      StatsComponent.chartFilter.customDateStart = dates[0] || new Date().toISOString().split('T')[0];
      StatsComponent.chartFilter.customDateEnd = new Date().toISOString().split('T')[0];
    }
    this.applyChartFilter();
  }

  chartFilterPrev(): void {
    StatsComponent.chartFilter.selectedIndex--;
    this.applyChartFilter();
  }

  chartFilterNext(): void {
    StatsComponent.chartFilter.selectedIndex++;
    this.applyChartFilter();
  }

  getChartFilterDateLabel(): string {
    const f = StatsComponent.chartFilter;
    if (f.filterType === 'all') return '';
    if (f.filterType === 'custom') {
      if (f.customDateStart && f.customDateEnd) return `${f.customDateStart} — ${f.customDateEnd}`;
      return '';
    }
    const range = ChartFilterService.getDateRange(f.filterType, f.selectedIndex);
    if (!range) return '';
    return ChartFilterService.formatDateRange(f.filterType, range.startDate, range.endDate);
  }

  isChartFilterAccountSelected(account: string): boolean {
    return StatsComponent.chartFilter.selectedAccounts.includes(account);
  }

  toggleChartFilterAccount(account: string): void {
    const arr = StatsComponent.chartFilter.selectedAccounts;
    const idx = arr.indexOf(account);
    if (idx > -1) arr.splice(idx, 1); else arr.push(account);
  }

  isChartFilterCategorySelected(category: string): boolean {
    return StatsComponent.chartFilter.selectedCategories.includes(category);
  }

  toggleChartFilterCategory(category: string): void {
    const arr = StatsComponent.chartFilter.selectedCategories;
    const idx = arr.indexOf(category);
    if (idx > -1) arr.splice(idx, 1); else arr.push(category);
  }

  applyChartFilter(): void {
    // Store current filter state into period/index for chart methods that still read them
    StatsComponent.period = StatsComponent.chartFilter.filterType;
    StatsComponent.Index = StatsComponent.chartFilter.selectedIndex;

    // Convert chart filter to selectedMode/selectedMonth for createChart (account line charts)
    const filter = StatsComponent.chartFilter;
    if (filter.filterType === 'all') {
      StatsComponent.selectedMode = 'year';
      StatsComponent.selectedMonth = 'all';
    } else if (filter.filterType === 'custom') {
      StatsComponent.selectedMode = 'year';
      StatsComponent.selectedMonth = 'all';
    } else {
      StatsComponent.selectedMode = filter.filterType;
      const range = ChartFilterService.getDateRange(filter.filterType, filter.selectedIndex);
      if (range) {
        if (filter.filterType === 'year') {
          StatsComponent.selectedMonth = String(range.startDate.getFullYear());
        } else if (filter.filterType === 'month') {
          StatsComponent.selectedMonth = `${range.startDate.getFullYear()}-${String(range.startDate.getMonth() + 1).padStart(2, '0')}`;
        } else if (filter.filterType === 'quarter') {
          const q = Math.floor(range.startDate.getMonth() / 3) + 1;
          StatsComponent.selectedMonth = `${range.startDate.getFullYear()}-Q${q}`;
        } else if (filter.filterType === 'week') {
          const weekNum = Math.ceil(((range.startDate.getTime() - new Date(range.startDate.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(range.startDate.getFullYear(), 0, 1).getDay() + 1) / 7);
          StatsComponent.selectedMonth = `${range.startDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        }
      }
    }

    this.callCharts();
  }

  get isCashflowMode(): boolean {
    return StatsComponent.modus === 'cashflow';
  }

  resetChartFilter(): void {
    StatsComponent.chartFilter = ChartFilterService.defaultState();
    StatsComponent.chartFilterAdvanced = false;
    this.applyChartFilter();
  }

  // Filter helper methods
  getAvailableAccounts(): string[] {
    const modus = StatsComponent.modus;
    // For account-specific modes, show only the relevant accounts
    const modeAccountMap: Record<string, string[]> = {
      'daily': ['Income', 'Daily'],
      'splurge': ['Income', 'Splurge'],
      'smile': ['Income', 'Smile'],
      'fire': ['Income', 'Fire'],
      'income': ['Income', 'Daily', 'Splurge', 'Smile', 'Fire'],
    };
    const allowedAccounts = modeAccountMap[modus];
    const accounts = new Set<string>();
    AppStateService.instance.allTransactions.forEach(t => {
      if (t.account) {
        if (allowedAccounts) {
          if (allowedAccounts.includes(t.account)) accounts.add(t.account);
        } else if (t.account !== 'Income') {
          accounts.add(t.account);
        }
      }
    });
    return Array.from(accounts).sort();
  }

  getAvailableCategories(): string[] {
    const categoryLastUse = new Map<string, Date>();
    AppStateService.instance.allTransactions.forEach(t => {
      if (t.category) {
        const cleanCategory = t.category.replace('@', '');
        const txDate = new Date(t.date);
        if (!categoryLastUse.has(cleanCategory) || txDate > categoryLastUse.get(cleanCategory)!) {
          categoryLastUse.set(cleanCategory, txDate);
        }
      }
    });
    return Array.from(categoryLastUse.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(entry => entry[0]);
  }

  isAccountSelected(account: string): boolean {
    return StatsComponent.explorativeSelectedAccounts.includes(account);
  }

  isCategorySelected(category: string): boolean {
    return StatsComponent.explorativeSelectedCategories.includes(category);
  }

  toggleAccountFilter(account: string): void {
    const index = StatsComponent.explorativeSelectedAccounts.indexOf(account);
    if (index > -1) {
      StatsComponent.explorativeSelectedAccounts.splice(index, 1);
    } else {
      StatsComponent.explorativeSelectedAccounts.push(account);
    }
  }

  toggleCategoryFilter(category: string): void {
    const index = StatsComponent.explorativeSelectedCategories.indexOf(category);
    if (index > -1) {
      StatsComponent.explorativeSelectedCategories.splice(index, 1);
    } else {
      StatsComponent.explorativeSelectedCategories.push(category);
    }
  }

  isFixedCost(category: string): boolean {
    return AppStateService.instance.allSubscriptions.some(sub => 
      sub.category.replace('@', '') === category
    );
  }

  updateExplorativeView(): void {
    StatsComponent.updateExplorativeView();
  }

  resetExplorativeFilter(): void {
    StatsComponent.customDateStart = "";
    StatsComponent.customDateEnd = "";
    StatsComponent.explorativeAmountMin = -9999;
    StatsComponent.explorativeAmountMax = 0;
    StatsComponent.explorativeSearchText = "";
    StatsComponent.explorativeSelectedAccounts = [];
    StatsComponent.explorativeSelectedCategories = [];
    StatsComponent.explorativeSearchFields = {
      account: true,
      amount: true,
      date: true,
      time: true,
      category: true,
      comment: true
    };
    this.isExplorativeAdvancedFilterExpanded = false;
    StatsComponent.updateExplorativeView();
  }

  showSearchHelp(): void {
    StatsComponent.explorativeSearchHelpVisible = !StatsComponent.explorativeSearchHelpVisible;
  }

  showChartSearchHelp(): void {
    StatsComponent.chartSearchHelpVisible = !StatsComponent.chartSearchHelpVisible;
  }

  appendToChartSearch(snippet: string): void {
    if (StatsComponent.chartFilter.searchText && StatsComponent.chartFilter.searchText.trim()) {
      StatsComponent.chartFilter.searchText = StatsComponent.chartFilter.searchText.trim() + ' && ' + snippet;
    } else {
      StatsComponent.chartFilter.searchText = snippet;
    }
  }

  appendToExplorativeSearch(snippet: string): void {
    if (StatsComponent.explorativeSearchText && StatsComponent.explorativeSearchText.trim()) {
      StatsComponent.explorativeSearchText = StatsComponent.explorativeSearchText.trim() + ' && ' + snippet;
    } else {
      StatsComponent.explorativeSearchText = snippet;
    }
  }

  ngAfterViewChecked(): void {
    // Move filter panel into D3.js placeholder if it exists - once only
    if (StatsComponent.activeAnalyticsLevel === 'explorative' && !StatsComponent.filterPanelMoved) {
      const placeholder = document.getElementById('explorative-filter-placeholder');
      const filterPanel = document.getElementById('explorative-filter-panel');
      
      if (placeholder && filterPanel && filterPanel.parentElement !== placeholder) {
        placeholder.appendChild(filterPanel);
        filterPanel.style.display = 'block';
        StatsComponent.filterPanelMoved = true;
      }
    }
  }


  showInsights()  {
    this.isChecked = !this.isChecked
    StatsComponent.createChart(StatsComponent.modus, StatsComponent.selectedYear, this.isChecked, StatsComponent.selectedMode, StatsComponent.selectedMonth);
  }

  onKPIChange(event: Event): void {
    const selected = (event.target as HTMLSelectElement).value;
    const fn = this.kpiFunctions[selected];
    if (fn) fn();
  }

  static refreshCharts() {
    if (StatsComponent.currentInstance) {
      StatsComponent.currentInstance.callCharts();
    } else {
      console.warn('No StatsComponent instance available to refresh charts');
    }
  }

  /**
   * Static method to refresh a specific chart type
   */
  static refreshChart(modus: string) {
    // Reset BI state when switching to non-BI modes
    this.resetBIStateIfNeeded(modus);
    
    StatsComponent.modus = modus;
    if (StatsComponent.currentInstance) {
      StatsComponent.currentInstance.callCharts();
    }
  }

  /**
   * Reset BI Dashboard state when switching to non-BI modes
   */
  static resetBIStateIfNeeded(modus: string) {
    if (modus !== 'bi' && StatsComponent.isBIDashboard) {
      // Save the current analytics level before resetting
      StatsComponent.savedBIAnalyticsLevel = StatsComponent.activeAnalyticsLevel;
      
      // Reset BI dashboard flags
      StatsComponent.isBIDashboard = false;
      StatsComponent.activeAnalyticsLevel = 'deskriptive';
      // pageTitle is a derived getter — no need to assign it.
      
      // Trigger change detection to update the title in the view
      if (StatsComponent.currentInstance) {
        StatsComponent.currentInstance.cdr.detectChanges();
      }
      
      // Reset chart selection to defaults to ensure charts display properly
      StatsComponent.selectedMode = "year";
      StatsComponent.selectedYear = "all";
      StatsComponent.selectedMonth = "all";
      
      // Reset explorative analytics state (but NOT general stats filters)
      StatsComponent.explorativeSelectedAccounts = [];
      StatsComponent.explorativeSelectedCategories = [];
      StatsComponent.explorativeAmountMin = -9999;
      StatsComponent.explorativeAmountMax = 0;
      StatsComponent.explorativeSearchText = "";
      StatsComponent.explorativeSearchFields = {
        account: true,
        amount: true,
        date: true,
        time: true,
        category: true,
        comment: true
      };
      StatsComponent.explorativeSearchHelpVisible = false;
      StatsComponent.explorativeDrilldownLevel = "overview";
      StatsComponent.explorativeDrilldownAccount = "";
      StatsComponent.explorativeDrilldownCategory = "";
      StatsComponent.explorativeBreadcrumbs = [];
    }
  }

  /**
   * Opens the chart and initializes the translated values for the pie chart.
   */
  openChart() {
    this.translate.get(StatsComponent.accounts).subscribe(translations => {
      StatsComponent.translatedValues = [
        translations['Menu.daily'],
        translations['Menu.splurge'],
        translations['Menu.smile'],
        translations['Menu.fire']
      ];
    });
    if (StatsComponent.modus == "home") {
      StatsComponent.createPieChart();
    }
    this.translate.get(StatsComponent.incomeNames).subscribe(translations => {
      StatsComponent.translatedIncomeValues = [
        translations['Income.Revenue'],
        translations['Income.Interests'],
        translations['Balance.Investments'],
        translations['Income.Revenue'],
        translations['Menu.daily'],
        translations['Menu.splurge'],
        translations['Menu.smile'],
        translations['Menu.fire'],
        translations['Income.Mojo'],
        translations['Cashflow.Expenses']
      ];
    });
    if (StatsComponent.modus == "statement") {
      StatsComponent.createZoomableChart();
    }
  }

  static getCountBox1() {
    let count = 0; 
    // Umsatzwachstum
    if (IncomeComponent.getCreditAmount() >= 0){
      count++;
    }
    // Eigenkapitalrentabilität
    if (IncomeComponent.getEigenkaptitalRen() >= 0){
      count++;
    }

    // Netto-Umsatzrentabilität
    if(IncomeComponent.getNettogewinnmarge() >= 0){
      count++;
    }

    return count;
  }

  static getCountBox2() {
    let count = 0; 
    // Verschuldungsgrad
    if (IncomeComponent.getVerschuldungsgrad() < 1){
      count++;
    }

    // Zinsdeckungsgrad
    if (IncomeComponent.getZinsdeckungsgrad() > 1){
      count++;
    }

    // Eigenkapitalquote
    if(IncomeComponent.getEigenkapitalquote() >= 30){
      count++;
    }

    return count;
  }

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    // Initialize the component
    // Track initial screen dimensions
    StatsComponent.lastScreenWidth = window.innerWidth;
    StatsComponent.lastScreenHeight = window.innerHeight;
    StatsComponent.screenWidth = window.innerWidth;
    StatsComponent.screenHeight = window.innerHeight;
  }

  ngAfterViewInit(): void {
    // Call charts after the view is rendered so D3 can find #chart-container in the DOM
    this.callCharts();
  }
  
  /**
   * Handle resize events - detect orientation changes and window moves
   */
  @HostListener('window:resize')
  onResize(): void {
    // Debounce resize events
    clearTimeout(StatsComponent.resizeTimeout);
    StatsComponent.resizeTimeout = setTimeout(() => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      
      // Check if either dimension changed OR if orientation flipped (width/height swapped)
      const dimensionsChanged = 
        currentWidth !== StatsComponent.lastScreenWidth || 
        currentHeight !== StatsComponent.lastScreenHeight;
      
      if (dimensionsChanged) {
        // Update tracked dimensions
        StatsComponent.lastScreenWidth = currentWidth;
        StatsComponent.lastScreenHeight = currentHeight;
        
        // Update screen dimensions used by charts
        StatsComponent.screenWidth = currentWidth;
        StatsComponent.screenHeight = currentHeight;
        
        StatsComponent.filterPanelMoved = false;
        
        // Recreate the current view
        if (StatsComponent.isBIDashboard) {
          StatsComponent.createBIDashboard(StatsComponent.activeBIDashboard);
        } else {
          this.callCharts();
        }
      }
    }, 50); // Wait 50ms after last resize event
  }
  
  /**
   * Stub method - no longer blocking interactions based on scrolling
   * All user interactions are now allowed immediately
   */
  isScrollingActive(): boolean {
    return false; // Never block
  }
  
  /**
   * Cleanup when component is destroyed
   */
  ngOnDestroy(): void {
    // Clear static instance reference
    if (StatsComponent.currentInstance === this) {
      StatsComponent.currentInstance = null;
    }
  }

  
  callCharts() {
    // Only call createChart for modes that use it (account line charts)
    const accountModes = ["daily", "splurge", "smile", "fire", "income"];
    if (accountModes.includes(StatsComponent.modus)) {
      StatsComponent.createChart(StatsComponent.modus, StatsComponent.selectedMonth, this.isChecked, StatsComponent.selectedMode, StatsComponent.selectedMonth);
    }

    if (StatsComponent.modus == "home") {
      this.translate.get(StatsComponent.accounts).subscribe(translations => {
        StatsComponent.translatedValues = [
          translations['Menu.daily'],
          translations['Menu.splurge'],
          translations['Menu.smile'],
          translations['Menu.fire']
        ];
      });
      StatsComponent.createPieChart();
    }

    if (StatsComponent.modus == "statement") {
      this.translate.get(StatsComponent.incomeNames).subscribe(translations => {
        StatsComponent.translatedIncomeValues = [
          translations['Income.Revenue'],
          translations['Income.Interests'],
          translations['Balance.Investments'],
          translations['Income.Revenue'],
          translations['Menu.daily'],
          translations['Menu.splurge'],
          translations['Menu.smile'],
          translations['Menu.fire'],
          translations['Income.Mojo'],
          translations['Cashflow.Expenses']
        ];
      });
      StatsComponent.createZoomableChart();
    }
    if (StatsComponent.modus == "cashflow") {
      StatsComponent.createCashflowBarChart(StatsComponent.period, StatsComponent.selectedYear);
    }
    if (StatsComponent.modus == "histogram") {
      StatsComponent.createHistogramChart();
    }
    if (StatsComponent.modus == "category"){
      StatsComponent.createCategoryBubbleChart();
    }
    if (StatsComponent.modus == "kpi"){
      StatsComponent.createKPI(StatsComponent.activeKPI); //burn-rate
    }
    if (StatsComponent.modus == "bi"){
      StatsComponent.createBIDashboard(StatsComponent.activeBIDashboard);
    }
  }

  /**
   * Navigates back to the previous page based on the current modus.
   */
  goBack() {
    // Reset filter when leaving BI dashboard
    if (StatsComponent.isBIDashboard) {
      StatsComponent.filterType = 'all';
      StatsComponent.selectedMonth = '';
      StatsComponent.customDateStart = '';
      StatsComponent.customDateEnd = '';
    }
    
    MenuComponent.openStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isKPI = false;
    if (StatsComponent.modus == "home") {
      this.router.navigate(['/home']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "income") {
      this.router.navigate(['/transactions']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "daily") {
      this.router.navigate(['/daily']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "splurge") {
      this.router.navigate(['/splurge']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "smile") {
      this.router.navigate(['/smile']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "fire") {
      this.router.navigate(['/fire']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "statement"){
      this.router.navigate(['/income']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "cashflow") {
      this.router.navigate(['/cashflow']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "histogram") {
      this.router.navigate(['/transactions']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "category"){
      this.router.navigate(['/income']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "kpi"){
      this.router.navigate(['/home']);
      AppComponent.gotoTop();
    }
    if (StatsComponent.modus == "bi"){
      this.router.navigate(['/home']);
      AppComponent.gotoTop();
    }
  }

  /**
   * Dispatches KPI chart creation by type string.
   * @param kpiType - One of 'burn-rate', 'expense-income-ratio', 'top-spending',
   *   'savings-rate', 'recurring-vs-one-time', 'net-worth-trend',
   *   'icome-streams-breakdown', or 'heatmap-calendar'.
   */
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchStartTime = Date.now();
    this.isTouchScrolling = false;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    // Detect if user is scrolling (not just tapping)
    if (typeof this.touchStartX === 'number' && typeof this.touchStartY === 'number') {
      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      const dx = Math.abs(currentX - this.touchStartX);
      const dy = Math.abs(currentY - this.touchStartY);
      
      // If movement is more than 10px, consider it scrolling
      if (dx > 10 || dy > 10) {
        this.isTouchScrolling = true;
      }
    }
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (typeof this.touchStartX !== 'number' || typeof this.touchStartY !== 'number') return;
    
    // If user was scrolling, don't clear flags - let scroll event handler do it
    // This ensures we catch all momentum scrolling regardless of speed
    if (this.isTouchScrolling) {
      this.touchStartX = undefined;
      this.touchStartY = undefined;
      this.touchStartTime = undefined;
      // Don't clear isTouchScrolling - the scroll event handler will clear it
      // when the page actually stops scrolling
      return;
    }
    
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const dx = touchEndX - this.touchStartX;
    const dy = touchEndY - this.touchStartY;
    
    // Only process as swipe if it was a deliberate gesture (not a scroll)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        this.onSwipeLeft();
      } else {
        this.onSwipeRight();
      }
    }
    this.touchStartX = undefined;
    this.touchStartY = undefined;
    this.touchStartTime = undefined;
  }

  touchStartX?: number;
  touchStartY?: number;
  touchStartTime?: number;
  isTouchScrolling: boolean = false;
  isPageScrolling: boolean = false; // Track if page is currently scrolling (including momentum)
  scrollTimeout: any = null; // Debounce timer for scroll end detection

  onSwipeLeft() {
    // Example: go to next period in category chart
    if (StatsComponent.modus === 'category') {
      // Find current period and index from the DOM or keep in a static variable if needed
      // For demo, just call with +1 index
      StatsComponent.createCategoryBubbleChart(StatsComponent.period, StatsComponent.Index + 1);
    }
  }

  onSwipeRight() {
    // Example: go to previous period in category chart
    if (StatsComponent.modus === 'category') {
      StatsComponent.createCategoryBubbleChart(StatsComponent.period, StatsComponent.Index - 1);
    }
  }

  

  selectedMode = "year";
  selectedMonth = "all"
  
  /**
   * Creates a chart based on the provided filter.
   * 
   * @param filter - The filter to apply to the chart.
   */  

  // ===================================================================
  // STATIC DELEGATES — forwarding to extracted modules
  // ===================================================================

  static createKPI(kpiType: string) { return createKPI(kpiType); }
  static createNetWorthTrendChart() { return createNetWorthTrendChart(); }
  static createExpenseIncomeRatio() { return createExpenseIncomeRatio(); }
  static createIncomeStreamsBreakdown(p?: string, i?: number) { return createIncomeStreamsBreakdown(p, i); }
  static createSavingsRate() { return createSavingsRateKPI(); }
  static createBurnRate() { return createBurnRate(); }
  static createTopSpendingCategories(p?: string, i?: number, n?: number) { return createTopSpendingCategories(p, i, n); }
  static createRecurringVsOneTimeChart(p?: string, i?: number) { return createRecurringVsOneTimeChart(p, i); }
  static createHeatmapCalendar(y?: number, m?: number | null, v?: string) { return createHeatmapCalendar(y, m, v as any); }
  static createZoomableChart() { return createZoomableChart(); }
  static createHistogramChart() { return createHistogramChart(); }
  static createCashflowBarChart(p?: any, y?: any) { return createCashflowBarChart(p, y); }
  static createCategoryBubbleChart(p?: string, i?: number) { return createCategoryBubbleChart(p, i); }
  static createChart(filter: string, selectedYear: string = "all", isChecked: boolean = true, selectedMode: string = "year", selectedMonth: string = "all") { return createAccountChart(filter, selectedYear, isChecked, selectedMode, selectedMonth); }
  static showTransactionDetails(t: any[], d: string, f: string) { return showTransactionDetails(t, d, f); }
  static createPieChart() { return createPieChart(); }
  static createBIDashboard(n: number) { return createBIDashboard(n); }
  static createExplorativeAnalytics(c: any) { return createExplorativeAnalytics(c); }
  static updateExplorativeView() { return updateExplorativeView(); }
  static updateBreadcrumbNavigation() { return updateBreadcrumbNavigation(); }
  static getExplorativeFilteredTransactions() { return getExplorativeFilteredTransactions(); }
  static checkExplorativeSearchTerm(t: any, s: string) { return checkExplorativeSearchTerm(t, s); }
  static createPraediktiveAnalytics(c: any) { return createPraediktiveAnalytics(c); }
  static refreshPredictiveMetrics() { return refreshPredictiveMetrics(); }
  static getPredictiveHistoricalData(m: string) { return getPredictiveHistoricalData(m); }
  static calculatePredictions(d: any[]) { return calculatePredictions(d); }
  static calculateARIMAPredictions(d: any[], l: string) { return calculateARIMAPredictions(d, l); }
  static addMonths(m: string, n: number) { return addMonths(m, n); }
  static calculateSavingsRate(m?: string) { return calculateSavingsRate(m); }
  static calculateBudgetCompliance(a: string, t: number, m?: string) { return calculateBudgetCompliance(a, t, m); }
  static calculateFixedCostsRatio(m?: string) { return calculateFixedCostsRatio(m); }
  static getMonthlyData() { return getMonthlyData(); }
  static getFilteredTransactions() { return getFilteredTransactions(); }
  static showOutlierAnalysis(t: any) { return showOutlierAnalysis(t); }
  static detectOutliers(t: any[]) { return detectOutliers(t); }
  static createTransactionDetailsTable(c: any, w: number) { return createTransactionDetailsTable(c, w); }
  static updateTransactionTable() { return updateTransactionTable(); }
  static createTimeFilter(c: any) { return createTimeFilter(c); }
  static createPraeskriptiveAnalytics(c: any) { return createPraeskriptiveAnalytics(c); }
  static refreshScenario() { return refreshScenario(); }

}