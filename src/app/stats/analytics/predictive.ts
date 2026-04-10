import { StatsComponent } from '../stats.component';
import * as d3 from 'd3';
import { AppStateService } from '../../shared/services/app-state.service';

export function createPraediktiveAnalytics(container: any) {
  const contentDiv = container.append("div")
    .attr("id", "praediktive-main-container")
    .style("width", "100%")
    .style("padding", "20px")
    .style("padding-bottom", "80px")
    .style("box-sizing", "border-box");

  contentDiv.append("h2")
    .style("color", "#1976d2")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.praediktiveTitle'));

  contentDiv.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("text-align", "center")
    .style("margin-bottom", "30px")
    .style("font-style", "italic")
    .text(StatsComponent.translateService.instant('BI.praediktiveDescription'));

  // Mojo Goal Achievement Forecast (first)
  createMojoGoalForecast(contentDiv);

  // Configuration Panel (below Mojo forecast)
  createPredictiveConfigPanel(contentDiv);

  // Metric Prediction Selector (with container ID)
  const metricContainer = contentDiv.append("div").attr("id", "metric-selector-container");
  createMetricPredictionSelector(metricContainer);

  // Main Prediction Chart (with container ID)
  const chartContainer = contentDiv.append("div").attr("id", "prediction-chart-container");
  createPredictionChart(chartContainer);

  // Additional Predictions Table (with container ID)
  const tableContainer = contentDiv.append("div").attr("id", "prediction-table-container");
  createPredictionSummaryTable(tableContainer);
}/**
 * Create configuration panel for predictive parameters
 */
export function createPredictiveConfigPanel(container: any) {
  const configPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  configPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praediktiveForecastParameters'));

  const controlsDiv = configPanel.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(250px, 1fr))")
    .style("gap", "20px");

  // Calculate max available months from transaction history
  const earliestDate = AppStateService.instance.allTransactions.reduce((earliest, t) => {
    const date = new Date(t.date);
    return date < earliest ? date : earliest;
  }, new Date());
  
  const today = new Date();
  const monthsDiff = (today.getFullYear() - earliestDate.getFullYear()) * 12 + 
                     (today.getMonth() - earliestDate.getMonth());
  const maxAvailableMonths = Math.max(3, monthsDiff); // At least 3 months
  
  // Initialize predictiveMonthsHistory to 12 on first load (or max available if less)
  if (StatsComponent.predictiveMonthsHistory > maxAvailableMonths) {
    StatsComponent.predictiveMonthsHistory = maxAvailableMonths;
  } else if (StatsComponent.predictiveMonthsHistory === 12 && maxAvailableMonths >= 12) {
    // Only set to 12 if it's still at the default value of 12
    StatsComponent.predictiveMonthsHistory = 12;
  }
  // Otherwise keep user's selected value

  // Historical months control
  const historyControl = controlsDiv.append("div");
  historyControl.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "5px")
    .text(`Historische Monate (Max: ${maxAvailableMonths}):`);
  
  historyControl.append("input")
    .attr("type", "range")
    .attr("min", "3")
    .attr("max", maxAvailableMonths.toString())
    .attr("value", Math.min(StatsComponent.predictiveMonthsHistory, maxAvailableMonths))
    .style("width", "100%")
    .on("input", function() {
      StatsComponent.predictiveMonthsHistory = parseInt(this.value);
      d3.select("#history-value").text(this.value);
    })
    .on("change", () => {
      // Prevent change during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        return;
      }
      
      refreshPredictiveMetrics();
    });
  
  historyControl.append("span")
    .attr("id", "history-value")
    .style("color", "var(--color-text-secondary)")
    .text(Math.min(StatsComponent.predictiveMonthsHistory, maxAvailableMonths));

  // Future months control
  const futureControl = controlsDiv.append("div");
  futureControl.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "5px")
    .text(StatsComponent.translateService.instant('BI.praediktiveForecastMonths'));
  
  futureControl.append("input")
    .attr("type", "range")
    .attr("min", "1")
    .attr("max", "12")
    .attr("value", StatsComponent.predictiveMonthsFuture)
    .style("width", "100%")
    .on("input", function() {
      StatsComponent.predictiveMonthsFuture = parseInt(this.value);
      d3.select("#future-value").text(this.value);
    })
    .on("change", () => {
      // Prevent change during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        return;
      }
      
      refreshPredictiveMetrics();
    });
  
  futureControl.append("span")
    .attr("id", "future-value")
    .style("color", "var(--color-text-secondary)")
    .text(StatsComponent.predictiveMonthsFuture);

  // Alpha parameter control (exponential smoothing)
  const alphaControl = controlsDiv.append("div");
  alphaControl.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "5px")
    .text(StatsComponent.translateService.instant('BI.praediktiveAlpha'));
  
  alphaControl.append("input")
    .attr("type", "range")
    .attr("min", "0.1")
    .attr("max", "0.9")
    .attr("step", "0.1")
    .attr("value", StatsComponent.predictiveAlpha)
    .style("width", "100%")
    .on("input", function() {
      StatsComponent.predictiveAlpha = parseFloat(this.value);
      d3.select("#alpha-value").text(this.value);
    })
    .on("change", () => {
      // Prevent change during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        return;
      }
      
      refreshPredictiveMetrics();
    });
  
  alphaControl.append("span")
    .attr("id", "alpha-value")
    .style("color", "var(--color-text-secondary)")
    .text(StatsComponent.predictiveAlpha.toFixed(1));
}/**
 * Create Mojo Goal Achievement Forecast
 */
