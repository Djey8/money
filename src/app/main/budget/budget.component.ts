import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AppComponent } from 'src/app/app.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { Budget } from 'src/app/interfaces/budget';
import { LocalService } from 'src/app/shared/services/local.service';
import { PlanComponent } from './plan/plan.component';
import * as d3 from 'd3';
import * as sankey from 'd3-sankey'
import { StatsComponent } from 'src/app/stats/stats.component';
import { ChartFilterService, ChartFilterState } from 'src/app/shared/services/chart-filter.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.css', '../../app.component.css', '../../shared/styles/filter-styles.css']
})
export class BudgetComponent {
  static get allBudgets(): Budget[] { return AppStateService.instance.allBudgets; }
  static set allBudgets(v: Budget[]) { AppStateService.instance.allBudgets = v; }

  public get appReference() { return AppComponent; }
  public classReference = BudgetComponent;
  public settingsReference = SettingsComponent;

  static modus = "budget";
  static period = "all";
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
  constructor(private router:Router, private localStorage: LocalService, private translate: TranslateService){ 
    BudgetComponent.isVisual = true;
    BudgetComponent.translateService = translate;
    AppStateService.instance.allBudgets = this.localStorage.getData("budget")=="" ? [] : JSON.parse(this.localStorage.getData("budget"));

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
  }

  callCharts(){
    BudgetComponent.createBudgetVsActuals(BudgetComponent.period, BudgetComponent.Index);
  }


  goToPlan() {
    this.router.navigate(['/plan']);
    AppComponent.gotoTop();
  }

  goToStats(){
    this.router.navigate(['/stats']);
    StatsComponent.resetBIStateIfNeeded("budget");
    BudgetComponent.modus = "budget"
    BudgetComponent.period = "month";
    MenuComponent.openStats = true;
    AppComponent.gotoTop();
  }

  // --- Chart filter methods ---
  get chartFilterVisible() { return BudgetComponent.chartFilterVisible; }
  get chartFilterAdvanced() { return BudgetComponent.chartFilterAdvanced; }
  get chartFilter() { return BudgetComponent.chartFilter; }

  toggleChartFilter() { BudgetComponent.chartFilterVisible = !BudgetComponent.chartFilterVisible; }
  closeChartFilter() { BudgetComponent.chartFilterVisible = false; }
  toggleChartFilterAdvanced() { BudgetComponent.chartFilterAdvanced = !BudgetComponent.chartFilterAdvanced; }

  selectChartPeriod(period: string) {
    BudgetComponent.chartFilter.filterType = period as any;
    BudgetComponent.chartFilter.selectedIndex = 0;
    this.applyChartFilter();
  }
  selectChartCustom() {
    BudgetComponent.chartFilter.filterType = 'custom';
    if (!BudgetComponent.chartFilter.customDateStart) {
      const dates = AppStateService.instance.allTransactions.map(t => t.date).sort();
      BudgetComponent.chartFilter.customDateStart = dates[0] || '';
      BudgetComponent.chartFilter.customDateEnd = new Date().toISOString().split('T')[0];
    }
    this.applyChartFilter();
  }
  chartFilterPrev() { BudgetComponent.chartFilter.selectedIndex--; this.applyChartFilter(); }
  chartFilterNext() { BudgetComponent.chartFilter.selectedIndex++; this.applyChartFilter(); }
  getChartFilterDateLabel(): string {
    const range = ChartFilterService.getDateRange(BudgetComponent.chartFilter.filterType, BudgetComponent.chartFilter.selectedIndex);
    return range ? ChartFilterService.formatDateRange(BudgetComponent.chartFilter.filterType, range.startDate, range.endDate) : '';
  }
  isChartFilterAccountSelected(acc: string) { return BudgetComponent.chartFilter.selectedAccounts.includes(acc); }
  toggleChartFilterAccount(acc: string) {
    const idx = BudgetComponent.chartFilter.selectedAccounts.indexOf(acc);
    idx >= 0 ? BudgetComponent.chartFilter.selectedAccounts.splice(idx, 1) : BudgetComponent.chartFilter.selectedAccounts.push(acc);
  }
  isChartFilterCategorySelected(cat: string) { return BudgetComponent.chartFilter.selectedCategories.includes(cat); }
  toggleChartFilterCategory(cat: string) {
    const idx = BudgetComponent.chartFilter.selectedCategories.indexOf(cat);
    idx >= 0 ? BudgetComponent.chartFilter.selectedCategories.splice(idx, 1) : BudgetComponent.chartFilter.selectedCategories.push(cat);
  }
  applyChartFilter() { this.callCharts(); }
  resetChartFilter() {
    BudgetComponent.chartFilter = ChartFilterService.defaultState();
    BudgetComponent.chartFilterAdvanced = false;
    this.applyChartFilter();
  }

