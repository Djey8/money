import { StatsComponent } from '../stats.component';
import * as d3 from 'd3';
import * as sankey from 'd3-sankey';
import { ChartFilterService } from '../../shared/services/chart-filter.service';
import { AppStateService } from '../../shared/services/app-state.service';
import { IncomeComponent } from '../../main/cashflow/income/income.component';
import { BalanceComponent } from '../../main/cashflow/balance/balance.component';
import { SmileProjectsComponent } from '../../main/smile/smile-projects/smile-projects.component';
import { FireEmergenciesComponent } from '../../main/fire/fire-emergencies/fire-emergencies.component';
import { GrowComponent } from '../../main/grow/grow.component';
import { FireComponent } from '../../main/fire/fire.component';
import { HomeComponent } from '../../main/home/home.component';

export function createKPI(kpiType: string) {
  switch (kpiType) {
    case "burn-rate":
      return createBurnRate();
    case "expense-income-ratio":
      return createExpenseIncomeRatio();
    case "top-spending":
      return createTopSpendingCategories(StatsComponent.period, StatsComponent.Index, StatsComponent.numCategories);
    case "savings-rate":
      return createSavingsRate();
    case "recurring-vs-one-time":
      return createRecurringVsOneTimeChart(StatsComponent.period, StatsComponent.Index);
    case "net-worth-trend":
      return createNetWorthTrendChart();
    case "icome-streams-breakdown":
      return createIncomeStreamsBreakdown(StatsComponent.period, StatsComponent.Index);
    case "heatmap-calendar":
      return createHeatmapCalendar();
    default:
      return createSavingsRate(); // fallback
  }
}
/**
 * Renders a cumulative net-worth trend line chart (assets minus liabilities)
 * grouped by month, with change-percentage annotations and a quadratic regression trend line.
 */
export function createNetWorthTrendChart() {
  d3.select("#chart-container").selectAll("*").remove();

  const groupBy = (date: Date): string => d3.timeFormat("%Y-%m")(date);
  const transactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter);

  const grouped = new Map<string, { assets: number, liabilities: number, records: any[] }>();
  transactions.forEach(t => {
    const date = new Date(t.date);
    const key = groupBy(date);
    if (!grouped.has(key)) grouped.set(key, { assets: 0, liabilities: 0, records: [] });

    const amt = Number(t.amount);
    const record = grouped.get(key)!;
    if (t.account === "Income") {
      record.assets += amt;
    } else {
      record.liabilities += amt;
    }
    record.records.push(t);
  });

  const rawData = Array.from(grouped.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  let cumulativeAssets = 0;
  let cumulativeLiabilities = 0;
  let previousNetWorth = 0;

  const data = rawData.map(([dateStr, { assets, liabilities, records }]) => {
    cumulativeAssets += assets;
    cumulativeLiabilities += liabilities;
    const netWorth = cumulativeAssets + cumulativeLiabilities;

    const entry = {
      dateStr,
      date: d3.timeParse("%Y-%m")(dateStr)!,
      netWorthBefore: previousNetWorth,
      netWorth,
      growth: assets + liabilities,
      assets,
      liabilities,
      transactions: records
    };
    previousNetWorth = netWorth;
    return entry;
  });

  const lastDateStr = data[data.length - 1].dateStr;

  const container = document.getElementById("chart-container");
  const margin = { top: 40, right: 50, bottom: 60, left: 60 };
  const width = container ? container.clientWidth - margin.left - margin.right : window.innerWidth - margin.left - margin.right - 20;
  const height = window.innerHeight - margin.top - margin.bottom - 80 - 75;
  const chartWidth = width;
  const chartHeight = height;

  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date) as [Date, Date])
    .range([0, chartWidth]);

  const y = d3.scaleLinear()
    .domain([d3.min(data, d => d.netWorthBefore) ?? 0, d3.max(data, d => d.netWorth) ?? 0])
    .nice()
    .range([chartHeight, 0]);

  // Bars (gain/loss lines)
  svg.selectAll(".bar")
    .data(data)
    .enter()
    .append("line")
    .attr("x1", d => x(d.date))
    .attr("x2", d => x(d.date))
    .attr("y1", d => y(d.netWorthBefore))
    .attr("y2", d => y(d.netWorth))
    .attr("stroke", d => d.netWorth >= d.netWorthBefore ? "#4caf50" : "#f44336")
    .attr("stroke-dasharray", d => d.dateStr === lastDateStr ? "4 2" : "0")
    .attr("stroke-width", 5);

  

  // Net worth line path (excluding last segment)
  svg.append("path")
    .datum(data.slice(0, -1))
    .attr("fill", "none")
    .style("stroke", "var(--color-primary)")
    .attr("stroke-width", 4)
    .attr("d", d3.line<any>()
      .x(d => x(d.date))
      .y(d => y(d.netWorth))
      .curve(d3.curveMonotoneX));

  // Last segment as grey dashed line
  svg.append("path")
    .datum(data.slice(data.length - 2))
    .attr("fill", "none")
    .style("stroke", "var(--color-border)")
    .attr("stroke-dasharray", "4 2")
    .attr("stroke-width", 4)
    .attr("d", d3.line<any>()
      .x(d => x(d.date))
      .y(d => y(d.netWorth))
      .curve(d3.curveMonotoneX));

  // Quadratic regression trend line (ignoring last unfinished month)
  StatsComponent.d3Service.drawTrendLine({
    svg, xScale: x, yScale: y,
    data: data.slice(0, -1).map(d => ({ date: d.date, value: d.netWorth }))
  });

  // Circles (dots)
  svg.selectAll(".net-worth-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.netWorth))
    .attr("r", 8)
    .attr("fill", d => d.dateStr === lastDateStr ? "var(--color-border)" : "#3f51b5")
    .attr("class", "net-worth-dot")
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      if (d3.select("#net-worth-info-box").empty()) {
        const dotX = x(d.date) + margin.left;
        const side = dotX < window.innerWidth / 2 ? "right" : "left";
        const left = side === "right" ? dotX + 12 : dotX - 200;
        const top = y(d.netWorth) + margin.top - 10;

        d3.select("#chart-container")
          .append("div")
          .attr("class", "dot-tooltip")
          .style("position", "absolute")
          .style("left", `${left}px`)
          .style("top", `${top}px`)
          .style("background", "var(--color-surface)")
          .style("border", "1px solid var(--color-primary)")
          .style("padding", "12px 16px")
          .style("border-radius", "6px")
          .style("font-size", "14px")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("pointer-events", "none")
          .style("min-width", "150px")
          .html(`
            <strong>${d3.timeFormat("%b %Y")(d.date)}</strong><br/>
            Net Worth: <span style="color:${d.netWorth < 0 ? 'red' : 'var(--color-text)'}">${d.netWorth.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
            <span style="color:#3f51b5;font-size:13px;">Click for details</span>
          `);
      }
    })
    .on("mouseleave", () => {
      if (d3.select("#net-worth-info-box").empty()) {
        d3.selectAll(".dot-tooltip").remove();
      }
    })
    .on("click", function (event, d) {
      d3.select("#net-worth-info-box").remove();
      d3.selectAll(".dot-tooltip").remove();

      const transactions = d.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const detailsHtml = transactions.map(t => `
        <li>${d3.timeFormat("%b %d, %Y")(new Date(t.date))}: <span style="color:${Number(t.amount) < 0 ? 'red' : 'var(--color-text)'}">${Number(t.amount).toFixed(2)} ${AppStateService.instance.currency}</span> (${t.account || "n/a"})</li>
      `).join("");

      const info = `
        <strong>${d3.timeFormat("%b %Y")(d.date)}</strong><br/>
        Net Worth: <span style="color:${d.netWorth < 0 ? 'red' : 'var(--color-text)'}">${d.netWorth.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
        Growth:  <span style="color:${d.growth < 0 ? 'red' : 'var(--color-text)'}">${d.growth.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
        Income: <span style="color:${d.assets < 0 ? 'red' : 'var(--color-text)'}">${d.assets.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
        Liabilities: <span style="color:${d.liabilities < 0 ? 'red' : 'var(--color-text)'}">${d.liabilities.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
        <a href="#" id="expand-networth-details" style="color:#3f51b5;text-decoration:underline;font-size:13px;">Show Details</a>
        <div id="networth-details-list" style="display:none;max-height:180px;overflow:auto;margin-top:8px;">
          <ul style="padding-left:18px;margin:0;">
        ${detailsHtml}
          </ul>
        </div>
      `;

      const dotX = x(d.date) + margin.left;
      const side = dotX < window.innerWidth / 2 ? "right" : "left";
      const left = side === "right" ? dotX + 12 : dotX - 200;
      const top = y(d.netWorth) + margin.top - 10;

      d3.select("#chart-container")
        .append("div")
        .attr("id", "net-worth-info-box")
        .style("position", "absolute")
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .style("background", "var(--color-surface)")
        .style("border", "1px solid var(--color-primary)")
        .style("padding", "12px 16px")
        .style("border-radius", "6px")
        .style("font-size", "14px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("min-width", "150px")
        .html(info);

      setTimeout(() => {
        const expandLink = document.getElementById("expand-networth-details");
        const detailsList = document.getElementById("networth-details-list");
        if (expandLink && detailsList) {
          expandLink.onclick = function (e) {
            e.preventDefault();
            if (detailsList.style.display === "none") {
              detailsList.style.display = "block";
              expandLink.textContent = "Hide Details";
            } else {
              detailsList.style.display = "none";
              expandLink.textContent = "Show Details";
            }
            e.stopPropagation();
            return false;
          };
        }
      }, 0);

      d3.select("body").on("click.networth-info", function (e) {
        if (
          !d3.select(e.target).classed("net-worth-dot") &&
          !d3.select(e.target).attr("id")?.startsWith("expand-networth-details")
        ) {
          d3.select("#net-worth-info-box").remove();
          d3.select("body").on("click.networth-info", null);
        }
      }, true);

      event.stopPropagation();
    });

  // Percentage labels
  svg.selectAll(".bar-label")
    .data(data)
    .enter()
    .append("text")
    .attr("x", d => x(d.date) + 6)
    .attr("y", d => (y(d.netWorthBefore) + y(d.netWorth)) / 2)
    .attr("dy", "0.35em")
    .attr("fill", d => d.netWorth >= d.netWorthBefore ? "#4caf50" : "#f44336")
    .attr("font-size", "12px")
    .attr("text-anchor", "start")
    .text(d => {
      const change = d.netWorth - d.netWorthBefore;
      const pct = d.netWorthBefore !== 0 ? (change / Math.abs(d.netWorthBefore)) * 100 : 0;
      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    });

  svg.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y")))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-0.8em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-35)");

  svg.append("g").call(d3.axisLeft(y));

  svg.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Net Worth Trend");
}
/**
 * Renders a monthly expense-to-income ratio bar chart with a 100% reference line.
 * Bars above 100% indicate months where expenses exceeded income.
 */