export function createMojoGoalForecast(container: any) {
  const mojoPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  mojoPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praediktiveMojoTitle'));

  // Get Mojo data from FireComponent
  const currentMojoBalance = AppStateService.instance.mojo.amount;
  const mojoGoalAmount = AppStateService.instance.mojo.target;

  // Get Mojo transactions from last 3 months to calculate contribution rate
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  
  const mojoTransactions = AppStateService.instance.allTransactions.filter(t => 
    t.category === '@Mojo' && Number(t.amount) < 0 && new Date(t.date) >= threeMonthsAgo
  );

  // Calculate average monthly contribution (last 3 months)
  const monthlyContributions = new Map<string, number>();
  mojoTransactions.forEach(t => {
    const month = t.date.substring(0, 7);
    monthlyContributions.set(month, (monthlyContributions.get(month) || 0) + Math.abs(Number(t.amount)));
  });

  const avgMonthlyContribution = monthlyContributions.size > 0
    ? Array.from(monthlyContributions.values()).reduce((sum, v) => sum + v, 0) / monthlyContributions.size
    : 0;

  // Calculate months to goal
  const remainingAmount = mojoGoalAmount - currentMojoBalance;
  const monthsToGoal = avgMonthlyContribution > 0
    ? Math.ceil(remainingAmount / avgMonthlyContribution)
    : Infinity;

  // Calculate target date
  const targetDate = avgMonthlyContribution > 0
    ? new Date(today.getFullYear(), today.getMonth() + monthsToGoal, 1)
    : null;

  // Display forecast
  const resultsDiv = mojoPanel.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(200px, 1fr))")
    .style("gap", "15px");

  // Current balance
  const balanceBox = resultsDiv.append("div")
    .style("padding", "15px")
    .style("background", "var(--color-info-surface)")
    .style("border-radius", "8px")
    .style("text-align", "center");
  
  balanceBox.append("div")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "5px")
    .text(StatsComponent.translateService.instant('BI.currentMojoBalance'));
  
  balanceBox.append("div")
    .style("font-size", "24px")
    .style("font-weight", "bold")
    .style("color", "#1976d2")
    .text(currentMojoBalance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

  // Average contribution
  const contribBox = resultsDiv.append("div")
    .style("padding", "15px")
    .style("background", "#f3e5f5")
    .style("border-radius", "8px")
    .style("text-align", "center");
  
  contribBox.append("div")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "5px")
    .text(StatsComponent.translateService.instant('BI.avgMonthlyContribution'));
  
  contribBox.append("div")
    .style("font-size", "24px")
    .style("font-weight", "bold")
    .style("color", "#7b1fa2")
    .text(avgMonthlyContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

  // Goal
  const goalBox = resultsDiv.append("div")
    .style("padding", "15px")
    .style("background", "#fff3e0")
    .style("border-radius", "8px")
    .style("text-align", "center");
  
  goalBox.append("div")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "5px")
    .text(StatsComponent.translateService.instant('BI.savingsGoal'));
  
  goalBox.append("div")
    .style("font-size", "24px")
    .style("font-weight", "bold")
    .style("color", "#f57c00")
    .text(mojoGoalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

  // Prediction
  const predictionBox = resultsDiv.append("div")
    .style("padding", "15px")
    .style("background", monthsToGoal !== Infinity ? "var(--color-success-surface-light)" : "#ffebee")
    .style("border-radius", "8px")
    .style("text-align", "center");
  
  predictionBox.append("div")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "5px")
    .text(StatsComponent.translateService.instant('BI.estimatedGoalCompletion'));
  
  if (currentMojoBalance >= mojoGoalAmount) {
    predictionBox.append("div")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("color", "var(--color-success-dark)")
      .text(StatsComponent.translateService.instant('BI.praeskriptiveAlreadyReached'));
  } else if (monthsToGoal !== Infinity) {
    predictionBox.append("div")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("color", "var(--color-success-dark)")
      .text(targetDate ? `${targetDate.toLocaleDateString('de-DE', {month: 'long', year: 'numeric'})}` : "N/A");
    
    predictionBox.append("div")
      .style("font-size", "14px")
      .style("color", "var(--color-text-secondary)")
      .style("margin-top", "5px")
      .text(`(in ca. ${monthsToGoal} Monaten)`);
  } else {
    predictionBox.append("div")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("color", "#c62828")
      .text(StatsComponent.translateService.instant('BI.noPayments'));
  }
}/**
 * Refresh only the predictive metrics (chart and table) without reloading entire page
 */
export function refreshPredictiveMetrics() {
  // Clear and recreate metric selector
  const metricContainer = d3.select("#metric-selector-container");
  if (!metricContainer.empty()) {
    metricContainer.html("");
    createMetricPredictionSelector(metricContainer);
  }

  // Clear and recreate chart
  const chartContainer = d3.select("#prediction-chart-container");
  if (!chartContainer.empty()) {
    chartContainer.html("");
    createPredictionChart(chartContainer);
  }

  // Clear and recreate table
  const tableContainer = d3.select("#prediction-table-container");
  if (!tableContainer.empty()) {
    tableContainer.html("");
    createPredictionSummaryTable(tableContainer);
  }
}/**
 * Create metric prediction selector
 */