  getAvailableAccounts(): string[] {
    const accounts = new Set<string>();
    AppStateService.instance.allTransactions.forEach(t => {
      if (t.account && t.account !== 'Income') accounts.add(t.account);
    });
    return Array.from(accounts).sort();
  }

  getAvailableCategories(): string[] {
    const cats = new Set<string>();
    AppStateService.instance.allTransactions.forEach(t => {
      if (t.category) cats.add(t.category.replace('@', ''));
    });
    return Array.from(cats).sort();
  }

  static createBudgetVsActuals(selectedPeriod: string = "all", selectedIndex: number = 0) {
  // Remove previous chart and controls
  d3.select("#chart-container").selectAll("*").remove();

  // Save period/index for navigation
  BudgetComponent.period = selectedPeriod;
  BudgetComponent.Index = selectedIndex;

  // Check if #chart-container exists
  const chartContainer = document.getElementById("chart-container");
  if (!chartContainer) {
    console.warn("No #chart-container element found in DOM.");
    return;
  }

  // Set relative position for overlay controls
  chartContainer.style.position = "relative";

  // Limit chart height to fit in landscape mode, accounting for top toolbar (80px)
  const isLandscape = window.innerWidth > window.innerHeight;
  const toolbarHeight = 150;
  
  const maxHeight = isLandscape ? window.innerHeight - toolbarHeight - Math.floor(window.innerHeight * 0.12) : 400;
  const margin = { top: 50, right: 30, bottom: 90, left: 70 };
  const width = chartContainer.offsetWidth > 0 ? chartContainer.offsetWidth - margin.left - margin.right : 600;
  const height = maxHeight;


  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Get all non-Income transactions (using chart filter for advanced filtering)
  const baseTransactions = ChartFilterService.filterTransactions(BudgetComponent.chartFilter);
  const validTransactions = baseTransactions.filter(t => 
    t.account !== "Income" && Number(t.amount) < 0
  );

  if (validTransactions.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No transaction data available");
    return;
  }

  // Find the first and last month with data (from transactions and budgets)
  const transactionDates = validTransactions.map(t => new Date(t.date));
  const budgetDates = (AppStateService.instance.allBudgets ?? []).map(b => new Date(b.date));
  const allDates = [...transactionDates, ...budgetDates].filter(d => !isNaN(d.getTime()));
  const firstDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const lastDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
  const firstMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  const lastMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);

