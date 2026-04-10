import { StatsComponent } from '../stats.component';
import * as d3 from 'd3';
import { ChartFilterService } from '../../shared/services/chart-filter.service';
import { AppStateService } from '../../shared/services/app-state.service';

// Deferred import to break circular chain
let IncomeComponent: any; setTimeout(() => import('../../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));

export function createBIDashboard(dashboardNumber: number) {
  // Update active dashboard tracking
  StatsComponent.activeBIDashboard = dashboardNumber;
  
  // Reset filter panel moved flag to ensure it gets repositioned when switching back to explorative
  StatsComponent.filterPanelMoved = false;
  
  // Save the filter panel before clearing (if it exists)
  const savedFilterPanel = document.getElementById('explorative-filter-panel');
  let filterParent: HTMLElement | null = null;
  if (savedFilterPanel && savedFilterPanel.parentElement) {
    filterParent = savedFilterPanel.parentElement;
    // Temporarily move filter out of the container to prevent it from being removed
    document.body.appendChild(savedFilterPanel);
    savedFilterPanel.style.display = 'none';
  }

  // Clear all chart containers completely
  const chartContainer = d3.select("#chart-container");
  chartContainer.selectAll("*").remove();
  
  StatsComponent.isBIDashboard = true;
  StatsComponent.pageTitle = 'Menu.bi'; // Change title to Business Intelligence
  
  // Trigger change detection to update the title in the view
  if (StatsComponent.currentInstance) {
    StatsComponent.currentInstance.cdr.detectChanges();
  }
  
  // Create main container
  const mainContainer = chartContainer.append("div")
    .style("width", "100%")
    .style("height", "100%")
    .style("background", "var(--color-background)");
  
  // Create Analytics Level Selector
  createAnalyticsLevelSelector(mainContainer);
  
  // Create content based on selected analytics level
  if (StatsComponent.activeAnalyticsLevel === 'deskriptive') {
    // Show the 3 dashboards for Deskriptive Analytics
    switch(dashboardNumber) {
      case 1:
        createBIDashboard1_FinancialOverview();
        break;
      case 2:
        createBIDashboard2_AccountBudgetAnalysis();
        break;
      case 3:
        createBIDashboard3_CategoryAnalysis();
        break;
      case 4:
        createBIDashboard4_CostsAnalysis();
        break;
      default:
        createBIDashboard1_FinancialOverview();
    }
  } else if (StatsComponent.activeAnalyticsLevel === 'explorative') {
    // Show Explorative Analytics
    StatsComponent.createExplorativeAnalytics(mainContainer);
  } else if (StatsComponent.activeAnalyticsLevel === 'praediktive') {
    // Show Prädiktive Analytics
    StatsComponent.createPraediktiveAnalytics(mainContainer);
  } else if (StatsComponent.activeAnalyticsLevel === 'praeskriptive') {
    // Show Präskriptive Analytics
    StatsComponent.createPraeskriptiveAnalytics(mainContainer);
  } else {
    // Placeholder for other analytics levels
    createAnalyticsPlaceholder(mainContainer);
  }
}
/**
 * Create Analytics Level Selector
 */
export function createAnalyticsLevelSelector(container: any) {
  const selectorDiv = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "15px")
    .style("margin-bottom", "15px")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
    .style("border-radius", "8px");
  
  // Detect screen size for responsive layout
  const screenWidth = window.innerWidth;
  const isMobileLayout = screenWidth < 600;
  
  const levels = [
    { id: 'deskriptive', label: StatsComponent.translateService.instant('BI.deskriptive'), subtitle: StatsComponent.translateService.instant('BI.deskriptiveSubtitle'), short: StatsComponent.translateService.instant('BI.deskriptiveShort') },
    { id: 'explorative', label: StatsComponent.translateService.instant('BI.explorative'), subtitle: StatsComponent.translateService.instant('BI.explorativeSubtitle'), short: StatsComponent.translateService.instant('BI.explorativeShort') },
    { id: 'praediktive', label: StatsComponent.translateService.instant('BI.praediktive'), subtitle: StatsComponent.translateService.instant('BI.praediktiveSubtitle'), short: StatsComponent.translateService.instant('BI.praediktiveShort') },
    { id: 'praeskriptive', label: StatsComponent.translateService.instant('BI.praeskriptive'), subtitle: StatsComponent.translateService.instant('BI.praeskriptiveSubtitle'), short: StatsComponent.translateService.instant('BI.praeskriptiveShort') }
  ];
  
  if (isMobileLayout) {
    // Mobile: Show dropdown-style selector
    const currentLevel = levels.find(l => l.id === StatsComponent.activeAnalyticsLevel) || levels[0];
    
    // Header showing selected level (clickable to expand)
    const headerDiv = selectorDiv.append("div")
      .attr("id", "analytics-selector-header")
      .style("cursor", "pointer")
      .style("padding", "12px")
      .style("border", "2px solid var(--color-primary)")
      .style("border-radius", "8px")
      .style("background", "var(--color-info-surface)")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .on("click", function() {
        const dropdown = d3.select("#analytics-dropdown");
        const isHidden = dropdown.style("display") === "none";
        dropdown.style("display", isHidden ? "block" : "none");
        d3.select("#dropdown-arrow").text(isHidden ? "▲" : "▼");
      });
    
    headerDiv.append("div")
      .style("font-weight", "bold")
      .style("color", "var(--color-primary)")
      .style("font-size", "14px")
      .text(currentLevel.short);
    
    headerDiv.append("div")
      .attr("id", "dropdown-arrow")
      .style("color", "var(--color-primary)")
      .style("font-size", "12px")
      .text("▼");
    
    // Dropdown with all options (initially hidden)
    const dropdownDiv = selectorDiv.append("div")
      .attr("id", "analytics-dropdown")
      .style("display", "none")
      .style("margin-top", "8px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "8px")
      .style("overflow", "hidden");
    
    levels.forEach((level, index) => {
      if (level.id !== StatsComponent.activeAnalyticsLevel) {
        const option = dropdownDiv.append("div")
          .style("cursor", "pointer")
          .style("padding", "12px")
          .style("border-bottom", index < levels.length - 1 ? "1px solid var(--color-muted-light)" : "none")
          .style("background", "var(--color-surface)")
          .style("transition", "background 0.2s")
          .on("mouseover", function() {
            d3.select(this).style("background", "var(--color-background)");
          })
          .on("", function() {
            d3.select(this).style("background", "var(--color-surface)");
          })
          .on("click", function(event) {
            // Only recreate if actually changing levels
            if (StatsComponent.activeAnalyticsLevel !== level.id) {
              StatsComponent.activeAnalyticsLevel = level.id;
              createBIDashboard(StatsComponent.activeBIDashboard);
            }
          });
        
        option.append("div")
          .style("font-weight", "500")
          .style("color", "var(--color-text)")
          .style("font-size", "14px")
          .text(level.short);
      }
    });
  } else {
    // Desktop: Show all buttons
    selectorDiv.append("h2")
      .style("color", "var(--color-primary)")
      .style("margin", "0 0 15px 0")
      .style("text-align", "center")
      .text(StatsComponent.translateService.instant('BI.analyticsLevels'));
    
    const buttonsDiv = selectorDiv.append("div")
      .style("display", "grid")
      .style("grid-template-columns", screenWidth < 900 ? "repeat(2, 1fr)" : "repeat(4, 1fr)")
      .style("gap", "15px")
      .style("max-width", screenWidth < 900 ? "600px" : "100%")
      .style("margin", "0 auto");
    
    levels.forEach(level => {
      const button = buttonsDiv.append("div")
        .style("cursor", "pointer")
        .style("padding", "15px 20px")
        .style("border", "2px solid " + (StatsComponent.activeAnalyticsLevel === level.id ? "var(--color-primary)" : "var(--color-border)"))
        .style("border-radius", "8px")
        .style("background", StatsComponent.activeAnalyticsLevel === level.id ? "var(--color-info-surface)" : "var(--color-surface)")
        .style("transition", "all 0.3s")
        .style("text-align", "center")
        .on("mouseover", function() {
          if (StatsComponent.activeAnalyticsLevel !== level.id) {
            d3.select(this)
              .style("border-color", "var(--color-primary)")
              .style("background", "var(--color-background)");
          }
        })
        .on("mouseout", function() {
          if (StatsComponent.activeAnalyticsLevel !== level.id) {
            d3.select(this)
              .style("border-color", "var(--color-border)")
              .style("background", "var(--color-surface)");
          }
        })
        .on("click", function(event) {
          // Prevent click if user was scrolling (includes momentum scrolling)
          if (StatsComponent.currentInstance?.isScrollingActive()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          
          // Only recreate if actually changing levels
          if (StatsComponent.activeAnalyticsLevel !== level.id) {
            StatsComponent.activeAnalyticsLevel = level.id;
            createBIDashboard(StatsComponent.activeBIDashboard);
          }
        });
      
      button.append("div")
        .style("font-weight", "bold")
        .style("color", "var(--color-primary)")
        .style("font-size", "14px")
        .style("margin-bottom", "5px")
        .text(level.label);
      
      button.append("div")
        .style("font-size", "12px")
        .style("color", "var(--color-text-secondary)")
        .text(level.subtitle);
    });
  }
}
/**
 * Create Placeholder for Analytics Levels (to be implemented)
 */
export function createAnalyticsPlaceholder(container: any) {
  const placeholderDiv = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "40px")
    .style("margin", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
    .style("text-align", "center");
  
  placeholderDiv.append("h2")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "20px")
    .text(() => {
      switch(StatsComponent.activeAnalyticsLevel) {
        case 'explorative': return 'Explorative Analytics – Interaktive Datenexploration';
        case 'praediktive': return 'Prädiktive Analytics – Einfache Prognosen';
        case 'praeskriptive': return 'Präskriptive Analytics – What-if-Szenarien';
        default: return 'Analytics Level';
      }
    });
  
  placeholderDiv.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("font-size", "16px")
    .style("margin-bottom", "30px")
    .text(StatsComponent.translateService.instant('BI.placeholder'));
  
  placeholderDiv.append("div")
    .style("font-size", "64px")
    .style("color", "var(--color-border)")
    .text(StatsComponent.translateService.instant('BI.placeholderIcon'));
  
  placeholderDiv.append("p")
    .style("color", "var(--color-text-hint)")
    .style("font-size", "14px")
    .style("margin-top", "20px")
    .text(StatsComponent.translateService.instant('BI.placeholderHint'));
}

// ===================================================================
// EXPLORATIVE ANALYTICS - INTERACTIVE DATA EXPLORATION
// ===================================================================
/**
 * Create Explorative Analytics Dashboard
 * Implements: Flexible navigation, filters, drill-down, breadcrumbs, period comparison
 */
export function createBIDashboard1_FinancialOverview() {
  const container = document.getElementById("chart-container");
  const width = container ? container.clientWidth : StatsComponent.screenWidth;
  const height = StatsComponent.screenHeight;
  
  // Clear existing content first
  d3.select("#chart-container").selectAll("*").remove();
  
  // Create main wrapper
  const mainContainer = d3.select("#chart-container")
    .append("div")
    .style("width", "100%")
    .style("height", "100%")
    .style("background", "var(--color-background)");
  
  // Create Analytics Level Selector
  createAnalyticsLevelSelector(mainContainer);
  
  // Create main container (no separate scroll, unified scrolling)
  const dashboardDiv = mainContainer
    .append("div")
    .attr("class", "bi-dashboard")
    .style("width", "100%")
    .style("padding", "15px")
    .style("padding-bottom", "80px")
    .style("box-sizing", "border-box")
    .style("background", "var(--color-background)");

  // Dashboard Title
  dashboardDiv.append("h2")
    .style("text-align", "center")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "20px")
    .text(StatsComponent.translateService.instant('BI.dashboard1Title'));

  // Dashboard Navigation
  createBIDashboardNavigation(dashboardDiv, 1);

  // Time Filter
  createTimeFilter(dashboardDiv);

  // KPI Tiles Container
  const kpiContainer = dashboardDiv.append("div")
    .attr("class", "kpi-container")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(180px, 1fr))")
    .style("gap", "10px")
    .style("margin-bottom", "20px")
    .style("width", "100%");

  // Calculate KPIs based on selected time filter
  const selectedMonth = StatsComponent.selectedMonth;
  const filterType = StatsComponent.filterType;
  const monthlyData = StatsComponent.getMonthlyData();
  
  // View Mode Toggle (Average/Total) - Only for Dashboard 1 with multiple months
  // Determine if current selection has multiple months
  let hasMultipleMonths = false;
  
  if (filterType === 'month' && selectedMonth && selectedMonth !== 'all') {
    hasMultipleMonths = false;
  } else if (filterType === 'all') {
    hasMultipleMonths = monthlyData.length > 1;
  } else if (filterType === 'quarter' || filterType === 'halfyear' || filterType === 'year' || filterType === 'custom') {
    // These filters typically span multiple months
    hasMultipleMonths = true;
  }
  
  // Show view mode toggle if multiple months are available
  if (hasMultipleMonths) {
    const viewModeDiv = dashboardDiv.append("div")
      .style("display", "flex")
      .style("justify-content", "center")
      .style("align-items", "center")
      .style("margin-bottom", "20px")
      .style("padding", "10px")
      .style("background", "var(--color-surface)")
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

    viewModeDiv.append("span")
      .style("margin-right", "10px")
      .style("font-weight", "bold")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.viewMode') + ":");

    viewModeDiv.append("button")
      .attr("id", "average-total-toggle-btn")
      .style("padding", "8px 16px")
      .style("background", StatsComponent.showAverageView ? "var(--color-primary)" : "var(--color-text-muted)")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "5px")
      .style("cursor", "pointer")
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .style("transition", "background 0.3s")
      .html(StatsComponent.showAverageView ? 
        `${StatsComponent.translateService.instant('BI.average')}` : 
        `${StatsComponent.translateService.instant('BI.total')}`)
      .on("click", function() {
        StatsComponent.showAverageView = !StatsComponent.showAverageView;
        updateDashboard1ViewMode();
      })
      .on("mouseover", function() {
        d3.select(this).style("opacity", "0.8");
      })
      .on("mouseout", function() {
        d3.select(this).style("opacity", "1");
      });
  }
  
  // Determine what data to show based on filter
  let displayIncome = 0;
  let displayExpenses = 0;
  let kpiLabel = "";
  let filteredData = monthlyData;
  
  if (filterType === 'month' && selectedMonth && selectedMonth !== 'all') {
    // Specific month selected
    const monthData = monthlyData.find(m => m.month === selectedMonth);
    displayIncome = monthData?.income || 0;
    displayExpenses = monthData?.expenses || 0;
    const date = new Date(selectedMonth + '-01');
    kpiLabel = date.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    filteredData = monthData ? [monthData] : [];
  } else if (filterType === 'quarter' && selectedMonth && selectedMonth.includes('-Q')) {
    // Quarter selected (format: YYYY-Qn)
    const [year, quarter] = selectedMonth.split('-');
    const quarterNum = parseInt(quarter.charAt(1));
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    
    filteredData = monthlyData.filter(m => {
      const monthDate = new Date(m.month + '-01');
      const monthYear = monthDate.getFullYear();
      const monthNum = monthDate.getMonth() + 1;
      return monthYear === parseInt(year) && monthNum >= startMonth && monthNum <= endMonth;
    });
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = `Q${quarterNum} ${year}`;
  } else if (filterType === 'halfyear' && selectedMonth && selectedMonth.includes('-H')) {
    // Half-year selected (format: YYYY-Hn)
    const [year, half] = selectedMonth.split('-');
    const halfNum = parseInt(half.charAt(1));
    const startMonth = halfNum === 1 ? 1 : 7;
    const endMonth = halfNum === 1 ? 6 : 12;
    
    filteredData = monthlyData.filter(m => {
      const monthDate = new Date(m.month + '-01');
      const monthYear = monthDate.getFullYear();
      const monthNum = monthDate.getMonth() + 1;
      return monthYear === parseInt(year) && monthNum >= startMonth && monthNum <= endMonth;
    });
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = `H${halfNum} ${year}`;
  } else if (filterType === 'year' && selectedMonth && selectedMonth !== 'all') {
    // Year selected
    filteredData = monthlyData.filter(m => m.month.startsWith(selectedMonth));
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = selectedMonth;
  } else if (filterType === 'custom' && selectedMonth && selectedMonth.startsWith('custom:')) {
    // Custom range selected (format: custom:YYYY-MM-DD:YYYY-MM-DD)
    const parts = selectedMonth.split(':');
    const startDate = parts[1];
    const endDate = parts[2];
    
    filteredData = monthlyData.filter(m => {
      const monthStr = m.month;
      return monthStr >= startDate.substring(0, 7) && monthStr <= endDate.substring(0, 7);
    });
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    const start = new Date(startDate);
    const end = new Date(endDate);
    kpiLabel = `${start.toLocaleDateString('de-DE')} - ${end.toLocaleDateString('de-DE')}`;
  } else {
    // No filter (all) - sum all months
    const totalData = monthlyData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    const monthCount = monthlyData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = "Gesamt";
  }

  const savingsRate = StatsComponent.calculateSavingsRate(selectedMonth);
  const fixedCostsRatio = StatsComponent.calculateFixedCostsRatio(selectedMonth);

  // Determine if we're showing more than one month
  const isMultiMonth = filteredData.length > 1;
  const viewModeLabel = StatsComponent.showAverageView && isMultiMonth ? 
    ` (${StatsComponent.translateService.instant('BI.average')})` : 
    ` (${StatsComponent.translateService.instant('BI.total')})`;
  
  // For income/expense KPIs, show either view mode label OR kpiLabel, but not both to avoid duplication
  const periodLabel = isMultiMonth ? viewModeLabel : ` (${kpiLabel})`;

  // KPI 1: Total Income
  createKPITile(kpiContainer, `${StatsComponent.translateService.instant('BI.kpiTotalIncome')}${periodLabel}`, 
    displayIncome, AppStateService.instance.currency, "#4caf50");

  // KPI 2: Total Expenses
  createKPITile(kpiContainer, `${StatsComponent.translateService.instant('BI.kpiTotalExpenses')}${periodLabel}`, 
    displayExpenses, AppStateService.instance.currency, "#f44336");

  // KPI 3: Savings Rate
  createKPITile(kpiContainer, StatsComponent.translateService.instant('BI.kpiSavingsRate'), 
    savingsRate, "%", savingsRate > 10 ? "#4caf50" : "#ff9800", StatsComponent.translateService.instant('BI.kpiSavingsRateGoal'));

  // KPI 4: Fixed Costs Ratio (clickable - drills down to Dashboard 4)
  createKPITile(kpiContainer, StatsComponent.translateService.instant('BI.kpiFixedCostsRatio'), 
    fixedCostsRatio, "%", fixedCostsRatio < 60 ? "#4caf50" : "#f44336", 
    StatsComponent.translateService.instant('BI.kpiFixedCostsGoal'),
    () => {
      createBIDashboard(4);
    });

  // Chart 1: Income vs Expenses Time Series
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard1Chart1'));

  const chart1ButtonContainer = dashboardDiv.append("div")
    .style("display", "flex")
    .style("justify-content", "flex-end")
    .style("margin-bottom", "10px")
    .style("margin-right", "15px");

  chart1ButtonContainer.append("button")
    .attr("id", "income-vs-expenses-toggle-btn")
    .style("padding", "5px 12px")
    .style("background", "var(--color-primary)")
    .style("color", "white")
    .style("border", "none")
    .style("border-radius", "3px")
    .style("cursor", "pointer")
    .style("font-size", "11px")
    .html(StatsComponent.incomeVsExpensesChartMode === "line" ? StatsComponent.translateService.instant('BI.chartModeBars') : StatsComponent.translateService.instant('BI.chartModeLines'))
    .on("click", function() {
      StatsComponent.incomeVsExpensesChartMode = StatsComponent.incomeVsExpensesChartMode === "line" ? "bar" : "line";
      updateIncomeVsExpensesChart(filteredData, chart1Width);
    });

  // Adaptive width based on number of data points
  const baseChartWidth = width - 30; // Account for padding
  const dataPointCount = filteredData.length;
  const chart1Width = dataPointCount <= 1 ? Math.min(400, baseChartWidth) : 
                      dataPointCount <= 3 ? Math.min(600, baseChartWidth) : 
                      baseChartWidth;
  
  const chart1Container = dashboardDiv.append("div")
    .attr("id", "income-vs-expenses-chart-container")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("width", "100%");
  
  const chart1Svg = chart1Container.append("svg")
    .attr("width", chart1Width)
    .attr("height", 300)
    .style("max-width", "100%")
    .style("display", "block");

  if (StatsComponent.incomeVsExpensesChartMode === "line") {
    createIncomeVsExpensesChart(chart1Svg, filteredData, chart1Width, 300);
  } else {
    createIncomeVsExpensesBarChart(chart1Svg, filteredData, chart1Width, 300);
  }

  // Chart 2: Savings Rate Over Time
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard1Chart2'));

  // Adaptive width based on number of data points
  const chart2Width = dataPointCount <= 1 ? Math.min(400, baseChartWidth) : 
                      dataPointCount <= 3 ? Math.min(600, baseChartWidth) : 
                      baseChartWidth;
  
  // Responsive height based on width (aspect ratio adjustment)
  const chart2Height = Math.max(250, Math.min(400, chart2Width * 0.4));
  
  const chart2Container = dashboardDiv.append("div")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("width", "100%");
  
  const chart2Svg = chart2Container.append("svg")
    .attr("width", chart2Width)
    .attr("height", chart2Height)
    .style("max-width", "100%")
    .style("display", "block");

  // Filter out current month for Savings Rate chart only
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const filteredDataForSavingsRate = filteredData.filter(d => d.month !== currentMonth);
  
  createSavingsRateChart(chart2Svg, filteredDataForSavingsRate, chart2Width, chart2Height);

  // Chart 3: Fixed vs Variable Costs (uses selectedMonth directly) - clickable drill-down to Dashboard 4
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard1Chart3'));

  const chartWidth = width - 30; // Use full width for this chart
  const chart3Container = dashboardDiv.append("div")
    .style("cursor", "pointer")
    .style("transition", "transform 0.2s")
    .on("click", () => {
      createBIDashboard(4);
    })
    .on("mouseover", function() {
      d3.select(this).style("transform", "scale(1.02)");
    })
    .on("mouseout", function() {
      d3.select(this).style("transform", "scale(1)");
    });

  const chart3Svg = chart3Container.append("svg")
    .attr("width", chartWidth)
    .attr("height", 150)
    .style("max-width", "100%")
    .style("display", "block")
    .style("pointer-events", "none");

  createFixedVsVariableCostsChart(chart3Svg, chartWidth, 150, filteredData.length > 1);
}
/**
 * Update Dashboard 1 view mode (Average/Total) without recreating everything
 */