export function createMetricPredictionSelector(container: any) {
  const selectorPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  selectorPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praediktiveSelectMetric'));

  const metricsDiv = selectorPanel.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("flex-wrap", "wrap")
    .style("justify-content", "center");

  const metrics = [
    { id: 'savings-rate', label: StatsComponent.translateService.instant('BI.savingsRate') },
    { id: 'total-expenses', label: StatsComponent.translateService.instant('BI.totalExpenses') },
    { id: 'net-worth', label: StatsComponent.translateService.instant('BI.netWorth') },
    { id: 'category-spending', label: StatsComponent.translateService.instant('BI.categorySpending') }
  ];

  metrics.forEach(metric => {
    const button = metricsDiv.append("button")
      .attr("data-metric-id", metric.id)
      .style("padding", "12px 24px")
      .style("border-radius", "8px")
      .style("border", "2px solid " + (StatsComponent.predictiveSelectedMetric === metric.id ? "#1976d2" : "#ddd"))
      .style("background", StatsComponent.predictiveSelectedMetric === metric.id ? "var(--color-info-surface)" : "var(--color-surface)")
      .style("cursor", "pointer")
      .style("transition", "all 0.3s")
      .style("font-size", "14px")
      .style("font-weight", StatsComponent.predictiveSelectedMetric === metric.id ? "bold" : "normal")
      .text(metric.label)
      .on("click", () => {
        StatsComponent.predictiveSelectedMetric = metric.id;
        refreshPredictiveMetrics();
      })
      .on("mouseover", function() {
        if (StatsComponent.predictiveSelectedMetric !== metric.id) {
          d3.select(this)
            .style("border-color", "#1976d2")
            .style("background", "#f5f5f5");
        }
      })
      .on("mouseout", function() {
        if (StatsComponent.predictiveSelectedMetric !== metric.id) {
          d3.select(this)
            .style("border-color", "#ddd")
            .style("background", "var(--color-surface)");
        }
      });
  });

  // Category selector for category-spending metric
  if (StatsComponent.predictiveSelectedMetric === 'category-spending') {
    const categorySelectorDiv = selectorPanel.append("div")
      .style("margin-top", "20px")
      .style("padding", "15px")
      .style("background", "#f5f5f5")
      .style("border-radius", "8px");

    categorySelectorDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text(StatsComponent.translateService.instant('BI.praediktiveSelectCategory'));

    // Get all categories with expenses
    const categoryTotals = new Map<string, number>();
    AppStateService.instance.allTransactions.filter(t => Number(t.amount) < 0).forEach(t => {
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + Math.abs(Number(t.amount)));
    });

    const categories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat)
      .filter(cat => cat); // Include all categories

    // Set default if not already set or if empty string
    if ((!StatsComponent.predictiveSelectedCategory || StatsComponent.predictiveSelectedCategory === '') && categories.length > 0) {
      StatsComponent.predictiveSelectedCategory = categories[0];
    }

    const select = categorySelectorDiv.append("select")
      .style("width", "100%")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        StatsComponent.predictiveSelectedCategory = this.value;
        refreshPredictiveMetrics();
      });

    categories.forEach(cat => {
      select.append("option")
        .attr("value", cat)
        .property("selected", cat === StatsComponent.predictiveSelectedCategory)
        .text(cat);
    });
  }
}/**
 * Create main prediction chart with historical data and forecast
 */