export function createExpenseIncomeRatio() {
  d3.select("#chart-container").selectAll("*").remove();

  const margin = { top: 20, right: 30, bottom: 60, left: 60 };
  const width = window.innerWidth - margin.left - margin.right - 20;
  const height = window.innerHeight - margin.top - margin.bottom - 80 - 75;

  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const parseDate = (d: string) => new Date(d);

  const transactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter)
    .map(t => ({
    date: parseDate(t.date),
    month: `${parseDate(t.date).getFullYear()}-${(parseDate(t.date).getMonth() + 1).toString().padStart(2, '0')}`,
    amount: Number(t.amount),
    account: t.account
    }));

  const now = new Date();
  const filteredMonthly = d3.rollups(
    transactions,
    values => {
      const income = values
        .filter(t => t.account === "Income")
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(
        values
          .filter(t => t.account !== "Income")
          .reduce((sum, t) => sum + t.amount, 0)
      );

      return {
        month: new Date(values[0].month + "-01"),
        ratio: income > 0 ? expenses / income : 0,
        income,
        expenses
      };
    },
    d => d.month
  ).filter(([month]) => {
    const [year, mon] = month.split('-').map(Number);
    return !(year === now.getFullYear() && mon === now.getMonth() + 1);
  });

  const data = filteredMonthly
    .map(([, d]) => d)
    .sort((a, b) => a.month.getTime() - b.month.getTime());

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.month) as [Date, Date])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.ratio)! * 1.1])
    .range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y") as any))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Background for negative values (light red, 50% transparent)
  // Highlight area above 100% (ratio > 1) with a light red background
  svg.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", y(1))
    .attr("fill", "rgba(255, 0, 0, 0.1)");

  svg.append("g").call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  svg.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0.8))
    .attr("y2", y(0.8))
    .attr("stroke", "red")
    .attr("stroke-dasharray", "4 4");

  svg.append("text")
    .attr("x", width - 60)
    .attr("y", y(0.8) - 5)
    .attr("fill", "red")
    .style("font-size", "12px")
    .text("Target: 80%");

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .style("stroke", "var(--color-primary)")
    .attr("stroke-width", 4)
    .attr("d", d3.line<any>()
      .x(d => x(d.month))
      .y(d => y(d.ratio))
    );

  // Quadratic trend line
  StatsComponent.d3Service.drawTrendLine({
    svg, xScale: x, yScale: y,
    data: data.map((d: { month: Date; ratio: number }) => ({ date: d.month, value: d.ratio })),
    dashArray: '10 5'
  });

  // Info box per dot (expandable by click/hover)
  svg.selectAll(".kpi-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.month))
    .attr("cy", d => y(d.ratio))
    .attr("r", 6)
    .style("fill", "var(--color-primary)")
    .attr("class", "kpi-dot")
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      // Only show tooltip if no expanded info box is present
      if (d3.select("#kpi-info-box").empty()) {
        const dotX = x(d.month) + margin.left;
        const side = dotX < window.innerWidth / 2 ? "right" : "left";
        const left = side === "right"
          ? dotX + 12
          : dotX - 200; // box width
        const top = y(d.ratio) + margin.top - 10;

        d3.select("#chart-container")
          .append("div")
          .attr("class", "dot-tooltip")
          .style("position", "absolute")
          .style("left", `${left}px`)
          .style("top", `${top}px`)
          .style("background", "var(--color-surface)")
          .style("border", "1px solid var(--color-primary)")
          .style("padding", "12px 16px")
          .style("border-radius", "6px")
          .style("font-size", "14px")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("pointer-events", "none")
          .style("min-width", "150px")
          .html(`
            <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br/>
            Ratio: <span style="color:${d.ratio > 1 ? 'red' : 'var(--color-text)'}">${(d.ratio * 100).toFixed(1)}%</span><br/>
            <span style="color:#3f51b5;font-size:13px;">Click for details</span>
          `);
      }
    })
    .on("mouseleave", () => {
      // Only remove tooltip if no expanded info box is present
      if (d3.select("#kpi-info-box").empty()) {
        d3.selectAll(".dot-tooltip").remove();
      }
    })
    .on("click", function(event, d) {
      // Remove any existing info box or tooltip
      d3.select("#kpi-info-box").remove();
      d3.selectAll(".dot-tooltip").remove();

      // Gather all transactions for this month
      const monthStr = d3.timeFormat("%Y-%m")(d.month);
      const transactions = AppStateService.instance.allTransactions
        .filter(t => {
          const tDate = new Date(t.date);
          return (
            `${tDate.getFullYear()}-${(tDate.getMonth() + 1).toString().padStart(2, '0')}` === monthStr
          );
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Build expandable info content
      let info = `
        <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br/>
        Ratio: <span style="color:${d.ratio > 1 ? 'red' : 'var(--color-text)'}">${(d.ratio * 100).toFixed(1)}%</span><br/>
        Income: <span style="color:${d.income < 0 ? 'red' : 'var(--color-text)'}">${d.income.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
        Expenses: <span style="color:${d.expenses*-1 < 0 ? 'red' : 'var(--color-text)'}">${d.expenses.toFixed(2)*-1} ${AppStateService.instance.currency}</span>
        <br>
        <a href="#" id="expand-expense-details" style="color:#3f51b5;text-decoration:underline;font-size:13px;">Show Details</a>
        <div id="expense-details-list" style="display:none;max-height:180px;overflow:auto;margin-top:8px;">
          <ul style="padding-left:18px;margin:0;">
        ${transactions.map(t => `
          <li>
            ${d3.timeFormat("%b %d, %Y")(new Date(t.date))}: <span style="color:${Number(t.amount) < 0 ? 'red' : 'var(--color-text)'}">${Number(t.amount).toFixed(2)} ${AppStateService.instance.currency}</span> (${t.account})
          </li>
        `).join("")}
          </ul>
        </div>
      `;

      // Calculate position
      const dotX = x(d.month) + margin.left;
      const side = dotX < window.innerWidth / 2 ? "right" : "left";
      const left = side === "right"
        ? dotX + 12
        : dotX - 200; // box width
      const top = y(d.ratio) + margin.top - 10;

      d3.select("#chart-container")
        .append("div")
        .attr("id", "kpi-info-box")
        .style("position", "absolute")
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .style("background", "var(--color-surface)")
        .style("border", "1px solid var(--color-primary)")
        .style("padding", "12px 16px")
        .style("border-radius", "6px")
        .style("font-size", "14px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("min-width", "150px")
        .html(info);

      // Add expand/collapse logic
      setTimeout(() => {
        const expandLink = document.getElementById("expand-expense-details");
        const detailsList = document.getElementById("expense-details-list");
        if (expandLink && detailsList) {
          expandLink.onclick = function(e) {
            e.preventDefault();
            if (detailsList.style.display === "none") {
              detailsList.style.display = "block";
              expandLink.textContent = "Hide Details";
            } else {
              detailsList.style.display = "none";
              expandLink.textContent = "Show Details";
            }
            e.stopPropagation();
            return false;
          };
        }
      }, 0);

      // Remove info box on next click anywhere except on the dot or expand link
      d3.select("body").on("click.kpi-info", function(e) {
        if (
          !d3.select(e.target).classed("kpi-dot") &&
          !d3.select(e.target).attr("id")?.startsWith("expand-expense-details")
        ) {
          d3.select("#kpi-info-box").remove();
          d3.select("body").on("click.kpi-info", null);
        }
      }, true);

      // Prevent event from bubbling up to body
      event.stopPropagation();
    })
    .append("title")
    .text(d => `Expense/Income Ratio: ${(d.ratio * 100).toFixed(1)}%`);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('KPI.expenseIncomeRatio'));
}
/**
 * Renders an income-streams Sankey diagram showing the flow from income sources
 * through fund allocation accounts (Daily/Splurge/Smile/Fire) to expense categories.
 * Supports period-based filtering and interactive zoom (click income/expense halves).
 */
 export function createIncomeStreamsBreakdown(selectedPeriod = "all", selectedIndex = 0) {
  d3.select("#chart-container").selectAll("*").remove();

  // Save period/index for swipe navigation
  StatsComponent.period = selectedPeriod;
  StatsComponent.Index = selectedIndex;

  // Fullscreen layout with some padding, centered in the middle of the screen
  const margin = { top: 40, right: 10, bottom: 50, left: 10 };
  const width = window.innerWidth - margin.left - margin.right - 20;
  const height = window.innerHeight - margin.top - margin.bottom - 80 - 75;

  // Create main SVG with margin
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("display", "block")
    .style("margin", "0 auto")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Add chart title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('KPI.incomeStreamsBreakdown'));

  // Create a zoom handler
  const zoom = d3.zoom()
    .scaleExtent([0.5, 3])
    .on("zoom", (event) => {
      svg.selectAll("g.chart-content").attr("transform", event.transform);
    });

  // Initialize the sankeyGenerator
  const sankeyGenerator = sankey.sankey()
    .nodeWidth(20)
    .nodePadding(10)
    .extent([[1, 1], [width - 1, height - 6]]);

  // Create a chart content group that will be zoomable
  const chartContent = svg.append("g")
    .attr("class", "chart-content");

  // Store initial data for zoom reset
  let fullData = null;
  let zoomState = "full"; // Possible values: "full", "income", "expense"

  function createChart(filter = null) {
    // Filter transactions using the unified chart filter
    const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter);

    const tx = filteredTransactions.map(t => ({
      date: new Date(t.date),
      amount: parseFloat(t.amount as any) || 0,
      account: (t.account || "").trim(),
      category: (t.category || "Uncategorized").trim()
    }));

    const incomeTx = tx.filter(t => t.account === "Income");
    const expenseTx = tx.filter(t => t.account !== "Income" && t.account !== "");

    // Only roll up if incomeTx is non-empty
    const incomeBySource = incomeTx.length > 0
      ? new Map(
          [...d3.rollup(
            incomeTx,
            v => d3.sum(v, d => d.amount),
            d => d.category.replace("@", "")
          ).entries()].sort(([, a], [, b]) => b - a)
        )
      : new Map([["No Income", 0]]);


    const totalIncome = d3.sum(Array.from(incomeBySource.values()));

    const allocationMap = {
      "Daily": AppStateService.instance.daily / 100,
      "Splurge": AppStateService.instance.splurge / 100,
      "Smile": AppStateService.instance.smile / 100,
      "Fire": AppStateService.instance.fire / 100
    };

    const allocations = Object.keys(allocationMap);

    const nodesSet = new Set<string>();
    incomeBySource.forEach((_, src) => nodesSet.add(src as string));
    allocations.forEach(acc => nodesSet.add(acc));
    const expenseCategories = new Set<string>();

    expenseTx.forEach(t => {
      if (allocations.includes(t.account)) {
        expenseCategories.add(t.category);
      }
    });
    expenseCategories.forEach(cat => nodesSet.add(cat));
    nodesSet.add("CASHFLOW");

    const nodeTypes = new Map();
    incomeBySource.forEach((_, src) => nodeTypes.set(src, "income"));
    allocations.forEach(acc => nodeTypes.set(acc, "account"));
    expenseCategories.forEach(cat => nodeTypes.set(cat, "expense"));
    nodeTypes.set("CASHFLOW", "cashflow");

    const nodes = Array.from(nodesSet).map(name => ({
      name,
      type: nodeTypes.get(name)
    }));

    const nodeIndexMap = new Map();
    nodes.forEach((node, i) => nodeIndexMap.set(node.name, i));

    const idx = (n) => {
      const index = nodeIndexMap.get(n);
      if (index === undefined) {
        console.warn(`Node not found: ${n}`);
        return -1;
      }
      return index;
    };

    const links = [];

    // Income → Account
    for (const [src, amount] of incomeBySource.entries()) {
      for (const [target, pct] of Object.entries(allocationMap)) {
        const sourceIndex = idx(src);
        const targetIndex = idx(target);
        if (sourceIndex === -1 || targetIndex === -1) continue;
        links.push({
          source: sourceIndex,
          target: targetIndex,
          value: Number(amount) * Number(pct),
          type: "income-to-account",
          sourceName: src,
          targetName: target
        });
      }
    }

    // Account → Category
    const spendingByAccountCategory = new Map();
    allocations.forEach(account => spendingByAccountCategory.set(account, new Map()));
    expenseTx.forEach(t => {
      const acc = t.account;
      const cat = t.category;
      const amt = Math.abs(t.amount);
      if (allocations.includes(acc)) {
      const accountMap = spendingByAccountCategory.get(acc);
      accountMap.set(cat, (accountMap.get(cat) || 0) + amt);
      }
    });

    // Category links (allow multiple sources)
    spendingByAccountCategory.forEach((categoryMap, account) => {
      categoryMap.forEach((amount, category) => {
      if (amount > 0 && nodesSet.has(category)) {
        const sourceIndex = idx(account);
        const targetIndex = idx(category);
        if (sourceIndex === -1 || targetIndex === -1) return;
        // Determine sign: positive if any transaction for this account/category is > 0, else negative
        const hasPositive = expenseTx.some(
          t => t.account === account && t.category === category && t.amount > 0
        );
        const sign = hasPositive ? 1 : -1;
        links.push({
        source: sourceIndex,
        target: targetIndex,
        value: amount,
        sign: sign,
        type: "account-to-expense",
        sourceName: account,
        targetName: category
        });
      }
      });
    });

    // Account → CASHFLOW (allow multiple accounts)
    for (const acc of allocations) {
      const allocated = totalIncome * allocationMap[acc];
      const categoryMap = spendingByAccountCategory.get(acc);
      const spent = Array.from(categoryMap.values()).reduce((sum: number, val: number) => sum + val, 0);
      const leftover = Number(allocated) - Number(spent);
      if (leftover > 0.01) {
        const sourceIndex = idx(acc);
        const targetIndex = idx("CASHFLOW");
        if (sourceIndex === -1 || targetIndex === -1) continue;
        links.push({
          source: sourceIndex,
          target: targetIndex,
          value: leftover,
          type: "account-to-cashflow",
          sourceName: acc,
          targetName: "CASHFLOW"
        });
      }
    }

    // Store all nodes and links for value calculations
    fullData = { nodes, links };

    // Filter data based on zoom state
    let filteredNodes = nodes;
    let filteredLinks = links;

    if (filter === "income") {
      // Only show income -> account links
      const accountNodes = nodes.filter(n => n.type === "income" || n.type === "account");
      const accountIndices = new Set(accountNodes.map(n => nodeIndexMap.get(n.name)));
      filteredNodes = accountNodes;
      filteredLinks = links.filter(l => accountIndices.has(l.source) && accountIndices.has(l.target));
    } else if (filter === "expense") {
      // Only show account -> category links
      // For expense zoom: show all account->expense and account->cashflow links, with threshold only for expense/cashflow nodes
      const expenseNodes = nodes.filter(n => n.type === "account" || n.type === "expense" || n.type === "cashflow");
      const expenseIndices = new Set(expenseNodes.map(n => nodeIndexMap.get(n.name)));
      const totalFlow = d3.sum(links, (l: any) => l.value);
      const threshold = totalFlow * 0.0; // 1% threshold

      // Always include account->expense and account->cashflow links, filter only expense/cashflow nodes by threshold
      filteredLinks = links.filter(l => {
        const sourceNode = nodes[l.source];
        const targetNode = nodes[l.target];
        // Only apply threshold for account->expense and account->cashflow links
        if (sourceNode.type === "account" && (targetNode.type === "expense" || targetNode.type === "cashflow")) {
          return l.value >= threshold;
        }
        // Always include links between account nodes (shouldn't exist), or other types
        return expenseIndices.has(l.source) && expenseIndices.has(l.target);
      });

      const nodeIds = new Set<number>();
      filteredLinks.forEach(l => {
        nodeIds.add(l.source);
        nodeIds.add(l.target);
      });
      // Always include all account nodes
      nodes.forEach((n, i) => {
        if (n.type === "account") nodeIds.add(i);
      });
      filteredNodes = nodes.filter((_, i) => nodeIds.has(i));
    } else {
      // Only apply threshold filtering for the expense side,
      // but do NOT filter out links that go into the largest category on the right

      // Find the largest expense/cashflow node by total value
      const nodeTotalValues = new Map<string, number>();
      filteredLinks.forEach(l => {
        const targetName = nodes[l.target].name;
        nodeTotalValues.set(
          targetName,
          (nodeTotalValues.get(targetName) || 0) + l.value
        );
      });

      // Find the largest node on the right (expense/cashflow)
      let largestNodeName = "";
      let largestNodeValue = -Infinity;
      nodeTotalValues.forEach((val, name) => {
        if (val > largestNodeValue) {
          largestNodeValue = val;
          largestNodeName = name;
        }
      });

      const totalFlow = d3.sum(links, l => l.value);
      const threshold = totalFlow * 0.0075; // 0.75% threshold

      // Only apply threshold to account->expense links, not income->account,
      // and always keep links going into the largest right node
      filteredLinks = links.filter(l => {
        const sourceType = nodes[l.source].type;
        const targetType = nodes[l.target].type;
        const targetName = nodes[l.target].name;
        // If account->expense, apply threshold unless it's the largest node
        if (sourceType === "account" && targetType === "expense") {
          if (targetName === largestNodeName) return true;
          return l.value >= threshold;
        }
        // Otherwise (income->account, account->cashflow), always include
        return true;
      });

      // Only keep nodes that are referenced by filtered links
      const nodeIds = new Set<number>();
      filteredLinks.forEach(l => {
        nodeIds.add(l.source);
        nodeIds.add(l.target);
      });
      filteredNodes = nodes.filter((_, i) => nodeIds.has(i));
    }

    // Create a new node index map for filtered nodes
    const filteredNodeIndexMap = new Map();
    filteredNodes.forEach((node, i) => filteredNodeIndexMap.set(node.name, i));

    // Remap indices for filtered links
    const remappedLinks = filteredLinks.map(link => ({
      ...link,
      source: filteredNodeIndexMap.get(nodes[link.source].name),
      target: filteredNodeIndexMap.get(nodes[link.target].name),
      value: link.value,
      type: link.type,
      sign: link.sign,
      sourceName: link.sourceName,
      targetName: link.targetName
    }));


    // Sort nodes on the right side (expense nodes) by value
    if (filter === "expense" || !filter) {
      // Calculate total value for each expense/cashflow node
      const nodeTotalValues = new Map();

      filteredNodes.forEach(node => {
        if (node.type === "expense" || node.type === "cashflow") {
          const incomingLinks = remappedLinks.filter(l =>
            filteredNodes[l.target].name === node.name
          );
          const totalValue = d3.sum(incomingLinks, l => l.value);
          nodeTotalValues.set(node.name, totalValue);
        }
      });

      // Custom sort function for the sankey diagram
      sankeyGenerator.nodeSort((a, b) => {
        // Keep account nodes at their default position
        if (a.type === "account" && b.type === "account") return 0;
        if (a.type === "account") return -1;
        if (b.type === "account") return 1;

        // Sort expense and cashflow nodes by their total value (descending)
        return (nodeTotalValues.get(b.name) || 0) - (nodeTotalValues.get(a.name) || 0);
      });
    } else {
      // Reset the node sorting for other views
      sankeyGenerator.nodeSort(null);
    }

    // 6. Generate Sankey graph
    const graph = sankeyGenerator({
      nodes: filteredNodes.map(d => Object.assign({}, d)),
      links: remappedLinks
    });

    // Clear previous content
    chartContent.selectAll("*").remove();

    // 7. Draw links
    chartContent.append("g")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("d", sankey.sankeyLinkHorizontal())
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("stroke", d => {
        if (d.target.type === "expense" && d.sign === -1) return "#E57373"; // Red for negative expenses
        if (d.target.type === "expense" && d.sign === 1) return "#388e3c"; // Green for postive expenses
        if (d.target.type === "cashflow") return "#388e3c"; // Green for CASHFLOW
        return "#4CAF50"; // Default purple
      })
      .attr("fill", "none")
      .attr("opacity", 0.6);

    // 8. Draw link labels - Find top 5 biggest flows and always show them
    // Sort links by value to find the top 5
    const sortedLinks = [...graph.links].sort((a, b) => b.value - a.value);
    const top5Links = new Set(sortedLinks.slice(0, 5));

    // 9. Draw nodes
    chartContent.append("g")
      .selectAll("rect")
      .data(graph.nodes)
      .join("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => {
        // Daily: "#d3d3d3",
        // Splurge: "#FFA500",
        // Smile: "#FFDE21",
        // Fire: "#D2042D",
        if (d.type === "income") return "#006400";
        if (d.type === "account" && d.name === "Daily") return "#b0b0b0";
        if (d.type === "account" && d.name === "Splurge") return "#FFA500";
        if (d.type === "account" && d.name === "Smile") return "#FFDE21";
        if (d.type === "account" && d.name === "Fire") return "#a30000";
        if (d.type === "expense") {
          // Find the incoming link(s) for this node and use its sign
          const incoming = graph.links.find(l => l.target.name === d.name);
          if (incoming && incoming.sign === -1) return "#E57373"; // Red for negative expenses
          if (incoming && incoming.sign === 1) return "#4CAF50"; // Green for positive expenses
          return "var(--color-muted)"; // fallback color
        }
        if (d.type === "cashflow") return "#4CAF50"; // Green for CASHFLOW
        return "#4C9F70"; // Default
      })
      .style("cursor", "pointer")
      .on("click", function(event, d) {
        handleNodeClick(d);
      });

    // 10. Draw node labels
    chartContent.append("g")
      .selectAll("text.node-label")
      .data(graph.nodes)
      .join("text")
      .attr("class", "node-label")
      .attr("x", d => d.x0 - 6)
      .attr("y", d => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .style("font-size", "12px")
      .style("cursor", "pointer")
      .text(d => d.type === "expense" ? d.name.replace("@", "") : d.name) // Remove @ for expense categories
      .filter(d => d.x0 < width / 2)
      .attr("x", d => d.x1 + 6)
      .attr("text-anchor", "start")
      .on("click", function(event, d) {
        handleNodeClick(d);
      });

    // 11. Add value labels to nodes with consistent
    // calculation regardless of view
    chartContent.append("g")
      .selectAll("text.node-value")
      .data(graph.nodes)
      .join("text")
      .attr("class", "node-value")
      .attr("x", d => d.x0 - 6)
      .attr("y", d => (d.y0 + d.y1) / 2 + 14) // Position below the name
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .style("font-size", "10px")
      .style("fill", "var(--color-text-secondary)")
      .text(d => {
        // Calculate values based on original full data
        let value = 0;
        const nodeName = d.name;
        const nodeType = d.type;

        // For the original nodes in fullData
        const originalNodeIndex = fullData.nodes.findIndex(n => n.name === nodeName);

        if (originalNodeIndex >= 0) {
          if (nodeType === "income") {
            // For income nodes, sum all outgoing links
            value = d3.sum(fullData.links.filter(l =>
              fullData.nodes[l.source].name === nodeName
            ), l => l.value);
          } else if (nodeType === "account") {
            // For account nodes, sum all incoming links
            value = d3.sum(fullData.links.filter(l =>
              fullData.nodes[l.target].name === nodeName
            ), l => l.value);
          } else {
            // For expense/cashflow nodes, sum all incoming links
            value = d3.sum(fullData.links.filter(l =>
              fullData.nodes[l.target].name === nodeName
            ), l => l.value);
          }
        }

        return `${value.toFixed(2)}  ${AppStateService.instance.currency}`;
      })
      .filter(d => d.x0 < width / 2)
      .attr("x", d => d.x1 + 6)
      .attr("text-anchor", "start");
  }

  function handleNodeClick(node) {
    // Determine which side of the chart was clicked based on node type
    if (zoomState === "full") {
      if (node.type === "income") {
        zoomState = "income";
        createChart("income");
      } else if (node.type === "expense" || node.type === "cashflow" || node.type === "account") {
        // Include account in the condition to allow zooming from middle nodes too
        zoomState = "expense";
        createChart("expense");
      }
    } else {
      // If already zoomed, reset to full view
      resetZoom();
    }
  }

  function resetZoom() {
    zoomState = "full";
    createChart();
  }

  // Initialize the chart
  createChart();

}
/**
 * Renders a monthly savings-rate bar chart (income − expenses / income × 100)
 * with a 20% target reference line and a quadratic regression trend.
 */