export function updateDashboard1ViewMode() {
  // Update the toggle button appearance
  const toggleButton = d3.select("#average-total-toggle-btn");
  toggleButton
    .style("background", StatsComponent.showAverageView ? "var(--color-primary)" : "var(--color-text-muted)")
    .html(StatsComponent.showAverageView ? 
      `${StatsComponent.translateService.instant('BI.average')}` : 
      `${StatsComponent.translateService.instant('BI.total')}`);

  // Recalculate KPI values
  const selectedMonth = StatsComponent.selectedMonth;
  const filterType = StatsComponent.filterType;
  const monthlyData = StatsComponent.getMonthlyData();
  
  let displayIncome = 0;
  let displayExpenses = 0;
  let kpiLabel = "";
  let filteredData = monthlyData;
  
  if (filterType === 'month' && selectedMonth && selectedMonth !== 'all') {
    const monthData = monthlyData.find(m => m.month === selectedMonth);
    displayIncome = monthData?.income || 0;
    displayExpenses = monthData?.expenses || 0;
    const date = new Date(selectedMonth + '-01');
    kpiLabel = date.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    filteredData = monthData ? [monthData] : [];
  } else if (filterType === 'quarter' && selectedMonth && selectedMonth.includes('-Q')) {
    const [year, quarter] = selectedMonth.split('-');
    const quarterNum = parseInt(quarter.charAt(1));
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    
    filteredData = monthlyData.filter(m => {
      const monthDate = new Date(m.month + '-01');
      const monthYear = monthDate.getFullYear();
      const monthNum = monthDate.getMonth() + 1;
      return monthYear === parseInt(year) && monthNum >= startMonth && monthNum <= endMonth;
    });
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = `Q${quarterNum} ${year}`;
  } else if (filterType === 'halfyear' && selectedMonth && selectedMonth.includes('-H')) {
    const [year, half] = selectedMonth.split('-');
    const halfNum = parseInt(half.charAt(1));
    const startMonth = halfNum === 1 ? 1 : 7;
    const endMonth = halfNum === 1 ? 6 : 12;
    
    filteredData = monthlyData.filter(m => {
      const monthDate = new Date(m.month + '-01');
      const monthYear = monthDate.getFullYear();
      const monthNum = monthDate.getMonth() + 1;
      return monthYear === parseInt(year) && monthNum >= startMonth && monthNum <= endMonth;
    });
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = `H${halfNum} ${year}`;
  } else if (filterType === 'year' && selectedMonth && selectedMonth !== 'all') {
    filteredData = monthlyData.filter(m => m.month.startsWith(selectedMonth));
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = selectedMonth;
  } else if (filterType === 'custom' && selectedMonth && selectedMonth.startsWith('custom:')) {
    const parts = selectedMonth.split(':');
    const startDate = parts[1];
    const endDate = parts[2];
    
    filteredData = monthlyData.filter(m => {
      return m.month >= startDate.substring(0, 7) && m.month <= endDate.substring(0, 7);
    });
    
    const totalData = filteredData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    
    const monthCount = filteredData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    const start = new Date(startDate);
    const end = new Date(endDate);
    kpiLabel = `${start.toLocaleDateString('de-DE')} - ${end.toLocaleDateString('de-DE')}`;
  } else {
    const totalData = monthlyData.reduce((acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings
    }), {income: 0, expenses: 0, savings: 0});
    const monthCount = monthlyData.length;
    displayIncome = StatsComponent.showAverageView && monthCount > 1 ? totalData.income / monthCount : totalData.income;
    displayExpenses = StatsComponent.showAverageView && monthCount > 1 ? totalData.expenses / monthCount : totalData.expenses;
    kpiLabel = "Gesamt";
  }

  const isMultiMonth = filteredData.length > 1;
  const viewModeLabel = StatsComponent.showAverageView && isMultiMonth ? 
    ` (${StatsComponent.translateService.instant('BI.average')})` : 
    ` (${StatsComponent.translateService.instant('BI.total')})`;
  
  const periodLabel = isMultiMonth ? viewModeLabel : ` (${kpiLabel})`;

  // Recalculate savings rate with current view mode
  const savingsRate = StatsComponent.calculateSavingsRate(selectedMonth);

  // Update KPI values in the DOM
  const kpiTiles = d3.selectAll(".kpi-tile");
  
  // Update Income KPI (first tile)
  const formattedIncome = displayIncome.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  kpiTiles.filter((d, i) => i === 0)
    .select("div:nth-child(1)")
    .text(`${StatsComponent.translateService.instant('BI.kpiTotalIncome')}${periodLabel}`);
  kpiTiles.filter((d, i) => i === 0)
    .select("div:nth-child(2)")
    .text(formattedIncome + " " + AppStateService.instance.currency);

  // Update Expenses KPI (second tile)
  const formattedExpenses = displayExpenses.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  kpiTiles.filter((d, i) => i === 1)
    .select("div:nth-child(1)")
    .text(`${StatsComponent.translateService.instant('BI.kpiTotalExpenses')}${periodLabel}`);
  kpiTiles.filter((d, i) => i === 1)
    .select("div:nth-child(2)")
    .text(formattedExpenses + " " + AppStateService.instance.currency);

  // Update Savings Rate KPI (third tile)
  const formattedSavingsRate = savingsRate.toFixed(2);  // Use 2 decimals to match initial creation
  kpiTiles.filter((d, i) => i === 2)
    .select("div:nth-child(2)")
    .text(formattedSavingsRate + " %");
  
  // Update savings rate color based on value
  kpiTiles.filter((d, i) => i === 2)
    .select("div:nth-child(2)")
    .style("color", savingsRate > 10 ? "#4caf50" : "#ff9800");
}

// ===================================================================
// DASHBOARD 2: ACCOUNT & BUDGET ANALYSIS (Konten- und Budget-Analyse)
// ===================================================================
export function createBIDashboard2_AccountBudgetAnalysis() {
  const container = document.getElementById("chart-container");
  const width = container ? container.clientWidth : StatsComponent.screenWidth;
  const height = StatsComponent.screenHeight;
  
  // Clear existing content first
  d3.select("#chart-container").selectAll("*").remove();
  
  // Create main wrapper
  const mainContainer = d3.select("#chart-container")
    .append("div")
    .style("width", "100%")
    .style("height", "100%")
    .style("background", "var(--color-background)");
  
  // Create Analytics Level Selector
  createAnalyticsLevelSelector(mainContainer);
  
  const dashboardDiv = mainContainer
    .append("div")
    .attr("class", "bi-dashboard")
    .style("width", "100%")
    .style("padding", "15px")
    .style("padding-bottom", "80px")
    .style("box-sizing", "border-box")
    .style("background", "var(--color-background)");

  // Dashboard Title
  dashboardDiv.append("h2")
    .style("text-align", "center")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "20px")
    .text(StatsComponent.translateService.instant('BI.dashboard2Title'));

  // Dashboard Navigation
  createBIDashboardNavigation(dashboardDiv, 2);

  // Time Filter
  createTimeFilter(dashboardDiv);

  // Account Balance Overview
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard2Chart1'));

  const chartWidth = width - 30; // Account for padding
  const accountData = getAccountBalances();
  createAccountBalanceTable(dashboardDiv, accountData, chartWidth);

  // Budget Compliance Chart
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "50px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard2Chart2'));

  const budgetSvg = dashboardDiv.append("svg")
    .attr("width", chartWidth)
    .attr("height", 300)
    .style("max-width", "100%")
    .style("display", "block");

  createBudgetComplianceChart(budgetSvg, accountData, chartWidth, 300);

  // Expenses per Account and Month Table
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "50px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard2Chart3'));

  createMonthlyExpenseTable(dashboardDiv, chartWidth);

  // Account Development Over Time
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard2Chart4'));

  const timeSeriesSvg = dashboardDiv.append("svg")
    .attr("width", chartWidth)
    .attr("height", 350)
    .style("max-width", "100%")
    .style("display", "block");

  createAccountDevelopmentChart(timeSeriesSvg, chartWidth, 350);
}

// ===================================================================
// DASHBOARD 3: CATEGORY ANALYSIS (Kategorie- und Ausgabenmuster)
// ===================================================================
export function createBIDashboard3_CategoryAnalysis() {
  const container = document.getElementById("chart-container");
  const width = container ? container.clientWidth : StatsComponent.screenWidth;
  const height = StatsComponent.screenHeight;
  
  // Clear existing content first
  d3.select("#chart-container").selectAll("*").remove();
  
  // Create main wrapper
  const mainContainer = d3.select("#chart-container")
    .append("div")
    .style("width", "100%")
    .style("height", "100%")
    .style("background", "var(--color-background)");
  
  // Create Analytics Level Selector
  createAnalyticsLevelSelector(mainContainer);
  
  const dashboardDiv = mainContainer
    .append("div")
    .attr("class", "bi-dashboard")
    .style("width", "100%")
    .style("padding", "15px")
    .style("padding-bottom", "80px")
    .style("box-sizing", "border-box")
    .style("background", "var(--color-background)");

  // Dashboard Title
  dashboardDiv.append("h2")
    .style("text-align", "center")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "20px")
    .text(StatsComponent.translateService.instant('BI.dashboard3Title'));

  // Dashboard Navigation
  createBIDashboardNavigation(dashboardDiv, 3);

  // Time Filter
  createTimeFilter(dashboardDiv);

  // Top Categories
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard3Chart1'));

  const chartWidth = width - 30; // Account for padding
  const topCategoriesSvg = dashboardDiv.append("svg")
    .attr("width", chartWidth)
    .attr("height", 400)
    .style("max-width", "100%")
    .style("display", "block");

  createTopCategoriesChart(topCategoriesSvg, chartWidth, 400);

  // Category Distribution
  dashboardDiv.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard3Chart2'));

  const treemapSvg = dashboardDiv.append("svg")
    .attr("width", chartWidth)
    .attr("height", 400)
    .style("max-width", "100%")
    .style("display", "block");

  createCategoryTreemap(treemapSvg, chartWidth, 400);

  // Category Timeline Chart
  dashboardDiv.append("h3")
    .attr("id", "category-timeline-title")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard3Chart3'));

  const timelineSvg = dashboardDiv.append("svg")
    .attr("id", "category-timeline-svg")
    .attr("width", chartWidth)
    .attr("height", 400)
    .style("max-width", "100%")
    .style("display", "block");

  createCategoryTimelineChart(timelineSvg, chartWidth, 400);

  // Transaction Details Table
  const tableSection = dashboardDiv.append("div")
    .attr("id", "transaction-table-section");
  
  tableSection.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.dashboard3Chart4'));

  createTransactionDetailsTable(tableSection, chartWidth);
}

// ===================================================================
// HELPER FUNCTIONS FOR VISUALIZATIONS
// ===================================================================
/**
 * Create time filter for Dashboard 1
 */