export function createPredictionChart(container: any) {
  const chartPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  chartPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praediktiveTimeseriesTitle'));

  // Get container width dynamically
  const containerWidth = (chartPanel.node() as HTMLElement).getBoundingClientRect().width;
  const isMobile = containerWidth < 600;
  const width = Math.max(isMobile ? 300 : 600, containerWidth - 40); // Responsive min width
  const height = Math.min(600, Math.max(300, width * (isMobile ? 0.8 : 0.5))); // Taller on mobile
  const margin = isMobile 
    ? {top: 20, right: 20, bottom: 60, left: 50} // Minimal right margin on mobile (legend hidden)
    : {top: 20, right: 150, bottom: 80, left: 80};

  const svg = chartPanel.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("max-width", "100%")
    .style("height", "auto");

  // Get historical data based on selected metric
  const historicalData = getPredictiveHistoricalData(StatsComponent.predictiveSelectedMetric);
  if (historicalData.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "var(--color-text-hint)")
      .style("font-size", "16px")
      .text(StatsComponent.translateService.instant('BI.praediktiveNotEnoughData'));
    return;
  }

  // Calculate predictions using different methods
  const predictions = calculatePredictions(historicalData);
  // Combine historical and prediction data
  const allData = [...historicalData, ...predictions.linear, ...predictions.exponential];
  
  // Calculate min/max with 10% padding at top
  const dataMin = Math.min(d3.min(allData, (d: any) => d.value) as number, 0);
  const dataMax = d3.max(allData, (d: any) => d.value) as number;
  const yPadding = (dataMax - dataMin) * 0.1; // 10% padding
  
  // Scales
  const xScale = d3.scaleTime()
    .domain(d3.extent(allData, (d: any) => new Date(d.month + "-01")) as [Date, Date])
    .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([
      dataMin,
      dataMax + yPadding // Add 10% space at top
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%m/%y") as any))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)");

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale));

  // Zero baseline reference line
  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", yScale(0))
    .attr("y2", yScale(0))
    .attr("stroke", "var(--color-text-hint)")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .attr("opacity", 0.5);

  // Line generators
  const line = d3.line()
    .x((d: any) => xScale(new Date(d.month + "-01")))
    .y((d: any) => yScale(d.value));
  
  const trendLine = d3.line()
    .x((d: any) => xScale(new Date(d.month + "-01")))
    .y((d: any) => yScale(d.value))
    .curve(d3.curveCatmullRom.alpha(0.5)); // Smooth Catmull-Rom spline

  // Historical line (solid)
  svg.append("path")
    .datum(historicalData)
    .attr("fill", "none")
    .attr("stroke", "#1976d2")
    .attr("stroke-width", 3)
    .attr("d", line as any);
  
  // Vertical line at last historical month (prediction start indicator)
  const lastHistoricalDate = new Date(historicalData[historicalData.length - 1].month + "-01");
  svg.append("line")
    .attr("x1", xScale(lastHistoricalDate))
    .attr("x2", xScale(lastHistoricalDate))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "var(--color-text-hint)")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .attr("opacity", 0.5);
  
  // Add historical trend line using quadratic regression
  const quadraticRegression = (data: any[]): any[] => {
    const n = data.length;
    if (n < 3) return [];
    
    // Convert month strings to dates and normalize x values (0 to 1)
    const dates = data.map(d => new Date(d.month + "-01"));
    const minTime = dates[0].getTime();
    const maxTime = dates[n - 1].getTime();
    const timeRange = maxTime - minTime;
    
    const points = data.map((d, i) => ({
      x: i / (n - 1),
      y: d.value
    }));
    
    // Set up matrices for least squares: Ax = b
    // For quadratic: y = ax² + bx + c
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;
    
    points.forEach(p => {
      const x = p.x, x2 = x * x, x3 = x2 * x, x4 = x3 * x;
      const y = p.y;
      
      sumX += x;
      sumX2 += x2;
      sumX3 += x3;
      sumX4 += x4;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x2 * y;
    });
    
    // Solve 3x3 system using Cramer's rule
    const A = [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4]
    ];
    const b = [sumY, sumXY, sumX2Y];
    
    const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
                A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
                A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    
    if (Math.abs(det) < 1e-10) return [];
    
    const c = (b[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
              b[1] * (A[0][1] * A[2][2] - A[0][2] * A[2][1]) +
              b[2] * (A[0][1] * A[1][2] - A[0][2] * A[1][1])) / det;
              
    const bCoeff = (A[0][0] * (b[1] * A[2][2] - b[2] * A[1][2]) -
                    A[0][1] * (b[0] * A[2][2] - b[2] * A[2][0]) +
                    A[0][2] * (b[0] * A[1][2] - b[1] * A[2][0])) / det;
                    
    const a = (A[0][0] * (A[1][1] * b[2] - A[1][2] * b[1]) -
              A[0][1] * (A[1][0] * b[2] - A[1][2] * b[0]) +
              A[0][2] * (A[1][0] * b[1] - A[1][1] * b[0])) / det;
    
    // Generate smooth curve points with actual Date objects for smooth plotting
    const result = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      const y = a * x * x + bCoeff * x + c;
      const time = minTime + x * timeRange;
      result.push({ 
        month: time, // Use timestamp directly for smooth interpolation
        value: y 
      });
    }
    
    return result;
  };
  
  const historicalTrend = quadraticRegression(historicalData);
  
  if (historicalTrend.length > 0) {
    const smoothTrendLine = d3.line()
      .x((d: any) => xScale(new Date(d.month)))
      .y((d: any) => yScale(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5));
      
    svg.append("path")
      .datum(historicalTrend)
      .attr("fill", "none")
      .attr("stroke", "#ff9800")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.8)
      .attr("d", smoothTrendLine as any);
  }

  // Confidence band for linear regression (hidden by default, exponential is shown)
  // Uncomment to show linear confidence band instead
  /*
  if (predictions.confidence && predictions.confidence.upper.length > 0) {
    const areaGenerator = d3.area()
      .x((d: any) => xScale(new Date(d.month + "-01")))
      .y0((d: any, i: number) => yScale(predictions.confidence.lower[i].value))
      .y1((d: any) => yScale(d.value));
    
    svg.append("path")
      .datum(predictions.confidence.upper)
      .attr("fill", "#f44336")
      .attr("opacity", 0.2)
      .attr("d", areaGenerator as any);
    
    // Add outer confidence band boundaries
    svg.append("path")
      .datum(predictions.confidence.upper)
      .attr("fill", "none")
      .attr("stroke", "#f44336")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.3)
      .attr("d", line as any);
      
    svg.append("path")
      .datum(predictions.confidence.lower)
      .attr("fill", "none")
      .attr("stroke", "#f44336")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.3)
      .attr("d", line as any);
  }
  */
  
  // Linear regression prediction (dashed red) - include last historical point for continuity
  const linearWithConnection = [historicalData[historicalData.length - 1], ...predictions.linear];
  svg.append("path")
    .datum(linearWithConnection)
    .attr("fill", "none")
    .attr("stroke", "#f44336")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("d", line as any);

  // Exponential smoothing prediction (dashed green) - include last historical point for continuity
  const exponentialWithConnection = [historicalData[historicalData.length - 1], ...predictions.exponential];
  svg.append("path")
    .datum(exponentialWithConnection)
    .attr("fill", "none")
    .attr("stroke", "#4caf50")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("d", line as any);

  // AI Ensemble prediction (dashed purple) - average of linear and exponential
  const ensembleWithConnection = [historicalData[historicalData.length - 1], ...predictions.ensemble];
  svg.append("path")
    .datum(ensembleWithConnection)
    .attr("fill", "none")
    .attr("stroke", "var(--color-accent-purple)")
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "5,5")
    .attr("d", line as any);

  // ARIMA prediction (dashed cyan) - time series model
  if (predictions.arima && predictions.arima.length > 0) {
    const arimaWithConnection = [historicalData[historicalData.length - 1], ...predictions.arima];
    svg.append("path")
      .datum(arimaWithConnection)
      .attr("fill", "none")
      .attr("stroke", "#00bcd4")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "3,3")
      .attr("d", line as any);
  }

  // Legend (only show on larger screens)
  if (!isMobile) {
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);

    legend.append("line")
      .attr("x1", 0).attr("x2", 30)
      .attr("y1", 0).attr("y2", 0)
      .style("stroke", "#1976d2")
      .style("stroke-width", 3);
    legend.append("text")
      .attr("x", 35).attr("y", 5)
      .style("font-size", "12px")
      .text(StatsComponent.translateService.instant('BI.praediktiveLegendHistorical'));

    legend.append("line")
      .attr("x1", 0).attr("x2", 30)
      .attr("y1", 25).attr("y2", 25)
      .style("stroke", "#ff9800")
      .style("stroke-width", 2)
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0.7);
    legend.append("text")
      .attr("x", 35).attr("y", 30)
      .style("font-size", "12px")
      .text("Historical Trend");

    legend.append("line")
      .attr("x1", 0).attr("x2", 30)
      .attr("y1", 50).attr("y2", 50)
      .style("stroke", "#f44336")
      .style("stroke-width", 2)
      .style("stroke-dasharray", "5,5");
    legend.append("text")
      .attr("x", 35).attr("y", 55)
      .style("font-size", "12px")
      .text(StatsComponent.translateService.instant('BI.praediktiveLegendLinear'));

    legend.append("line")
      .attr("x1", 0).attr("x2", 30)
      .attr("y1", 75).attr("y2", 75)
      .style("stroke", "#4caf50")
      .style("stroke-width", 2)
      .style("stroke-dasharray", "5,5");
    legend.append("text")
      .attr("x", 35).attr("y", 80)
      .style("font-size", "12px")
      .text(StatsComponent.translateService.instant('BI.praediktiveLegendExponential'));

    legend.append("line")
      .attr("x1", 0).attr("x2", 30)
      .attr("y1", 100).attr("y2", 100)
      .style("stroke", "var(--color-accent-purple)")
      .style("stroke-width", 2.5)
      .style("stroke-dasharray", "5,5");
    legend.append("text")
      .attr("x", 35).attr("y", 105)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("AI Ensemble");

    legend.append("line")
      .attr("x1", 0).attr("x2", 30)
      .attr("y1", 120).attr("y2", 120)
      .style("stroke", "#00bcd4")
      .style("stroke-width", 2.5)
      .style("stroke-dasharray", "3,3");
    legend.append("text")
      .attr("x", 35).attr("y", 125)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("ARIMA");
  }
}/**
 * Create prediction summary table
 */