export function createSavingsRate() {
    d3.select("#chart-container").selectAll("*").remove();

    // Dimensions
    const margin = { top: 20, right: 50, bottom: 60, left: 50 };
    const width = window.innerWidth - margin.left - margin.right - 20;
    const height = window.innerHeight - margin.top - margin.bottom - 80 - 75;

    const svg = d3.select("#chart-container")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = (d: string) => new Date(d);

    const transactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter)
      .map(t => ({
        date: parseDate(t.date),
        month: `${parseDate(t.date).getFullYear()}-${(parseDate(t.date).getMonth() + 1).toString().padStart(2, '0')}`,
        amount: Number(t.amount),
        account: t.account,
        category: t.category || "Other"
      }));

    // Group by month
    const monthlyData = d3.rollups(
      transactions,
      (values: { date: Date; month: string; amount: number; account: string; category: string }[]) => {
        const income = values
          .filter((t: { account: string }) => t.account === "Income")
          .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

        const expenses = values
          .filter((t: { account: string }) => t.account !== "Income")
          .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

        const savings = income + expenses;
        const rate = income > 0 ? savings / income : 0;

        return { income, expenses, savings, rate, transactions: values };
      },
      (d: { month: string }) => d.month
    ).filter(([month]) => {
      // Remove current month only when showing average view
      if (!StatsComponent.showAverageView) {
        return true; // Include all months for total view
      }
      const now = new Date();
      const [year, mon] = month.split('-').map(Number);
      return !(year === now.getFullYear() && mon === now.getMonth() + 1);
    });

    // Sort by month
    const sortedData = monthlyData
      .map(([month, values]) => ({
        month: new Date(month + "-01"),
        ...values
      }))
      .sort((a, b) => a.month.getTime() - b.month.getTime());

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(sortedData, d => d.month) as [Date, Date])
      .range([0, width]);

    const yMin = d3.min(sortedData, d => d.rate)!;
    const yMax = d3.max(sortedData, d => d.rate)!;
    const y = d3.scaleLinear()
      .domain([Math.min(0, yMin * 1.1), yMax * 1.1])
      .range([height, 0]);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y") as any))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    svg.append("g")
      .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

    // Line generator
    const line = d3.line<any>()
      .x(d => x(d.month))
      .y(d => y(d.rate));

    // Background for negative values (light red, 50% transparent)
    svg.append("rect")
      .attr("x", 0)
      .attr("y", y(0))
      .attr("width", width)
      .attr("height", height - y(0))
      .attr("fill", "rgba(255, 0, 0, 0.1)");

    // Line path
    svg.append("path")
      .datum(sortedData)
      .attr("fill", "none")
      .attr("stroke", "green")
      .attr("stroke-width", 4)
      .attr("d", line);
    
  // Quadratic regression trend line
  StatsComponent.d3Service.drawTrendLine({
    svg, xScale: x, yScale: y,
    data: sortedData.map(d => ({ date: d.month, value: d.rate }))
  });

    // Dots and info card logic
    svg.selectAll(".kpi-dot")
      .data(sortedData)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.month))
      .attr("cy", d => y(d.rate))
      .attr("r", 6)
      .attr("fill", "darkgreen")
      .attr("class", "kpi-dot")
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        // Only show tooltip if no expanded info box is present
        if (d3.select("#kpi-info-box").empty()) {
          const dotX = x(d.month) + margin.left;
          const side = dotX < window.innerWidth / 2 ? "right" : "left";
          const left = side === "right"
            ? dotX + 12
            : dotX - 200; // box width
          const top = y(d.rate) + margin.top - 10;

            d3.select("#chart-container")
            .append("div")
            .attr("class", "dot-tooltip")
            .style("position", "absolute")
            .style("left", `${left}px`)
            .style("top", `${top}px`)
            .style("background", "var(--color-surface)")
            .style("border", "1px solid var(--color-primary)")
            .style("padding", "12px 16px")
            .style("border-radius", "6px")
            .style("font-size", "14px")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
            .style("pointer-events", "none")
            .style("min-width", "150px")
            .html(`
              <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br/>
              Savings Rate: <span style="color:${d.rate < 0 ? 'red' : 'var(--color-text)'}">${(d.rate * 100).toFixed(1)}%</span><br/>
              <span style="color:var(--color-primary);font-size:13px;">Click for details</span>
            `);
        }
      })
      .on("mouseleave", () => {
        // Only remove tooltip if no expanded info box is present
        if (d3.select("#kpi-info-box").empty()) {
          d3.selectAll(".dot-tooltip").remove();
        }
      })
      .on("click", function (event, d) {
        // Remove any existing info box or tooltip
        d3.select("#kpi-info-box").remove();
        d3.selectAll(".dot-tooltip").remove();

        // Gather all transactions for this month
        const monthStr = d3.timeFormat("%Y-%m")(d.month);
        const transactions = d.transactions
          .filter((t: any) =>
            `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}` === monthStr
          )
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Build expandable info content
        let info = `
          <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br/>
          Savings Rate: <span style="color:${d.rate < 0 ? 'red' : 'var(--color-text)'}">${(d.rate * 100).toFixed(1)}%</span><br/>
          Income: <span style="color:${d.income < 0 ? 'red' : 'var(--color-text)'}">${d.income.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
          Expenses: <span style="color:${d.expenses < 0 ? 'red' : 'var(--color-text)'}">${d.expenses.toFixed(2)} ${AppStateService.instance.currency}</span><br/>
          Savings: <span style="color:${d.savings < 0 ? 'red' : 'var(--color-text)'}">${d.savings.toFixed(2)} ${AppStateService.instance.currency}</span>
          <br>
          <a href="#" id="expand-savings-details" style="color:var(--color-primary);text-decoration:underline;font-size:13px;">Show Details</a>
          <div id="savings-details-list" style="display:none;max-height:180px;overflow:auto;margin-top:8px;">
            <ul style="padding-left:18px;margin:0;">
              ${transactions.map((t: any) => `
          <li>
            ${d3.timeFormat("%b %d, %Y")(new Date(t.date))}: 
            <span style="color:${Number(t.amount) < 0 ? 'red' : 'var(--color-text)'}">${Number(t.amount).toFixed(2)} ${AppStateService.instance.currency}</span>
            (${t.account}${t.category ? ', ' + t.category.replace("@", "") : ""})
          </li>
              `).join("")}
            </ul>
          </div>
        `;

        // Calculate position
        const dotX = x(d.month) + margin.left;
        const side = dotX < window.innerWidth / 2 ? "right" : "left";
        const left = side === "right"
          ? dotX + 12
          : dotX - 200; // box width
        const top = y(d.rate) + margin.top - 10;

        d3.select("#chart-container")
          .append("div")
          .attr("id", "kpi-info-box")
          .style("position", "absolute")
          .style("left", `${left}px`)
          .style("top", `${top}px`)
          .style("background", "var(--color-surface)")
          .style("border", "1px solid var(--color-primary)")
          .style("padding", "12px 16px")
          .style("border-radius", "6px")
          .style("font-size", "14px")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("min-width", "150px")
          .html(info);

        // Add expand/collapse logic
        setTimeout(() => {
          const expandLink = document.getElementById("expand-savings-details");
          const detailsList = document.getElementById("savings-details-list");
          if (expandLink && detailsList) {
            expandLink.onclick = function (e) {
              e.preventDefault();
              if (detailsList.style.display === "none") {
                detailsList.style.display = "block";
                expandLink.textContent = "Hide Details";
              } else {
                detailsList.style.display = "none";
                expandLink.textContent = "Show Details";
              }
              e.stopPropagation();
              return false;
            };
          }
        }, 0);

        // Remove info box on next click anywhere except on the dot or expand link
        d3.select("body").on("click.kpi-info", function (e) {
          if (
            !d3.select(e.target).classed("kpi-dot") &&
            !d3.select(e.target).attr("id")?.startsWith("expand-savings-details")
          ) {
            d3.select("#kpi-info-box").remove();
            d3.select("body").on("click.kpi-info", null);
          }
        }, true);

        // Prevent event from bubbling up to body
        event.stopPropagation();
      })
      .append("title")
      .text(d => `Savings Rate: ${(d.rate * 100).toFixed(1)}%`);

    // KPI Title (centered)
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(StatsComponent.translateService.instant('KPI.savingsRate'));

    // Threshold line at 20%
    svg.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(0.2))
      .attr("y2", y(0.2))
      .attr("stroke", "red")
      .attr("stroke-dasharray", "4 4");

    svg.append("text")
      .attr("x", width - 60)
      .attr("y", y(0.2) - 5)
      .attr("fill", "red")
      .style("font-size", "12px")
      .text("Target: 20%");
}
/**
 * Renders a monthly burn-rate bar chart showing total expenses per month
 * with an average-line overlay and a quadratic regression trend.
 */