export function createTimeFilter(container: any) {
  // Only show time filter for Deskriptive and Explorative Analytics
  if (StatsComponent.activeAnalyticsLevel !== 'deskriptive' && 
      StatsComponent.activeAnalyticsLevel !== 'explorative') {
    return; // Don't create the filter for Praediktive and Praeskriptive
  }
  
  const filterDiv = container.append("div")
    .attr("class", "time-filter")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("gap", "10px")
    .style("margin-bottom", "20px")
    .style("padding", "15px")
    .style("background", "var(--color-surface)")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  filterDiv.append("span")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .style("margin-right", "10px")
    .text(StatsComponent.translateService.instant('BI.period'));

  // Get all available months from transactions
  const months = Array.from(new Set(
    AppStateService.instance.allTransactions.map(t => t.date.substring(0, 7))
  )).sort();
  
  const years = Array.from(new Set(
    months.map(m => m.substring(0, 4))
  )).sort();

  // Filter type selector
  const typeSelect = filterDiv.append("select")
    .style("padding", "8px 12px")
    .style("border", "2px solid var(--color-primary)")
    .style("border-radius", "5px")
    .style("font-size", "13px")
    .style("font-weight", "bold")
    .style("cursor", "pointer")
    .style("background", "var(--color-info-surface)")
    .on("change", function() {
      // Prevent change during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        return;
      }
      
      const newFilterType = this.value;
      StatsComponent.filterType = newFilterType;
      
      // Set appropriate default for the new filter type
      if (newFilterType === "all") {
        StatsComponent.selectedMonth = "all";
      } else if (newFilterType === "month") {
        // Default to the most recent month
        StatsComponent.selectedMonth = months[months.length - 1] || "all";
      } else if (newFilterType === "quarter") {
        // Default to the most recent quarter
        const currentYear = new Date().getFullYear();
        const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
        StatsComponent.selectedMonth = `${currentYear}-Q${currentQuarter}`;
      } else if (newFilterType === "halfyear") {
        // Default to the most recent half-year
        const currentYear = new Date().getFullYear();
        const currentHalf = new Date().getMonth() < 6 ? 1 : 2;
        StatsComponent.selectedMonth = `${currentYear}-H${currentHalf}`;
      } else if (newFilterType === "year") {
        // Default to the most recent year
        StatsComponent.selectedMonth = years[years.length - 1] || new Date().getFullYear().toString();
      } else if (newFilterType === "custom") {
        // Default to last month as range
        const startDate = months[0] ? months[0] + '-01' : new Date().toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];
        StatsComponent.customDateStart = startDate;
        StatsComponent.customDateEnd = endDate;
        StatsComponent.selectedMonth = `custom:${startDate}:${endDate}`;
      }
      
      createBIDashboard(StatsComponent.activeBIDashboard);
    });

  const filterTypes = [
    { value: "all", label: StatsComponent.translateService.instant('BI.all') },
    { value: "month", label: StatsComponent.translateService.instant('BI.month') },
    { value: "quarter", label: StatsComponent.translateService.instant('BI.quarter') },
    { value: "halfyear", label: StatsComponent.translateService.instant('BI.halfYear') },
    { value: "year", label: StatsComponent.translateService.instant('BI.year') },
    { value: "custom", label: StatsComponent.translateService.instant('BI.custom') }
  ];

  filterTypes.forEach(type => {
    typeSelect.append("option")
      .attr("value", type.value)
      .text(type.label)
      .property("selected", StatsComponent.filterType === type.value);
  });

  // Create container for dynamic selectors
  const selectorContainer = filterDiv.append("span")
    .attr("id", "selector-container");

  // Month selector (shown when filterType is "month")
  if (StatsComponent.filterType === "month") {
    const monthSelect = selectorContainer.append("select")
      .style("padding", "8px 12px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "5px")
      .style("font-size", "13px")
      .style("cursor", "pointer")
      .on("change", function() {
        // Prevent change during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          return;
        }
        
        StatsComponent.selectedMonth = this.value;
        createBIDashboard(StatsComponent.activeBIDashboard);
      });

    // Sort months descending
    const sortedMonths = [...months].sort().reverse();
    
    // Ensure we have a valid selection
    let currentSelection = StatsComponent.selectedMonth;
    if (!currentSelection || currentSelection === 'all' || !months.includes(currentSelection)) {
      currentSelection = sortedMonths[0]; // Default to most recent
      StatsComponent.selectedMonth = currentSelection;
    }
    
    sortedMonths.forEach(month => {
      const date = new Date(month + '-01');
      const currentLang = StatsComponent.translateService.currentLang || 'en';
      const label = date.toLocaleString(currentLang, { month: 'long', year: 'numeric' });
      monthSelect.append("option")
        .attr("value", month)
        .text(label)
        .property("selected", month === currentSelection);
    });
  }

  // Quarter selector (shown when filterType is "quarter")
  if (StatsComponent.filterType === "quarter") {
    const quarters: string[] = [];
    // Only generate quarters that have actual data
    years.forEach(year => {
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        // Check if any month in this quarter has data
        const hasData = months.some(m => {
          const monthDate = new Date(m + '-01');
          const monthYear = monthDate.getFullYear();
          const monthNum = monthDate.getMonth() + 1;
          return monthYear === parseInt(year) && monthNum >= startMonth && monthNum <= endMonth;
        });
        if (hasData) {
          quarters.push(`${year}-Q${q}`);
        }
      }
    });

    const quarterSelect = selectorContainer.append("select")
      .style("padding", "8px 12px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "5px")
      .style("font-size", "13px")
      .style("cursor", "pointer")
      .on("change", function() {
        // Prevent change during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          return;
        }
        
        StatsComponent.selectedMonth = this.value;
        createBIDashboard(StatsComponent.activeBIDashboard);
      });

    // Sort quarters descending
    const sortedQuarters = [...quarters].sort().reverse();
    
    // Ensure we have a valid selection
    let currentSelection = StatsComponent.selectedMonth;
    if (!currentSelection || !currentSelection.includes('-Q') || !quarters.includes(currentSelection)) {
      currentSelection = sortedQuarters[0]; // Default to most recent
      StatsComponent.selectedMonth = currentSelection;
    }
    
    sortedQuarters.forEach(quarter => {
      const [year, q] = quarter.split('-');
      const label = `Q${q.charAt(1)} ${year}`;
      quarterSelect.append("option")
        .attr("value", quarter)
        .text(label)
        .property("selected", quarter === currentSelection);
    });
  }

  // Half-year selector (shown when filterType is "halfyear")
  if (StatsComponent.filterType === "halfyear") {
    const halfYears: string[] = [];
    // Only generate half-years that have actual data
    years.forEach(year => {
      // Check H1 (months 1-6)
      const hasH1Data = months.some(m => {
        const monthDate = new Date(m + '-01');
        const monthYear = monthDate.getFullYear();
        const monthNum = monthDate.getMonth() + 1;
        return monthYear === parseInt(year) && monthNum >= 1 && monthNum <= 6;
      });
      if (hasH1Data) {
        halfYears.push(`${year}-H1`);
      }
      
      // Check H2 (months 7-12)
      const hasH2Data = months.some(m => {
        const monthDate = new Date(m + '-01');
        const monthYear = monthDate.getFullYear();
        const monthNum = monthDate.getMonth() + 1;
        return monthYear === parseInt(year) && monthNum >= 7 && monthNum <= 12;
      });
      if (hasH2Data) {
        halfYears.push(`${year}-H2`);
      }
    });

    const halfYearSelect = selectorContainer.append("select")
      .style("padding", "8px 12px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "5px")
      .style("font-size", "13px")
      .style("cursor", "pointer")
      .on("change", function() {
        // Prevent change during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          return;
        }
        
        StatsComponent.selectedMonth = this.value;
        createBIDashboard(StatsComponent.activeBIDashboard);
      });

    // Sort half-years descending
    const sortedHalfYears = [...halfYears].sort().reverse();
    
    // Ensure we have a valid selection
    let currentSelection = StatsComponent.selectedMonth;
    if (!currentSelection || !currentSelection.includes('-H') || !halfYears.includes(currentSelection)) {
      currentSelection = sortedHalfYears[0]; // Default to most recent
      StatsComponent.selectedMonth = currentSelection;
    }
    
    sortedHalfYears.forEach(halfYear => {
      const [year, h] = halfYear.split('-');
      const label = `${h} ${year}`;
      halfYearSelect.append("option")
        .attr("value", halfYear)
        .text(label)
        .property("selected", halfYear === currentSelection);
    });
  }

  // Year selector (shown when filterType is "year")
  if (StatsComponent.filterType === "year") {
    const yearSelect = selectorContainer.append("select")
      .style("padding", "8px 12px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "5px")
      .style("font-size", "13px")
      .style("cursor", "pointer")
      .on("change", function() {
        // Prevent change during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          return;
        }
        
        StatsComponent.selectedMonth = this.value;
        createBIDashboard(StatsComponent.activeBIDashboard);
      });

    // Sort years descending
    const sortedYears = [...years].sort().reverse();
    
    // Ensure we have a valid selection
    let currentSelection = StatsComponent.selectedMonth;
    if (!currentSelection || !years.includes(currentSelection)) {
      currentSelection = sortedYears[0]; // Default to most recent
      StatsComponent.selectedMonth = currentSelection;
    }
    
    sortedYears.forEach(year => {
      yearSelect.append("option")
        .attr("value", year)
        .text(year)
        .property("selected", year === currentSelection);
    });
  }

  // Custom range selector (shown when filterType is "custom")
  if (StatsComponent.filterType === "custom") {
    selectorContainer.append("span")
      .style("margin-right", "5px")
      .text(StatsComponent.translateService.instant('BI.from'));

    selectorContainer.append("input")
      .attr("type", "date")
      .attr("value", StatsComponent.customDateStart || months[0] + '-01')
      .style("padding", "6px 10px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "5px")
      .style("font-size", "13px")
      .on("change", function() {
        // Prevent change during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          return;
        }
        
        StatsComponent.customDateStart = this.value;
        StatsComponent.selectedMonth = `custom:${StatsComponent.customDateStart}:${StatsComponent.customDateEnd}`;
        createBIDashboard(StatsComponent.activeBIDashboard);
      });

    selectorContainer.append("span")
      .style("margin-left", "10px")
      .style("margin-right", "5px")
      .text(StatsComponent.translateService.instant('BI.to'));

    selectorContainer.append("input")
      .attr("type", "date")
      .attr("value", StatsComponent.customDateEnd || new Date().toISOString().split('T')[0])
      .style("padding", "6px 10px")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "5px")
      .style("font-size", "13px")
      .on("change", function() {
        // Prevent change during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          return;
        }
        
        StatsComponent.customDateEnd = this.value;
        StatsComponent.selectedMonth = `custom:${StatsComponent.customDateStart}:${StatsComponent.customDateEnd}`;
        createBIDashboard(StatsComponent.activeBIDashboard);
      });
  }
}
/**
 * Dashboard 4: Costs Analysis
 * Shows Fixed vs Variable expenses with drill-down tables
 */
export function createBIDashboard4_CostsAnalysis() {
  // Clear existing content first
  const chartContainer = d3.select("#chart-container");
  chartContainer.selectAll("*").remove();

  // Create main wrapper
  const mainContainer = chartContainer.append("div")
    .style("width", "100%")
    .style("height", "100%")
    .style("background", "var(--color-background)");

  // Create Analytics Level Selector
  createAnalyticsLevelSelector(mainContainer);

  // Create dashboard content container
  const container = mainContainer.append("div")
    .style("width", "100%")
    .style("max-width", "1400px")
    .style("margin", "0 auto")
    .style("padding", "20px")
    .style("padding-bottom", "80px")
    .style("background", "var(--color-background)")
    .style("overflow-y", "auto")
    .style("box-sizing", "border-box");

  // Title
  container.append("h2")
    .style("text-align", "center")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "20px")
    .text(StatsComponent.translateService.instant('BI.dashboard4Title'));

  // Dashboard Navigation
  createBIDashboardNavigation(container, 4);

  // Period Filter
  createTimeFilter(container);

  // Filter to cost type indicator (if active)
  if (StatsComponent.dashboard4CostTypeFilter !== 'all') {
    const filterIndicator = container.append("div")
      .style("background", "var(--color-surface)")
      .style("padding", "10px 20px")
      .style("margin-bottom", "15px")
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center");

    filterIndicator.append("span")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.filterActive') + ": " + 
            (StatsComponent.dashboard4CostTypeFilter === 'fixed' 
              ? StatsComponent.translateService.instant('BI.fixedCosts')
              : StatsComponent.translateService.instant('BI.variableCosts')));

    filterIndicator.append("button")
      .style("padding", "5px 15px")
      .style("background", "#f44336")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "5px")
      .style("cursor", "pointer")
      .text(StatsComponent.translateService.instant('BI.clearFilter'))
      .on("click", () => {
        StatsComponent.dashboard4CostTypeFilter = 'all';
        StatsComponent.dashboard4SelectedCategory = '';
        createBIDashboard(4);
      });
  }

  // Get filtered transactions
  const filteredTransactions = StatsComponent.getFilteredTransactions();

  // Fixed vs Variable Expenses Chart (Clickable)
  createDashboard4CostTypeChart(container, filteredTransactions);

  // Category Summary Table
  createDashboard4CategoryTable(container, filteredTransactions);

  // Transaction Detail Table (shown when category is selected)
  if (StatsComponent.dashboard4SelectedCategory) {
    createDashboard4TransactionTable(container, filteredTransactions);
  }
}
/**
 * Update only the category and transaction tables for Dashboard 4 (no page recreation)
 */
export function updateDashboard4Tables() {
  const filteredTransactions = StatsComponent.getFilteredTransactions();
  
  // Remove existing tables
  d3.select("#dashboard4-category-table").remove();
  d3.select("#dashboard4-transaction-table").remove();
  
  // Get the main container
  const container = d3.select("#chart-container").select("div");
  
  // Recreate category table
  createDashboard4CategoryTable(container, filteredTransactions);
  
  // Recreate transaction table if category is selected
  if (StatsComponent.dashboard4SelectedCategory) {
    createDashboard4TransactionTable(container, filteredTransactions);
  }
}
/**
 * Create clickable Fixed vs Variable expenses chart for Dashboard 4
 */
