import { viewportHeight } from '../../stats/viewport';
import { isActualIncome, toMinorUnits } from '@money/domain';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { merge, Subscription } from 'rxjs';
import { formatNumber } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AppComponent } from 'src/app/app.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { Budget } from 'src/app/interfaces/budget';
import { LocalService } from 'src/app/shared/services/local.service';
import { PlanComponent } from './plan/plan.component';
import * as d3 from 'd3';
import * as sankey from 'd3-sankey';
import { StatsComponent } from 'src/app/stats/stats.component';
import { ChartFilterService, ChartFilterState } from 'src/app/shared/services/chart-filter.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CashflowGameService } from 'src/app/shared/services/cashflow-game.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './budget.component.html',
  styleUrls: [
    './budget.component.css',
    '../../app.component.css',
    '../../shared/styles/filter-styles.css',
  ],
})
export class BudgetComponent implements OnInit, OnDestroy {
  private dataSub?: Subscription;

  /** An amount in the chart labels, in the number format the player chose (4.000,00 / 4,000.00), no sign. */
  private static amount(value: number, decimals = 2): string {
    const locale = AppStateService.instance.isEuropeanFormat ? 'de-DE' : 'en-US';
    return formatNumber(value, locale, `1.${decimals}-${decimals}`);
  }

  static get allBudgets(): Budget[] {
    return AppStateService.instance.allBudgets;
  }
  static set allBudgets(v: Budget[]) {
    AppStateService.instance.allBudgets = v;
  }

  public get appReference() {
    return AppComponent;
  }
  public classReference = BudgetComponent;
  public settingsReference = SettingsComponent;

  static modus = 'budget';
  static period = 'all';
  static Index = 0;

  // Chart filter state
  static chartFilter: ChartFilterState = ChartFilterService.defaultState();
  static chartFilterVisible = false;
  static chartFilterAdvanced = false;

  static isVisual;
  private static translateService: TranslateService;

  /**
   * Creates an instance of the CashflowComponent.
   * @param {Router} router - The router service used for navigation.
   */
  constructor(
    private router: Router,
    private localStorage: LocalService,
    private translate: TranslateService,
    private game: CashflowGameService,
  ) {
    BudgetComponent.isVisual = true;
    BudgetComponent.translateService = translate;
    AppStateService.instance.allBudgets =
      this.localStorage.getData('budget') == ''
        ? []
        : JSON.parse(this.localStorage.getData('budget'));

    // a game from before the budget was planned gets this and last month planned now
    this.game.backfillBudget();
    this.callCharts();
  }