export function createBurnRate() {
  d3.select("#chart-container").selectAll("*").remove();

  const margin = { top: 20, right: 30, bottom: 60, left: 60 };
  const width = window.innerWidth - margin.left - margin.right - 20;
  const height = window.innerHeight - margin.top - margin.bottom - 80 - 75;

  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const parseDate = (d: string) => new Date(d);

  const transactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter)
    .map(t => ({
    date: parseDate(t.date),
    month: `${parseDate(t.date).getFullYear()}-${(parseDate(t.date).getMonth() + 1).toString().padStart(2, '0')}`,
    amount: Number(t.amount),
    category: t.category || "Other",
    account: t.account
    }));

  const monthly = d3.rollups(
    transactions,
    values => values
      .filter(v => v.account !== "Income")
      .reduce((sum, v) => sum + (v.amount > 0 ? -v.amount : Math.abs(v.amount)), 0),
    d => d.month
  );

  const data = monthly
    .map(([month, amount]) => ({
      month: new Date(month + "-01"),
      amount
    }))
    .sort((a, b) => a.month.getTime() - b.month.getTime());

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.month) as [Date, Date])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.amount)! * 1.1])
    .range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y") as any))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));

  // Split data into finished and unfinished
const finishedData = data.slice(0, -1); // All except last
const unfinishedData = data.slice(-2);  // Last two points

// Calculate total active fixed income from subscriptions
const now = new Date();
const activeFixedIncome = AppStateService.instance.allSubscriptions
  .filter(sub => sub.account === "Income" && (!sub.endDate || new Date(sub.endDate) >= now))
  .reduce((sum, sub) => sum + Number(sub.amount), 0);

// Draw active fixed income as a green dashed line
svg.append("line")
  .attr("x1", 0)
  .attr("x2", width)
  .attr("y1", y(activeFixedIncome))
  .attr("y2", y(activeFixedIncome))
  .attr("stroke", "#388e3c")
  .attr("stroke-width", 2)
  .attr("stroke-dasharray", "6,4");

svg.append("text")
  .attr("x", 10)
  .attr("y", y(activeFixedIncome) - 8)
  .attr("fill", "#388e3c")
  .style("font-size", "12px")
  .text(`Income: ${activeFixedIncome.toFixed(2)} ${AppStateService.instance.currency}`);

// Draw background for burn rate above active fixed income (light red, 50% transparent)
svg.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", width)
  .attr("height", y(activeFixedIncome))
  .attr("fill", "rgba(255, 0, 0, 0.1)");

// Draw finished line (main color)
svg.append("path")
  .datum(finishedData)
  .attr("fill", "none")
  .attr("stroke", "#e91e63")
  .attr("stroke-width", 4)
  .attr("d", d3.line<any>()
    .x(d => x(d.month))
    .y(d => y(d.amount))
  );