export function createDashboard4CostTypeChart(container: any, transactions: any[]) {
  const chartSection = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  chartSection.append("h3")
    .style("text-align", "center")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.fixedVsVariableExpenses'));

  // Calculate fixed vs variable costs (excluding inter-account transfers)
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const subscriptionCategories = new Set(
    AppStateService.instance.allSubscriptions.map(sub => sub.category.replace('@', ''))
  );

  let fixedCosts = 0;
  let variableCosts = 0;

  transactions
    .filter(t => {
      if (t.amount >= 0) return false; // Only expenses
      if (t.account === 'Mojo') return false; // Exclude Mojo account (not an expense)
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory); // Exclude inter-account transfers
    })
    .forEach(t => {
      const cleanCategory = t.category.replace('@', '');
      const amount = Math.abs(t.amount);
      
      if (subscriptionCategories.has(cleanCategory)) {
        fixedCosts += amount;
      } else {
        variableCosts += amount;
      }
    });

  const totalCosts = fixedCosts + variableCosts;

  if (totalCosts === 0) {
    chartSection.append("p")
      .style("text-align", "center")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.noDataAvailable'));
    return;
  }

  const data = [
    { 
      type: 'fixed', 
      label: StatsComponent.translateService.instant('BI.fixedCosts'),
      amount: fixedCosts, 
      percentage: (fixedCosts / totalCosts * 100)
    },
    { 
      type: 'variable',
      label: StatsComponent.translateService.instant('BI.variableCosts'),
      amount: variableCosts, 
      percentage: (variableCosts / totalCosts * 100)
    }
  ];

  // Smaller chart dimensions
  const width = 300;
  const height = 300;
  const radius = 100;
  const legendHeight = 60;

  const svg = chartSection.append("svg")
    .attr("width", width)
    .attr("height", height + legendHeight)
    .style("display", "block")
    .style("margin", "0 auto")
    .style("max-width", "100%");

  const g = svg.append("g")
    .attr("transform", `translate(${width/2}, ${height/2})`);

  const color = d3.scaleOrdinal()
    .domain(['fixed', 'variable'])
    .range(['#ff9800', '#1976d2']);

  const pie = d3.pie()
    .value((d: any) => d.amount)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius);

  const arcs = g.selectAll(".arc")
    .data(pie(data))
    .enter().append("g")
    .attr("class", "arc")
    .style("cursor", "pointer")
    .on("click", (event, d: any) => {
      const selectedType = d.data.type;
      if (StatsComponent.dashboard4CostTypeFilter === selectedType) {
        // Clicking the same type again deselects it
        StatsComponent.dashboard4CostTypeFilter = 'all';
      } else {
        StatsComponent.dashboard4CostTypeFilter = selectedType;
      }
      StatsComponent.dashboard4SelectedCategory = '';
      createBIDashboard(4);
    });

  arcs.append("path")
    .attr("d", arc as any)
    .attr("fill", (d: any) => {
      const isSelected = StatsComponent.dashboard4CostTypeFilter === d.data.type;
      const isAnySelected = StatsComponent.dashboard4CostTypeFilter !== 'all';
      if (isAnySelected && !isSelected) {
        return d3.color(color(d.data.type) as string).copy({opacity: 0.3}) as any;
      }
      return color(d.data.type) as string;
    })
    .attr("stroke", (d: any) => {
      return StatsComponent.dashboard4CostTypeFilter === d.data.type ? "var(--color-text)" : "white";
    })
    .attr("stroke-width", (d: any) => {
      return StatsComponent.dashboard4CostTypeFilter === d.data.type ? 3 : 2;
    })
    .style("transition", "all 0.3s");

  arcs.append("text")
    .attr("transform", (d: any) => `translate(${arc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .style("fill", "white")
    .style("pointer-events", "none")
    .text((d: any) => `${d.data.percentage.toFixed(1)}%`);

  // Legend below the chart
  const legend = svg.append("g")
    .attr("transform", `translate(${width/2}, ${height + 20})`);

  data.forEach((d, i) => {
    const legendRow = legend.append("g")
      .attr("transform", `translate(${i === 0 ? -120 : 20}, 0)`);

    legendRow.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", color(d.type) as string);

    const legendText = legendRow.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("font-size", "12px");

    legendText.append("tspan")
      .attr("x", 20)
      .attr("dy", 0)
      .text(`${d.label}:`);

    const formattedAmount = d.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    legendText.append("tspan")
      .attr("x", 20)
      .attr("dy", "1.2em")
      .text(`${formattedAmount} ${AppStateService.instance.currency}`);
  });
}
/**
 * Create category summary table for Dashboard 4
 */
export function createDashboard4CategoryTable(container: any, transactions: any[]) {
  const tableSection = container.append("div")
    .attr("id", "dashboard4-category-table")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("max-width", "100%");

  tableSection.append("h3")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.categorySummary'));

  const subscriptionCategories = new Set(
    AppStateService.instance.allSubscriptions.map(sub => sub.category.replace('@', ''))
  );

  // Exclude inter-account transfers (same as Dashboard 1 fixed cost calculation)
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];

  // Group transactions by category
  const categoryMap = new Map<string, {amount: number, count: number, type: string}>();
  
  transactions
    .filter(t => {
      if (t.amount >= 0) return false; // Only expenses
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory); // Exclude inter-account transfers
    })
    .forEach(t => {
      const cleanCategory = t.category.replace('@', '');
      const amount = Math.abs(t.amount);
      const type = subscriptionCategories.has(cleanCategory) ? 'fixed' : 'variable';
      
      // Apply cost type filter if active
      if (StatsComponent.dashboard4CostTypeFilter !== 'all' && 
          StatsComponent.dashboard4CostTypeFilter !== type) {
        return;
      }
      
      if (!categoryMap.has(cleanCategory)) {
        categoryMap.set(cleanCategory, {amount: 0, count: 0, type});
      }
      const categoryData = categoryMap.get(cleanCategory)!;
      categoryData.amount += amount;
      categoryData.count += 1;
    });

  if (categoryMap.size === 0) {
    tableSection.append("p")
      .style("text-align", "center")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.noDataAvailable'));
    return;
  }

  // Convert to array
  let categoryData = Array.from(categoryMap.entries())
    .map(([category, data]) => ({category, ...data}));

  // Calculate total for percentage
  const total = categoryData.reduce((sum, d) => sum + d.amount, 0);
  categoryData.forEach(d => {
    (d as any).percentage = (d.amount / total * 100);
  });

  // Apply sorting
  categoryData.sort((a, b) => {
    let comparison = 0;
    switch(StatsComponent.dashboard4SortColumn) {
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'count':
        comparison = a.count - b.count;
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'percentage':
        comparison = (a as any).percentage - (b as any).percentage;
        break;
    }
    return StatsComponent.dashboard4SortOrder === 'desc' ? -comparison : comparison;
  });

  // Create table with responsive container
  const tableWrapper = tableSection.append("div")
    .style("overflow-x", "auto")
    .style("max-height", "500px")
    .style("overflow-y", "auto");

  const table = tableWrapper.append("table")
    .style("width", "100%")
    .style("min-width", "600px")
    .style("border-collapse", "collapse");

  // Header with sortable columns
  const thead = table.append("thead")
    .style("position", "sticky")
    .style("top", "0")
    .style("z-index", "1");
    
  const headerRow = thead.append("tr");
  
  const headers = [
    { label: StatsComponent.translateService.instant('BI.category'), column: 'category' },
    { label: StatsComponent.translateService.instant('BI.classification'), column: 'type' },
    { label: StatsComponent.translateService.instant('BI.count'), column: 'count' },
    { label: StatsComponent.translateService.instant('BI.totalAmount'), column: 'amount' },
    { label: StatsComponent.translateService.instant('BI.percentage'), column: 'percentage' },
    { label: StatsComponent.translateService.instant('BI.action'), column: null }
  ];

  headers.forEach(header => {
    const th = headerRow.append("th")
      .style("padding", "12px")
      .style("background", "var(--color-primary)")
      .style("color", "white")
      .style("text-align", "left")
      .style("font-weight", "bold")
      .style("cursor", header.column ? "pointer" : "default")
      .style("user-select", "none")
      .text(header.label);

    if (header.column) {
      // Add sort indicator
      if (StatsComponent.dashboard4SortColumn === header.column) {
        th.append("span")
          .style("margin-left", "5px")
          .text(StatsComponent.dashboard4SortOrder === 'asc' ? '▲' : '▼');
      }

      // Make clickable for sorting
      th.on("click", () => {
        if (StatsComponent.dashboard4SortColumn === header.column) {
          StatsComponent.dashboard4SortOrder = StatsComponent.dashboard4SortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          StatsComponent.dashboard4SortColumn = header.column!;
          StatsComponent.dashboard4SortOrder = 'desc';
        }
        updateDashboard4Tables();
      });

      th.on("mouseover", function() {
        d3.select(this).style("background", "var(--color-primary-active)");
      });

      th.on("mouseout", function() {
        d3.select(this).style("background", "var(--color-primary)");
      });
    }
  });

  // Body
  const tbody = table.append("tbody");
  
  categoryData.forEach((d, i) => {
    const row = tbody.append("tr")
      .style("background", i % 2 === 0 ? "var(--color-surface-hover)" : "var(--color-surface)")
      .style("border-bottom", StatsComponent.dashboard4SelectedCategory === d.category ? "3px solid #1976d2" : "1px solid #ddd");

    row.append("td")
      .style("padding", "12px")
      .style("font-weight", StatsComponent.dashboard4SelectedCategory === d.category ? "bold" : "normal")
      .text(d.category);

    row.append("td")
      .style("padding", "12px")
      .append("span")
      .style("padding", "4px 8px")
      .style("border-radius", "4px")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("background", d.type === 'fixed' ? "#ff9800" : "var(--color-primary)")
      .style("color", "white")
      .text(d.type === 'fixed' 
        ? StatsComponent.translateService.instant('BI.fixed')
        : StatsComponent.translateService.instant('BI.variable'));

    row.append("td")
      .style("padding", "12px")
      .text(d.count);

    row.append("td")
      .style("padding", "12px")
      .text(`${d.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);

    row.append("td")
      .style("padding", "12px")
      .text(`${(d as any).percentage.toFixed(2)}%`);

    // Action column with button
    const actionCell = row.append("td")
      .style("padding", "12px");

    actionCell.append("button")
      .style("padding", "5px 12px")
      .style("background", StatsComponent.dashboard4SelectedCategory === d.category ? "#4caf50" : "var(--color-primary)")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "4px")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .style("transition", "background 0.3s")
      .text(StatsComponent.dashboard4SelectedCategory === d.category 
        ? "✓ " + StatsComponent.translateService.instant('BI.viewDetails')
        : StatsComponent.translateService.instant('BI.viewDetails'))
      .on("click", function(event) {
        event.stopPropagation();
        if (StatsComponent.dashboard4SelectedCategory === d.category) {
          StatsComponent.dashboard4SelectedCategory = '';
        } else {
          StatsComponent.dashboard4SelectedCategory = d.category;
        }
        updateDashboard4Tables();
        
        // Scroll to transaction table after a short delay
        if (StatsComponent.dashboard4SelectedCategory) {
          setTimeout(() => {
            const transactionTable = document.getElementById('dashboard4-transaction-table');
            if (transactionTable) {
              transactionTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      })
      .on("mouseover", function() {
        d3.select(this).style("background", StatsComponent.dashboard4SelectedCategory === d.category ? "var(--color-success-light)" : "#1565c0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", StatsComponent.dashboard4SelectedCategory === d.category ? "#4caf50" : "var(--color-primary)");
      });
  });
}
/**
 * Create transaction detail table for Dashboard 4
 */
export function createDashboard4TransactionTable(container: any, transactions: any[]) {
  const tableSection = container.append("div")
    .attr("id", "dashboard4-transaction-table")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("max-width", "100%");

  tableSection.append("h3")
    .style("color", "var(--color-primary)")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.transactionDetails') + 
          `: ${StatsComponent.dashboard4SelectedCategory}`);

  // Exclude inter-account transfers (same as Dashboard 1)
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];

  // Filter transactions for selected category
  let categoryTransactions = transactions
    .filter(t => {
      const cleanCategory = t.category.replace('@', '');
      if (t.amount >= 0) return false; // Only expenses
      if (accountCategoriesToExclude.includes(cleanCategory)) return false; // Exclude inter-account transfers
      return cleanCategory === StatsComponent.dashboard4SelectedCategory;
    });

  if (categoryTransactions.length === 0) {
    tableSection.append("p")
      .style("text-align", "center")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.noTransactions'));
    return;
  }

  // Sort transactions based on current sort settings
  categoryTransactions.sort((a, b) => {
    let compareValue = 0;
    
    switch (StatsComponent.dashboard4TransactionSortColumn) {
      case 'date':
        compareValue = a.date.localeCompare(b.date);
        break;
      case 'account':
        compareValue = a.account.localeCompare(b.account);
        break;
      case 'amount':
        compareValue = Math.abs(a.amount) - Math.abs(b.amount);
        break;
      case 'comment':
        compareValue = (a.comment || '').localeCompare(b.comment || '');
        break;
    }
    
    return StatsComponent.dashboard4TransactionSortOrder === 'asc' ? compareValue : -compareValue;
  });

  const total = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  tableSection.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "15px")
    .text(`${categoryTransactions.length} ${StatsComponent.translateService.instant('BI.transactions')} | ` +
          `${StatsComponent.translateService.instant('BI.total')}: ${total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);

  // Create table
  const tableWrapper = tableSection.append("div")
    .style("overflow-x", "auto")
    .style("max-height", "400px")
    .style("overflow-y", "auto");

  const table = tableWrapper.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse")
    .style("min-width", "600px");

  // Header
  const thead = table.append("thead")
    .style("position", "sticky")
    .style("top", "0")
    .style("z-index", "1");
    
  const headerRow = thead.append("tr");
  
  const headers = [
    { label: StatsComponent.translateService.instant('BI.date'), column: 'date' },
    { label: StatsComponent.translateService.instant('BI.account'), column: 'account' },
    { label: StatsComponent.translateService.instant('BI.totalAmount'), column: 'amount' },
    { label: StatsComponent.translateService.instant('BI.comment'), column: 'comment' }
  ];
  
  headers.forEach(header => {
    const th = headerRow.append("th")
      .style("padding", "12px")
      .style("background", "var(--color-primary)")
      .style("color", "white")
      .style("text-align", "left")
      .style("font-weight", "bold")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .text(header.label);

    // Add sort indicator
    if (StatsComponent.dashboard4TransactionSortColumn === header.column) {
      th.append("span")
        .style("margin-left", "5px")
        .text(StatsComponent.dashboard4TransactionSortOrder === 'asc' ? '▲' : '▼');
    }

    // Make clickable for sorting
    th.on("click", () => {
      if (StatsComponent.dashboard4TransactionSortColumn === header.column) {
        StatsComponent.dashboard4TransactionSortOrder = 
          StatsComponent.dashboard4TransactionSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        StatsComponent.dashboard4TransactionSortColumn = header.column;
        StatsComponent.dashboard4TransactionSortOrder = 'desc';
      }
      updateDashboard4Tables();
    });

    th.on("mouseover", function() {
      d3.select(this).style("background", "var(--color-primary-active)");
    });

    th.on("mouseout", function() {
      d3.select(this).style("background", "var(--color-primary)");
    });
  });

  // Body
  const tbody = table.append("tbody");
  
  categoryTransactions.forEach((t, i) => {
    const row = tbody.append("tr")
      .style("background", i % 2 === 0 ? "var(--color-surface-hover)" : "var(--color-surface)")
      .style("border-bottom", "1px solid #ddd");

    // Format date as dd.mm.yyyy
    const date = new Date(t.date);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;

    row.append("td")
      .style("padding", "12px")
      .text(formattedDate);

    row.append("td")
      .style("padding", "12px")
      .text(t.account);

    row.append("td")
      .style("padding", "12px")
      .style("font-weight", "bold")
      .text(`${Math.abs(t.amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);

    row.append("td")
      .style("padding", "12px")
      .style("max-width", "300px")
      .style("overflow", "hidden")
      .style("text-overflow", "ellipsis")
      .style("white-space", "nowrap")
      .attr("title", t.comment || '')
      .text(t.comment || '-');
  });
}
/**
 * Create navigation buttons for switching between BI dashboards
 */
export function createBIDashboardNavigation(container: any, activeDashboard: number) {
  const navDiv = container.append("div")
    .attr("class", "bi-nav")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("justify-content", "center")
    .style("gap", "8px")
    .style("margin-bottom", "20px")
    .style("width", "100%");

  const dashboards = [
    {id: 1, name: StatsComponent.translateService.instant('BI.dashboard1Name')},
    {id: 2, name: StatsComponent.translateService.instant('BI.dashboard2Name')},
    {id: 3, name: StatsComponent.translateService.instant('BI.dashboard3Name')},
    {id: 4, name: StatsComponent.translateService.instant('BI.dashboard4Name')}
  ];

  dashboards.forEach(dash => {
    navDiv.append("button")
      .text(dash.name)
      .style("padding", "8px 12px")
      .style("background", dash.id === activeDashboard ? "var(--color-primary)" : "var(--color-surface)")
      .style("color", dash.id === activeDashboard ? "var(--color-surface)" : "var(--color-primary)")
      .style("border", "2px solid var(--color-primary)")
      .style("border-radius", "5px")
      .style("cursor", "pointer")
      .style("font-size", "13px")
      .style("font-weight", dash.id === activeDashboard ? "bold" : "normal")
      .style("white-space", "nowrap")
      .style("flex-shrink", "0")
      .on("click", (event) => {
        // Prevent click if user was scrolling (includes momentum scrolling)
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
        // Only recreate if actually switching dashboards
        if (StatsComponent.activeBIDashboard !== dash.id) {
          StatsComponent.activeBIDashboard = dash.id;
          createBIDashboard(dash.id);
        }
      });
  });
}
/**
 * Create a KPI tile
 */
export function createKPITile(container: any, title: string, value: number, unit: string, 
                      color: string, subtitle?: string, onClick?: () => void) {
  const tile = container.append("div")
    .attr("class", "kpi-tile")
    .style("background", "var(--color-surface)")
    .style("border-radius", "8px")
    .style("padding", "20px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("text-align", "center")
    .style("cursor", onClick ? "pointer" : "default")
    .style("transition", "transform 0.2s, box-shadow 0.2s")
    .on("click", onClick ? () => onClick() : null)
    .on("mouseover", function() {
      if (onClick) {
        d3.select(this)
          .style("transform", "translateY(-2px)")
          .style("box-shadow", "0 4px 8px rgba(0,0,0,0.15)");
      }
    })
    .on("mouseout", function() {
      if (onClick) {
        d3.select(this)
          .style("transform", "translateY(0)")
          .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");
      }
    });

  tile.append("div")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "10px")
    .text(title);

  // Format number with thousand separators
  const formattedValue = unit === "%" 
    ? value.toFixed(2)
    : value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  tile.append("div")
    .style("font-size", "32px")
    .style("font-weight", "bold")
    .style("color", color)
    .text(formattedValue + " " + unit);

  if (subtitle) {
    tile.append("div")
      .style("font-size", "11px")
      .style("color", "var(--color-text-hint)")
      .style("margin-top", "5px")
      .text(subtitle);
  }
}
/**
 * Create Income vs Expenses chart
 */