export function createPredictionSummaryTable(container: any) {
  const tablePanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  tablePanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praediktiveForecastSummary'));

  const historicalData = getPredictiveHistoricalData(StatsComponent.predictiveSelectedMetric);
  if (historicalData.length === 0) return;

  const predictions = calculatePredictions(historicalData);

  const tableDiv = tablePanel.append("div")
    .style("overflow-x", "auto");

  const table = tableDiv.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse");

  // Header
  const thead = table.append("thead");
  const headerRow = thead.append("tr");
  const headers = [
    StatsComponent.translateService.instant('BI.month'),
    StatsComponent.translateService.instant('BI.linearRegression'),
    StatsComponent.translateService.instant('BI.exponentialSmoothing'),
    StatsComponent.translateService.instant('BI.arima'),
    StatsComponent.translateService.instant('BI.aiEnsemble'),
    StatsComponent.translateService.instant('BI.trend')
  ];
  const columnWidths = ['12%', '18%', '18%', '18%', '18%', '16%'];
  
  headerRow.selectAll("th")
    .data(headers)
    .enter()
    .append("th")
    .style("padding", "12px")
    .style("background", "#1976d2")
    .style("color", "white")
    .style("text-align", "left")
    .style("width", (d, i) => columnWidths[i])
    .text(d => d);

  // Body
  const tbody = table.append("tbody");

  predictions.linear.forEach((linearPred: any, i: number) => {
    const expPred = predictions.exponential[i];
    const arimaPred = predictions.arima && predictions.arima[i] ? predictions.arima[i] : null;
    const ensemblePred = predictions.ensemble[i];
    const row = tbody.append("tr")
      .style("border-bottom", "1px solid var(--color-muted-light)");

    row.append("td")
      .style("padding", "10px")
      .style("font-weight", "bold")
      .text(linearPred.month);

    row.append("td")
      .style("padding", "10px")
      .text(linearPred.value.toFixed(2));

    row.append("td")
      .style("padding", "10px")
      .text(expPred.value.toFixed(2));

    const arimaCell = row.append("td")
      .style("padding", "10px")
      .style("font-weight", "bold");
    
    if (arimaPred) {
      arimaCell
        .style("color", "#00bcd4")
        .text(arimaPred.value.toFixed(2));
    } else {
      arimaCell
        .style("color", "#ff9800")
        .html('⚠️ ' + StatsComponent.translateService.instant('BI.praediktiveDataMissing'));
    }

    row.append("td")
      .style("padding", "10px")
      .style("font-weight", "bold")
      .style("color", "var(--color-accent-purple)")
      .text(ensemblePred.value.toFixed(2));

    // Calculate trend based on comparison with last historical value and prediction trend
    let trend = "→";
    const lastHistorical = historicalData[historicalData.length - 1].value;
    
    if (i === 0) {
      // First prediction: compare with last historical
      const change = ((ensemblePred.value - lastHistorical) / Math.max(Math.abs(lastHistorical), 0.01)) * 100;
      trend = change > 2 ? "📈" : change < -2 ? "📉" : "→";
    } else {
      // Subsequent predictions: compare with previous prediction
      const prevPred = predictions.ensemble[i-1].value;
      const change = ((ensemblePred.value - prevPred) / Math.max(Math.abs(prevPred), 0.01)) * 100;
      trend = change > 1 ? "📈" : change < -1 ? "📉" : "→";
    }
    
    row.append("td")
      .style("padding", "10px")
      .style("font-size", "20px")
      .text(trend);
  });
}/**
 * Get historical data for selected metric
 */