// Draw unfinished line (light grey)
if (unfinishedData.length === 2) {
  svg.append("path")
    .datum(unfinishedData)
    .attr("fill", "none")
    .style("stroke", "var(--color-border)")
    .attr("stroke-width", 4)
    .attr("stroke-dasharray", "4,4")
    .attr("d", d3.line<any>()
      .x(d => x(d.month))
      .y(d => y(d.amount))
    );
}


  // Quadratic regression trend line (excluding last unfinished month)
  StatsComponent.d3Service.drawTrendLine({
    svg, xScale: x, yScale: y,
    data: data.slice(0, -1).map(d => ({ date: d.month, value: d.amount }))
  });

    // Draw dots
  svg.selectAll(".kpi-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.month))
    .attr("cy", d => y(d.amount))
    .attr("r", 6)
    .attr("fill", (d, i) => i === data.length - 1 ? "var(--color-border)" : "#e91e63") // Last dot is grey
    .attr("class", "kpi-dot")
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      // Only show tooltip if no expanded info box is present
      if (d3.select("#kpi-info-box").empty()) {
        const dotX = x(d.month) + margin.left;
        const side = dotX < window.innerWidth / 2 ? "right" : "left";
        const left = side === "right"
          ? dotX + 12
          : dotX - 200; // box width
        const top = y(d.amount) + margin.top - 10;

        d3.select("#chart-container")
          .append("div")
          .attr("class", "dot-tooltip")
          .style("position", "absolute")
          .style("left", `${left}px`)
          .style("top", `${top}px`)
          .style("background", "var(--color-surface)")
          .style("border", "1px solid #e91e63")
          .style("padding", "12px 16px")
          .style("border-radius", "6px")
          .style("font-size", "14px")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("pointer-events", "none")
          .style("min-width", "150px")
          .html(`
            <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br/>
            Burn Rate: <span style="color:${d.amount*-1 < 0 ? 'red' : 'var(--color-text)'}">${d.amount.toFixed(2)*-1} ${AppStateService.instance.currency}</span><br/>
            <span style="color:#e91e63;font-size:13px;">Click for details</span>
          `);
      }
    })
    .on("mouseleave", () => {
      // Only remove tooltip if no expanded info box is present
      if (d3.select("#kpi-info-box").empty()) {
        d3.selectAll(".dot-tooltip").remove();
      }
    })
    .on("click", function(event, d) {
      // Remove any existing info box or tooltip
      d3.select("#kpi-info-box").remove();
      d3.selectAll(".dot-tooltip").remove();

      // Gather all transactions for this month (excluding Income)
      const monthStr = d3.timeFormat("%Y-%m")(d.month);
      const transactions = AppStateService.instance.allTransactions
        .filter(t => {
          const tDate = new Date(t.date);
          return (
            `${tDate.getFullYear()}-${(tDate.getMonth() + 1).toString().padStart(2, '0')}` === monthStr &&
            t.account !== "Income"
          );
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Build expandable info content
      let info = `
        <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br/>
        Burn Rate: <span style="color:${d.amount*-1 < 0 ? 'red' : 'var(--color-text)'}">${d.amount.toFixed(2)*-1} ${AppStateService.instance.currency}</span>
        <br>
        <a href="#" id="expand-burn-details" style="color:#e91e63;text-decoration:underline;font-size:13px;">Show Details</a>
        <div id="burn-details-list" style="display:none;max-height:180px;overflow:auto;margin-top:8px;">
          <ul style="padding-left:18px;margin:0;">
        ${transactions
          .filter(t => t.account !== "Mojo")
          .map(t => `
          <li>
            ${d3.timeFormat("%b %d, %Y")(new Date(t.date))}: <span style="color:${Number(t.amount) < 0 ? 'red' : 'var(--color-text)'}">${Number(t.amount).toFixed(2)} ${AppStateService.instance.currency}</span> (${t.category.replace("@", "") || "Other"})
          </li>
        `).join("")}
          </ul>
        </div>
      `;

      // Calculate position
      const dotX = x(d.month) + margin.left;
      const side = dotX < window.innerWidth / 2 ? "right" : "left";
      const left = side === "right"
        ? dotX + 12
        : dotX - 200; // box width
      const top = y(d.amount) + margin.top - 10;

      d3.select("#chart-container")
        .append("div")
        .attr("id", "kpi-info-box")
        .style("position", "absolute")
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .style("background", "var(--color-surface)")
        .style("border", "1px solid #e91e63")
        .style("padding", "12px 16px")
        .style("border-radius", "6px")
        .style("font-size", "14px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("min-width", "150px")
        .html(info);

      // Add expand/collapse logic
      setTimeout(() => {
        const expandLink = document.getElementById("expand-burn-details");
        const detailsList = document.getElementById("burn-details-list");
        if (expandLink && detailsList) {
          expandLink.onclick = function(e) {
            e.preventDefault();
            if (detailsList.style.display === "none") {
              detailsList.style.display = "block";
              expandLink.textContent = "Hide Details";
            } else {
              detailsList.style.display = "none";
              expandLink.textContent = "Show Details";
            }
            e.stopPropagation();
            return false;
          };
        }
      }, 0);

      // Remove info box on next click anywhere except on the dot or expand link
      d3.select("body").on("click.kpi-info", function(e) {
        if (
          !d3.select(e.target).classed("kpi-dot") &&
          !d3.select(e.target).attr("id")?.startsWith("expand-burn-details")
        ) {
          d3.select("#kpi-info-box").remove();
          d3.select("body").on("click.kpi-info", null);
        }
      }, true);

      // Prevent event from bubbling up to body
      event.stopPropagation();
    })
    .append("title")
    .text(d => `Burn Rate: ${d.amount.toFixed(2)}`);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('KPI.burnRate'));
}
/**
 * Renders a horizontal bar chart of the top N spending categories.
 * Supports period-based filtering and swipe navigation between periods.
 * @param selectedPeriod - Time grouping ('all', 'year', 'quarter', 'month').
 * @param selectedIndex - Index within the selected period for navigation.
 * @param numCategories - Number of top categories to display (default 5).
 */
export function createTopSpendingCategories(selectedPeriod: string = "all", selectedIndex: number = 0, numCategories: number = 5) {
  d3.select("#chart-container").selectAll("*").remove();

  // Save period/index for swipe navigation
  StatsComponent.period = selectedPeriod;
  StatsComponent.Index = selectedIndex;

  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const width = window.innerWidth - margin.left - margin.right - 20;
  const height = window.innerHeight - margin.top - margin.bottom - 80 - 75;

  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const parseDate = (d: string) => new Date(d);

  // Filter transactions using the unified chart filter
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter);

  const transactions = filteredTransactions
    .filter(t => Number(t.amount) < 0 && t.account !== "Income")
    .map(t => ({
    date: parseDate(t.date),
    category: t.category || "Other",
    amount: Math.abs(Number(t.amount)),
    account: t.account
    }));

  const totals = d3.rollups(
    transactions,
    v => d3.sum(v, d => d.amount),
    d => d.category.replace("@", "")
  );

  let maxCategories = numCategories;
  if (maxCategories === -1) { // If "all" is selected
    maxCategories = totals.length;
  }

  const topCategories = totals.sort((a, b) => b[1] - a[1]).slice(0, maxCategories);

  const x = d3.scaleBand()
    .domain(topCategories.map(d => d[0]))
    .range([0, width])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(topCategories, d => d[1])! * 1.1])
    .range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));

  // Bars
  svg.selectAll(".bar")
    .data(topCategories)
    .enter()
    .append("rect")
    .attr("x", d => x(d[0])!)
    .attr("y", d => y(d[1]))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d[1]))
    .attr("fill", "#ff9800");

  // Value labels above bars
  svg.selectAll(".bar-label")
    .data(topCategories)
    .enter()
    .append("text")
    .attr("x", d => x(d[0])! + x.bandwidth() / 2)
    .attr("y", d => y(d[1]) - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--color-text)")
    .style("font-size", "13px")
    .text(d => d[1].toFixed(2));

  // Small black dot for expand/click
  svg.selectAll(".expand-dot")
    .data(topCategories)
    .enter()
    .append("circle")
    .attr("cx", d => x(d[0])! + x.bandwidth() / 2)
    .attr("cy", d => y(d[1]) + 14)
    .attr("r", 4)
    .attr("fill", "var(--color-text-secondary)")
    .attr("class", "expand-dot")
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      // Remove any existing info box
      d3.select("#kpi-info-box").remove();

      // Gather all transactions for this category
      const category = d[0];
      const categoryTransactions = filteredTransactions
        .filter(t => (t.category || "Other").replace("@", "") === category)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Build expandable info content
      let info = `
        <strong>${category}</strong><br/>
        Total: ${d[1].toFixed(2)} ${AppStateService.instance.currency}
        <br>
        <a href="#" id="expand-details" style="color:#ff9800;text-decoration:underline;font-size:13px;">Show Details</a>
        <div id="details-list" style="display:none;max-height:180px;overflow:auto;margin-top:8px;">
          <ul style="padding-left:18px;margin:0;">
        ${categoryTransactions.map(t => `
          <li>
        ${d3.timeFormat("%b %d, %Y")(new Date(t.date))}: <span style="color:${Number(t.amount) < 0 ? 'red' : 'var(--color-text)'}">${Number(t.amount).toFixed(2)} ${AppStateService.instance.currency}</span>
          </li>
        `).join("")}
          </ul>
        </div>
      `;
      // Calculate the dot's x position as a percentage of the chart width
      const dotX = x(d[0])! + x.bandwidth() / 2;
      const chartWidth = width;
      const dotPercent = dotX / chartWidth;

      const infoBoxWidth = 190;
      let left: number;
      // Make the info box closer to the dot (reduce offset from 40 to 10)
      let top = y(d[1]) + margin.top - 10;

      if (dotPercent < 0.5) {
        // Place box to the right of the dot
        left = dotX + margin.left + 12;
      } else {
        // Place box to the left of the dot
        left = dotX + margin.left - infoBoxWidth;
      }

      // Prevent box from going off the top or bottom of the window
      if (top < 10) top = 10;
      if (top + 180 > window.innerHeight) top = window.innerHeight - 200;

      d3.select("#chart-container")
        .append("div")
        .attr("id", "kpi-info-box")
        .style("position", "absolute")
        .style("left", left + "px")
        .style("top", top + "px")
        .style("background", "var(--color-surface)")
        .style("border", "1px solid var(--color-warning)")
        .style("border-radius", "6px")
        .style("padding", "10px 16px")
        .style("font-size", "14px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("min-width", "150px")
        .html(info);

      // Add expand/collapse logic
      setTimeout(() => {
        const expandLink = document.getElementById("expand-details");
        const detailsList = document.getElementById("details-list");
        if (expandLink && detailsList) {
          expandLink.onclick = function(e) {
            e.preventDefault();
            if (detailsList.style.display === "none") {
              detailsList.style.display = "block";
              expandLink.textContent = "Hide Details";
            } else {
              detailsList.style.display = "none";
              expandLink.textContent = "Show Details";
            }
            e.stopPropagation();
            return false;
          };
        }
      }, 0);

      d3.select("body").on("click.kpi-info", function(e) {
        if (!d3.select(e.target).classed("expand-dot") && !d3.select(e.target).attr("id")?.startsWith("expand-details")) {
          d3.select("#kpi-info-box").remove();
          d3.select("body").on("click.kpi-info", null);
        }
      }, true);

      // Prevent event from bubbling up to body
      event.stopPropagation();
    })
    .append("title")
    .text(d => `Total: ${d[1].toFixed(2)}`);

  // Title at the top
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('KPI.topSpending'));

  // Add category count selector in top left
  const categorySelectContainer = d3.select("#chart-container")
    .append("div")
    .style("position", "absolute")
    .style("top", "70px")
    .style("left", "15px")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "5px");

  const categorySelect = categorySelectContainer.append("select")
    .style("border", "2px solid var(--color-primary)")
    .style("border-radius", "20px")
    .style("padding", "4px 5px")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .style("color", "var(--color-primary)")
    .style("background-color", "var(--color-surface)")
    .style("cursor", "pointer")
    .style("outline", "none")
    .on("change", function() {
      const selectedValue = +(this as HTMLSelectElement).value;
      StatsComponent.numCategories = selectedValue;
      createTopSpendingCategories(selectedPeriod, selectedIndex, selectedValue);
    });

  // Add options for category count
  const categoryOptions = [5, 10, 15, -1]; // -1 represents "all"
  categoryOptions.forEach(option => {
    categorySelect.append("option")
      .attr("value", option)
      .attr("selected", option === numCategories ? "selected" : null)
      .text(option === -1 ? "All" : "Top " + option);
  });
}
/**
 * Renders a stacked bar chart comparing recurring (subscription-matched) vs.
 * one-time expenses per category for the selected period.
 */