export function createIncomeVsExpensesChart(svg: any, data: any[], width: number, height: number) {
  const leftMargin = width < 600 ? 45 : 60;
  const rightMargin = width < 600 ? 30 : 80;
  const margin = {top: 20, right: rightMargin, bottom: 40, left: leftMargin};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleTime()
    .domain(d3.extent(data, (d: any) => d.date) as [Date, Date])
    .range([0, chartWidth]);

  // Add 15% padding to top of y-axis for legend space
  const maxValue = d3.max(data, (d: any) => Math.max(d.income, d.expenses)) as number;
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.15])
    .nice()
    .range([chartHeight, 0]);

  // Lines
  const incomeLine = d3.line<any>()
    .x(d => x(d.date))
    .y(d => y(d.income))
    .curve(d3.curveMonotoneX);

  const expenseLine = d3.line<any>()
    .x(d => x(d.date))
    .y(d => y(d.expenses))
    .curve(d3.curveMonotoneX);

  // Draw income line
  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#4caf50")
    .attr("stroke-width", 3)
    .attr("d", incomeLine);

  // Draw expense line
  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#f44336")
    .attr("stroke-width", 3)
    .attr("d", expenseLine);

  // Add interactive data points for click navigation
  g.selectAll(".income-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "income-dot")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.income))
    .attr("r", 5)
    .attr("fill", "#4caf50")
    .attr("stroke", "var(--color-surface)")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("mouseover", function() {
      d3.select(this).attr("r", 7);
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 5);
    })
    .on("click", function(event, d: any) {
      const monthStr = d.date.toISOString().substring(0, 7);
      StatsComponent.selectedMonth = monthStr;
      StatsComponent.filterType = 'month';
      StatsComponent.activeBIDashboard = 2;
      createBIDashboard(2);
    });

  g.selectAll(".expense-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "expense-dot")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.expenses))
    .attr("r", 5)
    .attr("fill", "#f44336")
    .attr("stroke", "var(--color-surface)")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("mouseover", function() {
      d3.select(this).attr("r", 7);
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 5);
    })
    .on("click", function(event, d: any) {
      const monthStr = d.date.toISOString().substring(0, 7);
      StatsComponent.selectedMonth = monthStr;
      StatsComponent.filterType = 'month';
      StatsComponent.activeBIDashboard = 2;
      createBIDashboard(2);
    });

  // Axes - dynamic tick count based on data length
  const xTickCount = data.length === 1 ? 1 : Math.min(data.length, 6);
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(xTickCount))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .style("font-size", "11px");

  // Legend - moved to top left inside chart
  const legend = g.append("g")
    .attr("transform", `translate(10, 5)`);

  legend.append("line")
    .attr("x1", 0).attr("x2", 20)
    .attr("y1", 0).attr("y2", 0)
    .attr("stroke", "#4caf50")
    .attr("stroke-width", 3);

  legend.append("text")
    .attr("x", 25).attr("y", 5)
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('BI.legendIncome'));

  legend.append("line")
    .attr("x1", 0).attr("x2", 20)
    .attr("y1", 20).attr("y2", 20)
    .attr("stroke", "#f44336")
    .attr("stroke-width", 3);

  legend.append("text")
    .attr("x", 25).attr("y", 25)
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('BI.legendExpenses'));
}
/**
 * Create Income vs Expenses Bar Chart (side-by-side bars)
 */
export function createIncomeVsExpensesBarChart(svg: any, data: any[], width: number, height: number) {
  const leftMargin = width < 600 ? 45 : 60;
  const rightMargin = width < 600 ? 30 : 80;
  const margin = {top: 20, right: rightMargin, bottom: 40, left: leftMargin};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Convert dates to strings for band scale
  const dateStrings = data.map(d => {
    const date = new Date(d.date);
    return date.toLocaleString('de-DE', { month: 'short', year: 'numeric' });
  });

  // Scales
  const x0 = d3.scaleBand()
    .domain(dateStrings)
    .range([0, chartWidth])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(['income', 'expenses'])
    .range([0, x0.bandwidth()])
    .padding(0.05);

  const maxValue = d3.max(data, (d: any) => Math.max(d.income, d.expenses)) as number;
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.15])
    .nice()
    .range([chartHeight, 0]);

  // Create groups for each time period
  const groups = g.selectAll(".period-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "period-group")
    .attr("transform", (d, i) => `translate(${x0(dateStrings[i])},0)`);

  // Income bars
  groups.append("rect")
    .attr("x", x1('income') as number)
    .attr("y", d => y(d.income))
    .attr("width", x1.bandwidth())
    .attr("height", d => chartHeight - y(d.income))
    .attr("fill", "#4caf50")
    .style("cursor", "pointer")
    .on("mouseover", function() {
      d3.select(this).attr("opacity", 0.8);
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 1);
    })
    .on("click", function(event, d: any) {
      const monthStr = d.date.toISOString().substring(0, 7);
      StatsComponent.selectedMonth = monthStr;
      StatsComponent.filterType = 'month';
      StatsComponent.activeBIDashboard = 2;
      createBIDashboard(2);
    });

  // Expense bars
  groups.append("rect")
    .attr("x", x1('expenses') as number)
    .attr("y", d => y(d.expenses))
    .attr("width", x1.bandwidth())
    .attr("height", d => chartHeight - y(d.expenses))
    .attr("fill", "#f44336")
    .style("cursor", "pointer")
    .on("mouseover", function() {
      d3.select(this).attr("opacity", 0.8);
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 1);
    })
    .on("click", function(event, d: any) {
      const monthStr = d.date.toISOString().substring(0, 7);
      StatsComponent.selectedMonth = monthStr;
      StatsComponent.filterType = 'month';
      StatsComponent.activeBIDashboard = 2;
      createBIDashboard(2);
    });

  // Axes
  const xTickCount = data.length === 1 ? 1 : Math.min(data.length, 6);
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x0).tickValues(
      data.length <= xTickCount ? dateStrings : 
      dateStrings.filter((_, i) => i % Math.ceil(data.length / xTickCount) === 0)
    ))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .style("font-size", "11px");

  // Legend
  const legend = g.append("g")
    .attr("transform", `translate(10, 5)`);

  legend.append("rect")
    .attr("x", 0).attr("y", -5)
    .attr("width", 20).attr("height", 10)
    .attr("fill", "#4caf50");

  legend.append("text")
    .attr("x", 25).attr("y", 5)
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('BI.legendIncome'));

  legend.append("rect")
    .attr("x", 0).attr("y", 15)
    .attr("width", 20).attr("height", 10)
    .attr("fill", "#f44336");

  legend.append("text")
    .attr("x", 25).attr("y", 25)
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('BI.legendExpenses'));
}
/**
 * Update Income vs Expenses chart without page jump
 */
export function updateIncomeVsExpensesChart(filteredData: any[], chartWidth: number) {
  // Update button text
  d3.select("#income-vs-expenses-toggle-btn")
    .html(StatsComponent.incomeVsExpensesChartMode === "line" ? "📊 " + StatsComponent.translateService.instant('BI.chartModeBars') : StatsComponent.translateService.instant('BI.chartModeLines'));
  
  const container = d3.select("#income-vs-expenses-chart-container");
  container.selectAll("*").remove();
  
  const svg = container.append("svg")
    .attr("width", chartWidth)
    .attr("height", 300)
    .style("max-width", "100%")
    .style("display", "block");
  
  if (StatsComponent.incomeVsExpensesChartMode === "line") {
    createIncomeVsExpensesChart(svg, filteredData, chartWidth, 300);
  } else {
    createIncomeVsExpensesBarChart(svg, filteredData, chartWidth, 300);
  }
}
/**
 * Create Savings Rate chart
 */
export function createSavingsRateChart(svg: any, data: any[], width: number, height: number) {
  // Responsive left margin based on width
  const leftMargin = width < 600 ? 45 : 55;
  const rightMargin = width < 600 ? 50 : (width >= 1200 ? 70 : 60);
  const margin = {top: 30, right: rightMargin, bottom: 50, left: leftMargin};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Calculate savings rate for each month
  const savingsRateData = data.map(d => ({
    date: d.date,
    savingsRate: d.income > 0 ? ((d.income - d.expenses) / d.income) * 100 : 0
  }));

  // Calculate average savings rate (average of monthly rates, not total-based)
  const actualTotalSavingsRate = savingsRateData.length > 0
    ? savingsRateData.reduce((sum, d) => sum + d.savingsRate, 0) / savingsRateData.length
    : 0;

  // Calculate bar width with proper spacing
  const barGap = 4; // Gap between bars
  const availableWidth = chartWidth * 0.95; // Use 95% of width for bars
  const totalBars = savingsRateData.length;
  const barWidth = Math.max(8, (availableWidth - (totalBars - 1) * barGap) / totalBars);
  const startPadding = (chartWidth - (totalBars * barWidth + (totalBars - 1) * barGap)) / 2;
  
  const x = d3.scaleTime()
    .domain(d3.extent(savingsRateData, d => d.date) as [Date, Date])
    .range([startPadding + barWidth / 2, chartWidth - startPadding - barWidth / 2]);

  const y = d3.scaleLinear()
    .domain([
      Math.min(0, d3.min(savingsRateData, d => d.savingsRate) as number) - 5,
      Math.max(20, d3.max(savingsRateData, d => d.savingsRate) as number) + 5
    ])
    .nice()
    .range([chartHeight, 0]);

  // Bars (drawn first, behind the reference line)
  g.selectAll(".bar")
    .data(savingsRateData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.date) - barWidth / 2)
    .attr("y", d => d.savingsRate >= 0 ? y(d.savingsRate) : y(0))
    .attr("width", barWidth)
    .attr("height", d => Math.abs(y(d.savingsRate) - y(0)))
    .attr("fill", d => d.savingsRate >= 10 ? "#4caf50" : d.savingsRate >= 0 ? "#ff9800" : "#f44336")
    .attr("opacity", 0.85)
    .style("cursor", "pointer")
    .on("mouseover", function() {
      d3.select(this).attr("opacity", 1);
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.85);
    })
    .on("click", function(event, d: any) {
      const monthStr = d.date.toISOString().substring(0, 7);
      StatsComponent.selectedMonth = monthStr;
      StatsComponent.filterType = 'month';
      StatsComponent.activeBIDashboard = 2;
      createBIDashboard(2);
    });

  // Add percentage labels on bars
  g.selectAll(".bar-label")
    .data(savingsRateData)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.date))
    .attr("y", d => d.savingsRate >= 0 ? y(d.savingsRate) - 3 : y(d.savingsRate) + 12)
    .attr("text-anchor", "middle")
    .style("font-size", "9px")
    .style("fill", "var(--color-text)")
    .style("font-weight", "500")
    .text(d => d.savingsRate.toFixed(1) + "%");

  // Zero line (drawn after bars so it appears on top)
  g.append("line")
    .attr("x1", 0)
    .attr("x2", chartWidth)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .style("stroke", "var(--color-text)")
    .attr("stroke-width", 1)
    .style("pointer-events", "none");

  // Actual average savings rate line (light orange)
  if (savingsRateData.length > 1 && actualTotalSavingsRate > 0) {
    g.append("line")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", y(actualTotalSavingsRate))
      .attr("y2", y(actualTotalSavingsRate))
      .attr("stroke", "#ffb74d")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "8 4")
      .style("pointer-events", "none");

    g.append("text")
      .attr("x", chartWidth + 8)
      .attr("y", y(actualTotalSavingsRate) + 4)
      .style("font-size", "10px")
      .style("text-anchor", "start")
      .style("fill", "#ff9800")
      .style("font-weight", "bold")
      .text(`Ø ${actualTotalSavingsRate.toFixed(1)}%`);
  }

  // Reference line at 10% (drawn after bars so it appears on top)
  g.append("line")
    .attr("x1", 0)
    .attr("x2", chartWidth)
    .attr("y1", y(10))
    .attr("y2", y(10))
    .attr("stroke", "var(--color-text-secondary)")
    .attr("stroke-dasharray", "5 3")
    .attr("stroke-width", 2)
    .style("pointer-events", "none");

  g.append("text")
    .attr("x", chartWidth - 5)
    .attr("y", y(10) - 5)
    .style("font-size", "10px")
    .style("text-anchor", "end")
    .style("fill", "var(--color-text-secondary)")
    .style("font-weight", "bold")
    .text("Ziel: 10%");

  // Axes - dynamic tick count based on data length
  const xTickCount = savingsRateData.length === 1 ? 1 : Math.min(savingsRateData.length, 8);
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(xTickCount))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%"))
    .style("font-size", "11px");
}
/**
 * Create Fixed vs Variable Costs chart
 */
export function createFixedVsVariableCostsChart(svg: any, width: number, height: number, isMultiMonth: boolean = false) {
  // Responsive left margin based on width
  const leftMargin = width < 600 ? 45 : 60;
  const margin = {top: 50, right: 30, bottom: 30, left: leftMargin};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Calculate fixed/variable costs ratio - if average mode is on and multiple months, calculate average
  let fixedRatio = StatsComponent.calculateFixedCostsRatio(StatsComponent.selectedMonth);
  
  // If average view is enabled and we have multiple months, the ratio calculation already handles averaging
  // But we need to divide the fixed costs by the number of months for display purposes
  if (StatsComponent.showAverageView && isMultiMonth) {
    // The calculateFixedCostsRatio already considers the period, so this stays the same
    // The label will indicate it's an average view
  }
  
  const variableRatio = 100 - fixedRatio;

  const data = [
    {label: "Fixkosten", value: fixedRatio, color: "#115f9a"},
    {label: "Variable Ausgaben", value: variableRatio, color: "#48b5c4"}
  ];

  const x = d3.scaleLinear()
    .domain([0, 100])
    .range([0, chartWidth]);

  // Legend - positioned above the chart
  const legend = g.append("g")
    .attr("transform", `translate(0, -35)`);

  // Fixkosten (left-aligned at 0)
  const fixkostenLegend = legend.append("g")
    .attr("transform", `translate(0, 0)`);

  fixkostenLegend.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", data[0].color);

  fixkostenLegend.append("text")
    .attr("x", 20)
    .attr("y", 12)
    .style("font-size", "11px")
    .text(StatsComponent.translateService.instant('BI.legendFixedCosts'));

  // Variable Ausgaben (right-aligned)
  const variableLegend = legend.append("g")
    .attr("transform", `translate(${chartWidth - 150}, 0)`);

  variableLegend.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", data[1].color);

  variableLegend.append("text")
    .attr("x", 20)
    .attr("y", 12)
    .style("font-size", "11px")
    .text(StatsComponent.translateService.instant('BI.legendVariableCosts'));

  let cumulative = 0;
  g.selectAll(".segment")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "segment")
    .attr("x", d => {
      const start = x(cumulative);
      cumulative += d.value;
      return start;
    })
    .attr("y", 0)
    .attr("width", d => x(d.value))
    .attr("height", chartHeight)
    .attr("fill", d => d.color);

  // Labels
  cumulative = 0;
  g.selectAll(".label")
    .data(data)
    .enter()
    .append("text")
    .attr("x", d => {
      const start = cumulative + d.value / 2;
      cumulative += d.value;
      return x(start);
    })
    .attr("y", chartHeight / 2 + 5)
    .style("text-anchor", "middle")
    .style("fill", "white")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text(d => d.value.toFixed(1) + "%");

  // Axis
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"))
    .style("font-size", "11px");
}
/**
 * Get account balances and budget data
 */