  // Calculate monthly actuals starting from first month
  const monthlyActuals = d3.rollups(
    validTransactions,
    v => d3.sum(v, d => Math.abs(Number(d.amount))),
    d => {
      const date = new Date(d.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  ).sort((a, b) => a[0].localeCompare(b[0]));

  // Get budget data for the months (accumulate all budgets for each month)
  const budgetMap = new Map<string, number>();
  if (AppStateService.instance.allBudgets) {
    AppStateService.instance.allBudgets.forEach(budget => {
      const date = new Date(budget.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const prev = budgetMap.get(monthKey) || 0;
      budgetMap.set(monthKey, prev + (Number(budget.amount) || 0));
    });
  }

  // Determine months to show based on chart filter
  let monthsToShow: string[] = [];
  const range = ChartFilterService.getDateRange(BudgetComponent.chartFilter.filterType, BudgetComponent.chartFilter.selectedIndex);

  if (range) {
    // Generate month keys within the filter date range
    let tempDate = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), 1);
    const rangeEnd = new Date(range.endDate.getFullYear(), range.endDate.getMonth(), 1);
    while (tempDate <= rangeEnd) {
      const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
      monthsToShow.push(monthKey);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
  } else if (BudgetComponent.chartFilter.filterType === 'custom' && BudgetComponent.chartFilter.customDateStart) {
    const cs = new Date(BudgetComponent.chartFilter.customDateStart);
    const ce = BudgetComponent.chartFilter.customDateEnd ? new Date(BudgetComponent.chartFilter.customDateEnd) : new Date();
    let tempDate = new Date(cs.getFullYear(), cs.getMonth(), 1);
    const rangeEnd = new Date(ce.getFullYear(), ce.getMonth(), 1);
    while (tempDate <= rangeEnd) {
      const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
      monthsToShow.push(monthKey);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
  } else {
    // "all" - show all months from first to last
    let tempDate = new Date(firstMonth);
    while (tempDate <= lastMonth) {
      const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
      monthsToShow.push(monthKey);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
  }

  // Prepare chart data for each month in the selected period
  const chartData = monthsToShow.map(monthKey => {
    const actualEntry = monthlyActuals.find(d => d[0] === monthKey);
    const actual = actualEntry ? actualEntry[1] : 0;
    const planned = budgetMap.get(monthKey) || 0;
    const difference = actual - planned;
    
    return {
      month: monthKey,
      actual,
      planned,
      difference,
      overBudget: difference > 0 ? difference : 0,
      underBudget: difference > 0 ? planned : actual
    };
  });

  // Scales
  const x = d3.scaleBand()
    .domain(chartData.map(d => d.month))
    .range([0, width])
    .padding(0.3);

  const maxValue = d3.max(chartData, d => Math.max(d.actual, d.planned)) || 0;
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.15])
    .range([height, 0]);

  // Shared function to show info box for a month
  const showInfoBox = (d: any, xPos: number) => {
    d3.select("#kpi-info-box").remove();

    const info = `
      <strong>${d3.timeFormat("%B %Y")(new Date(d.month))}</strong><br/>
      <span style="color:#2196F3;">●</span> ${BudgetComponent.translateService.instant('Budget.actual')}: ${d.actual.toFixed(2)} ${AppStateService.instance.currency}<br/>
      <span style="color:green;">●</span> ${BudgetComponent.translateService.instant('Budget.planned')}: ${d.planned.toFixed(2)} ${AppStateService.instance.currency}<br/>
      <strong style="color:${d.difference > 0 ? '#d32f2f' : '#4caf50'}">
        ${d.difference > 0 ? BudgetComponent.translateService.instant('Budget.over') : BudgetComponent.translateService.instant('Budget.under')} ${BudgetComponent.translateService.instant('Budget.label')}: ${Math.abs(d.difference).toFixed(2)} ${AppStateService.instance.currency}
      </strong>
    `;

    const infoBoxWidth = 200;
    const xPercent = xPos / width;
    let left = xPercent < 0.5 
      ? xPos + margin.left + 12 
      : xPos + margin.left - infoBoxWidth;
    let top = Math.min(y(d.underBudget), y(d.actual), y(d.planned)) + margin.top - 10;

    if (top < 10) top = 10;
    if (top + 150 > window.innerHeight) top = window.innerHeight - 160;

    d3.select("#chart-container")
      .append("div")
      .attr("id", "kpi-info-box")
      .style("position", "absolute")
      .style("left", left + "px")
      .style("top", top + "px")
      .style("background", "var(--color-surface)")
      .style("border", "1px solid var(--color-warning)")
      .style("border-radius", "6px")
      .style("padding", "12px")
      .style("font-size", "13px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
      .style("min-width", "180px")
      .html(info);
  };

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      const [year, month] = d.split('-');
      return d3.timeFormat("%b %y")(new Date(+year, +month - 1, 1));
    }))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g")
    .call(d3.axisLeft(y).ticks(8));

  // Y-axis label (hide if portrait and small screen)
  const isPortrait = window.innerWidth <= window.innerHeight;
  const isSmallScreen = window.innerWidth < 600;
  if (!(isPortrait && isSmallScreen)) {
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(`Amount (${AppStateService.instance.currency})`);
  }