export function createRecurringVsOneTimeChart(selectedPeriod: string = "all", selectedIndex: number = 0) {
  // Remove all chart content
  d3.select("#chart-container").selectAll("*").remove();

  // Save period/index for swipe navigation
  StatsComponent.period = selectedPeriod;
  StatsComponent.Index = selectedIndex;

  // Filter transactions using the unified chart filter
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter);

  // Group by type and category
  const expenseMap = new Map<string, Map<string, number>>();
  filteredTransactions
    .filter(t => t.account !== "Income" && Number(t.amount) < 0)
    .forEach(t => {
      const title = t.comment.split(" + ")[0];
      const comment = t.comment.split(" + ")[1];
      const isRecurring = AppStateService.instance.allSubscriptions.some(sub =>
        sub.title === title && sub.account === t.account && sub.comment === comment && sub.amount === t.amount
      );
      // Always use these exact keys for color mapping
      const type = isRecurring ? "Recurring" : "One-time";
      const category = (t.category || "Other").replace("@", "");
      if (!expenseMap.has(type)) expenseMap.set(type, new Map());
      const catMap = expenseMap.get(type)!;
      catMap.set(category, (catMap.get(category) || 0) + Math.abs(Number(t.amount)));
    });

  // Prepare data for pie
  // Always order as Recurring, One-time for color consistency
  const data: { type: string, total: number, categories: { category: string, value: number }[] }[] = [];
  if (expenseMap.has("Recurring")) {
    const catMap = expenseMap.get("Recurring")!;
    data.push({
      type: "Recurring",
      total: Array.from(catMap.values()).reduce((a, b) => a + b, 0),
      categories: Array.from(catMap.entries()).map(([cat, val]) => ({ category: cat, value: val }))
    });
  }
  if (expenseMap.has("One-time")) {
    const catMap = expenseMap.get("One-time")!;
    data.push({
      type: "One-time",
      total: Array.from(catMap.values()).reduce((a, b) => a + b, 0),
      categories: Array.from(catMap.entries()).map(([cat, val]) => ({ category: cat, value: val }))
    });
  }

  // Chart dimensions
  const container = document.getElementById("chart-container");
  const width = container ? container.clientWidth : window.innerWidth - 20;
  const height = window.innerHeight - 150;
  const isLandscape = width > height;
  const radius = Math.min(width, height) * (isLandscape ? 0.85 : 1) / 2;

  // SVG
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height - 10)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);
  
  // Pie
  // Always map "Recurring" to blue, "One-time" to red
  const color = d3.scaleOrdinal<string, string>()
    .domain(["Recurring", "One-time"])
    .range(["#3f51b5", "#f44336"]);

  const pie = d3.pie<any>().value(d => d.total);
  const arc = d3.arc<any>().innerRadius(0).outerRadius(radius);

  // Draw pie
  const pieGroups = svg.selectAll('g.pie-section')
    .data(pie(data))
    .enter()
    .append('g')
    .attr('class', 'pie-section');

  pieGroups.append('path')
    .attr('d', arc)
    .attr('fill', d => color(d.data.type))
    .attr("stroke", "white")
    .style("stroke-width", "2px")
    .on("click", function(event, d) {
      d3.selectAll(".pie-tooltip").remove();
      d3.select("#kpi-info-box").remove();
      let html = `<strong>${d.data.type}: ${(d.data.total * -1).toFixed(2)} ${AppStateService.instance.currency}</strong><br>`;
      html += "<div style='max-height:180px;overflow:auto;'><ul style='margin:0;padding-left:18px;'>";
      d.data.categories
        .sort((a, b) => b.value - a.value)
        .forEach(cat => {
          const displayValue = cat.value * -1;
          const color = displayValue < 0 ? 'red' : 'var(--color-text)';
          html += `<li>${cat.category}: <span style="color:${color}">${displayValue.toFixed(2)} ${AppStateService.instance.currency}</span></li>`;
        });
      html += "</ul></div>";

      // Calculate left/right position based on click X
      const screenWidth = window.innerWidth;
      const boxWidth = 220;
      let left: number;
      if (event.pageX > screenWidth * 0.6) {
        // Clicked on right side, show box to the left of cursor
        left = event.pageX - boxWidth - 10;
      } else {
        // Default: show box to the right of cursor
        left = event.pageX + 10;
      }

      d3.select("#chart-container")
        .append("div")
        .attr("id", "kpi-info-box")
        .style("position", "absolute")
        .style("left", `${left}px`)
        .style("top", `${event.pageY - 28}px`)
        .style("background", "var(--color-surface)")
        .style("padding", "12px 16px")
        .style("border", "1px solid var(--color-primary)")
        .style("border-radius", "6px")
        .style("font-size", "14px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("min-width", "180px")
        .html(html);

      d3.select("body").on("click.kpi-info", function(e) {
        if (!d3.select(e.target).classed("pie-section")) {
          d3.select("#kpi-info-box").remove();
          d3.select("body").on("click.kpi-info", null);
        }
      }, true);

      event.stopPropagation();
    });

  // Add labels (multi-line, larger, more readable, with colored background for contrast)
  pieGroups.append('g')
    .attr("transform", d => `translate(${arc.centroid(d)})`)
    .each(function(d) {
      const group = d3.select(this);
      const lines = [
        d.data.type,
        `${((d.data.total / d3.sum(data, d => d.total)) * 100).toFixed(1)}%`
      ];

      // Background rect (rounded, color based on type)
      const bgColor = d.data.type === "Recurring" ? "#e3eafc" : "#fdeaea";
      const textColor = d.data.type === "Recurring" ? "#3f51b5" : "#f44336";

      // Dummy text to measure size
      const tempText = group.append("text")
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("visibility", "hidden")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .attr("dominant-baseline", "middle");

      lines.forEach((line, i) => {
        tempText.append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? 0 : "1.1em")
          .text(line.length > 16 ? line.slice(0, 14) + "…" : line);
      });

      // Get bbox for background
      const bbox = (tempText.node() as SVGTextElement).getBBox();
      tempText.remove();

      // Draw background rect
      group.append("rect")
        .attr("x", bbox.x - 6)
        .attr("y", bbox.y - 3)
        .attr("width", bbox.width + 12)
        .attr("height", bbox.height + 6)
        .attr("rx", 7)
        .attr("fill", bgColor)
        .attr("opacity", 0.92);

      // Draw text
      const text = group.append("text")
        .style("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("fill", textColor)
        .attr("dominant-baseline", "middle")
        .style("pointer-events", "none");

      lines.forEach((line, i) => {
        text.append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? 0 : "1.1em")
          .text(line.length > 16 ? line.slice(0, 14) + "…" : line);
      });
    });
}
/**
 * Renders a GitHub-style spending heatmap calendar. Supports year and month view
 * modes with color intensity mapped to daily spending amounts.
 */