  /**
   * Handles the click event on the cashflow button.
   */
  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.detectScreenOrientation();
  }

  /**
   * Detects the screen orientation and calls the chart creation method.
   */
  detectScreenOrientation() {
    const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    this.callCharts();
  }

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    // Initialize the component
    this.callCharts();
    // A Payday, a game move or a new transaction changes the actuals, the plan and the income: the chart follows without a reload
    const state = AppStateService.instance;
    this.dataSub = merge(state.transactionsUpdated$, state.subscriptionsUpdated$).subscribe(() =>
      this.callCharts(),
    );
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

  callCharts() {
    BudgetComponent.createBudgetVsActuals(BudgetComponent.period, BudgetComponent.Index);
  }

  goToPlan() {
    this.router.navigate(['/plan']);
    AppComponent.gotoTop();
  }

  goToStats() {
    this.router.navigate(['/stats']);
    StatsComponent.resetBIStateIfNeeded('budget');
    BudgetComponent.modus = 'budget';
    BudgetComponent.period = 'month';
    MenuComponent.openStats = true;
    AppComponent.gotoTop();
  }

  // --- Chart filter methods ---
  get chartFilterVisible() {
    return BudgetComponent.chartFilterVisible;
  }
  get chartFilterAdvanced() {
    return BudgetComponent.chartFilterAdvanced;
  }
  get chartFilter() {
    return BudgetComponent.chartFilter;
  }

  toggleChartFilter() {
    BudgetComponent.chartFilterVisible = !BudgetComponent.chartFilterVisible;
  }
  closeChartFilter() {
    BudgetComponent.chartFilterVisible = false;
  }
  toggleChartFilterAdvanced() {
    BudgetComponent.chartFilterAdvanced = !BudgetComponent.chartFilterAdvanced;
  }

  selectChartPeriod(period: string) {
    BudgetComponent.chartFilter.filterType = period as any;
    BudgetComponent.chartFilter.selectedIndex = 0;
    this.applyChartFilter();
  }
  selectChartCustom() {
    BudgetComponent.chartFilter.filterType = 'custom';
    if (!BudgetComponent.chartFilter.customDateStart) {
      const dates = AppStateService.instance.allTransactions.map((t) => t.date).sort();
      BudgetComponent.chartFilter.customDateStart = dates[0] || '';
      BudgetComponent.chartFilter.customDateEnd = new Date().toISOString().split('T')[0];
    }
    this.applyChartFilter();
  }
  chartFilterPrev() {
    BudgetComponent.chartFilter.selectedIndex--;
    this.applyChartFilter();
  }
  chartFilterNext() {
    BudgetComponent.chartFilter.selectedIndex++;
    this.applyChartFilter();
  }
  getChartFilterDateLabel(): string {
    const range = ChartFilterService.getDateRange(
      BudgetComponent.chartFilter.filterType,
      BudgetComponent.chartFilter.selectedIndex,
    );
    return range
      ? ChartFilterService.formatDateRange(
          BudgetComponent.chartFilter.filterType,
          range.startDate,
          range.endDate,
        )
      : '';
  }
  isChartFilterAccountSelected(acc: string) {
    return BudgetComponent.chartFilter.selectedAccounts.includes(acc);
  }
  toggleChartFilterAccount(acc: string) {
    const idx = BudgetComponent.chartFilter.selectedAccounts.indexOf(acc);
    if (idx >= 0) {
      BudgetComponent.chartFilter.selectedAccounts.splice(idx, 1);
    } else {
      BudgetComponent.chartFilter.selectedAccounts.push(acc);
    }
  }
  isChartFilterCategorySelected(cat: string) {
    return BudgetComponent.chartFilter.selectedCategories.includes(cat);
  }
  toggleChartFilterCategory(cat: string) {
    const idx = BudgetComponent.chartFilter.selectedCategories.indexOf(cat);
    if (idx >= 0) {
      BudgetComponent.chartFilter.selectedCategories.splice(idx, 1);
    } else {
      BudgetComponent.chartFilter.selectedCategories.push(cat);
    }
  }
  applyChartFilter() {
    this.callCharts();
  }
  resetChartFilter() {
    BudgetComponent.chartFilter = ChartFilterService.defaultState();
    BudgetComponent.chartFilterAdvanced = false;
    this.applyChartFilter();
  }

  getAvailableAccounts(): string[] {
    const accounts = new Set<string>();
    AppStateService.instance.allTransactions.forEach((t) => {
      if (t.account && t.account !== 'Income') accounts.add(t.account);
    });
    return Array.from(accounts).sort();
  }

  getAvailableCategories(): string[] {
    const cats = new Set<string>();
    AppStateService.instance.allTransactions.forEach((t) => {
      if (t.category) cats.add(t.category.replace('@', ''));
    });
    return Array.from(cats).sort();
  }

  static createBudgetVsActuals(selectedPeriod = 'all', selectedIndex = 0) {
    // Remove previous chart and controls
    d3.select('#chart-container').selectAll('*').remove();

    // Save period/index for navigation
    BudgetComponent.period = selectedPeriod;
    BudgetComponent.Index = selectedIndex;

    // Check if #chart-container exists
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
      console.warn('No #chart-container element found in DOM.');
      return;
    }

    // Set relative position for overlay controls
    chartContainer.style.position = 'relative';

    // Limit chart height to fit in landscape mode, accounting for top toolbar (80px)
    const isLandscape = window.innerWidth > window.innerHeight;
    const toolbarHeight = 150;

    const maxHeight = isLandscape
      ? viewportHeight() - toolbarHeight - Math.floor(viewportHeight() * 0.12)
      : 400;
    const margin = { top: 50, right: 30, bottom: 90, left: 70 };
    const width =
      chartContainer.offsetWidth > 0
        ? chartContainer.offsetWidth - margin.left - margin.right
        : 600;
    const height = maxHeight;

    const svg = d3
      .select('#chart-container')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get all non-Income transactions (using chart filter for advanced filtering)
    const baseTransactions = ChartFilterService.filterTransactions(BudgetComponent.chartFilter);
    const validTransactions = baseTransactions.filter(
      (t) => t.account !== 'Income' && Number(t.amount) < 0,
    );

    if (validTransactions.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No transaction data available');
      return;
    }

    // Find the first and last month with data (from transactions and budgets)
    const transactionDates = validTransactions.map((t) => new Date(t.date));
    const budgetDates = (AppStateService.instance.allBudgets ?? []).map((b) => new Date(b.date));
    const allDates = [...transactionDates, ...budgetDates].filter((d) => !isNaN(d.getTime()));
    const firstDate =
      allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : new Date();
    const lastDate =
      allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : new Date();
    const firstMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    const lastMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);

    // Calculate monthly actuals starting from first month
    const monthlyActuals = d3
      .rollups(
        validTransactions,
        (v) => d3.sum(v, (d) => Math.abs(Number(d.amount))),
        (d) => {
          const date = new Date(d.date);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        },
      )
      .sort((a, b) => a[0].localeCompare(b[0]));

    // Get budget data for the months (accumulate all budgets for each month)
    const budgetMap = new Map<string, number>();
    if (AppStateService.instance.allBudgets) {
      AppStateService.instance.allBudgets.forEach((budget) => {
        const date = new Date(budget.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const prev = budgetMap.get(monthKey) || 0;
        budgetMap.set(monthKey, prev + (Number(budget.amount) || 0));
      });
    }

    // The income of each month (the green line): what was earned, not what was sold or borrowed
    const monthlyIncome = new Map<string, number>();
    for (const tx of baseTransactions) {
      const amount = Number(tx.amount);
      if (
        !isActualIncome({
          account: tx.account,
          amountMinor: toMinorUnits(amount),
          comment: tx.comment,
          category: tx.category,
        })
      ) {
        continue;
      }
      const date = new Date(tx.date);
      if (isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyIncome.set(key, (monthlyIncome.get(key) || 0) + amount);
    }

    // Determine months to show based on chart filter
    const monthsToShow: string[] = [];
    const range = ChartFilterService.getDateRange(
      BudgetComponent.chartFilter.filterType,
      BudgetComponent.chartFilter.selectedIndex,
    );

    if (range) {
      // Generate month keys within the filter date range
      const tempDate = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), 1);
      const rangeEnd = new Date(range.endDate.getFullYear(), range.endDate.getMonth(), 1);
      while (tempDate <= rangeEnd) {
        const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
        monthsToShow.push(monthKey);
        tempDate.setMonth(tempDate.getMonth() + 1);
      }
    } else if (
      BudgetComponent.chartFilter.filterType === 'custom' &&
      BudgetComponent.chartFilter.customDateStart
    ) {
      const cs = new Date(BudgetComponent.chartFilter.customDateStart);
      const ce = BudgetComponent.chartFilter.customDateEnd
        ? new Date(BudgetComponent.chartFilter.customDateEnd)
        : new Date();
      const tempDate = new Date(cs.getFullYear(), cs.getMonth(), 1);
      const rangeEnd = new Date(ce.getFullYear(), ce.getMonth(), 1);
      while (tempDate <= rangeEnd) {
        const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
        monthsToShow.push(monthKey);
        tempDate.setMonth(tempDate.getMonth() + 1);
      }
    } else {
      // "all" - show all months from first to last
      const tempDate = new Date(firstMonth);
      while (tempDate <= lastMonth) {
        const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
        monthsToShow.push(monthKey);
        tempDate.setMonth(tempDate.getMonth() + 1);
      }
    }

    // Prepare chart data for each month in the selected period
    const chartData = monthsToShow.map((monthKey) => {
      const actualEntry = monthlyActuals.find((d) => d[0] === monthKey);
      const actual = actualEntry ? actualEntry[1] : 0;
      const planned = budgetMap.get(monthKey) || 0;
      const difference = actual - planned;
      const income = monthlyIncome.get(monthKey) || 0;

      return {
        month: monthKey,
        actual,
        planned,
        income,
        plannedCashflow: income - planned,
        cashflow: income - actual,
        difference,
        overBudget: difference > 0 ? difference : 0,
        underBudget: difference > 0 ? planned : actual,
      };
    });

    // Scales
    const x = d3
      .scaleBand()
      .domain(chartData.map((d) => d.month))
      .range([0, width])
      .padding(0.3);

    const maxValue = d3.max(chartData, (d) => Math.max(d.actual, d.planned, d.income)) || 0;
    const y = d3
      .scaleLinear()
      .domain([0, maxValue * 1.15])
      .range([height, 0]);

    // Shared function to show info box for a month
    const PLANNED = '#7b1fa2';
    const INCOME = '#2e7d32';
    const showInfoBox = (d: any, xPos: number) => {
      d3.select('#kpi-info-box').remove();

      const tr = (key: string) => BudgetComponent.translateService.instant(key);
      const money = (value: number) =>
        `${value < 0 ? '-' : ''}${BudgetComponent.amount(Math.abs(value))} ${AppStateService.instance.currency}`;
      const row = (color: string, label: string, value: string, strong = false) =>
        `<div class="kpi-row"><span class="kpi-label"><span style="color:${color};">●</span> ${label}</span><span class="kpi-value"${strong ? ' style="font-weight:bold;"' : ''}>${value}</span></div>`;
      const over = d.difference > 0;
      const info = `
      <strong>${d3.timeFormat('%B %Y')(new Date(d.month))}</strong>
      ${row('#2196F3', tr('Budget.actual'), money(d.actual))}
      ${row(PLANNED, tr('Budget.planned'), money(d.planned))}
      ${row(over ? '#d32f2f' : '#2196F3', `${over ? tr('Budget.over') : tr('Budget.under')} ${tr('Budget.label')}`, money(Math.abs(d.difference)), true)}
      <hr style="margin:6px 0;border:0;border-top:1px solid var(--color-border, #ccc);" />
      ${row(INCOME, tr('Budget.income'), money(d.income))}
      ${row(PLANNED, tr('Budget.plannedCashflow'), money(d.plannedCashflow), true)}
      ${row('#2196F3', tr('Budget.cashflow'), money(d.cashflow), true)}
    `;

      // as wide as the chart allows (a phone), and always inside it
      const containerWidth = (chartContainer as HTMLElement).offsetWidth || width + margin.left;
      const boxWidth = Math.min(260, containerWidth - 8);
      const xPercent = xPos / width;
      let left = xPercent < 0.5 ? xPos + margin.left + 12 : xPos + margin.left - boxWidth;
      left = Math.max(4, Math.min(left, containerWidth - boxWidth - 4));
      let top = Math.min(y(d.underBudget), y(d.actual), y(d.planned)) + margin.top - 10;

      if (top < 10) top = 10;
      if (top + 190 > window.innerHeight) top = Math.max(10, window.innerHeight - 200);

      d3.select('#chart-container')
        .append('div')
        .attr('id', 'kpi-info-box')
        .style('position', 'absolute')
        .style('left', left + 'px')
        .style('top', top + 'px')
        .style('width', boxWidth + 'px')
        .style('box-sizing', 'border-box')
        .style('background', 'var(--color-surface)')
        .style('border', '1px solid var(--color-warning)')
        .style('border-radius', '6px')
        .style('padding', '10px')
        .style('font-size', '13px')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
        .style('z-index', '5')
        .html(info);
      d3.selectAll('#kpi-info-box .kpi-row')
        .style('display', 'flex')
        .style('justify-content', 'space-between')
        .style('gap', '8px');
      d3.selectAll('#kpi-info-box .kpi-value').style('white-space', 'nowrap');
    };

    // Axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(x).tickFormat((d) => {
          const [year, month] = d.split('-');
          return d3.timeFormat('%b %y')(new Date(+year, +month - 1, 1));
        }),
      )
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    svg.append('g').call(d3.axisLeft(y).ticks(8));

    // Y-axis label (hide if portrait and small screen)
    const isPortrait = window.innerWidth <= window.innerHeight;
    const isSmallScreen = window.innerWidth < 600;
    if (!(isPortrait && isSmallScreen)) {
      svg
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -50)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(`Amount (${AppStateService.instance.currency})`);
    }

    // Bars - under budget portion (blue)
    svg
      .selectAll('.bar-under')
      .data(chartData)
      .enter()
      .append('rect')
      .attr('class', 'bar-under')
      .attr('x', (d) => x(d.month)!)
      .attr('y', (d) => y(d.underBudget))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.underBudget))
      .attr('fill', '#2196F3')
      .style('cursor', 'pointer')
      .on('click', function (event, d) {
        showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
        event.stopPropagation();
      });

    // Bars - over budget portion (red)
    svg
      .selectAll('.bar-over')
      .data(chartData.filter((d) => d.overBudget > 0))
      .enter()
      .append('rect')
      .attr('class', 'bar-over')
      .attr('x', (d) => x(d.month)!)
      .attr('y', (d) => y(d.actual))
      .attr('width', x.bandwidth())
      .attr('height', (d) => y(d.planned) - y(d.actual))
      .attr('fill', '#d32f2f')
      .style('cursor', 'pointer')
      .on('click', function (event, d) {
        showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
        event.stopPropagation();
      });

    // Budget line
    const line = d3
      .line<any>()
      .x((d) => x(d.month)! + x.bandwidth() / 2)
      .y((d) => y(d.planned));

    svg
      .append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', PLANNED)
      .attr('stroke-width', 3)
      .attr('d', line);

    // Budget line points
    svg
      .selectAll('.budget-point')
      .data(chartData)
      .enter()
      .append('circle')
      .attr('class', 'budget-point')
      .attr('cx', (d) => x(d.month)! + x.bandwidth() / 2)
      .attr('cy', (d) => y(d.planned))
      .attr('r', 5)
      .attr('fill', PLANNED)
      .attr('stroke', PLANNED)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', function (event, d) {
        showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
        event.stopPropagation();
      });

    // Income line (green, with bullets): what was earned in the month
    const incomeLine = d3
      .line<any>()
      .x((d) => x(d.month)! + x.bandwidth() / 2)
      .y((d) => y(d.income));
    if (chartData.some((d) => d.income > 0)) {
      svg
        .append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', INCOME)
        .attr('stroke-width', 3)
        .attr('d', incomeLine);
      svg
        .selectAll('.income-point')
        .data(chartData)
        .enter()
        .append('circle')
        .attr('class', 'income-point')
        .attr('cx', (d) => x(d.month)! + x.bandwidth() / 2)
        .attr('cy', (d) => y(d.income))
        .attr('r', 5)
        .attr('fill', INCOME)
        .attr('stroke', INCOME)
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
          showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
          event.stopPropagation();
        });
    }

    // Actual value labels
    svg
      .selectAll('.actual-label')
      .data(chartData.filter((d) => d.actual > 0))
      .enter()
      .append('text')
      .attr('class', 'actual-label')
      .attr('x', (d) => x(d.month)! + x.bandwidth() / 2)
      .attr('y', (d) => y(d.actual) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', 'black')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .text((d) => BudgetComponent.amount(d.actual, 0));

    // Difference labels (red for over budget)
    svg
      .selectAll('.diff-label')
      .data(chartData.filter((d) => d.difference > 0))
      .enter()
      .append('text')
      .attr('class', 'diff-label')
      .attr('x', (d) => x(d.month)! + x.bandwidth() / 2)
      .attr('y', (d) => y(d.actual) - 22)
      .attr('text-anchor', 'middle')
      .attr('fill', '#d32f2f')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .text((d) => `+${BudgetComponent.amount(d.difference, 0)}`);

    // Interactive dots for details (only if actual > 0)
    svg
      .selectAll('.info-dot')
      .data(chartData.filter((d) => d.actual > 0))
      .enter()
      .append('circle')
      .attr('class', 'info-dot')
      .attr('cx', (d) => x(d.month)! + x.bandwidth() / 2)
      .attr('cy', (d) => y(d.actual) + 14)
      .attr('r', 4)
      .attr('fill', '#222')
      .style('cursor', 'pointer')
      .on('click', function (event, d) {
        showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
        event.stopPropagation();
      });

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text(BudgetComponent.translateService.instant('Budget.chartTitle'));

    // Period display label
    d3.select('#chart-container')
      .append('div')
      .style('position', 'absolute')
      .style('top', '20px')
      .style('left', '50%')
      .style('transform', 'translateX(-50%)')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('text-align', 'center')
      .style('color', 'var(--color-text)')
      .text(() => {
        const r = ChartFilterService.getDateRange(
          BudgetComponent.chartFilter.filterType,
          BudgetComponent.chartFilter.selectedIndex,
        );
        if (!r) return BudgetComponent.translateService.instant('Period.all');
        return ChartFilterService.formatDateRange(
          BudgetComponent.chartFilter.filterType,
          r.startDate,
          r.endDate,
        );
      });

    // Legend - fixed in upper right corner
    const legendContainer = d3
      .select('#chart-container')
      .append('div')
      .attr('id', 'budget-legend')
      .style('position', 'absolute')
      .style('top', isLandscape ? '1.3%' : '25px')
      .style('right', isLandscape ? '20px' : '2px')
      .style('border-radius', '6px')
      .style('padding', '8px 16px')
      .style('font-size', '13px');

    const legendData = [
      { label: BudgetComponent.translateService.instant('Budget.actual'), color: '#2196F3' },
      { label: BudgetComponent.translateService.instant('Budget.overBudget'), color: '#d32f2f' },
      {
        label: BudgetComponent.translateService.instant('Budget.planned'),
        color: PLANNED,
        line: true,
      },
      {
        label: BudgetComponent.translateService.instant('Budget.income'),
        color: INCOME,
        line: true,
      },
    ];

    legendData.forEach((item) => {
      const row = legendContainer
        .append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('margin-bottom', '4px');

      if (item.line) {
        const mark = row.append('svg').attr('width', 22).attr('height', 12);
        mark
          .append('line')
          .attr('x1', 2)
          .attr('x2', 20)
          .attr('y1', 6)
          .attr('y2', 6)
          .attr('stroke', item.color)
          .attr('stroke-width', 3);
        mark.append('circle').attr('cx', 11).attr('cy', 6).attr('r', 3.5).attr('fill', item.color);
      } else {
        row
          .append('div')
          .style('width', '20px')
          .style('height', '10px')
          .style('background', item.color)
          .style('margin-right', '4px')
          .style('border-radius', '2px');
      }

      row.append('span').style('margin-left', '6px').text(item.label);
    });

    // Global click handler to close info box when clicking outside
    d3.select('body').on('click.budget-info', function () {
      d3.select('#kpi-info-box').remove();
    });
  }
}