export function getPredictiveHistoricalData(metric: string): any[] {
  const transactions = AppStateService.instance.allTransactions;
  const monthlyData = new Map<string, number>();
  
  // Get data for the specified number of historical months (excluding current month)
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const startDate = new Date(today.getFullYear(), today.getMonth() - StatsComponent.predictiveMonthsHistory, 1);

  switch (metric) {
    case 'savings-rate': {
      // Calculate monthly savings rate (excluding current month)
      const monthlyIncome = new Map<string, number>();
      const monthlyExpenses = new Map<string, number>();
      
      transactions.filter(t => new Date(t.date) >= startDate && t.date.substring(0, 7) !== currentMonthStr).forEach(t => {
        const month = t.date.substring(0, 7);
        const amount = Number(t.amount);
        
        if (t.account === 'Income' && amount > 0) {
          monthlyIncome.set(month, (monthlyIncome.get(month) || 0) + amount);
        } else if (['Daily', 'Splurge', 'Smile', 'Fire', 'Mojo'].includes(t.account) && amount < 0) {
          monthlyExpenses.set(month, (monthlyExpenses.get(month) || 0) + Math.abs(amount));
        }
      });

      monthlyIncome.forEach((income, month) => {
        const expenses = monthlyExpenses.get(month) || 0;
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
        monthlyData.set(month, savingsRate);
      });
      break;
    }

    case 'total-expenses': {
      // Calculate monthly total expenses (excluding current month)
      transactions.filter(t => 
        new Date(t.date) >= startDate &&
        t.date.substring(0, 7) !== currentMonthStr &&
        ['Daily', 'Splurge', 'Smile', 'Fire', 'Mojo'].includes(t.account) &&
        Number(t.amount) < 0
      ).forEach(t => {
        const month = t.date.substring(0, 7);
        monthlyData.set(month, (monthlyData.get(month) || 0) + Math.abs(Number(t.amount)));
      });
      break;
    }

    case 'net-worth': {
      // Calculate monthly net worth across all accounts (as total positive balance, excluding current month)
      const accounts = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
      
      // Get all months in the range (excluding current month)
      const allMonths = new Set<string>();
      transactions.filter(t => new Date(t.date) >= startDate && t.date.substring(0, 7) !== currentMonthStr).forEach(t => {
        allMonths.add(t.date.substring(0, 7));
      });

      // For each month, calculate the net worth up to that month
      Array.from(allMonths).sort().forEach(month => {
        const monthEndDate = new Date(month + '-01');
        monthEndDate.setMonth(monthEndDate.getMonth() + 1);
        monthEndDate.setDate(0); // Last day of month

        // Sum all transactions up to end of this month
        const netWorth = transactions
          .filter(t => new Date(t.date) <= monthEndDate && accounts.includes(t.account))
          .reduce((sum, t) => sum + Number(t.amount), 0);

        monthlyData.set(month, Math.abs(netWorth)); // Use absolute value to show as positive
      });
      break;
    }

    case 'category-spending': {
      // Use selected category for prediction, or auto-select top category if none selected
      let selectedCategory = StatsComponent.predictiveSelectedCategory;
      
      // If no category selected (empty string or undefined), find and set the top spending category
      if (!selectedCategory || selectedCategory === '') {
        const categoryTotals = new Map<string, number>();
        transactions.filter(t => Number(t.amount) < 0 && t.category).forEach(t => {
          categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + Math.abs(Number(t.amount)));
        });

        const topCategoryEntry = Array.from(categoryTotals.entries())
          .sort((a, b) => b[1] - a[1])[0];
        
        if (topCategoryEntry) {
          selectedCategory = topCategoryEntry[0];
          StatsComponent.predictiveSelectedCategory = selectedCategory;
        }
      }
      
      if (selectedCategory) {
        // Group all transactions by month for the selected category
        const monthlySpending = new Map<string, number>();
        
        const categoryTransactions = transactions
          .filter(t => t.category === selectedCategory && Number(t.amount) < 0);
        
        categoryTransactions.forEach(t => {
          const month = t.date.substring(0, 7);
          monthlySpending.set(month, (monthlySpending.get(month) || 0) + Math.abs(Number(t.amount)));
        });
        
        // Generate all months in the range and fill with data (excluding current month)
        const currentMonth = new Date();
        for (let i = StatsComponent.predictiveMonthsHistory; i >= 1; i--) {
          const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
          const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Add to monthlyData with actual value or 0
          const value = monthlySpending.get(monthStr) || 0;
          monthlyData.set(monthStr, value);
        }
      }
      
      break;
    }
  }

  // Convert to array and sort by month
  return Array.from(monthlyData.entries())
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}/**
 * Calculate predictions using different methods with confidence intervals
 */