export function getAccountBalances(): Array<{account: string, balance: number, target: number, actual: number, compliance: number}> {
  const accounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  const targetPercentages = {
    'Daily': AppStateService.instance.daily,
    'Splurge': AppStateService.instance.splurge,
    'Smile': AppStateService.instance.smile,
    'Fire': AppStateService.instance.fire
  };

  const filteredTransactions = StatsComponent.getFilteredTransactions();
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];

  // Calculate total expenses (excluding inter-account transfers and zero amounts)
  // Only count expenses from the 4 main accounts to ensure percentages sum to 100%
  const totalExpenses = Math.abs(filteredTransactions
    .filter(t => {
      if (t.amount === 0.0) return false;
      if (t.amount >= 0) return false;
      // Only count expenses from the 4 main accounts
      if (!accounts.includes(t.account)) return false;
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory);
    })
    .reduce((sum, t) => sum + Number(t.amount), 0));

  const accountData = accounts.map(account => {
    // Only use the account itself, don't combine Fire with Mojo
    const accountsToInclude = [account];
    
    // Calculate balance excluding inter-account transfers and zero amounts
    const balance = filteredTransactions
      .filter(t => {
        if (t.amount === 0.0) return false;
        if (!accountsToInclude.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate actual percentage of expenses for this account
    // Match cashflow logic: exclude inter-account transfers and zero amounts
    const accountExpenses = Math.abs(filteredTransactions
      .filter(t => {
        if (t.amount === 0.0) return false;
        if (t.amount >= 0) return false;
        if (!accountsToInclude.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      })
      .reduce((sum, t) => sum + Number(t.amount), 0));
    
    const actualPercent = totalExpenses > 0 ? (accountExpenses / totalExpenses) * 100 : 0;
    const targetPercent = targetPercentages[account] || 25;
    const compliance = StatsComponent.calculateBudgetCompliance(account, targetPercent, StatsComponent.selectedMonth);

    return {
      account,
      balance,
      target: targetPercent,
      actual: actualPercent,
      accountExpenses,
      compliance
    };
  });

  // Normalize actual percentages to exactly 100% to handle rounding errors
  const totalActual = accountData.reduce((sum, d) => sum + d.actual, 0);
  if (totalActual > 0 && totalActual !== 100) {
    const adjustmentFactor = 100 / totalActual;
    accountData.forEach(d => {
      d.actual = d.actual * adjustmentFactor;
    });
  }

  // Remove the temporary accountExpenses field before returning
  return accountData.map(({accountExpenses, ...rest}) => rest);
}
/**
 * Create account balance table
 */
export function createAccountBalanceTable(container: any, data: any[], width: number) {
  const tableWrapper = container.append("div")
    .style("width", "100%")
    .style("overflow-x", "auto")
    .style("margin-bottom", "20px");

  const table = tableWrapper.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse")
    .style("background", "var(--color-surface)")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("table-layout", "auto");

  const thead = table.append("thead");
  const tbody = table.append("tbody");

  // Header
  thead.append("tr")
    .selectAll("th")
    .data([StatsComponent.translateService.instant('BI.columnAccount'), StatsComponent.translateService.instant('BI.columnCurrentBalance'), StatsComponent.translateService.instant('BI.columnActualRate'), StatsComponent.translateService.instant('BI.columnTargetRate'), StatsComponent.translateService.instant('BI.columnCompliance'), StatsComponent.translateService.instant('BI.columnStatus')])
    .enter()
    .append("th")
    .style("padding", "12px")
    .style("text-align", "left")
    .style("background", "var(--color-primary)")
    .style("color", "white")
    .style("font-size", "13px")
    .style("white-space", "nowrap")
    .text(d => d);

  // Rows
  const rows = tbody.selectAll("tr")
    .data(data)
    .enter()
    .append("tr")
    .style("border-bottom", "1px solid #ddd");

  rows.append("td")
    .style("padding", "12px")
    .style("font-weight", "bold")
    .style("white-space", "nowrap")
    .text(d => d.account);

  rows.append("td")
    .style("padding", "12px")
    .style("white-space", "nowrap")
    .text(d => d.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

  rows.append("td")
    .style("padding", "12px")
    .style("white-space", "nowrap")
    .text(d => d.actual.toFixed(2) + "%");

  rows.append("td")
    .style("padding", "12px")
    .style("white-space", "nowrap")
    .text(d => d.target.toFixed(0) + "%");

  rows.append("td")
    .style("padding", "12px")
    .style("white-space", "nowrap")
    .text(d => d.compliance.toFixed(2) + "%");

  rows.append("td")
    .style("padding", "12px")
    .style("white-space", "nowrap")
    .append("span")
    .style("padding", "4px 8px")
    .style("border-radius", "4px")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .style("background", d => d.compliance >= 80 ? "#4caf50" : d.compliance >= 50 ? "#ff9800" : "#f44336")
    .style("color", "white")
    .text(d => d.compliance >= 80 ? "✓ OK" : d.compliance >= 50 ? "⚠ Warnung" : "✗ Abweichung");
}
/**
 * Create Monthly Expense Table (Ausgaben pro Konto und Monat)
 */
export function createMonthlyExpenseTable(container: any, width: number) {
  const filteredTransactions = StatsComponent.getFilteredTransactions();
  const accounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income']; // Exclude inter-account transfers, but include Mojo (savings)
  
  // Get unique months from filtered transactions
  const monthSet = new Set<string>();
  filteredTransactions.forEach(t => {
    const month = t.date.substring(0, 7); // YYYY-MM
    monthSet.add(month);
  });
  const months = Array.from(monthSet).sort();
  
  // Calculate expenses per account per month - match getMonthlyData logic exactly
  const expenseData = new Map<string, Map<string, number>>();
  accounts.forEach(account => {
    expenseData.set(account, new Map<string, number>());
    months.forEach(month => {
      expenseData.get(account)!.set(month, 0);
    });
  });
  
  filteredTransactions.forEach(t => {
    // Match cashflow logic: exclude zero amounts
    if (t.amount === 0.0) return;
    
    // Strip @ from category before comparing
    const cleanCategory = t.category.replace('@', '');
    
    // Match getMonthlyData: exclude inter-account transfers (where category is an account name)
    if (accountCategoriesToExclude.includes(cleanCategory)) return;
    
    const amount = Number(t.amount);
    if (amount >= 0) return; // Only negative amounts (expenses)
    if (!accounts.includes(t.account)) return; // Only process main accounts
    
    const month = t.date.substring(0, 7);
    const currentValue = expenseData.get(t.account)!.get(month) || 0;
    // Use absolute value to match getMonthlyData
    expenseData.get(t.account)!.set(month, currentValue + Math.abs(amount));
  });
  
  // Calculate monthly totals
  const monthlyTotals = new Map<string, number>();
  months.forEach(month => {
    let total = 0;
    accounts.forEach(account => {
      total += expenseData.get(account)!.get(month) || 0;
    });
    monthlyTotals.set(month, total);
  });
  
  // Calculate row totals (total per account)
  const accountTotals = new Map<string, number>();
  accounts.forEach(account => {
    let total = 0;
    months.forEach(month => {
      total += expenseData.get(account)!.get(month) || 0;
    });
    accountTotals.set(account, total);
  });
  
  // Calculate grand total
  let grandTotal = 0;
  accounts.forEach(account => {
    grandTotal += accountTotals.get(account) || 0;
  });
  
  // Create table
  const tableDiv = container.append("div")
    .style("max-width", width + "px")
    .style("overflow-x", "auto")
    .style("margin", "0 auto");
  
  const table = tableDiv.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse")
    .style("background", "var(--color-surface)")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");
  
  // Header row
  const thead = table.append("thead");
  const headerRow = thead.append("tr")
    .style("background", "var(--color-primary)")
    .style("color", "white");
  
  headerRow.append("th")
    .style("padding", "12px")
    .style("text-align", "left")
    .style("border", "1px solid var(--color-border)")
    .style("min-width", "80px")
    .text(StatsComponent.translateService.instant('BI.columnAccount'));
  
  months.forEach(month => {
    headerRow.append("th")
      .style("padding", "12px")
      .style("text-align", "right")
      .style("border", "1px solid var(--color-border)")
      .style("min-width", "100px")
      .style("white-space", "nowrap")
      .text(month);
  });
  
  headerRow.append("th")
    .style("padding", "12px")
    .style("text-align", "right")
    .style("border", "1px solid var(--color-border)")
    .style("min-width", "100px")
    .style("white-space", "nowrap")
    .style("font-weight", "bold")
    .text("Total");
  
  // Data rows
  const tbody = table.append("tbody");
  accounts.forEach((account, idx) => {
    const row = tbody.append("tr")
      .style("background", idx % 2 === 0 ? "var(--color-surface-hover)" : "var(--color-surface)")
      .style("border-bottom", "1px solid #ddd");
    
    row.append("td")
      .style("padding", "12px")
      .style("font-weight", "bold")
      .style("border", "1px solid var(--color-border)")
      .style("min-width", "80px")
      .text(account);
    
    months.forEach(month => {
      const value = expenseData.get(account)!.get(month) || 0;
      row.append("td")
        .style("padding", "12px")
        .style("text-align", "right")
        .style("border", "1px solid var(--color-border)")
        .style("min-width", "100px")
        .style("white-space", "nowrap")
        .text(value.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €");
    });
    
    row.append("td")
      .style("padding", "12px")
      .style("text-align", "right")
      .style("border", "1px solid var(--color-border)")
      .style("min-width", "100px")
      .style("white-space", "nowrap")
      .style("font-weight", "bold")
      .style("background", "var(--color-background)")
      .text((accountTotals.get(account) || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €");
  });
  
  // Total row
  const totalRow = tbody.append("tr")
    .style("background", "var(--color-info-surface)")
    .style("font-weight", "bold")
    .style("border-top", "2px solid #1976d2");
  
  totalRow.append("td")
    .style("padding", "12px")
    .style("border", "1px solid var(--color-border)")
    .style("min-width", "80px")
    .text(StatsComponent.translateService.instant('BI.labelTotal'));
  
  months.forEach(month => {
    const total = monthlyTotals.get(month) || 0;
    totalRow.append("td")
      .style("padding", "12px")
      .style("text-align", "right")
      .style("border", "1px solid var(--color-border)")
      .style("min-width", "100px")
      .style("white-space", "nowrap")
      .text(total.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €");
  });
  
  totalRow.append("td")
    .style("padding", "12px")
    .style("text-align", "right")
    .style("border", "1px solid var(--color-border)")
    .style("min-width", "100px")
    .style("white-space", "nowrap")
    .style("background", "var(--color-info-surface)")
    .text(grandTotal.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €");
}
/**
 * Create Budget Compliance Chart
 */
export function createBudgetComplianceChart(svg: any, data: any[], width: number, height: number) {
  const margin = {top: 50, right: 30, bottom: 60, left: 60};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand()
    .domain(data.map(d => d.account))
    .range([0, chartWidth])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(["Ist", "Ziel"])
    .range([0, x0.bandwidth()])
    .padding(0.05);

  const y = d3.scaleLinear()
    .domain([0, 100])
    .nice()
    .range([chartHeight, 0]);

  // Draw bars
  const accountGroups = g.selectAll(".account-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "account-group")
    .attr("transform", d => `translate(${x0(d.account)},0)`);

  accountGroups.append("rect")
    .attr("x", x1("Ist"))
    .attr("y", d => y(d.compliance))
    .attr("width", x1.bandwidth())
    .attr("height", d => chartHeight - y(d.compliance))
    .attr("fill", d => d.compliance >= 80 ? "#48b5c4" : d.compliance >= 50 ? "#ff9800" : "#f44336");

  accountGroups.append("rect")
    .attr("x", x1("Ziel"))
    .attr("y", d => y(100))
    .attr("width", x1.bandwidth())
    .attr("height", d => chartHeight - y(100))
    .attr("fill", "#115f9a");

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x0))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%"))
    .style("font-size", "11px");

  // Legend - positioned below the chart area on the left
  const legend = g.append("g")
    .attr("transform", `translate(0, ${chartHeight + 40})`);

  const legendData = [
    {label: StatsComponent.translateService.instant('BI.legendActualCompliance'), color: "#48b5c4"},
    {label: StatsComponent.translateService.instant('BI.legendTarget100'), color: "#115f9a"}
  ];

  legendData.forEach((d, i) => {
    legend.append("rect")
      .attr("x", i * 150)
      .attr("y", 0)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d.color);

    legend.append("text")
      .attr("x", i * 150 + 20)
      .attr("y", 12)
      .style("font-size", "11px")
      .text(d.label);
  });
}
/**
 * Create Account Development Chart (Time Series)
 */
export function createAccountDevelopmentChart(svg: any, width: number, height: number) {
  // Responsive margins - increase right margin on smaller screens for account labels
  const screenWidth = window.innerWidth;
  const isMobile = screenWidth < 600;
  const margin = {top: 20, right: isMobile ? 40 : 100, bottom: 40, left: 60};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Clear any existing content
  svg.selectAll("*").remove();
  
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Get daily data per account - use filtered transactions (fresh calculation each time)
  const filteredTransactions = StatsComponent.getFilteredTransactions();
  const accounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  const dailyMap = new Map<string, any>();
  
  filteredTransactions.forEach(t => {
    // Only negative outflows from the main accounts, excluding transfers between main accounts
    if (t.amount >= 0) return; // Skip positive amounts
    if (!accounts.includes(t.account)) return; // Only process main accounts
    if (accounts.includes(t.category)) return; // Skip transfers between main accounts
    
    const day = t.date.substring(0, 10);
    
    if (!dailyMap.has(day)) {
      dailyMap.set(day, {
        day,
        date: new Date(day),
        Daily: 0,
        Splurge: 0,
        Smile: 0,
        Fire: 0
      });
    }

    const data = dailyMap.get(day)!;
    data[t.account] += Number(t.amount);
  });

  const timeSeriesData = Array.from(dailyMap.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Determine the actual period start date
  let periodStartDate: Date;
  let periodEndDate: Date;
  if (StatsComponent.filterType === 'month') {
    // For month selection, use the 1st of the selected month
    periodStartDate = new Date(StatsComponent.selectedMonth + '-01');
    periodEndDate = new Date(periodStartDate);
    periodEndDate.setMonth(periodEndDate.getMonth() + 1);
    periodEndDate.setDate(0); // Last day of the month
  } else if (StatsComponent.filterType === 'custom') {
    periodStartDate = new Date(StatsComponent.customDateStart);
    periodEndDate = new Date(StatsComponent.customDateEnd);
  } else if (StatsComponent.filterType === 'quarter') {
    const [year, quarter] = StatsComponent.selectedMonth.split('-Q');
    const startMonth = (parseInt(quarter) - 1) * 3;
    periodStartDate = new Date(parseInt(year), startMonth, 1);
    periodEndDate = new Date(parseInt(year), startMonth + 3, 0);
  } else if (StatsComponent.filterType === 'halfyear') {
    const [year, half] = StatsComponent.selectedMonth.split('-H');
    const startMonth = (parseInt(half) - 1) * 6;
    periodStartDate = new Date(parseInt(year), startMonth, 1);
    periodEndDate = new Date(parseInt(year), startMonth + 6, 0);
  } else if (StatsComponent.filterType === 'year') {
    const year = parseInt(StatsComponent.selectedMonth);
    periodStartDate = new Date(year, 0, 1);
    periodEndDate = new Date(year, 11, 31);
  } else {
    // For 'all', use the first and last transaction dates
    periodStartDate = timeSeriesData.length > 0 ? new Date(timeSeriesData[0].day) : new Date();
    periodEndDate = timeSeriesData.length > 0 ? new Date(timeSeriesData[timeSeriesData.length - 1].day) : new Date();
  }

  // Fill in all days in the period with zero values if no transactions
  const filledData: any[] = [];
  const currentDate = new Date(periodStartDate);
  currentDate.setDate(currentDate.getDate() - 1); // Start one day before
  
  const endDate = new Date(periodEndDate);
  const dailyDataMap = new Map(dailyMap);
  
  while (currentDate <= endDate) {
    const dayStr = currentDate.toISOString().substring(0, 10);
    if (dailyDataMap.has(dayStr)) {
      filledData.push(dailyDataMap.get(dayStr)!);
    } else {
      filledData.push({
        day: dayStr,
        date: new Date(currentDate),
        Daily: 0,
        Splurge: 0,
        Smile: 0,
        Fire: 0
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate cumulative starting from 0 for the selected period
  let cumulative = {Daily: 0, Splurge: 0, Smile: 0, Fire: 0};
  filledData.forEach(d => {
    accounts.forEach(acc => {
      cumulative[acc] += d[acc];
      d[acc + '_cumulative'] = cumulative[acc];
    });
  });

  const x = d3.scaleTime()
    .domain(d3.extent(filledData, d => d.date) as [Date, Date])
    .range([0, chartWidth]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(filledData, d => Math.min(...accounts.map(acc => d[acc + '_cumulative']))) as number,
      d3.max(filledData, d => Math.max(...accounts.map(acc => d[acc + '_cumulative']))) as number
    ])
    .nice()
    .range([chartHeight, 0]);

  const colors = {
    Daily: "#115f9a",
    Splurge: "#1984c5",
    Smile: "#22a7f0",
    Fire: "#48b5c4"
  };

  // Draw lines
  accounts.forEach(account => {
    const line = d3.line<any>()
      .x(d => x(d.date))
      .y(d => y(d[account + '_cumulative']))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(filledData)
      .attr("fill", "none")
      .attr("stroke", colors[account])
      .attr("stroke-width", 2)
      .attr("d", line);
    
    // Add label at the end of the line
    const lastPoint = filledData[filledData.length - 1];
    g.append("text")
      .attr("x", x(lastPoint.date) + 5)
      .attr("y", y(lastPoint[account + '_cumulative']) + 4)
      .style("font-size", "11px")
      .style("fill", colors[account])
      .style("font-weight", "bold")
      .text(account);
  });

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(6))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .style("font-size", "11px");
}
/**
 * Create Top Categories Chart
 */
export function createTopCategoriesChart(svg: any, width: number, height: number) {
  // Responsive margins based on screen width
  const rightMargin = width < 600 ? 80 : width < 900 ? 120 : 150;
  const leftMargin = width < 600 ? 100 : 150;
  const margin = {top: 20, right: rightMargin, bottom: 40, left: leftMargin};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Aggregate by category - use filtered transactions
  const filteredTransactions = StatsComponent.getFilteredTransactions();
  const categoryMap = new Map<string, number>();
  filteredTransactions
    .filter(t => Number(t.amount) < 0)
    .forEach(t => {
      const amount = Math.abs(Number(t.amount));
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + amount);
    });

  const categoryData = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({category, amount}))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const totalExpenses = categoryData.reduce((sum, d) => sum + d.amount, 0);

  const y = d3.scaleBand()
    .domain(categoryData.map(d => d.category))
    .range([0, chartHeight])
    .padding(0.2);

  const x = d3.scaleLinear()
    .domain([0, d3.max(categoryData, d => d.amount) as number])
    .nice()
    .range([0, chartWidth]);

  // Draw bars
  g.selectAll(".bar")
    .data(categoryData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d.category) as number)
    .attr("width", d => x(d.amount))
    .attr("height", y.bandwidth())
    .attr("fill", d => {
      // Check if selected (orange)
      if (StatsComponent.selectedCategory === d.category) return "#ff9800";
      // Check if it's a subscription category (light grey)
      const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === d.category);
      return isSubscription ? "#d3d3d3" : "var(--color-primary)";
    })
    .attr("stroke", d => StatsComponent.selectedCategory === d.category ? "#f57c00" : "none")
    .attr("stroke-width", d => StatsComponent.selectedCategory === d.category ? 3 : 0)
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      if (StatsComponent.selectedCategory === d.category) {
        StatsComponent.selectedCategory = "";
      } else {
        StatsComponent.selectedCategory = d.category;
      }
      
      // Update all bar colors
      g.selectAll(".bar")
        .attr("fill", (barData: any) => {
          if (StatsComponent.selectedCategory === barData.category) return "#ff9800";
          const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === barData.category);
          return isSubscription ? "#d3d3d3" : "var(--color-primary)";
        })
        .attr("stroke", (barData: any) => StatsComponent.selectedCategory === barData.category ? "#f57c00" : "none")
        .attr("stroke-width", (barData: any) => StatsComponent.selectedCategory === barData.category ? 3 : 0);
      
      updateTransactionTable();
    });

  // Add value labels
  g.selectAll(".label")
    .data(categoryData)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => x(d.amount) + 5)
    .attr("y", d => (y(d.category) as number) + y.bandwidth() / 2)
    .style("font-size", "11px")
    .style("alignment-baseline", "middle")
    .text(d => d.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency + 
               " (" + ((d.amount / totalExpenses) * 100).toFixed(1) + "%)");

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(5))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y))
    .style("font-size", "11px");
}
/**
 * Create Category Treemap
 */