export function createHeatmapCalendar(selectedYear: number = new Date().getFullYear(), selectedMonth: number | null = null, viewMode: 'month' | 'year' = 'year') {
  // Clear previous content
  d3.select("#chart-container").selectAll("*").remove();

  // Set dimensions and margins
  const margin = { top: 80, right: 100, bottom: 50, left: 40 };
  // Use window.innerWidth for width, but clamp to 100vw if container is smaller (fixes mobile centering)
  const container = document.getElementById("chart-container");
  let width = (container ? container.clientWidth : window.innerWidth) - margin.left - margin.right;
  let height = window.innerHeight - margin.top - margin.bottom - 80 - 75;

  // On mobile, ensure width is at least 95vw (fixes left-half bug)
  if (window.innerWidth < 600) {
    width = window.innerWidth - margin.left - margin.right - 10;
  }

  // Cell dimensions - adjust based on view mode
  let cellSize: number;
  if (viewMode === 'year') {
    cellSize = Math.min(Math.floor(width / 53), Math.floor((height - 20) / 7)); // 53 weeks max in a year, 7 days in a week
  } else {
    // For month view, we can make cells larger since we're showing fewer weeks
    cellSize = Math.min(Math.floor(width / 6), Math.floor((height - 20) / 7)); // ~6 weeks max in a month
  }
  const cellMargin = 2;

  // Determine date range based on view mode
  let startDate: Date, endDate: Date;

  if (viewMode === 'year') {
    startDate = new Date(selectedYear, 0, 1);
    endDate = new Date(selectedYear, 11, 31, 23, 59, 59);
  } else {
    // Month view - ensure selectedMonth is not null
    const month = selectedMonth !== null ? selectedMonth : new Date().getMonth();
    startDate = new Date(selectedYear, month, 1);
    // Set end date to the last day of the selected month
    endDate = new Date(selectedYear, month + 1, 0, 23, 59, 59);
  }

  // Get ALL transactions (both income and expenses)
  const filteredTransactions = AppStateService.instance.allTransactions
    .filter(t => {
    const date = new Date(t.date);
    return t.account !== "Mojo" && date >= startDate && date <= endDate;
    })
    .map(t => ({
    date: new Date(t.date),
    amount: Number(t.amount) // Keep original sign
    }));

  // Get daily sums using d3.rollup (preserving positive/negative values)
  const dailySums = d3.rollups(
    filteredTransactions,
    v => d3.sum(v, d => d.amount),
    d => d3.timeFormat("%Y-%m-%d")(d.date)
  );

  // Create a map for easier lookups
  const dailySumsMap = new Map(dailySums);

  // Get min and max values for color scales
  const values = Array.from(dailySumsMap.values());
  const positiveValues = values.filter(v => Number(v) > 0);
  const negativeValues = values.filter(v => Number(v) < 0).map(v => Math.abs(Number(v)));

  const maxPositive = positiveValues.length > 0 ? d3.max(positiveValues) || 0 : 0;
  const maxNegative = negativeValues.length > 0 ? d3.max(negativeValues) || 0 : 0;

  // Create color scales
  const positiveColorScale = d3.scaleSequential()
    .domain([0, maxPositive])
    .interpolator(d3.interpolateGreens); // Green scale for income

  const negativeColorScale = d3.scaleSequential()
    .domain([0, maxNegative])
    .interpolator(d3.interpolateReds); // Red scale for expenses

  // Generate date array for the selected period
  const endDateForRange = viewMode === 'year'
    ? new Date(selectedYear + 1, 0, 1)
    : new Date(selectedYear, (selectedMonth || 0) + 1, 1);

  const dateRange = d3.timeDays(startDate, endDateForRange);

  // Calculate month-specific information for centering
  let weekCount = 0;
  if (viewMode === 'month') {
    // Count the number of weeks in the month
    weekCount = d3.timeWeeks(startDate, endDateForRange).length;
  }

  // Calculate horizontal offset for centering in month view
  const horizontalOffset = viewMode === 'month'
    ? (width - (weekCount * (cellSize + cellMargin))) / 2
    : 0;

  // Create SVG
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    // Center SVG horizontally in container (fixes mobile bug)
    .style("display", "block")
    .style("margin", "0 auto")
    .style("max-width", "100vw")
    .style("background", "transparent")
    .append("g")
    .attr("transform", `translate(${margin.left + horizontalOffset},${margin.top})`);

  // Add title
  const titleText = viewMode === 'year'
    ? `${StatsComponent.translateService.instant('KPI.heatmapYearTitle')} - ${selectedYear}`
    : `${StatsComponent.translateService.instant('KPI.heatmapMonthTitle')} - ${new Date(selectedYear, selectedMonth || 0).toLocaleString('default', { month: 'long' })} ${selectedYear}`;

  svg.append("text")
    .attr("x", viewMode === 'year' ? width / 2 : (weekCount * (cellSize + cellMargin)) / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text(titleText);

  // Add view mode toggle (Month/Year)
  const viewToggle = d3.select("#chart-container")
    .append("div")
    .style("position", "absolute")
    .style("top", "15px")
    .style("right", "65px")
    .style("display", "flex")
    .style("align-items", "center")
    .style("z-index", "10");

  // Month button
  viewToggle.append("button")
    .text("Month")
    .style("font-size", "14px")
    .style("margin-right", "5px")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "4px")
    .style("background", viewMode === 'month' ? "var(--color-muted)" : "var(--color-surface-alt)")
    .style("font-weight", viewMode === 'month' ? "bold" : "normal")
    .style("cursor", "pointer")
    .style("padding", "5px 10px")
    .on("click", () => {
    createHeatmapCalendar(selectedYear, selectedMonth !== null ? selectedMonth : new Date().getMonth(), 'month');
    });

  // Year button
  viewToggle.append("button")
    .text("Year")
    .style("font-size", "14px")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "4px")
    .style("background", viewMode === 'year' ? "var(--color-muted)" : "var(--color-surface-alt)")
    .style("font-weight", viewMode === 'year' ? "bold" : "normal")
    .style("cursor", "pointer")
    .style("padding", "5px 10px")
    .on("click", () => {
      createHeatmapCalendar(selectedYear, null, 'year');
    });
  
  // Add year/month selector
  const periodSelector = d3.select("#chart-container")
    .append("div")
    .style("position", "absolute")
    .style("top", "70px")
    .style("right", "15px")
    .style("display", "flex")
    .style("align-items", "center");
  
  // Add previous period button
  periodSelector.append("button")
    .text("←")
    .style("font-size", "16px")
    .style("margin-right", "10px")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "4px")
    .style("background", "var(--color-surface-alt)")
    .style("cursor", "pointer")
    .style("padding", "3px 8px")
    .on("click", () => {
      if (viewMode === 'year') {
          createHeatmapCalendar(selectedYear - 1, null, viewMode);
      } else {
          let newMonth = (selectedMonth || 0) - 1;
          let newYear = selectedYear;
          
          if (newMonth < 0) {
              newMonth = 11;
              newYear--;
          }
          
          createHeatmapCalendar(newYear, newMonth, viewMode);
      }
    });
  
  // Display current period
  const periodText = viewMode === 'year' 
      ? `${selectedYear}` 
      : `${new Date(selectedYear, selectedMonth || 0).toLocaleString('default', { month: 'short' })} ${selectedYear}`;
  
  periodSelector.append("span")
    .text(periodText)
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("margin", "0 10px");
  
  // Add next period button
  periodSelector.append("button")
    .text("→")
    .style("font-size", "16px")
    .style("margin-left", "10px")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "4px")
    .style("background", "var(--color-surface-alt)")
    .style("cursor", "pointer")
    .style("padding", "3px 8px")
    .on("click", () => {
      if (viewMode === 'year') {
          createHeatmapCalendar(selectedYear + 1, null, viewMode);
      } else {
          let newMonth = (selectedMonth || 0) + 1;
          let newYear = selectedYear;
          
          if (newMonth > 11) {
              newMonth = 0;
              newYear++;
          }
          
          createHeatmapCalendar(newYear, newMonth, viewMode);
      }
    });
  
  // Calculate week number for each date relative to start of the period
  const timeWeekOffset = viewMode === 'year' 
      ? d3.timeWeek.count(d3.timeYear(startDate), startDate)
      : d3.timeWeek.count(d3.timeMonth(startDate), startDate);
  
  // Generate weeks in the period
  const weekRange = d3.timeWeeks(startDate, endDateForRange);
  
  // Add month labels (only in year view)
  if (viewMode === 'year') {
      const monthLabels = d3.timeMonths(startDate, endDate)
          .map(d => ({
              name: d3.timeFormat("%b")(d),
              startWeek: d3.timeWeek.count(d3.timeYear(startDate), d) // Week number of month start relative to year start
          }));
      
      svg.selectAll(".month-label")
          .data(monthLabels)
          .enter()
          .append("text")
          .attr("class", "month-label")
          .attr("x", d => d.startWeek * (cellSize + cellMargin))
          .attr("y", -5)
          .attr("text-anchor", "start")
          .style("font-size", "12px")
          .text(d => d.name);
  } else {
      // In month view, add week numbers
      svg.selectAll(".week-label")
          .data(weekRange)
          .enter()
          .append("text")
          .attr("class", "week-label")
          .attr("x", (d, i) => i * (cellSize + cellMargin) + cellSize/2)
          .attr("y", -5)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .text((d, i) => `W${i+1}`);
  }
  
  // Add day of week labels - adjust position for month view
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  svg.selectAll(".day-label")
    .data(dayLabels)
    .enter()
    .append("text")
    .attr("class", "day-label")
    .attr("x", -5)
    .attr("y", (d, i) => (i * (cellSize + cellMargin)) + cellSize/2 + 4)
    .attr("text-anchor", "end")
    .style("font-size", "10px")
    .text(d => d);
  
  // Create heatmap cells
  const heatmapCells = svg.selectAll(".day-cell")
    .data(dateRange)
    .enter()
    .append("rect")
    .attr("class", "day-cell")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => {
    // Calculate week number relative to period start
    let weekNum = d3.timeWeek.count(viewMode === 'year' ? d3.timeYear(d) : d3.timeMonth(d), d);
    if (viewMode === 'month') {
      // Adjust for first week potentially starting mid-week
      const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const firstDayOfWeek = firstDayOfMonth.getDay();
      // If first day is not Monday (1), adjust the weekNum
      if (weekNum === 0 && firstDayOfWeek !== 1) {
        weekNum = 0;
      }
    }
    return weekNum * (cellSize + cellMargin);
    })
    .attr("y", d => {
    let day = d.getDay(); // 0 is Sunday
    day = day === 0 ? 6 : day - 1; // Convert to Monday-based (0 = Monday, 6 = Sunday)
    return day * (cellSize + cellMargin);
    })
    .attr("rx", 2)
    .attr("ry", 2)
    .attr("fill", d => {
    const dateKey = d3.timeFormat("%Y-%m-%d")(d);
    const value = Number(dailySumsMap.get(dateKey)) || 0;
    
    if (value > 0) {
      // Positive value (income) - use green scale
      return positiveColorScale(value);
    } else if (value < 0) {
      // Negative value (expense) - use red scale
      return negativeColorScale(Math.abs(value));
    } else {
      // No transactions - neutral color
      return "var(--color-muted-light)";
    }
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .on("mouseover", function(event, d) {
    const dateKey = d3.timeFormat("%Y-%m-%d")(d);
    const formattedDate = d3.timeFormat("%b %d, %Y")(d);
    const value = Number(dailySumsMap.get(dateKey)) || 0;
    
    d3.select(this)
      .attr("stroke", "var(--color-text)")
      .attr("stroke-width", 2);
    
    // Remove any existing tooltip
    d3.select("#heatmap-tooltip").remove();
    
    // Create tooltip
    const tooltip = d3.select("#chart-container")
      .append("div")
      .attr("id", "heatmap-tooltip")
      .style("position", "absolute")
      .style("background", "var(--color-surface)")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "4px")
      .style("padding", "8px 12px")
      .style("box-shadow", "0 1px 4px rgba(0,0,0,0.2)")
      .style("font-size", "13px")
      .style("pointer-events", "none");
    
    // Position tooltip
    const screenWidth = window.innerWidth;
    const boxWidth = 200;
    let left;
    if (event.pageX < screenWidth * 0.6) {
      // Clicked on left side, show box to the right of cursor
      left = event.pageX + 10;
    } else {
      // Clicked on right side, show box to the left of cursor
      left = event.pageX - boxWidth - 10;
    }
    tooltip
      .style("left", `${left}px`)
      .style("top", `${event.pageY - 30}px`);
    
    // Add content with appropriate label based on value
    let valueLabel = "";
    let valueColor = "var(--color-text)";
    if (value > 0) {
      valueLabel = "Net income";
      valueColor = "green";
    } else if (value < 0) {
      valueLabel = "Net spending";
      valueColor = "red";
    } else {
      valueLabel = "No transactions";
    }
    
    tooltip.html(`
      <div><strong>${formattedDate}</strong></div>
      <div>${valueLabel}: <span style="color: ${valueColor};">${Math.abs(value).toFixed(2)} ${AppStateService.instance.currency}</span></div>
    `);
    })
    .on("mouseout", function() {
    d3.select(this)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);
    
    d3.select("#heatmap-tooltip").remove();
    })
    .on("click", function(event, d) {
    d3.select("#heatmap-tooltip").remove();
    // Remove existing details box
    d3.select("#day-details-box").remove();

    const dateKey = d3.timeFormat("%Y-%m-%d")(d);
    const formattedDate = d3.timeFormat("%b %d, %Y")(d);
    
    // Get all transactions for this date
    const dateTransactions = AppStateService.instance.allTransactions
      .filter(t => {
        const transDate = new Date(t.date);
        return d3.timeFormat("%Y-%m-%d")(transDate) === dateKey && t.account !== "Mojo";
      })
      .sort((a, b) => Number(b.amount) - Number(a.amount)); // Sort by amount (income first, then expenses)

    // Show details box
    if (dateTransactions.length > 0) {
      const detailsBox = d3.select("#chart-container")
        .append("div")
        .attr("id", "day-details-box")
        .style("position", "fixed")
        .style("background", "var(--color-surface)")
        .style("border", "1px solid var(--color-warning)")
        .style("border-radius", "6px")
        .style("padding", "12px 16px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("max-width", "70vw")
        .style("width", "70vw")
        .style("max-height", `${window.innerHeight - 40}px`)
        .style("overflow-y", "auto")
        .style("z-index", "100")
        .style("left", "50%")
        .style("top", "50%")
        .style("transform", "translate(-50%, -50%)");
      
      // Calculate totals
      const netValue = Number(dailySumsMap.get(dateKey)) || 0;
      const incomeTotal = dateTransactions
        .filter(t => Number(t.amount) > 0)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expenseTotal = dateTransactions
        .filter(t => Number(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      
      // Add content
      let content = `<h3 style="margin-top:0;">${formattedDate}</h3>`;
      content += `<p><strong>Net: <span style="color: ${netValue >= 0 ? 'green' : 'red'};">${netValue >= 0 ? '+' : '-'}${Math.abs(netValue).toFixed(2)} ${AppStateService.instance.currency}</span></strong></p>`;
      
      if (incomeTotal > 0) {
        content += `<p style="color: green;"><strong>Income: +${incomeTotal.toFixed(2)} ${AppStateService.instance.currency}</strong></p>`;
      }
      if (expenseTotal > 0) {
        content += `<p style="color: red;"><strong>Expenses: -${expenseTotal.toFixed(2)} ${AppStateService.instance.currency}</strong></p>`;
      }
      
      if (dateTransactions.length > 0) {
        content += `<h4 style="margin-bottom:5px;">Transactions:</h4>`;
        content += `<ul style="padding-left:18px;margin:5px 0;">`;
        dateTransactions.forEach(t => {
          const amount = Number(t.amount);
          const isIncome = amount > 0;
          const color = isIncome ? "green" : "red";
          const prefix = isIncome ? "+" : "-";
          
          content += `<li style="margin-bottom:4px;">
            <span style="color:var(--color-text);">${t.category || "Uncategorized"}</span>: 
            <span style="font-weight:bold;color:${color};">${prefix}${Math.abs(amount).toFixed(2)} ${AppStateService.instance.currency}</span>
            ${t.comment ? `<br><span style="font-size:12px;color:var(--color-text-secondary);">${t.comment}</span>` : ""}
            </li>`;
        });
        content += `</ul>`;
      } else {
        content += `<p>No transactions recorded.</p>`;
      }
      
      content += `<div style="text-align:right;margin-top:10px;">
        <button id="close-details" style="padding:5px 10px;border:1px solid var(--color-border);background:#f8f8f8;border-radius:4px;cursor:pointer;">Close</button>
        </div>`;
      
      detailsBox.html(content);
      
      // Add close button event handler
      setTimeout(() => {
        document.getElementById("close-details")?.addEventListener("click", () => {
          detailsBox.remove();
        });
      }, 0);
    }
    });

  // Calculate available space and determine if legends should be repositioned
  const minHeatmapHeight = 400; // Minimum height needed for readable heatmap
  const legendRequiredHeight = 40; // Height needed for legends (15 + margins)
  const availableHeight = window.innerHeight - 130; // Account for other UI elements and navbar

  // Determine if we need to move legends to avoid cramping the heatmap
  const shouldRepositionLegends = (height + legendRequiredHeight) > availableHeight || height < minHeatmapHeight;

  // Add dual legend (income and expenses)
  const legendWidth = 120;
  const legendHeight = 15;
  const legendSpacing = 30;

  let legendX, legendY;

  if (shouldRepositionLegends) {
    // Position legends horizontally beside the heatmap or overlay them
    // Always position legends in the right lower corner
    legendX = width - (legendWidth * 2 + legendSpacing + 20);
    legendY = height + 20; // <-- increased from 20 to 40 for lower placement

    // Add background for better readability
    svg.append("rect")
    .attr("x", legendX - 10)
    .attr("y", legendY - 10)
    .attr("width", legendWidth * 2 + legendSpacing + 20)
    .attr("height", legendHeight + 40)
    .attr("fill", "none")
    .attr("opacity", 0.9)
    .attr("rx", 5);
  } else {
    // Original positioning below heatmap
    legendX = viewMode === 'year'
      ? (width - (legendWidth * 2 + legendSpacing)) / 2
      : ((weekCount * (cellSize + cellMargin)) - (legendWidth * 2 + legendSpacing)) / 2;
    legendY = height + 10;
  }

  // Generate legend gradients (same as before)
  const defs = svg.append("defs");

  // Income gradient (green)
  const incomeGradient = defs.append("linearGradient")
    .attr("id", "income-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  const incomeStops = [0, 0.25, 0.5, 0.75, 1];
  incomeStops.forEach(stop => {
    incomeGradient.append("stop")
      .attr("offset", `${stop * 100}%`)
      .attr("stop-color", positiveColorScale(stop * maxPositive));
  });

  // Expense gradient (red)
  const expenseGradient = defs.append("linearGradient")
    .attr("id", "expense-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  const expenseStops = [0, 0.25, 0.5, 0.75, 1];
  expenseStops.forEach(stop => {
    expenseGradient.append("stop")
      .attr("offset", `${stop * 100}%`)
      .attr("stop-color", negativeColorScale(stop * maxNegative));
  });

  // Always place legends next to each other (horizontal layout)
  const expenseLegendX = legendX + legendWidth + legendSpacing;
  const expenseLegendY = legendY;

  // Draw income legend
  svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#income-gradient)");

  // Income legend labels
  svg.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 5)
    .style("text-anchor", "start")
    .style("font-size", "10px")
    .text(`0 ${AppStateService.instance.currency}`);

  svg.append("text")
    .attr("x", legendX + legendWidth)
    .attr("y", legendY - 5)
    .style("text-anchor", "end")
    .style("font-size", "10px")
    .text(`${maxPositive.toFixed(0)} ${AppStateService.instance.currency}`);

  svg.append("text")
    .attr("x", legendX + legendWidth / 2)
    .attr("y", legendY + legendHeight + 15)
    .style("text-anchor", "middle")
    .style("font-size", "11px")
    .text("Income");

  // Draw expense legend
  svg.append("rect")
    .attr("x", expenseLegendX)
    .attr("y", expenseLegendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#expense-gradient)");

  // Expense legend labels
  svg.append("text")
    .attr("x", expenseLegendX)
    .attr("y", expenseLegendY - 5)
    .style("text-anchor", "start")
    .style("font-size", "10px")
    .text(`0 ${AppStateService.instance.currency}`);

  svg.append("text")
    .attr("x", expenseLegendX + legendWidth)
    .attr("y", expenseLegendY - 5)
    .style("text-anchor", "end")
    .style("font-size", "10px")
    .text(`${maxNegative.toFixed(0)} ${AppStateService.instance.currency}`);

  svg.append("text")
    .attr("x", expenseLegendX + legendWidth / 2)
    .attr("y", expenseLegendY + legendHeight + 15)
    .style("text-anchor", "middle")
    .style("font-size", "11px")
    .text("Expenses");    
    
  // Add click-outside listener to remove details box
  d3.select("body").on("click.details", event => {
    const target = event.target as HTMLElement;
    if (!target.closest("#day-details-box") && !target.classList.contains("day-cell")) {
      d3.select("#day-details-box").remove();
    }
  });

  // Calculate summary statistics for the viewed period
  const totalDaysWithTransactions = Array.from(dailySumsMap.values()).filter(v => Number(v) !== 0).length;
  const totalIncome = Number(values.filter(v => Number(v) > 0).reduce((sum, v) => Number(sum) + Number(v), 0));
  const totalExpenses = Number(values.filter(v => Number(v) < 0).reduce((sum, v) => Number(sum) + Math.abs(Number(v)), 0));
  const netTotal = totalIncome - totalExpenses;

  // Basic averages
  const avgDailyIncome = totalIncome / dateRange.length;
  const avgDailyExpense = totalExpenses / dateRange.length;
  const avgNetPerDay = netTotal / dateRange.length;

  // Volatility & Consistency Metrics
  const dailyNets = dateRange.map(d => Number(dailySumsMap.get(d3.timeFormat("%Y-%m-%d")(d))) || 0);
  const variance = dailyNets.reduce((sum, val) => sum + Math.pow(val - avgNetPerDay, 2), 0) / dailyNets.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = avgNetPerDay !== 0 ? (standardDeviation / Math.abs(avgNetPerDay)) * 100 : 0;
  const zeroDays = dailyNets.filter(v => v === 0).length;
  const medianNet = dailyNets.sort((a, b) => a - b)[Math.floor(dailyNets.length / 2)];

  // Day of week patterns
  const dayOfWeekSums = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  dateRange.forEach(d => {
    const dayOfWeek = d.getDay();
    const value = Number(dailySumsMap.get(d3.timeFormat("%Y-%m-%d")(d))) || 0;
    dayOfWeekSums[dayOfWeek] += value;
    dayOfWeekCounts[dayOfWeek]++;
  });
  const dayOfWeekAvgs = dayOfWeekSums.map((sum, i) => dayOfWeekCounts[i] > 0 ? sum / dayOfWeekCounts[i] : 0);
  const bestDayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekAvgs.indexOf(Math.max(...dayOfWeekAvgs))];
  const worstDayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekAvgs.indexOf(Math.min(...dayOfWeekAvgs))];

  // Trend analysis (first half vs second half)
  const midPoint = Math.floor(dateRange.length / 2);
  const firstHalfAvg = dailyNets.slice(0, midPoint).reduce((sum, v) => sum + v, 0) / midPoint;
  const secondHalfAvg = dailyNets.slice(midPoint).reduce((sum, v) => sum + v, 0) / (dailyNets.length - midPoint);
  const trendChange = ((secondHalfAvg - firstHalfAvg) / Math.abs(firstHalfAvg)) * 100;
  const trendDirection = trendChange > 5 ? '↗️' : trendChange < -5 ? '↘️' : '↔️';

  // Enhanced streaks
  let longestPositiveStreak = 0, currentPositiveStreak = 0;
  let longestNegativeStreak = 0, currentNegativeStreak = 0;
  let longestTransactionStreak = 0, currentTransactionStreak = 0;
  let currentStreakType = 'none', currentStreakLength = 0;

  for (let i = 0; i < dateRange.length; i++) {
    const v = Number(dailySumsMap.get(d3.timeFormat("%Y-%m-%d")(dateRange[i]))) || 0;
    
    // Transaction streak
    if (v !== 0) {
      currentTransactionStreak++;
      longestTransactionStreak = Math.max(longestTransactionStreak, currentTransactionStreak);
    } else {
      currentTransactionStreak = 0;
    }
    
    // Positive/negative streaks
    if (v > 0) {
      currentPositiveStreak++;
      longestPositiveStreak = Math.max(longestPositiveStreak, currentPositiveStreak);
      currentNegativeStreak = 0;
      if (i === dateRange.length - 1) { // Last day
        currentStreakType = 'positive';
        currentStreakLength = currentPositiveStreak;
      }
    } else if (v < 0) {
      currentNegativeStreak++;
      longestNegativeStreak = Math.max(longestNegativeStreak, currentNegativeStreak);
      currentPositiveStreak = 0;
      if (i === dateRange.length - 1) { // Last day
        currentStreakType = 'negative';
        currentStreakLength = currentNegativeStreak;
      }
    } else {
      currentPositiveStreak = 0;
      currentNegativeStreak = 0;
      if (i === dateRange.length - 1) { // Last day
        currentStreakType = 'neutral';
        currentStreakLength = 1;
      }
    }
  }

  // Financial health indicators
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const breakEvenDays = dailyNets.filter(v => Math.abs(v) <= 5).length; // Days between -5 and +5
  const maxIncomeDay = d3.max(filteredTransactions, d => d.amount > 0 ? d.amount : 0) || 0;
  const maxExpenseDay = Math.abs(d3.min(filteredTransactions, d => d.amount < 0 ? d.amount : 0) || 0);

  // Income/expense ratio
  const expenseIncomeRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;

  // Add a toggle button for the summary in the top left corner
  const toggleBtn = d3.select("#chart-container")
    .append("button")
    .attr("id", "summary-toggle-btn")
    .style("position", "absolute")
    .style("top", "70px")
    .style("left", "15px")
    .style("width", "32px")
    .style("height", "32px")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "50%")
    .style("background", "var(--color-surface-alt)")
    .style("font-size", "20px")
    .style("cursor", "pointer")
    .text("?");

  // Add the summary box (initially hidden)
  const statsBox = d3.select("#chart-container")
    .append("div")
    .attr("id", "heatmap-summary-box")
    .style("position", "absolute")
    .style("top", "80px")
    .style("left", "55px")
    .style("background", "var(--color-surface)")
    .style("border", "1px solid var(--color-border)")
    .style("border-radius", "8px")
    .style("padding", "12px 16px")
    .style("font-size", "13px")
    .style("display", "none")
    .style("max-height", "400px")
    .style("overflow-y", "auto")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("min-width", "280px");

  const periodLabel = viewMode === 'year' ? 'Year' : 'Month';
  statsBox.html(`
    <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: var(--color-text);">
      ${trendDirection} ${periodLabel} Summary
    </div>
    
    <div style="margin-bottom: 8px;">
      <div>Days with transactions: <strong>${totalDaysWithTransactions}</strong> of ${dateRange.length} days</div>
      <div style="color: green;">Total income: <strong>+${totalIncome.toFixed(2)} ${AppStateService.instance.currency}</strong></div>
      <div style="color: red;">Total expenses: <strong>-${totalExpenses.toFixed(2)} ${AppStateService.instance.currency}</strong></div>
      <div style="color: ${netTotal >= 0 ? 'green' : 'red'}; font-weight: bold;">
        Net total: ${netTotal >= 0 ? '+' : ''}${netTotal.toFixed(2)} ${AppStateService.instance.currency}
      </div>
    </div>

    <div style="border-top: 1px solid var(--color-muted-light); padding-top: 8px; margin-bottom: 8px;">
      <div style="font-weight: bold; margin-bottom: 4px;">📊 Daily Averages</div>
      <div>Income: <span style="color:green;">${avgDailyIncome.toFixed(2)} ${AppStateService.instance.currency}</span></div>
      <div>Expenses: <span style="color:red;">${avgDailyExpense.toFixed(2)} ${AppStateService.instance.currency}</span></div>
      <div>Net: <span style="color:${avgNetPerDay >= 0 ? 'green' : 'red'};">${avgNetPerDay >= 0 ? '+' : ''}${avgNetPerDay.toFixed(2)} ${AppStateService.instance.currency}</span></div>
      <div>Median net: <span style="color:${medianNet >= 0 ? 'green' : 'red'};">${medianNet >= 0 ? '+' : ''}${medianNet.toFixed(2)} ${AppStateService.instance.currency}</span></div>
    </div>

    <div style="border-top: 1px solid var(--color-muted-light); padding-top: 8px; margin-bottom: 8px;">
      <div style="font-weight: bold; margin-bottom: 4px;">📈 Volatility & Patterns</div>
      <div>Daily volatility: <strong>${standardDeviation.toFixed(2)} ${AppStateService.instance.currency}</strong></div>
      <div>Variability: <strong>${coefficientOfVariation.toFixed(1)}%</strong></div>
      <div>Best day: <strong>${bestDayOfWeek}</strong> (${dayOfWeekAvgs[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(bestDayOfWeek)].toFixed(2)} ${AppStateService.instance.currency})</div>
      <div>Trend: <strong>${trendChange >= 0 ? '+' : ''}${trendChange.toFixed(1)}%</strong> ${trendDirection}</div>
    </div>

    <div style="border-top: 1px solid var(--color-muted-light); padding-top: 8px; margin-bottom: 8px;">
      <div style="font-weight: bold; margin-bottom: 4px;">🔥 Streaks & Records</div>
      <div>Current streak: <strong style="color:${currentStreakType === 'positive' ? 'green' : currentStreakType === 'negative' ? 'red' : 'var(--color-text-secondary)'};">
        ${currentStreakLength} ${currentStreakType} days
      </strong></div>
      <div>Longest positive: <strong>${longestPositiveStreak} days</strong></div>
      <div>Longest negative: <strong>${longestNegativeStreak} days</strong></div>
      <div>Longest active: <strong>${longestTransactionStreak} days</strong></div>
      <div>Max income day: <span style="color:green;"><strong>${maxIncomeDay.toFixed(2)} ${AppStateService.instance.currency}</strong></span></div>
      <div>Max expense day: <span style="color:red;"><strong>${maxExpenseDay.toFixed(2)} ${AppStateService.instance.currency}</strong></span></div>
    </div>

    <div style="border-top: 1px solid var(--color-muted-light); padding-top: 8px;">
      <div style="font-weight: bold; margin-bottom: 4px;">💰 Financial Health</div>
      <div>Savings rate: <strong style="color:${savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'orange' : 'red'};">
        ${savingsRate.toFixed(1)}%
      </strong></div>
      <div>Expense ratio: <strong>${(expenseIncomeRatio * 100).toFixed(1)}%</strong></div>
      <div>Break-even days: <strong>${breakEvenDays}</strong></div>
      <div>Zero-activity days: <strong>${zeroDays}</strong></div>
    </div>
  `);

  // Toggle summary visibility on button click
  toggleBtn.on("click", function () {
    const box = document.getElementById("heatmap-summary-box");
    if (box) {
      box.style.display = box.style.display === "none" ? "block" : "none";
    }
  });
}




/**
 * Renders a zoomable sunburst/treemap chart displaying the full income statement
 * hierarchy (revenues, interests, properties, and per-account expenses).
 */