  // Bars - under budget portion (blue)
  svg.selectAll(".bar-under")
    .data(chartData)
    .enter()
    .append("rect")
    .attr("class", "bar-under")
    .attr("x", d => x(d.month)!)
    .attr("y", d => y(d.underBudget))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.underBudget))
    .attr("fill", "#2196F3")
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
      event.stopPropagation();
    });

  // Bars - over budget portion (red)
  svg.selectAll(".bar-over")
    .data(chartData.filter(d => d.overBudget > 0))
    .enter()
    .append("rect")
    .attr("class", "bar-over")
    .attr("x", d => x(d.month)!)
    .attr("y", d => y(d.actual))
    .attr("width", x.bandwidth())
    .attr("height", d => y(d.planned) - y(d.actual))
    .attr("fill", "#d32f2f")
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
      event.stopPropagation();
    });

  // Budget line
  const line = d3.line<any>()
    .x(d => x(d.month)! + x.bandwidth() / 2)
    .y(d => y(d.planned));

  svg.append("path")
    .datum(chartData)
    .attr("fill", "none")
    .attr("stroke", "green")
    .attr("stroke-width", 3)
    .attr("d", line);

  // Budget line points
  svg.selectAll(".budget-point")
    .data(chartData)
    .enter()
    .append("circle")
    .attr("class", "budget-point")
    .attr("cx", d => x(d.month)! + x.bandwidth() / 2)
    .attr("cy", d => y(d.planned))
    .attr("r", 5)
    .attr("fill", "green")
    .attr("stroke", "green")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
      event.stopPropagation();
    });

  // Actual value labels
  svg.selectAll(".actual-label")
    .data(chartData.filter(d => d.actual > 0))
    .enter()
    .append("text")
    .attr("class", "actual-label")
    .attr("x", d => x(d.month)! + x.bandwidth() / 2)
    .attr("y", d => y(d.actual) - 8)
    .attr("text-anchor", "middle")
    .attr("fill", "black")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(d => d.actual.toFixed(0));

  // Difference labels (red for over budget)
  svg.selectAll(".diff-label")
    .data(chartData.filter(d => d.difference > 0))
    .enter()
    .append("text")
    .attr("class", "diff-label")
    .attr("x", d => x(d.month)! + x.bandwidth() / 2)
    .attr("y", d => y(d.actual) - 22)
    .attr("text-anchor", "middle")
    .attr("fill", "#d32f2f")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(d => `+${d.difference.toFixed(0)}`);

  // Interactive dots for details (only if actual > 0)
  svg.selectAll(".info-dot")
    .data(chartData.filter(d => d.actual > 0))
    .enter()
    .append("circle")
    .attr("class", "info-dot")
    .attr("cx", d => x(d.month)! + x.bandwidth() / 2)
    .attr("cy", d => y(d.actual) + 14)
    .attr("r", 4)
    .attr("fill", "#222")
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      showInfoBox(d, x(d.month)! + x.bandwidth() / 2);
      event.stopPropagation();
    });

  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -35)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text(BudgetComponent.translateService.instant('Budget.chartTitle'));

  // Period display label
  d3.select("#chart-container")
    .append("div")
    .style("position", "absolute")
    .style("top", "20px")
    .style("left", "50%")
    .style("transform", "translateX(-50%)")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .style("text-align", "center")
    .style("color", "var(--color-text)")
    .text(() => {
      const r = ChartFilterService.getDateRange(BudgetComponent.chartFilter.filterType, BudgetComponent.chartFilter.selectedIndex);
      if (!r) return BudgetComponent.translateService.instant('Period.all');
      return ChartFilterService.formatDateRange(BudgetComponent.chartFilter.filterType, r.startDate, r.endDate);
    });

  // Legend - fixed in upper right corner
  const legendContainer = d3.select("#chart-container")
    .append("div")
    .attr("id", "budget-legend")
    .style("position", "absolute")
    .style("top", isLandscape ? "1.3%" : "25px")
    .style("right", isLandscape ? "20px" : "2px")
    .style("border-radius", "6px")
    .style("padding", "8px 16px")
    .style("font-size", "13px");

  const legendData = [
    { label: BudgetComponent.translateService.instant('Budget.actual'), color: "#2196F3" },
    { label: BudgetComponent.translateService.instant('Budget.overBudget'), color: "#d32f2f" },
    { label: BudgetComponent.translateService.instant('Budget.planned'), color: "green" }
  ];

  legendData.forEach(item => {
    const row = legendContainer.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("margin-bottom", "4px");

    if (item.label === "Planned") {
      row.append("svg")
        .attr("width", 22)
        .attr("height", 12)
        .append("line")
        .attr("x1", 2)
        .attr("x2", 20)
        .attr("y1", 6)
        .attr("y2", 6)
        .attr("stroke", item.color)
        .attr("stroke-width", 3);
    } else {
      row.append("div")
        .style("width", "20px")
        .style("height", "10px")
        .style("background", item.color)
        .style("margin-right", "4px")
        .style("border-radius", "2px");
    }

    row.append("span")
      .style("margin-left", "6px")
      .text(item.label);
  });

  // Global click handler to close info box when clicking outside
  d3.select("body").on("click.budget-info", function() {
    d3.select("#kpi-info-box").remove();
  });
}
}