export function createCategoryTreemap(svg: any, width: number, height: number) {
  const filteredTransactions = StatsComponent.getFilteredTransactions();
  const categoryMap = new Map<string, number>();
  filteredTransactions
    .filter(t => Number(t.amount) < 0)
    .forEach(t => {
      const amount = Math.abs(Number(t.amount));
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + amount);
    });

  const data = {
    name: "root",
    children: Array.from(categoryMap.entries())
      .map(([name, value]) => ({name, value}))
  };

  const root = d3.hierarchy(data)
    .sum((d: any) => d.value)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  d3.treemap()
    .size([width, height])
    .padding(2)
    (root);

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const cells = svg.selectAll("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("transform", (d: any) => `translate(${d.x0},${d.y0})`);

  cells.append("rect")
    .attr("width", (d: any) => d.x1 - d.x0)
    .attr("height", (d: any) => d.y1 - d.y0)
    .attr("fill", (d: any, i: number) => color(i.toString()))
    .attr("opacity", 0.7)
    .attr("stroke", (d: any) => StatsComponent.selectedCategory === d.data.name ? "#0d47a1" : "var(--color-surface)")
    .attr("stroke-width", (d: any) => StatsComponent.selectedCategory === d.data.name ? 6 : 2)
    .style("cursor", "pointer")
    .on("click", function(event, d: any) {
      if (StatsComponent.selectedCategory === d.data.name) {
        StatsComponent.selectedCategory = "";
      } else {
        StatsComponent.selectedCategory = d.data.name;
      }
      
      // Update treemap borders
      svg.selectAll("rect")
        .attr("stroke", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? "#0d47a1" : "var(--color-surface)")
        .attr("stroke-width", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? 6 : 2);
      
      // Update Top-Kategorien chart colors
      const topCategoriesSvg = d3.select("#bi-dashboard-3-top-categories");
      topCategoriesSvg.selectAll(".bar")
        .attr("fill", (barData: any) => {
          if (StatsComponent.selectedCategory === barData.category) return "#ff9800";
          const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === barData.category);
          return isSubscription ? "#d3d3d3" : "var(--color-primary)";
        })
        .attr("stroke", (barData: any) => StatsComponent.selectedCategory === barData.category ? "#f57c00" : "none")
        .attr("stroke-width", (barData: any) => StatsComponent.selectedCategory === barData.category ? 3 : 0);
      
      updateTransactionTable();
    });

  // Category name
  cells.append("text")
    .attr("x", (d: any) => (d.x1 - d.x0) / 2)
    .attr("y", (d: any) => (d.y1 - d.y0) / 2 - 8)
    .style("text-anchor", "middle")
    .style("alignment-baseline", "middle")
    .style("font-size", "11px")
    .style("fill", "white")
    .style("font-weight", "bold")
    .text((d: any) => {
      const width = d.x1 - d.x0;
      const height = d.y1 - d.y0;
      if (width > 60 && height > 40) {
        return d.data.name;
      }
      return "";
    });

  // Value amount
  cells.append("text")
    .attr("x", (d: any) => (d.x1 - d.x0) / 2)
    .attr("y", (d: any) => (d.y1 - d.y0) / 2 + 8)
    .style("text-anchor", "middle")
    .style("alignment-baseline", "middle")
    .style("font-size", "10px")
    .style("fill", "white")
    .text((d: any) => {
      const width = d.x1 - d.x0;
      const height = d.y1 - d.y0;
      if (width > 60 && height > 40) {
        return d.data.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency;
      }
      return "";
    });
}
/**
 * Create Category Timeline Chart - Multi-line chart showing category trends over time
 */
export function createCategoryTimelineChart(svg: any, width: number, height: number) {
  const filteredTransactions = StatsComponent.getFilteredTransactions();
  
  // Check if we should hide this chart (only one month selected)
  if (filteredTransactions.length === 0) {
    svg.style("display", "none");
    d3.select("#category-timeline-title").style("display", "none");
    return;
  }

  // Get date range
  const dates = filteredTransactions.map(t => new Date(t.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  // Check if range is within one month
  const monthDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + 
                    (maxDate.getMonth() - minDate.getMonth());
  
  if (monthDiff === 0) {
    svg.style("display", "none");
    d3.select("#category-timeline-title").style("display", "none");
    return;
  }

  // Show chart
  svg.style("display", "block");
  d3.select("#category-timeline-title").style("display", "block");

  const rightMargin = width < 600 ? 20 : 120;
  const margin = {top: 20, right: rightMargin, bottom: 40, left: 60};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  svg.selectAll("*").remove();

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Aggregate by category and month
  const categoryMonthMap = new Map<string, Map<string, number>>();
  
  filteredTransactions
    .filter(t => Number(t.amount) < 0)
    .forEach(t => {
      const amount = Math.abs(Number(t.amount));
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!categoryMonthMap.has(t.category)) {
        categoryMonthMap.set(t.category, new Map());
      }
      const monthMap = categoryMonthMap.get(t.category)!;
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + amount);
    });

  // Get all categories sorted by total (to create consistent color mapping like treemap)
  const categoryTotals = new Map<string, number>();
  categoryMonthMap.forEach((monthMap, category) => {
    const total = Array.from(monthMap.values()).reduce((sum, val) => sum + val, 0);
    categoryTotals.set(category, total);
  });
  
  const allCategoriesSorted = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
  
  // Create color mapping based on sorted categories (same as treemap)
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  const categoryColorMap = new Map<string, string>();
  allCategoriesSorted.forEach((cat, i) => {
    categoryColorMap.set(cat, color(i.toString()));
  });

  // Get top 10 categories (or just selected category if filtered)
  let categoriesToShow: string[];
  if (StatsComponent.selectedCategory) {
    categoriesToShow = [StatsComponent.selectedCategory];
  } else {
    categoriesToShow = allCategoriesSorted.slice(0, 10);
  }

  // Generate all months in range
  const allMonths: string[] = [];
  let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  
  while (currentDate <= endDate) {
    allMonths.push(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Prepare data for lines
  const lineData = categoriesToShow.map(category => {
    const monthMap = categoryMonthMap.get(category) || new Map();
    return {
      category,
      values: allMonths.map(month => ({
        month,
        value: monthMap.get(month) || 0
      }))
    };
  });

  // Create scales
  const x = d3.scalePoint()
    .domain(allMonths)
    .range([0, chartWidth]);

  const maxValue = d3.max(lineData, d => d3.max(d.values, v => v.value)) as number;
  const y = d3.scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([chartHeight, 0]);

  // Create line generator
  const line = d3.line<any>()
    .x(d => x(d.month) as number)
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  // Draw lines
  lineData.forEach((d, i) => {
    const categoryColor = categoryColorMap.get(d.category) || color(i.toString());
    
    g.append("path")
      .datum(d.values)
      .attr("fill", "none")
      .attr("stroke", categoryColor)
      .attr("stroke-width", 2)
      .attr("d", line)
      .style("cursor", "pointer")
      .style("pointer-events", "stroke")
      .on("click", function(event: any) {
        event.stopPropagation();
        
        if (StatsComponent.selectedCategory === d.category) {
          StatsComponent.selectedCategory = "";
        } else {
          StatsComponent.selectedCategory = d.category;
        }
        
        // Update treemap selection
        const treemapSvg = d3.select("#bi-dashboard-3-treemap");
        treemapSvg.selectAll("rect")
          .attr("stroke", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? "#f57c00" : "var(--color-surface)")
          .attr("stroke-width", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? 6 : 2);
        
        // Update Top-Kategorien chart colors
        const topCategoriesSvg = d3.select("#bi-dashboard-3-top-categories");
        topCategoriesSvg.selectAll(".bar")
          .attr("fill", (barData: any) => {
            if (StatsComponent.selectedCategory === barData.category) return "#ff9800";
            const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === barData.category);
            return isSubscription ? "#d3d3d3" : "var(--color-primary)";
          })
          .attr("stroke", (barData: any) => StatsComponent.selectedCategory === barData.category ? "#f57c00" : "none")
          .attr("stroke-width", (barData: any) => StatsComponent.selectedCategory === barData.category ? 3 : 0);
        
        updateTransactionTable();
      });

    // Add dots
    g.selectAll(`.dot-${i}`)
      .data(d.values)
      .enter()
      .append("circle")
      .attr("class", `dot-${i}`)
      .attr("cx", v => x(v.month) as number)
      .attr("cy", v => y(v.value))
      .attr("r", 4)
      .attr("fill", categoryColor)
      .style("cursor", "pointer")
      .on("click", function(event: any) {
        event.stopPropagation();
        
        if (StatsComponent.selectedCategory === d.category) {
          StatsComponent.selectedCategory = "";
        } else {
          StatsComponent.selectedCategory = d.category;
        }
        
        // Update treemap selection
        const treemapSvg = d3.select("#bi-dashboard-3-treemap");
        treemapSvg.selectAll("rect")
          .attr("stroke", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? "#f57c00" : "var(--color-surface)")
          .attr("stroke-width", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? 6 : 2);
        
        // Update Top-Kategorien chart colors
        const topCategoriesSvg = d3.select("#bi-dashboard-3-top-categories");
        topCategoriesSvg.selectAll(".bar")
          .attr("fill", (barData: any) => {
            if (StatsComponent.selectedCategory === barData.category) return "#ff9800";
            const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === barData.category);
            return isSubscription ? "#d3d3d3" : "var(--color-primary)";
          })
          .attr("stroke", (barData: any) => StatsComponent.selectedCategory === barData.category ? "#f57c00" : "none")
          .attr("stroke-width", (barData: any) => StatsComponent.selectedCategory === barData.category ? 3 : 0);
        
        updateTransactionTable();
      })
      .append("title")
      .text(v => `${d.category}\n${v.month}\n${v.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);
  });

  // Add axes
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).tickValues(allMonths.filter((_, i) => i % Math.max(1, Math.floor(allMonths.length / 8)) === 0)))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)")
    .style("font-size", "10px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .style("font-size", "11px");

  // Add legend - hide on small screens
  if (width >= 600) {
    const legend = g.append("g")
      .attr("transform", `translate(${chartWidth + 10}, 0)`);

    lineData.forEach((d, i) => {
      const categoryColor = categoryColorMap.get(d.category) || color(i.toString());
      
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`)
        .style("cursor", "pointer")
        .on("click", function(event: any) {
          event.stopPropagation();
          
          if (StatsComponent.selectedCategory === d.category) {
            StatsComponent.selectedCategory = "";
          } else {
            StatsComponent.selectedCategory = d.category;
          }
          
          // Update treemap selection
          const treemapSvg = d3.select("#bi-dashboard-3-treemap");
          treemapSvg.selectAll("rect")
            .attr("stroke", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? "#f57c00" : "var(--color-surface)")
            .attr("stroke-width", (rectData: any) => StatsComponent.selectedCategory === rectData.data.name ? 6 : 2);
          
          // Update Top-Kategorien chart colors
          const topCategoriesSvg = d3.select("#bi-dashboard-3-top-categories");
          topCategoriesSvg.selectAll(".bar")
            .attr("fill", (barData: any) => {
              if (StatsComponent.selectedCategory === barData.category) return "#ff9800";
              const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === barData.category);
              return isSubscription ? "#d3d3d3" : "var(--color-primary)";
            })
            .attr("stroke", (barData: any) => StatsComponent.selectedCategory === barData.category ? "#f57c00" : "none")
            .attr("stroke-width", (barData: any) => StatsComponent.selectedCategory === barData.category ? 3 : 0);
          
          updateTransactionTable();
        });

      legendRow.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 10)
        .attr("y2", 10)
        .attr("stroke", categoryColor)
        .attr("stroke-width", 2);

      legendRow.append("text")
        .attr("x", 25)
        .attr("y", 10)
        .attr("dy", ".35em")
        .style("font-size", "10px")
        .text(d.category.length > 12 ? d.category.substring(0, 12) + "..." : d.category);
    });
  }
}
/**
 * Create Transaction Details Table
 */

/**
 * Show explanation why transaction is an outlier
 */
export function showOutlierAnalysis(transaction: any) {
  const outlierType = transaction.outlierType;
  const metadata = transaction.outlierMetadata;
  let reason = '';
  
  if (outlierType === 'iqr' && metadata) {
    const baseline = metadata.baseline;
    const amount = metadata.amount;
    const category = metadata.category || transaction.category;
    const difference = Math.abs(amount) - Math.abs(baseline);
    const percentOver = ((difference / Math.abs(baseline)) * 100).toFixed(0);
    
    reason = `<strong>IQR-Methode:</strong><br>` +
             `Baseline ${category}: ${baseline.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}<br>` +
             `${StatsComponent.translateService.instant('BI.qrExceedance')} ${difference.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency} (+${percentOver}%)`;
  } else if (outlierType === 'rare-category') {
    reason = StatsComponent.translateService.instant('BI.rareCategoryReason');
  } else {
    reason = StatsComponent.translateService.instant('BI.outlierDetected');
  }
  
  const [year, month, day] = transaction.date.split('-');
  const formattedDate = `${day}.${month}.${year}`;
  
  // Create custom modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--color-surface);
    padding: 25px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  modalContent.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--color-primary);">
      <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
      <h3 style="margin: 0; color: var(--color-primary); font-size: 18px;">${StatsComponent.translateService.instant('BI.whyOutlier')}</h3>
    </div>
    
    <div style="background: var(--color-warning-bg); padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid var(--color-warning);">
      ${reason}
    </div>
    
    <div style="background: var(--color-background); padding: 15px; border-radius: 5px; margin-bottom: 20px;">
      <div style="margin-bottom: 8px;"><strong>${StatsComponent.translateService.instant('BI.qrDate')}</strong> ${formattedDate}</div>
      <div style="margin-bottom: 8px;"><strong>${StatsComponent.translateService.instant('BI.qrCategory')}</strong> ${transaction.category}</div>
      <div style="margin-bottom: 8px;"><strong>${StatsComponent.translateService.instant('BI.qrAmount')}</strong> <span style="color: ${Number(transaction.amount) >= 0 ? '#4caf50' : '#f44336'}; font-weight: bold;">${Number(transaction.amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}</span></div>
      <div><strong>${StatsComponent.translateService.instant('BI.qrComment')}</strong> ${transaction.comment || '-'}</div>
    </div>
    
    <button id="closeOutlierModal" style="
      width: 100%;
      padding: 12px;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    ">Schließen</button>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close handlers
  const closeModal = () => document.body.removeChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.getElementById('closeOutlierModal')!.addEventListener('click', closeModal);
}
/**
 * Detect outlier transactions using multiple methods:
 * 
 * 1. IQR-Methode (Interquartile Range):
 *    - Berechnet Q1, Q3 und IQR für jede Kategorie
 *    - Markiert Ausgaben wenn HÖHER als Q3 + 1.2×IQR
 *    - Erfordert mindestens 4 Transaktionen pro Kategorie
 * 
 * 2. Kategorie-Nutzungsmuster:
 *    - (Kategorie nur in einem Monat ODER erscheint <3 Mal) UND Betrag > 100€
 * 
 * - Nur Ausgaben werden berücksichtigt (keine Income-Transaktionen)
 * - Ignoriert interne Konto-Transfers (Daily, Splurge, Smile, Fire)
 * - Ignoriert wiederkehrende Transaktionen (gleicher Betrag in 3+ Monaten)
 * 
 * Visuelle Markierung:
 * - Orange Hintergrund (#fff3e0)
 * - Orange linker Rand (4px, #ff9800)
 * - ⚠️ Warning-Symbol vor der Kategorie
 * 
 * Returns outliers Map and recurring Set
 */