export function calculatePredictions(historicalData: any[]): any {
  if (historicalData.length < 2) {
    return { linear: [], exponential: [], confidence: { upper: [], lower: [] } };
  }

  const n = historicalData.length;
  
  // Linear regression with proper statistical calculations
  const xValues = historicalData.map((_, i) => i);
  const yValues = historicalData.map(d => d.value);
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
  
  const meanX = sumX / n;
  const meanY = sumY / n;
  // Calculate slope and intercept
  const denominator = (n * sumX2 - sumX * sumX);
  let slope = 0;
  let intercept = meanY;
  
  if (Math.abs(denominator) > 1e-10) {
    slope = (n * sumXY - sumX * sumY) / denominator;
    intercept = meanY - slope * meanX;
  }
  // Calculate standard error for confidence intervals
  const predictions = xValues.map(x => slope * x + intercept);
  const residuals = yValues.map((y, i) => y - predictions[i]);
  const sse = residuals.reduce((sum, r) => sum + r * r, 0);
  const mse = n > 2 ? sse / (n - 2) : sse / n;
  const standardError = Math.sqrt(mse);
  
  // Calculate variance of x for confidence interval calculation
  const varX = xValues.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / n;

  // Generate linear predictions starting from next month after last historical data
  const linearPredictions = [];
  const upperConfidence = [];
  const lowerConfidence = [];
  const lastMonth = historicalData[n - 1].month;
  
  for (let i = 1; i <= StatsComponent.predictiveMonthsFuture; i++) {
    const futureMonth = StatsComponent.addMonths(lastMonth, i);
    const x = n - 1 + i; // continuing from last historical index
    const predictedValue = slope * x + intercept;
    // Calculate confidence interval (95% confidence = ~1.96 * SE)
    // Increase uncertainty as we predict further into the future
    const distanceFromMean = Math.pow(x - meanX, 2);
    const predictionError = standardError * Math.sqrt(1 + 1/n + distanceFromMean / (n * varX + 1e-10));
    const confidenceMargin = 1.96 * predictionError * (1 + 0.1 * i); // Uncertainty grows with time
    
    linearPredictions.push({
      month: futureMonth,
      value: predictedValue  // Don't clamp - savings rate can be negative
    });
    
    upperConfidence.push({
      month: futureMonth,
      value: predictedValue + confidenceMargin
    });
    
    lowerConfidence.push({
      month: futureMonth,
      value: predictedValue - confidenceMargin
    });
  }

  // Exponential smoothing with Holt's linear trend method (double exponential smoothing)
  const alpha = StatsComponent.predictiveAlpha; // Level smoothing
  const beta = 0.3; // Trend smoothing
  
  let level = historicalData[0].value;
  let trend = 0;
  
  if (n > 1) {
    trend = historicalData[1].value - historicalData[0].value;
  }
  
  // Apply Holt's method to historical data
  for (let i = 1; i < n; i++) {
    const previousLevel = level;
    level = alpha * historicalData[i].value + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }

  // Generate exponential predictions with trend continuation
  const exponentialPredictions = [];
  const upperConfidenceExp = [];
  const lowerConfidenceExp = [];
  
  // Calculate standard deviation for confidence bands
  const expErrors = historicalData.map((d, i) => {
    if (i === 0) return 0;
    let tempLevel = historicalData[0].value;
    let tempTrend = n > 1 ? historicalData[1].value - historicalData[0].value : 0;
    for (let j = 1; j <= i; j++) {
      const prevLevel = tempLevel;
      tempLevel = alpha * historicalData[j].value + (1 - alpha) * (tempLevel + tempTrend);
      tempTrend = beta * (tempLevel - prevLevel) + (1 - beta) * tempTrend;
    }
    return historicalData[i].value - (tempLevel + tempTrend);
  });
  const expStdDev = Math.sqrt(expErrors.reduce((sum, e) => sum + e * e, 0) / Math.max(1, n - 1));
  
  for (let i = 1; i <= StatsComponent.predictiveMonthsFuture; i++) {
    const futureMonth = StatsComponent.addMonths(lastMonth, i);
    const forecastValue = level + i * trend;
    
    // Confidence interval grows with forecast horizon
    const confidenceMargin = 1.96 * expStdDev * Math.sqrt(i);
    
    exponentialPredictions.push({
      month: futureMonth,
      value: forecastValue  // Don't clamp - savings rate can be negative
    });
    
    upperConfidenceExp.push({
      month: futureMonth,
      value: forecastValue + confidenceMargin
    });
    
    lowerConfidenceExp.push({
      month: futureMonth,
      value: forecastValue - confidenceMargin
    });
  }

  // ARIMA prediction - Advanced time series forecasting
  let arimaPredictions: any[] = [];
  try {
    arimaPredictions = calculateARIMAPredictions(historicalData, lastMonth);
  } catch (error) {
    console.warn('[ARIMA] Prediction failed, using fallback:', error);
    // Fallback: use ensemble if ARIMA fails
    arimaPredictions = [];
  }

  // AI-Enhanced: Ensemble prediction (average of linear, exponential, and ARIMA)
  const ensemblePredictions = [];
  for (let i = 0; i < linearPredictions.length; i++) {
    let ensembleValue;
    if (arimaPredictions.length > i) {
      // Include ARIMA in ensemble
      ensembleValue = (linearPredictions[i].value + exponentialPredictions[i].value + arimaPredictions[i].value) / 3;
    } else {
      // Fallback to linear + exponential average
      ensembleValue = (linearPredictions[i].value + exponentialPredictions[i].value) / 2;
    }
    ensemblePredictions.push({
      month: linearPredictions[i].month,
      value: ensembleValue
    });
  }

  return {
    linear: linearPredictions,
    exponential: exponentialPredictions,
    arima: arimaPredictions,
    ensemble: ensemblePredictions,
    confidence: {
      upper: upperConfidence,
      lower: lowerConfidence
    },
    confidenceExp: {
      upper: upperConfidenceExp,
      lower: lowerConfidenceExp
    },
    historicalSlope: slope,
    historicalIntercept: intercept
  };
}/**
 * ARIMA Prediction Function (Browser-compatible implementation)
 * Simplified ARIMA(p,d,q) model for time series forecasting
 * p = autoregressive order, d = differencing order, q = moving average order
 * 
 * This is a custom implementation optimized for browser environments.
 * Uses ARIMA(1,1,1) - a simplified but effective model for financial data.
 */
export function calculateARIMAPredictions(historicalData: any[], lastMonth: string): any[] {
  if (historicalData.length < 8) {
    console.warn('[ARIMA] Not enough data points (minimum 8 required)');
    return [];
  }

  try {
    // Extract values
    const values = historicalData.map(d => d.value);
    const n = values.length;
    
    // Step 1: Differencing (d=1) - Remove trend by computing first differences
    const differenced: number[] = [];
    for (let i = 1; i < n; i++) {
      differenced.push(values[i] - values[i - 1]);
    }
    
    // Step 2: Calculate AR(1) coefficient - Autoregressive component
    // Measures how much current value depends on previous value
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < differenced.length - 1; i++) {
      const x = differenced[i];
      const y = differenced[i + 1];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    const m = differenced.length - 1;
    const meanX = sumX / m;
    const meanY = sumY / m;
    
    let phi = 0; // AR coefficient
    const denominator = sumX2 - m * meanX * meanX;
    if (Math.abs(denominator) > 1e-10) {
      phi = (sumXY - m * meanX * meanY) / denominator;
      // Ensure stationarity: |phi| < 1
      phi = Math.max(-0.95, Math.min(0.95, phi));
    }
    
    // Step 3: Calculate MA(1) coefficient - Moving Average component
    // Captures the impact of previous forecast errors
    const residuals: number[] = [];
    for (let i = 1; i < differenced.length; i++) {
      const predicted = meanY + phi * (differenced[i - 1] - meanX);
      residuals.push(differenced[i] - predicted);
    }
    
    let theta = 0; // MA coefficient
    if (residuals.length > 1) {
      let sumRes = 0, sumRes2 = 0;
      for (let i = 0; i < residuals.length - 1; i++) {
        sumRes += residuals[i] * residuals[i + 1];
        sumRes2 += residuals[i] * residuals[i];
      }
      if (Math.abs(sumRes2) > 1e-10) {
        theta = sumRes / sumRes2;
        // Ensure invertibility: |theta| < 1
        theta = Math.max(-0.95, Math.min(0.95, theta));
      }
    }
    
    // Step 4: Forecasting
    const arimaPredictions = [];
    let lastValue = values[n - 1];
    let lastDiff = differenced[differenced.length - 1];
    let lastError = residuals.length > 0 ? residuals[residuals.length - 1] : 0;
    for (let h = 1; h <= StatsComponent.predictiveMonthsFuture; h++) {
      // Forecast differenced series using ARIMA(1,1,1)
      const forecastDiff = phi * lastDiff + theta * lastError;
      
      // Integrate back to get level forecast
      const forecastValue = lastValue + forecastDiff;
      
      const futureMonth = StatsComponent.addMonths(lastMonth, h);
      arimaPredictions.push({
        month: futureMonth,
        value: forecastValue
      });
      
      // Update for next iteration
      lastValue = forecastValue;
      lastDiff = forecastDiff;
      // Error decays to zero for multi-step forecasts
      lastError = lastError * theta;
    }
    return arimaPredictions;
    
  } catch (error) {
    console.error('[ARIMA] Error during prediction:', error);
    return [];
  }
}

/**
 * Helper function to add months to YYYY-MM string
 */