export function detectOutliers(transactions: any[]): { outliers: Map<number, {type: string, metadata?: any}>, recurringTransactions: Set<number> } {
  const outliers = new Map<number, {type: string, metadata?: any}>();
  
  // First, identify recurring transactions (same amount appearing multiple times)
  const recurringTransactions = new Set<number>();
  const amountGroups = new Map<string, {amounts: number[], indices: number[], dates: string[]}>();
  
  transactions.forEach((t, index) => {
    if (t.account === 'Income') return;
    // Ignore internal account transfers
    if (['Daily', 'Splurge', 'Smile', 'Fire'].includes(t.category)) return;
    const amount = Math.abs(Number(t.amount));
    if (amount === 0) return;
    
    const key = `${t.account}_${t.category}`;
    if (!amountGroups.has(key)) {
      amountGroups.set(key, {amounts: [], indices: [], dates: []});
    }
    amountGroups.get(key)!.amounts.push(amount);
    amountGroups.get(key)!.indices.push(index);
    amountGroups.get(key)!.dates.push(t.date);
  });
  
  // Mark transactions as recurring if same amount appears in multiple different months
  amountGroups.forEach((group) => {
    // Group by similar amounts (within 5% tolerance)
    const amountClusters = new Map<number, {indices: number[], months: Set<string>}>();
    
    group.amounts.forEach((amount, i) => {
      let foundCluster = false;
      
      for (const [clusterAmount, cluster] of amountClusters.entries()) {
        // Check if amount is within 5% of cluster amount
        if (Math.abs(amount - clusterAmount) / clusterAmount <= 0.05) {
          cluster.indices.push(group.indices[i]);
          cluster.months.add(group.dates[i].substring(0, 7)); // YYYY-MM
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        amountClusters.set(amount, {
          indices: [group.indices[i]],
          months: new Set([group.dates[i].substring(0, 7)])
        });
      }
    });
    
    // Mark as recurring if same amount appears in 3+ different months
    amountClusters.forEach((cluster) => {
      if (cluster.months.size >= 3) {
        cluster.indices.forEach(idx => recurringTransactions.add(idx));
      }
    });
  });
  
  // Group transactions by category for both detection methods
  const categoryGroups = new Map<string, {amounts: number[], indices: number[], months: Set<string>}>();
  
  transactions.forEach((t, index) => {
    // Skip Income account but allow all other accounts including Mojo
    if (t.account === 'Income') return;
    // Ignore internal account transfers
    if (['@Daily', '@Splurge', '@Smile', '@Fire'].includes(t.category)) return;
    
    const amount = Number(t.amount);
    if (amount === 0) return; // Skip zero amounts
    
    // Group by category only (not account)
    const key = t.category;
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, {amounts: [], indices: [], months: new Set()});
    }
    categoryGroups.get(key)!.amounts.push(amount);
    categoryGroups.get(key)!.indices.push(index);
    categoryGroups.get(key)!.months.add(t.date.substring(0, 7)); // YYYY-MM
  });
  
  // METHOD 1: IQR detection for categories with sufficient data
  categoryGroups.forEach((group, key) => {
    if (group.amounts.length >= 4) {
      // Work with absolute values for IQR calculation
      const absAmounts = group.amounts.map(a => Math.abs(a));
      const sorted = [...absAmounts].sort((a, b) => a - b);
      const n = sorted.length;
      
      // Calculate Q1, Q3, and IQR on absolute values
      const q1Index = Math.floor(n * 0.25);
      const q3Index = Math.floor(n * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      
      // Outlier boundary (only upper bound) - threshold adjustable by user
      const upperBound = q3 + StatsComponent.iqrThreshold * iqr;
      
      // Mark outliers (only amounts HIGHER than usual)
      group.amounts.forEach((amount, i) => {
        const idx = group.indices[i];
        if (Math.abs(amount) > upperBound && !recurringTransactions.has(idx)) {
          outliers.set(idx, {
            type: 'iqr',
            metadata: { baseline: q3, upperBound: upperBound, amount: amount, category: key }
          });
        }
      });
    }
  });
  
  // METHOD 2: Category usage pattern detection
  categoryGroups.forEach((group, key) => {
    const totalOccurrences = group.amounts.length;
    const uniqueMonths = group.months.size;
    
    // Rule: (Category appears in only one month OR appears <3 times total) AND amount > 100€
    if (uniqueMonths === 1 || totalOccurrences < 3) {
      group.amounts.forEach((amount, i) => {
        const idx = group.indices[i];
        if (Math.abs(amount) > 100 && !recurringTransactions.has(idx)) {
          outliers.set(idx, { type: 'rare-category' });
        }
      });
    }
  });
  
  // Return both outliers and recurring info
  return { outliers, recurringTransactions };
}
export function createTransactionDetailsTable(container: any, width: number) {
  // IMPORTANT: Detect outliers on ALL transactions (not filtered by time)
  // This ensures consistent outlier detection regardless of time filter
  const allTransactions = AppStateService.instance.allTransactions || [];
  const { outliers: allOutliers, recurringTransactions: allRecurring } = detectOutliers(allTransactions);
  
  // Create a map from transaction unique key to outlier info
  const outlierMap = new Map<string, {type: string, isRecurring: boolean, metadata?: any}>();
  allTransactions.forEach((t, index) => {
    const key = `${t.date}_${t.account}_${t.category}_${t.amount}_${t.comment || ''}`;
    if (allOutliers.has(index)) {
      const outlierInfo = allOutliers.get(index)!;
      outlierMap.set(key, {
        type: outlierInfo.type,
        isRecurring: allRecurring.has(index),
        metadata: outlierInfo.metadata
      });
    }
  });
  
  // Get filtered transactions (respects time period)
  let filteredTransactions = StatsComponent.getFilteredTransactions();
  const totalBeforeCategoryFilter = filteredTransactions.length;
  
  // Apply category filter FIRST if selected
  if (StatsComponent.selectedCategory) {
    filteredTransactions = filteredTransactions.filter(t => t.category === StatsComponent.selectedCategory);
  }
  
  // Apply outlier info from the global detection to filtered transactions
  const transactionsWithOutliers = filteredTransactions.map((t) => {
    const key = `${t.date}_${t.account}_${t.category}_${t.amount}_${t.comment || ''}`;
    const outlierInfo = outlierMap.get(key);
    return {
      ...t,
      isOutlier: outlierInfo ? !outlierInfo.isRecurring : false, // Only show as outlier if NOT recurring
      outlierType: outlierInfo?.type || null,
      outlierMetadata: outlierInfo?.metadata || null,
      isRecurring: outlierInfo?.isRecurring || false
    };
  });
  
  // Count non-recurring outliers for display
  const outlierCount = transactionsWithOutliers.filter(t => t.isOutlier).length;
  
  // Filter controls container
  const controlsDiv = container.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("justify-content", "center")
    .style("gap", "10px")
    .style("margin-bottom", "15px");
  
  // Show selected category filter if active
  if (StatsComponent.selectedCategory) {
    const filterInfo = controlsDiv.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px")
      .style("padding", "10px")
      .style("background", "var(--color-info-surface)")
      .style("border-radius", "5px")
      .style("border", "2px solid var(--color-primary)");

    filterInfo.append("span")
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .style("color", "var(--color-primary)")
      .text(`${StatsComponent.translateService.instant('BI.filteredByCategory')} ${StatsComponent.selectedCategory}`);

    filterInfo.append("button")
      .style("padding", "5px 15px")
      .style("background", "var(--color-primary)")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "3px")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .text(StatsComponent.translateService.instant('BI.clearFilter'))
      .on("click", function() {
        StatsComponent.selectedCategory = "";
        updateTransactionTable();
      });
  }
  
  // Outlier filter toggle (only show if there are outliers)
  if (outlierCount > 0) {
    const outlierFilterDiv = controlsDiv.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px")
      .style("padding", "10px")
      .style("background", StatsComponent.showOnlyOutliers ? "var(--color-warning-bg)" : "var(--color-background)")
      .style("border-radius", "5px")
      .style("border", `2px solid ${StatsComponent.showOnlyOutliers ? "#ff9800" : "var(--color-border)"}`);
    
    outlierFilterDiv.append("span")
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .style("color", "var(--color-text-secondary)")
      .html(`⚠️ ${StatsComponent.translateService.instant('BI.labelOutliers')} (${outlierCount})`);
    
    outlierFilterDiv.append("button")
      .style("padding", "5px 15px")
      .style("background", StatsComponent.showOnlyOutliers ? "#ff9800" : "var(--color-text-muted)")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "3px")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .text(StatsComponent.showOnlyOutliers ? StatsComponent.translateService.instant('BI.showAllButton') : StatsComponent.translateService.instant('BI.showOnlyOutliersButton'))
      .on("click", function() {
        StatsComponent.showOnlyOutliers = !StatsComponent.showOnlyOutliers;
        updateTransactionTable();
      });
  }
  
  // IQR Threshold control
  const thresholdDiv = controlsDiv.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "8px")
    .style("padding", "10px")
    .style("background", "var(--color-background)")
    .style("border-radius", "5px")
    .style("border", "2px solid var(--color-border)");
  
  thresholdDiv.append("span")
    .style("font-size", "13px")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .text(StatsComponent.translateService.instant('BI.labelIQRThreshold') + ":");
  
  const thresholdInput = thresholdDiv.append("input")
    .attr("type", "number")
    .attr("min", "0.5")
    .attr("max", "3.0")
    .attr("step", "0.1")
    .attr("value", StatsComponent.iqrThreshold)
    .style("width", "60px")
    .style("padding", "5px")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "3px")
    .style("font-size", "12px")
    .on("change", function() {
      const newValue = parseFloat((this as HTMLInputElement).value);
      if (newValue >= 0.5 && newValue <= 3.0) {
        StatsComponent.iqrThreshold = newValue;
        localStorage.setItem('iqrThreshold', newValue.toString());
        updateTransactionTable();
      }
    });
  
  thresholdDiv.append("span")
    .style("font-size", "11px")
    .style("color", "var(--color-text-hint)")
    .text("(0.5-3.0)");
  
  // Now transactionsWithOutliers already has the category filter applied
  filteredTransactions = transactionsWithOutliers;
  
  // Apply outlier filter if active
  if (StatsComponent.showOnlyOutliers) {
    filteredTransactions = filteredTransactions.filter(t => t.isOutlier);
  }
  
  // Sort transactions based on current sort settings
  const recentTransactions = filteredTransactions
    .slice()
    .sort((a, b) => {
      let comparison = 0;
      
      switch (StatsComponent.dashboard3TableSortColumn) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'account':
          comparison = a.account.localeCompare(b.account);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'amount':
          comparison = Number(a.amount) - Number(b.amount);
          break;
        case 'comment':
          comparison = (a.comment || "").localeCompare(b.comment || "");
          break;
      }
      
      return StatsComponent.dashboard3TableSortOrder === 'desc' ? -comparison : comparison;
    });

  // Info bar with transaction count and total
  const infoBar = container.append("div")
    .style("display", "flex")
    .style("justify-content", "flex-start")
    .style("align-items", "center")
    .style("margin-bottom", "15px")
    .style("padding", "10px")
    .style("background-color", "var(--color-background)")
    .style("border-radius", "5px");

  infoBar.append("span")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .html(() => {
      const total = recentTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalColor = total >= 0 ? "#4caf50" : "#f44336";
      return `${recentTransactions.length} ${StatsComponent.translateService.instant('BI.labelTransactions')} | ${StatsComponent.translateService.instant('BI.labelTotal')}: <span style="color: ${totalColor};">${total.toFixed(2)} ${AppStateService.instance.currency}</span>`;
    });

  const tableDiv = container.append("div")
    .style("width", "100%")
    .style("max-height", "400px")
    .style("overflow-y", "auto")
    .style("overflow-x", "auto");

  const table = tableDiv.append("table")
    .style("width", "100%")
    .style("min-width", "600px")
    .style("border-collapse", "collapse")
    .style("background", "var(--color-surface)")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  const thead = table.append("thead");
  const tbody = table.append("tbody");

  // Create sortable column headers
  const headerRow = thead.append("tr");
  const columns = [
    { key: 'date', label: StatsComponent.translateService.instant('BI.columnDate') },
    { key: 'account', label: StatsComponent.translateService.instant('BI.columnAccount') },
    { key: 'category', label: StatsComponent.translateService.instant('BI.columnCategory') },
    { key: 'amount', label: StatsComponent.translateService.instant('BI.columnAmount') },
    { key: 'comment', label: StatsComponent.translateService.instant('BI.columnComment') }
  ];

  columns.forEach(col => {
    const th = headerRow.append("th")
      .style("padding", "12px")
      .style("text-align", "left")
      .style("background", "var(--color-primary)")
      .style("color", "white")
      .style("font-size", "13px")
      .style("position", "sticky")
      .style("top", "0")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .on("click", () => {
        if (StatsComponent.dashboard3TableSortColumn === col.key) {
          // Toggle sort order
          StatsComponent.dashboard3TableSortOrder = 
            StatsComponent.dashboard3TableSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          // New column, default to descending
          StatsComponent.dashboard3TableSortColumn = col.key;
          StatsComponent.dashboard3TableSortOrder = 'desc';
        }
        updateTransactionTable();
      })
      .on("mouseover", function() {
        d3.select(this).style("background", "var(--color-primary-active)");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "var(--color-primary)");
      });

    // Column label and sort indicator
    th.append("span")
      .text(col.label);

    if (StatsComponent.dashboard3TableSortColumn === col.key) {
      th.append("span")
        .style("margin-left", "5px")
        .style("font-size", "12px")
        .text(StatsComponent.dashboard3TableSortOrder === 'asc' ? '▲' : '▼');
    }
  });

  // Rows
  const rows = tbody.selectAll("tr")
    .data(recentTransactions)
    .enter()
    .append("tr")
    .style("border-bottom", "1px solid #ddd")
    .style("background", (d: any) => d.isOutlier ? "var(--color-warning-bg)" : "transparent")
    .style("border-left", (d: any) => d.isOutlier ? "4px solid #ff9800" : "none")
    .style("cursor", (d: any) => d.isOutlier ? "pointer" : "default")
    .on("click", function(event: any, d: any) {
      if (d.isOutlier) {
        showOutlierAnalysis(d);
      }
    });

  rows.append("td")
    .style("padding", "10px")
    .style("font-size", "12px")
    .style("min-width", "90px")
    .style("white-space", "nowrap")
    .text(d => {
      const [year, month, day] = d.date.split('-');
      return `${day}.${month}.${year}`;
    });

  rows.append("td")
    .style("padding", "10px")
    .style("font-size", "12px")
    .text(d => d.account);

  rows.append("td")
    .style("padding", "10px")
    .style("font-size", "12px")
    .html((d: any) => d.isOutlier ? `⚠️ ${d.category}` : d.category);

  rows.append("td")
    .style("padding", "10px")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("min-width", "100px")
    .style("white-space", "nowrap")
    .style("color", d => Number(d.amount) >= 0 ? "#4caf50" : "#f44336")
    .text(d => Number(d.amount).toFixed(2) + " " + AppStateService.instance.currency);

  rows.append("td")
    .style("padding", "10px")
    .style("font-size", "12px")
    .style("min-width", "150px")
    .style("max-width", "300px")
    .style("word-wrap", "break-word")
    .style("overflow-wrap", "break-word")
    .text(d => d.comment || "-");
  
  // Restore scroll position after rendering
  setTimeout(() => {
    const container = document.getElementById("chart-container");
    if (container && StatsComponent.savedScrollPosition > 0) {
      container.scrollTop = StatsComponent.savedScrollPosition;
      StatsComponent.savedScrollPosition = 0; // Reset after restoration
    }
  }, 50);
}
/**
 * Update only the transaction table section without refreshing entire dashboard
 */
export function updateTransactionTable() {
  const container = document.getElementById("chart-container");
  if (!container) return;
  
  const width = container.clientWidth;
  const chartWidth = width - 30;
  
  // Update bar chart selection
  d3.selectAll(".bar")
    .attr("fill", function(d: any) {
      if (StatsComponent.selectedCategory === d.category) return "#ff9800";
      const isSubscription = AppStateService.instance.allSubscriptions?.some(sub => sub.category === d.category);
      return isSubscription ? "#d3d3d3" : "var(--color-primary)";
    })
    .attr("stroke", function(d: any) {
      return StatsComponent.selectedCategory === d.category ? "#f57c00" : "none";
    })
    .attr("stroke-width", function(d: any) {
      return StatsComponent.selectedCategory === d.category ? 3 : 0;
    });
  
  // Update treemap selection
  d3.selectAll("#transaction-table-section").selectAll("rect")
    .each(function(d: any) {
      const rect = d3.select(this);
      if (d && d.data && d.data.name) {
        const isSelected = StatsComponent.selectedCategory === d.data.name;
        if (isSelected) {
          rect.attr("fill", "#ff9800");
          rect.attr("stroke", "#f57c00");
          rect.attr("stroke-width", 4);
        }
      }
    });
  
  // Update treemap cells (find the treemap svg)
  const treemapCells = d3.selectAll("g").filter(function() {
    const parent = d3.select(this.parentNode as any);
    return parent.node() && (parent.node() as any).tagName === "svg";
  });
  
  treemapCells.select("rect")
    .attr("stroke", function(d: any) {
      if (d && d.data && d.data.name) {
        return StatsComponent.selectedCategory === d.data.name ? "#0d47a1" : "white";
      }
      return "white";
    })
    .attr("stroke-width", function(d: any) {
      if (d && d.data && d.data.name) {
        return StatsComponent.selectedCategory === d.data.name ? 6 : 2;
      }
      return 2;
    });
  
  // Update category timeline chart
  const timelineSvg = d3.select("#category-timeline-svg");
  if (timelineSvg.node()) {
    createCategoryTimelineChart(timelineSvg, chartWidth, 400);
  }
  
  // Clear and recreate just the table section
  const tableSection = d3.select("#transaction-table-section");
  tableSection.selectAll("*").remove();
  
  tableSection.append("h3")
    .style("color", "var(--color-text)")
    .style("margin-top", "30px")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text("Detailtabelle: Einzeltransaktionen");
  
  createTransactionDetailsTable(tableSection, chartWidth);
}

// ===================================================================
// PRÄSKRIPTIVE ANALYTICS - WHAT-IF SCENARIOS
// ===================================================================

/**
 * Create Präskriptive Analytics Dashboard
 * Implements: What-if scenarios, decision support, action simulation
 */
