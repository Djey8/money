import { StatsComponent } from '../stats.component';
import * as d3 from 'd3';
import { ChartFilterService, ChartFilterState } from '../../shared/services/chart-filter.service';
import { AppStateService } from '../../shared/services/app-state.service';
import { IncomeStatementService } from '../../shared/services/income-statement.service';
import { IncomeComponent } from '../../main/cashflow/income/income.component';
import { BalanceComponent } from '../../main/cashflow/balance/balance.component';
import { SmileProjectsComponent } from '../../main/smile/smile-projects/smile-projects.component';
import { FireEmergenciesComponent } from '../../main/fire/fire-emergencies/fire-emergencies.component';
import { GrowComponent } from '../../main/grow/grow.component';
import { FireComponent } from '../../main/fire/fire.component';
import { HomeComponent } from '../../main/home/home.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';

export function createZoomableChart() {
  const svgElement = d3.select("#chart-container").select("svg");
  d3.select("#chart-container").selectAll("*").remove();

  if (!svgElement.empty()) {
    svgElement.remove();
  }

  let data = {
    name: "All",
    children: []
  };

  // Recompute statement data from filtered transactions (supports time range, account, category, search)
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter, false);

  const revenuesMap = new Map<string, number>();
  const intrestsMap = new Map<string, number>();
  const propertiesMap = new Map<string, number>();
  const dailyExpMap = new Map<string, number>();
  const splurgeExpMap = new Map<string, number>();
  const smileExpMap = new Map<string, number>();
  const fireExpMap = new Map<string, number>();
  const mojoExpMap = new Map<string, number>();

  // Build sets for interest/property classification from existing data
  const interestTags = new Set(AppStateService.instance.allIntrests.map(i => i.tag.toLowerCase()));
  const propertyTags = new Set(AppStateService.instance.allProperties.map(p => p.tag.toLowerCase()));
  // Also check balance items for new tags
  AppStateService.instance.allShares.forEach(s => interestTags.add(s.tag.toLowerCase()));
  AppStateService.instance.allInvestments.forEach(inv => propertyTags.add(inv.tag.toLowerCase()));

  filteredTransactions.forEach(t => {
    if (t.amount === 0) return;
    const tag = (t.category || '').replace('@', '');
    const tagLower = tag.toLowerCase();
    const amount = Number(t.amount);

    if (t.account === 'Income') {
      if (interestTags.has(tagLower)) {
        intrestsMap.set(tag, (intrestsMap.get(tag) || 0) + amount);
      } else if (propertyTags.has(tagLower)) {
        propertiesMap.set(tag, (propertiesMap.get(tag) || 0) + amount);
      } else {
        revenuesMap.set(tag, (revenuesMap.get(tag) || 0) + amount);
      }
    } else {
      const expMap = {
        'Daily': dailyExpMap, 'Splurge': splurgeExpMap,
        'Smile': smileExpMap, 'Fire': fireExpMap, 'Mojo': mojoExpMap
      }[t.account];
      if (expMap) expMap.set(tag, (expMap.get(tag) || 0) + amount);
    }
  });

  const mapToArray = (m: Map<string, number>) => Array.from(m.entries()).map(([tag, amount]) => ({ tag, amount }));
  const revenues = mapToArray(revenuesMap);
  const intrests = mapToArray(intrestsMap);
  const properties = mapToArray(propertiesMap);
  const dailyExp = mapToArray(dailyExpMap);
  const splurgeExp = mapToArray(splurgeExpMap);
  const smileExp = mapToArray(smileExpMap);
  const fireExp = mapToArray(fireExpMap);
  const mojoExp = mapToArray(mojoExpMap);

  let incomeChildren = [];
  if (revenues.length > 0) {
    incomeChildren.push({
      name: `${StatsComponent.translatedIncomeValues[0]} ${Number(revenues.reduce((sum, el) => sum + Math.abs(el.amount), 0).toFixed(2)) > 0 ? '+' : '-'}${revenues.reduce((sum, el) => sum + Math.abs(el.amount), 0).toFixed(2)}`,
      children: revenues.map(element => ({
        name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
        value: Math.abs(element.amount),
        original: element.amount
      }))
    });
  }
  if (intrests.length > 0) {
    incomeChildren.push({
    name: `${StatsComponent.translatedIncomeValues[1]} ${intrests.reduce((sum, el) => sum + Math.abs(el.amount), 0).toFixed(2)}`,
    children: intrests.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount
    }))
    });
  }
  if (properties.length > 0) {
    incomeChildren.push({
    name: `${StatsComponent.translatedIncomeValues[2]} ${properties.reduce((sum, el) => sum + Math.abs(el.amount), 0).toFixed(2)}`,
    children: properties.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount
    }))
    });
  }
  if (incomeChildren.length > 0) {
    data.children.push({
    name: `${StatsComponent.translatedIncomeValues[3]} ${incomeChildren.reduce((sum, child) => sum + child.children.reduce((s, el) => s + el.value, 0), 0).toFixed(2) > 0 ? '+' : '-'}${incomeChildren.reduce((sum, child) => sum + child.children.reduce((s, el) => s + el.value, 0), 0).toFixed(2)}`,
    children: incomeChildren
    });
  }

  let expensesChildren = [];
  if (dailyExp.length > 0) {
    expensesChildren.push({
    name: `${StatsComponent.translatedIncomeValues[4]} ${dailyExp.reduce((sum, el) => sum + el.amount, 0).toFixed(2)}`,
    children: dailyExp.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount
    }))
    });
  }
  if (splurgeExp.length > 0) {
    expensesChildren.push({
    name: `${StatsComponent.translatedIncomeValues[5]} ${splurgeExp.reduce((sum, el) => sum + el.amount, 0).toFixed(2)}`,
    children: splurgeExp.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount
    }))
    });
  }
  if (smileExp.length > 0) {
    expensesChildren.push({
    name: `${StatsComponent.translatedIncomeValues[6]} ${smileExp.reduce((sum, el) => sum + el.amount, 0).toFixed(2)}`,
    children: smileExp.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount
    }))
    });
  }
  if (fireExp.length > 0) {
    expensesChildren.push({
    name: `${StatsComponent.translatedIncomeValues[7]} ${fireExp.reduce((sum, el) => sum + el.amount, 0).toFixed(2)}`,
    children: fireExp.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount
    }))
    });
  }
  if (mojoExp.length > 0) {
    expensesChildren.push({
    name: `${StatsComponent.translatedIncomeValues[8]} ${mojoExp.reduce((sum, el) => sum + el.amount, 0).toFixed(2)}`,
    children: mojoExp.map(element => ({
      name: `${element.tag} ${element.amount > 0 ? '+' : '-'}${Math.abs(element.amount).toFixed(2)}`,
      value: Math.abs(element.amount),
      original: element.amount,
      account: "Mojo"
    }))
    });
  }
  if (expensesChildren.length > 0) {
    data.children.push({
      name: `${StatsComponent.translatedIncomeValues[9]} ${expensesChildren.reduce((sum, child) => 
        sum + child.children
      .filter(el => el.account !== "Mojo")
      .reduce((s, el) => s + el.original, 0)
      , 0).toFixed(2)}`,
      children: expensesChildren
    });
  }


  // Specify the chart’s dimensions.
  StatsComponent.screenWidth = window.innerWidth;
  StatsComponent.screenHeight = window.innerHeight;

  const size = Math.min(StatsComponent.screenWidth, StatsComponent.screenHeight - 100);
  const width = size;
  const height = size;

  // Create the color scale.
  const color = d3.scaleLinear()
      .domain([0, 5])
      .range(["hsl(204, 55.00%, 78.20%)", "hsl(228, 50.60%, 31.80%)"])
      .interpolate(d3.interpolateHcl);

  // Function to determine fill color based on node type and value
  const getFillColor = (d: any) => {
    if (d.children) {
      // Non-leaf nodes use the original color scale
      return color(d.depth);
    } else {
      // Leaf nodes are colored based on their value
      return d.data.original >= 0 ? 'rgba(26, 224, 26, 0.51)' : 'rgba(241, 26, 26, 0.38)'; // lightgreen : lightpink
    }
  };

  // Compute the layout.
  const pack = data => d3.pack()
      .size([width, height])
      .padding(3)
    (d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value));
  const root = pack(data);

  // Create the SVG container.
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .attr("style", `max-width: 100%; height: auto; margin: auto; display: block; background: transperant; cursor: pointer;`)
    .style("position", "absolute")
    .style("top", "50%")
    .style("left", "50%")
    .style("transform", "translate(-50%, -46%)");

  // Create nodes with updated coloring
  const node = svg.append("g")
    .selectAll("circle")
    .data(root.descendants().slice(1))
    .join("circle")
    .attr("fill", getFillColor)
    .attr("pointer-events", (d: any) => !d.children ? "none" : null)
    .on("mouseover", function() { 
      d3.select(this)
        .attr("stroke", "var(--color-text)")
        .attr("stroke-width", 1.5); 
    })
    .on("mouseout", function() { 
      d3.select(this)
        .attr("stroke", null)
        .attr("stroke-width", null); 
    })
    .on("click", (event: any, d: any) => {
      if (focus !== d) {
        zoom(event, d);
        event.stopPropagation();
      }
    });

  // Append the text labels.
  const label = svg.append("g")
      .style("font", "1em sans-serif")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants())
    .join("text")
      .style("fill-opacity", d => d.parent === root ? 1 : 0)
      .style("display", d => d.parent === root ? "inline" : "none")
      .text(d => d.data.name + `${AppStateService.instance.currency}`);

  // Create the zoom behavior and zoom immediately in to the initial focus node.
  svg.on("click", (event) => zoom(event, root));
  let focus = root;
  let view;
  zoomTo([focus.x, focus.y, focus.r * 2]);

  function zoomTo(v) {
    const k = width / v[2];

    view = v;

    label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
    node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
    node.attr("r", d => d.r * k);
  }

  function zoom(event, d) {
    const focus0 = focus;

    focus = d;

    const transition = svg.transition()
        .duration(event.altKey ? 7500 : 750)
        .tween("zoom", d => {
          const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
          return t => zoomTo(i(t));
        });

    label
      .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
      .transition(transition)
        .style("fill-opacity", d => d.parent === focus ? 1 : 0)
        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
  }

  return svg.node();
}
/**
 * Renders a histogram of transaction amounts with configurable bin sizes
 * and a bell-curve overlay showing the normal distribution.
 */
export function createHistogramChart() {
  // Reset BI state when switching to histogram
  if (StatsComponent.isBIDashboard) {
    StatsComponent.filterType = 'all';
    StatsComponent.selectedMonth = '';
    StatsComponent.customDateStart = '';
    StatsComponent.customDateEnd = '';
    StatsComponent.isBIDashboard = false;
  }
  
  const svgElement = d3.select("#chart-container").select("svg");
  // Remove the button if it exists
  d3.select("#chart-container").selectAll("*").remove();
  if (!svgElement.empty()) {
    svgElement.remove();
  }

  // Use filtered transactions for the histogram
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter, false);
  const data = filteredTransactions.map(transaction => Number(transaction.amount));

  // Set up dimensions and margins
  StatsComponent.screenWidth = window.innerWidth-20;
  StatsComponent.screenHeight = window.innerHeight - 130;

  const margin = { top: 20, right: 30, bottom: 70, left: 40 };
  const width = StatsComponent.screenWidth - margin.left - margin.right;
  const height = StatsComponent.screenHeight - margin.top - margin.bottom;

  // Create the SVG container
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", StatsComponent.screenWidth)
    .attr("height", StatsComponent.screenHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Set up the x-axis scale
  let x = d3.scaleLinear()
    .domain([d3.min(data) - 1, d3.max(data) + 1]) // Add 1 bin to the left and right
    .nice()
    .range([0, width]);

  const initialXDomain = x.domain(); // Save the initial x-axis domain

  // Generate bins for the histogram
  const generateBins = (domain: [number, number], binCount: number) => {
    const binThresholds = d3.scaleLinear().domain(domain).ticks(binCount);
    const bins = d3.histogram()
      .domain(domain)
      .thresholds(binThresholds)(data);

    // Add extra bins with value 0 on the left and right
    const extraLeftBin = { x0: bins[0].x0 - (bins[0].x1 - bins[0].x0), x1: bins[0].x0, length: 0 };
    const extraRightBin = { x0: bins[bins.length - 1].x1, x1: bins[bins.length - 1].x1 + (bins[0].x1 - bins[0].x0), length: 0 };
    return [extraLeftBin, ...bins, extraRightBin];
  };

  let bins = generateBins(x.domain() as [number, number], 50);

  // Set up the y-axis scale
  let y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([height, 0]);

  // Add the x-axis
  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // Add the y-axis
  const yAxis = svg.append("g")
    .call(d3.axisLeft(y));

  // Add bars for the histogram
  const bars = svg.selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", (d: d3.Bin<number, number>) => x(d.x0 || 0))
    .attr("y", (d: d3.Bin<number, number>) => y(d.length))
    .attr("width", (d: d3.Bin<number, number>) => Math.max(1, x(d.x1 || 0) - x(d.x0 || 0) - 1)) // Ensure minimum bar width
    .attr("height", (d: d3.Bin<number, number>) => height - y(d.length))
    .attr("fill", (d: d3.Bin<number, number>) => (d.x0 && d.x0 < 0 ? "#f28b8b" : "#a6f5a6")); // Lighter red and green colors

  // Add labels to the bars (exclude bins with value 0)
  const labels = svg.selectAll("text.bar-label")
    .data(bins)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.x0) + (x(d.x1) - x(d.x0)) / 2)
    .attr("y", d => y(d.length) - 5)
    .attr("text-anchor", "middle")
    .text(d => (d.length > 0 ? d.length : ""));

  // Add zoom functionality
  const zoom = d3.zoom()
    .scaleExtent([1, 10]) // Allow zooming between 1x and 10x
    .translateExtent([[0, 0], [width, height]]) // Restrict panning to chart area
    .on("zoom", (event) => {
      const transform = event.transform;
      const newX = transform.rescaleX(x);

      // Recalculate bins based on the new x-axis domain
      bins = generateBins(newX.domain() as [number, number], 50);

      // Update the y-axis scale based on the new bins
      y.domain([0, d3.max(bins, d => d.length)]).nice();

      // Update the x-axis and y-axis
      xAxis.call(d3.axisBottom(newX));
      yAxis.call(d3.axisLeft(y));

      // Update the bars
      bars.data(bins)
        .join("rect")
        .attr("x", (d: d3.Bin<number, number>) => newX(d.x0 || 0))
        .attr("y", (d: d3.Bin<number, number>) => y(d.length))
        .attr("width", (d: d3.Bin<number, number>) => Math.max(1, newX(d.x1 || 0) - newX(d.x0 || 0) - 1))
        .attr("height", (d: d3.Bin<number, number>) => height - y(d.length))
        .attr("fill", (d: d3.Bin<number, number>) => (d.x0 && d.x0 < 0 ? "#f28b8b" : "#a6f5a6"));

      // Update the labels
      labels.data(bins)
        .join("text")
        .attr("class", "bar-label")
        .attr("x", d => newX(d.x0) + (newX(d.x1) - newX(d.x0)) / 2)
        .attr("y", d => y(d.length) - 5)
        .attr("text-anchor", "middle")
        .text(d => (d.length > 0 ? d.length : ""));
    });

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .call(zoom);

  // Add a reset zoom button
  d3.select("#chart-container")
    .append("button")
    .text("Reset Zoom")
    .style("position", "absolute")
    .style("bottom", "10px")
    .style("left", "50%")
    .style("transform", "translate(-50%, -50%)")
    .style("border", "2px solid var(--color-border)")
    .style("border-radius", "3px")
    .style("padding", "5px")
    .style("color", "var(--color-text)")
    .style("background", "var(--color-surface)")
    .on("click", () => {
      // Reset the zoom to the initial configuration
      createHistogramChart();
    });
}
/**
 * Renders a grouped bar chart of income vs. expenses aggregated by the
 * active bar-grouping period (week, month, quarter, or year), with
 * net-balance line overlay and swipe navigation.
 */
export function createCashflowBarChart(period?, selectedYear?) {
  const svgElement = d3.select("#chart-container").select("svg");
  // Remove the button if it exists
  d3.select("#chart-container").selectAll("*").remove();

  if (!svgElement.empty()) {
    svgElement.remove();
  }

  // Derive grouping from chart filter barGrouping (or auto-derive from period)
  const filterType = StatsComponent.chartFilter.filterType;
  const barGrouping = StatsComponent.chartFilter.barGrouping;
  const groupPeriod: string = barGrouping !== 'auto' ? barGrouping
    : filterType === 'all' ? 'year'
    : filterType === 'year' ? 'month'
    : filterType === 'quarter' ? 'month'
    : filterType === 'month' ? 'week'
    : filterType === 'week' ? 'week'
    : 'month'; // custom

  // Group transactions by time period (week, month, quarter, year)
  const groupByPeriod = (transactions: { date: string; amount: number }[], period: "week" | "month" | "quarter" | "year") => {
    const grouped: Map<Date | number, { date: string; amount: number }[]> = d3.group(transactions, transaction => {
      const date = new Date(transaction.date);
      if (period === "week") return `W${(parseInt(d3.timeFormat("%U")(date)) + 1).toString().padStart(2, '0')} ${date.getFullYear()}`;
      if (period === "month") return d3.timeFormat("%b %Y")(date);
      if (period === "quarter") {
        const quarter = Math.floor(date.getMonth() / 3) + 1; // Calculate the quarter (1-4)
        return `Q${quarter} ${date.getFullYear()}`; // Format as Q1 2024
      }
      if (period === "year") return date.getFullYear(); // Group by year
    });
    return Array.from(grouped, ([key, values]) => ({
      period: key,
      value: d3.sum(values, (d: { amount: number }) => Number(d.amount))
    }));
  };

  // Filter transactions using the unified chart filter, then apply cashflow-specific filters
  const allowedAccounts = ['Income', 'Daily', 'Splurge', 'Smile', 'Fire'];
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter)
    .filter(transaction => {
      if (!allowedAccounts.includes(transaction.account)) return false;
      if (transaction.amount === 0.0) return false;
      const cleanCategory = transaction.category.replace('@', '');
      if (accountCategoriesToExclude.includes(cleanCategory)) return false;
      return true;
    });

  // Sample data for the bar chart
  const data = groupByPeriod(filteredTransactions, groupPeriod as any);

  // Sort the data by period to ensure chronological order
  if (groupPeriod === "week") {
    data.sort((a, b) => {
    const [weekA, yearA] = a.period.toString().split(" ").map(part => part.trim());
    const [weekB, yearB] = b.period.toString().split(" ").map(part => part.trim());
    return new Date(`${yearA}-01-01`).getTime() + parseInt(weekA.slice(1)) * 7 * 24 * 60 * 60 * 1000 -
      (new Date(`${yearB}-01-01`).getTime() + parseInt(weekB.slice(1)) * 7 * 24 * 60 * 60 * 1000);
    });
  } else if (groupPeriod === "quarter") {
    data.sort((a, b) => {
    const [quarterA, yearA] = a.period.toString().split(" ").map(part => part.trim());
    const [quarterB, yearB] = b.period.toString().split(" ").map(part => part.trim());
    return new Date(`${yearA}-01-01`).getTime() + parseInt(quarterA.slice(1)) * 3 * 30 * 24 * 60 * 60 * 1000 -
      (new Date(`${yearB}-01-01`).getTime() + parseInt(quarterB.slice(1)) * 3 * 30 * 24 * 60 * 60 * 1000);
    });
  } else if (groupPeriod === "month") {
    data.sort((a, b) => {
    const [monthA, yearA] = a.period.toString().split(" ").map(part => part.trim());
    const [monthB, yearB] = b.period.toString().split(" ").map(part => part.trim());
    const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const dateA = new Date(Number(yearA), monthMap[monthA], 1);
    const dateB = new Date(Number(yearB), monthMap[monthB], 1);
    return dateA.getTime() - dateB.getTime();
    });
  } else {
    data.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());
  }

  // Set up dimensions and margins
  StatsComponent.screenWidth = window.innerWidth-20;
  StatsComponent.screenHeight = window.innerHeight - 130;

  const margin = { top: 20, right: 30, bottom: 70, left: 50 };
  const width = StatsComponent.screenWidth - margin.left - margin.right;
  const height = StatsComponent.screenHeight - margin.top - margin.bottom;

  // Create the SVG container
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", StatsComponent.screenWidth)
    .attr("height", StatsComponent.screenHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Set up the x-axis scale
  const x = d3.scaleBand()
    .domain(data.map(d => d.period.toString()))
    .range([0, width])
    .padding(0.1);

  // Set up the y-axis scale
  const y = d3.scaleLinear()
    .domain([
    Math.min(0, d3.min(data, (d: { value: number }) => d.value) * 1.1),
    Math.max(0, d3.max(data, (d: { value: number }) => d.value) * 1.1)
    ])
    .nice()
    .range([height, 0]);

  // Add the x-axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Add the y-axis
  svg.append("g")
    .call(d3.axisLeft(y));
  
  function isCurrentPeriod(period: string): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();

    // WEEK: "W18 2025"
    if (/^W\d+\s\d{4}$/.test(period)) {
      const [weekStr, yearStr] = period.split(" ");
      const weekNumber = (date: Date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      };
      const currentWeek = weekNumber(now);
      return parseInt(yearStr) === currentYear && weekStr === `W${currentWeek}`;
    }

    // MONTH: "Sep 2024"
    if (/^[A-Za-z]{3}\s\d{4}$/.test(period)) {
      const [monthStr, yearStr] = period.split(" ");
      const currentMonthStr = now.toLocaleString("en-US", { month: "short" });
      return parseInt(yearStr) === currentYear && monthStr === currentMonthStr;
    }

    // QUARTER: "Q2 2024"
    if (/^Q[1-4]\s\d{4}$/.test(period)) {
      const [quarterStr, yearStr] = period.split(" ");
      const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
      return parseInt(yearStr) === currentYear && quarterStr === `Q${currentQuarter}`;
    }

    // YEAR: "2024"
    if (/^\d{4}$/.test(period)) {
      return parseInt(period) === currentYear;
    }

    return false;
  }

  // Add bars for the chart
  svg.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d: { period: string | number; value: number }) => x(d.period.toString()))
    .attr("y", (d: { period: string | number; value: number }) => y(Math.max(0, d.value)))
    .attr("width", x.bandwidth())
    .attr("height", (d: { period: string | number; value: number }) => Math.abs(y(d.value) - y(0)))
    .attr("fill", (d: { period: string | number; value: number }) => {
      const baseColor = d.value >= 0 ? "#a6f5a6" : "#f28b8b";
      const highlightColor = d.value >= 0 ? "#e5fbe5" : "#fddddd";
      return isCurrentPeriod(d.period.toString()) ? highlightColor : baseColor;
    });
  // Add labels to the bars
  svg.selectAll("text.bar-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.period.toString()) + x.bandwidth() / 2)
    .attr("y", d => y(d.value) - 5)
    .attr("text-anchor", "middle")
    .text(d => d.value.toFixed(2));

  // Add a horizontal line at y = 0
  svg.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "var(--color-text-muted)")
    .attr("stroke-width", 1);
}
/**
 * Renders a packed bubble chart where each bubble represents an expense category,
 * sized by total spend. Supports period filtering and swipe navigation.
 */
export function createCategoryBubbleChart(selectedPeriod = "all", selectedIndex = 0) {
  // Reset BI state when switching to pie chart
  if (StatsComponent.isBIDashboard) {
    StatsComponent.filterType = 'all';
    StatsComponent.selectedMonth = '';
    StatsComponent.customDateStart = '';
    StatsComponent.customDateEnd = '';
    StatsComponent.isBIDashboard = false;
  }
  
  const svgElement = d3.select("#chart-container").select("svg");
  d3.select("#chart-container").selectAll("*").remove();

  StatsComponent.period = selectedPeriod;
  StatsComponent.Index = selectedIndex;

  if (!svgElement.empty()) {
    svgElement.remove();
  }

  // Reset the index to 0 when the period is changed
  if (selectedIndex === 0) {
    selectedIndex = 0;
  }

  // Filter transactions using the unified chart filter
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter);

  // Group transactions by category and calculate the total value for each category
  const groupedData = d3.group(filteredTransactions, (d: { category: string }) => d.category);
  const data = Array.from(groupedData, ([key, values]) => ({
    id: key.replace(/@/g, ""), // Remove '@' from each tag
    value: d3.sum(values, (d: { amount: number }) => d.amount)
  }));

  // Specify the dimensions of the chart
  const width = window.innerWidth;
  const height = window.innerHeight - 100; // Adjust height to account for the header and navbar
  const margin = 1; // To avoid clipping the root circle stroke
  const format = d3.format(",d");

  // Define colors for each account
  const accountColors = {
    Income: "#a6f5a6",
    Daily: "#d3d3d3",
    Splurge: "#FFA500",
    Smile: "#FFDE21",
    Fire: "#D2042D",
    Mojo: "#F0FFFF"
  };

  // Create a categorical color scale
  const color = d3.scaleOrdinal()
    .domain(data.map(d => d.id))
    .range(data.map(d => {
      const account = AppStateService.instance.allTransactions.find(t => t.category.replace(/@/g, "") === d.id)?.account;
      return accountColors[account] || "#cccccc"; // Default color if account is not found
    }));

  // Create the pack layout
  const pack = d3.pack()
    .size([width - margin * 2, height - margin * 2])
    .padding(3);

  // Compute the hierarchy from the data and apply the pack layout
  const root = pack(d3.hierarchy({ children: data })
    .sum((d: { value: number }) => Math.abs(d.value))); // Consider both positive and negative values

  // Create the SVG container
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-margin, -margin, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
    .attr("text-anchor", "middle");

  // Center the chart in the middle of the screen
  svg.style("position", "absolute")
    .style("top", "calc(50% + 35px)") // Adjust for the 70px header (half of it)
    .style("left", "50%")
    .style("transform", "translate(-50%, -50%)");

  // Place each (leaf) node according to the layout’s x and y values
  const node = svg.append("g")
    .selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("transform", (d: { x: number; y: number }) => `translate(${d.x},${d.y})`);

  // Add a title
  node.append("title")
    .text((d: { data: { id: string }; value: number }) => `${d.data.id}\n${format(d.value)}`);

  // Add a filled circle
  node.append("circle")
    .attr("fill-opacity", 0.7)
    .attr("fill", (d: { data: { id: string } }) => color(d.data.id))
    .attr("r", (d: { r: number }) => d.r);

  // Add a label
  const text = node.append("text")
    .attr("clip-path", (d: { r: number }) => `circle(${d.r})`);

  // Add a tspan for the category name
  text.append("tspan")
    .attr("x", 0)
    .attr("y", "-0.35em")
    .text((d: { data: { id: string } }) => d.data.id);

  // Add a tspan for the category value
  text.append("tspan")
    .attr("x", 0)
    .attr("y", "0.85em")
    .attr("fill-opacity", 0.7)
    .text((d: { value: number }) => format(d.value));
}

export function createChart(filter: string, selectedYear: string = "all", isChecked: boolean = true, selectedMode: string = "year", selectedMonth: string = "all") {
  const svgElement = d3.select("#chart-container").select("svg");
  d3.select("#chart-container").selectAll("*").remove();
  if (!svgElement.empty()) svgElement.remove();

  // Dimensions
  StatsComponent.screenWidth = window.innerWidth - 20;
  StatsComponent.screenHeight = window.innerHeight - 110;
  const margin = { top: 25, right: 50, bottom: 60, left: 40 };
  const width = StatsComponent.screenWidth - margin.left - margin.right;
  const height = StatsComponent.screenHeight - margin.top - margin.bottom;
  const fontSize = Math.min(12, Math.max(8, Math.round(StatsComponent.screenWidth / 100)));

  const x = d3.scaleTime().range([0, width]);
  const y = d3.scaleLinear().range([height, 0]);

  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const parseDate = (d: string) => new Date(d);

  // Use ChartFilterService to apply all filters (time range, accounts, categories, search)
  const filteredRaw = ChartFilterService.filterTransactions(StatsComponent.chartFilter);
  let transactions = filteredRaw.map(t => ({
    date: parseDate(t.date),
    account: t.account,
    amount: Number(t.amount),
    original: t
  }));

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  const dailyTotals = new Map<string, number>();
  const dailySmileTransactions = new Map<string, any[]>();
  const dailyFireTransactions = new Map<string, any[]>();
  const dailyAddMojoTransactions = new Map<string, any[]>();
  const dailyGrowTransactions = new Map<string, any[]>();
  
  for (let t of transactions) {
    const dateStr = t.date.toISOString().split("T")[0];
    let value = 0;
    // Track Smile transactions for insights when isChecked is true
    if (
      isChecked &&
      t.account === "Smile" &&
      t.amount < 0 &&
      typeof SmileProjectsComponent !== "undefined" &&
      Array.isArray(AppStateService.instance.allSmileProjects) &&
      AppStateService.instance.allSmileProjects.some(
        (proj: any) => proj.title === (t.original.category || "").replace("@", "")
      )
    ) {
      if (!dailySmileTransactions.has(dateStr)) {
        dailySmileTransactions.set(dateStr, []);
      }
      dailySmileTransactions.get(dateStr)!.push(t);
    }
    // Track Fire transactions for insights when isChecked is true
    if (
      isChecked &&
      t.account === "Fire" &&
      t.amount < 0 &&
      typeof FireEmergenciesComponent !== "undefined" &&
      Array.isArray(AppStateService.instance.allFireEmergencies) &&
      AppStateService.instance.allFireEmergencies.some(
        (proj: any) => proj.title === (t.original.category || "").replace("@", "")
      )
    ) {
      if (!dailyFireTransactions.has(dateStr)) {
        dailyFireTransactions.set(dateStr, []);
      }
      dailyFireTransactions.get(dateStr)!.push(t);
    }
    // Track Mojo transactions for insights when isChecked is true
    if (
      isChecked &&
      t.amount < 0 &&
      (t.original.category || "") === "@Mojo"
    ) {
      if (!dailyAddMojoTransactions.has(dateStr)) {
        dailyAddMojoTransactions.set(dateStr, []);
      }
      dailyAddMojoTransactions.get(dateStr)!.push(t);
    }
    if (
      isChecked &&
      typeof GrowComponent !== "undefined" &&
      Array.isArray(AppStateService.instance.allGrowProjects) &&
      AppStateService.instance.allGrowProjects.some(
        (proj: any) => proj.title === (t.original.category || "").replace(/^@/, "")
      )
    ) {
      if (!dailyGrowTransactions.has(dateStr)) {
        dailyGrowTransactions.set(dateStr, []);
      }
      dailyGrowTransactions.get(dateStr)!.push(t);
    }
    if (filter === "income") {
      value = t.amount;
    } else if (filter === "daily" && (t.account === "Income" || t.account === "Daily")) {
      value = t.account === "Income" ? t.amount * AppStateService.instance.daily / 100 : t.amount;
    } else if (filter === "splurge" && (t.account === "Income" || t.account === "Splurge")) {
      value = t.account === "Income" ? t.amount * AppStateService.instance.splurge / 100 : t.amount;
    } else if (filter === "smile" && (t.account === "Income" || t.account === "Smile")) {
      value = t.account === "Income" ? t.amount * AppStateService.instance.smile / 100 : t.amount;
    } else if (filter === "fire" && (t.account === "Income" || t.account === "Fire")) {
      value = t.account === "Income" ? t.amount * AppStateService.instance.fire / 100 : t.amount;
    }

    dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + value);
  }

  // Fill missing days
  const firstDate = d3.min(transactions, d => d.date)!;
  const lastDate = d3.max(transactions, d => d.date)!;
  const dateMap = new Map<string, number>(dailyTotals);
  let cursor = new Date(firstDate);
  while (cursor <= lastDate) {
    const dateStr = cursor.toISOString().split("T")[0];
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  // --- Adjust cumulative starting point based on chart filter period ---
  let cumulative = 0;
  const chartState = StatsComponent.chartFilter;
  if (chartState.filterType !== 'all') {
    // Get the start date of the current display window
    let windowStart: Date | null = null;
    if (chartState.filterType === 'custom' && chartState.customDateStart) {
      windowStart = new Date(chartState.customDateStart);
    } else {
      const range = ChartFilterService.getDateRange(chartState.filterType, chartState.selectedIndex);
      if (range) windowStart = range.startDate;
    }
    if (windowStart) {
      // Get all transactions with same search/account/category filters but no time restriction
      const allTimeState: ChartFilterState = { ...chartState, filterType: 'all', selectedIndex: 0 };
      const allFiltered = ChartFilterService.filterTransactions(allTimeState);
      cumulative = allFiltered
        .filter(t => new Date(t.date) < windowStart!)
        .reduce((sum, t) => {
          let value = 0;
          const amount = Number(t.amount);
          if (filter === "income") value = amount;
          else if (filter === "daily" && (t.account === "Income" || t.account === "Daily")) value = t.account === "Income" ? amount * AppStateService.instance.daily / 100 : amount;
          else if (filter === "splurge" && (t.account === "Income" || t.account === "Splurge")) value = t.account === "Income" ? amount * AppStateService.instance.splurge / 100 : amount;
          else if (filter === "smile" && (t.account === "Income" || t.account === "Smile")) value = t.account === "Income" ? amount * AppStateService.instance.smile / 100 : amount;
          else if (filter === "fire" && (t.account === "Income" || t.account === "Fire")) value = t.account === "Income" ? amount * AppStateService.instance.fire / 100 : amount;
          return sum + value;
        }, 0);
    }
  }

  const dataset: { date: Date, value: number }[] = [];
  for (let [dateStr, dailyValue] of [...dateMap.entries()].sort()) {
    cumulative += dailyValue;
    dataset.push({ date: new Date(dateStr), value: cumulative });
  }

  // Domains
  x.domain(d3.extent(dataset, d => d.date) as [Date, Date]);

  const minY = d3.min(dataset, d => d.value)!;
  const maxY = d3.max(dataset, d => d.value)!;
  const range = maxY - minY;
  const padding = range < 100 ? 50 : range * 0.1;

  y.domain([
    minY > 0 ? 0 : minY - padding,
    maxY + padding
  ]);

  // X Axis with custom tick format for 1st tick
  const ticks = x.ticks(Math.min(10, dataset.length));
  // Always label x=0 with the first date in the dataset
  if (dataset.length > 0 && !ticks.some(t => +t === +dataset[0].date)) {
    ticks.unshift(dataset[0].date);
  }
  const customFormat = (d: Date) => d3.timeFormat("%-d %b")(d);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x)
      .tickValues(ticks)
      .tickFormat(customFormat as any)
    )
    .selectAll("text")
    .style("font-size", `${fontSize}px`);

  svg.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format(",.0f")))
    .selectAll("text")
    .style("font-size", `${fontSize}px`);

  // Grids
  svg.append("g")
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", .5)
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ""));

  svg.selectAll("xGrid")
    .data(x.ticks().slice(1))
    .join("line")
    .attr("x1", d => x(d))
    .attr("x2", d => x(d))
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", .5);

  // Dots
  svg.selectAll(".dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("fill", "steelblue")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.value))
    .attr("r", 4);

  // Line
  svg.append("path")
    .datum(dataset)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 3)
    .attr("d", d3.line<{ date: Date, value: number }>()
      .x(d => x(d.date))
      .y(d => y(d.value)));

  // Short-term trend (7-day moving average)
  const shortTerm = calculateMovingAverage(dataset, 7);

  // Long-term trend (30-day moving average)
  const longTerm = calculateMovingAverage(dataset, 30);

  svg.append("path")
    .datum(longTerm)
    .attr("fill", "none")
    .attr("stroke", "orange")
    .attr("stroke-dasharray", "5 3")
    .attr("stroke-width", 3)
    .attr("d", d3.line<{ date: Date, value: number }>()
    .x(d => x(d.date))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX)
    );

  // --- Moving average helper ---
  function calculateMovingAverage(
    data: { date: Date, value: number }[],
    windowSize: number
  ): { date: Date, value: number }[] {
    if (data.length === 0) return [];
    const result: { date: Date, value: number }[] = [];
    for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const avg = window.reduce((sum, d) => sum + d.value, 0) / window.length;
    result.push({ date: data[i].date, value: avg });
    }
    return result;
  }

  // Red background under 0
  svg.append("rect")
    .attr("x", 0)
    .attr("y", y(0))
    .attr("width", width)
    .attr("height", height - y(0))
    .attr("fill", "rgba(255, 0, 0, 0.1)");

  // === Mojo TRANSACTION INDICATORS ===
  if (isChecked) {
    // Add mojo icons for outgoing Mojo transactions
    for (let [dateStr, mojoTransactions] of dailyAddMojoTransactions.entries()) {
      const mojoAccounts = new Set<string>();
      mojoTransactions.forEach((t: any) => {
        if (t.account) {
          mojoAccounts.add(t.account.toLocaleLowerCase());
        }
      });
      const date = new Date(dateStr);
      const dataPoint = dataset.find(d => d.date.toISOString().split("T")[0] === dateStr);
      
      if (
        dataPoint &&
        mojoTransactions.length > 0 &&
        (filter === "income" || mojoAccounts.has(filter.toLocaleLowerCase()))
      ) {
        const xPos = x(date);
        const yPos = y(dataPoint.value);
        
        // Create a group for the smile indicator
        const smileGroup = svg.append("g")
          .attr("class", "mojo-indicator")
          .attr("transform", `translate(${xPos}, ${yPos})`);
        
        // Add smile icon (using emoji as fallback if image fails)
          // Use an SVG <clipPath> to make the image round
          const clipId = `mojo-clip-${dateStr.replace(/[^a-zA-Z0-9]/g, "")}`;
          smileGroup.append("clipPath")
            .attr("id", clipId)
            .append("circle")
            .attr("cx", -4) // center of the image (x + width/2)
            .attr("cy", -18) // center of the image (y + height/2)
            .attr("r", 12);

          smileGroup.append("image")
            .attr("href", "../../../assets/icons/mojo.jpg")
            .attr("x", -16)
            .attr("y", -30)
            .attr("width", 24)
            .attr("height", 24)
            .attr("clip-path", `url(#${clipId})`)
            .style("cursor", "pointer")
            .on("error", function() {
              // Fallback to emoji if image fails to load
              d3.select(this).remove();
              smileGroup.append("text")
                .attr("x", 0)
                .attr("y", -10)
                .attr("text-anchor", "middle")
                .attr("font-size", "20px")
                .style("cursor", "pointer")
                .text("💰");
            })
            .on("click", function() {
              showTransactionDetails(mojoTransactions, dateStr, filter);
            });

          // Overlay a semi-transparent yellow circle on top of the image
          smileGroup.append("circle")
            .attr("cx", -4)
            .attr("cy", -18)
            .attr("r", 12)
            .attr("fill", "blue")
            .attr("fill-opacity", 0.3)
            .attr("pointer-events", "none");
        
      }
    }
  }

  if (isChecked) {
    // Add grow icons for outgoing Grow transactions
    for (let [dateStr, growTransactions] of dailyGrowTransactions.entries()) {
    const growAccounts = new Set<string>();
    growTransactions.forEach((t: any) => {
      if (t.account) {
      growAccounts.add(t.account.toLocaleLowerCase());
      }
    });

    // Mark each transaction as positive or negative for later use
    growTransactions.forEach((t: any) => {
      t.isPositive = t.amount > 0;
    });

    const date = new Date(dateStr);
    const dataPoint = dataset.find(d => d.date.toISOString().split("T")[0] === dateStr);

    if (
      dataPoint &&
      growTransactions.length > 0 &&
      (filter === "income" || growAccounts.has(filter.toLocaleLowerCase()))
    ) {
      const xPos = x(date);
      const yPos = y(dataPoint.value);

      // Create a group for the grow indicator
      const smileGroup = svg.append("g")
      .attr("class", "grow-indicator")
      .attr("transform", `translate(${xPos}, ${yPos})`);

      // Use an SVG <clipPath> to make the image round
      const clipId = `grow-clip-${dateStr.replace(/[^a-zA-Z0-9]/g, "")}`;
      smileGroup.append("clipPath")
      .attr("id", clipId)
      .append("circle")
      .attr("cx", -4)
      .attr("cy", -18)
      .attr("r", 12);

      smileGroup.append("image")
      .attr("href", "../../../assets/icons/grow.jpg")
      .attr("x", -16)
      .attr("y", -30)
      .attr("width", 24)
      .attr("height", 24)
      .attr("clip-path", `url(#${clipId})`)
      .style("cursor", "pointer")
      .on("error", function() {
        // Fallback to emoji if image fails to load
        d3.select(this).remove();
        smileGroup.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-size", "20px")
        .style("cursor", "pointer")
        .text("💰");
      })
      .on("click", function() {
        showTransactionDetails(growTransactions, dateStr, filter);
      });

      // Determine fill color based on the sign of the first transaction for this date
      const isPositive = growTransactions[0]?.isPositive;
      smileGroup.append("circle")
      .attr("cx", -4)
      .attr("cy", -18)
      .attr("r", 12)
      .attr("fill", isPositive ? "#006400" : "#4fd8e6") // dark green if positive, turquoise if negative
      .attr("fill-opacity", 0.3)
      .attr("pointer-events", "none");
    }
    }
  }
  
    // === SMILE TRANSACTION INDICATORS ===
  if (isChecked && (filter === "income" || filter === "smile")) {
    // Add smile icons for outgoing Smile transactions
    for (let [dateStr, smileTransactions] of dailySmileTransactions.entries()) {
      const date = new Date(dateStr);
      const dataPoint = dataset.find(d => d.date.toISOString().split("T")[0] === dateStr);
      
      if (dataPoint && smileTransactions.length > 0) {
        const xPos = x(date);
        const yPos = y(dataPoint.value);
        
        // Create a group for the smile indicator
        const smileGroup = svg.append("g")
          .attr("class", "smile-indicator")
          .attr("transform", `translate(${xPos}, ${yPos})`);
        
        // Add smile icon (using emoji as fallback if image fails)
          // Use an SVG <clipPath> to make the image round
          const clipId = `smile-clip-${dateStr.replace(/[^a-zA-Z0-9]/g, "")}`;
          smileGroup.append("clipPath")
            .attr("id", clipId)
            .append("circle")
            .attr("cx", -4) // center of the image (x + width/2)
            .attr("cy", -18) // center of the image (y + height/2)
            .attr("r", 12);

          smileGroup.append("image")
            .attr("href", "../../../assets/icons/smile.jpg")
            .attr("x", -16)
            .attr("y", -30)
            .attr("width", 24)
            .attr("height", 24)
            .attr("clip-path", `url(#${clipId})`)
            .style("cursor", "pointer")
            .on("error", function() {
              // Fallback to emoji if image fails to load
              d3.select(this).remove();
              smileGroup.append("text")
                .attr("x", 0)
                .attr("y", -10)
                .attr("text-anchor", "middle")
                .attr("font-size", "20px")
                .style("cursor", "pointer")
                .text("😊");
            })
            .on("click", function() {
              showTransactionDetails(smileTransactions, dateStr, filter);
            });

          // Overlay a semi-transparent yellow circle on top of the image
          smileGroup.append("circle")
            .attr("cx", -4)
            .attr("cy", -18)
            .attr("r", 12)
            .attr("fill", "yellow")
            .attr("fill-opacity", 0.3)
            .attr("pointer-events", "none");
        
      }
    }
  }

  if (isChecked && (filter === "income" || filter === "fire")) {
    // Add fire icons for outgoing Smile transactions
    for (let [dateStr, fireTransactions] of dailyFireTransactions.entries()) {
      const date = new Date(dateStr);
      const dataPoint = dataset.find(d => d.date.toISOString().split("T")[0] === dateStr);
      
      if (dataPoint && fireTransactions.length > 0) {
        const xPos = x(date);
        const yPos = y(dataPoint.value);
        
        // Create a group for the smile indicator
        const smileGroup = svg.append("g")
          .attr("class", "fire-indicator")
          .attr("transform", `translate(${xPos}, ${yPos})`);
        
        // Add smile icon (using emoji as fallback if image fails)
          // Use an SVG <clipPath> to make the image round
          const clipId = `fire-clip-${dateStr.replace(/[^a-zA-Z0-9]/g, "")}`;
          smileGroup.append("clipPath")
            .attr("id", clipId)
            .append("circle")
            .attr("cx", -4) // center of the image (x + width/2)
            .attr("cy", -18) // center of the image (y + height/2)
            .attr("r", 12);

          smileGroup.append("image")
            .attr("href", "../../../assets/icons/fire.jpg")
            .attr("x", -16)
            .attr("y", -30)
            .attr("width", 24)
            .attr("height", 24)
            .attr("clip-path", `url(#${clipId})`)
            .style("cursor", "pointer")
            .on("error", function() {
              // Fallback to emoji if image fails to load
              d3.select(this).remove();
              smileGroup.append("text")
                .attr("x", 0)
                .attr("y", -10)
                .attr("text-anchor", "middle")
                .attr("font-size", "20px")
                .style("cursor", "pointer")
                .text("🔥");
            })
            .on("click", function() {
              showTransactionDetails(fireTransactions, dateStr, filter);
            });
            
          // Overlay a semi-transparent yellow circle on top of the image
          smileGroup.append("circle")
            .attr("cx", -4)
            .attr("cy", -18)
            .attr("r", 12)
            .attr("fill", "red")
            .attr("fill-opacity", 0.3)
            .attr("pointer-events", "none");
      }
    }
  }

  // Final Value Label
  if (dataset.length > 0) {
    const lastPoint = dataset[dataset.length - 1];
    svg.append("text")
      .attr("x", x(lastPoint.date) + 5)
      .attr("y", y(lastPoint.value))
      .attr("dy", "0.35em")
      .attr("fill", "var(--color-text)")
      .style("font-size", `${fontSize}px`)
      .style("font-weight", "bold")
      .text(lastPoint.value.toFixed(2));
  }
}

// New method to show detailed information about Smile transactions
export function showTransactionDetails(anyTransactions: any[], dateStr: string, filter: string) {
  // Determine modal width and margins based on screen size
  const screenWidth = window.innerWidth;
  const isSmallScreen = screenWidth <= 768;
  const modalWidth = isSmallScreen ? "90vw" : "400px";

  // Create a modal or popup to show transaction details
  const modal = d3.select("body")
    .append("div")
    .attr("class", "transaction-modal")
    .style("position", "fixed")
    .style("top", "50%")
    .style("left", "50%")
    .style("transform", "translate(-50%, -50%)")
    .style("background", "var(--color-surface)")
    .style("border", "2px solid var(--color-text)")
    .style("border-radius", "10px")
    .style("padding", isSmallScreen ? "15px" : "20px")
    .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
    .style("z-index", "1000")
    .style("max-width", modalWidth)
    .style("width", modalWidth)
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("max-height", "70vh")
    .style("overflow-y", "auto");

  // Add close button
  modal.append("button")
    .style("position", "absolute")
    .style("top", "5px")
    .style("right", "5px")
    .style("background", "none")
    .style("border", "none")
    .style("font-size", "20px")
    .style("cursor", "pointer")
    .text("×")
    .on("click", () => {modal.remove();
      d3.select(".modal-backdrop").remove();});

  // Add title
  modal.append("h3")
    .style("margin-top", "0")
    .style("color", "var(--color-text)")
    .text(`Transactions`);

  // Add transaction details
  let totalAmount = 0;
  if (anyTransactions.length > 0) {
    if (filter === "income") {
    totalAmount = anyTransactions.reduce((sum, t) => sum + t.amount, 0);
    } else {
    totalAmount = anyTransactions
      .filter(t => t.account.toLowerCase() === filter)
      .reduce((sum, t) => sum + t.amount, 0);
    }
  }
  
  modal.append("p")
    .style("font-weight", "bold")
    .style("color", "var(--color-danger-soft)")
    .text(`Total: ${totalAmount.toFixed(2)} ${AppStateService.instance.currency}`);

  // List each transaction
  const transactionList = modal.append("ul")
    .style("list-style-type", "none")
    .style("padding", "0");

  anyTransactions
    .filter(t => t.account.toLowerCase() === filter || filter === "income")
    .forEach(transaction => {
    const listItem = transactionList.append("li")
      .style("margin-bottom", "10px")
      .style("padding", "10px")
      .style("background", "var(--color-surface-hover)")
      .style("border-radius", "5px");

    listItem.append("div")
      .style("font-weight", "bold")
      .text(`Amount: ${transaction.amount.toFixed(2)} ${AppStateService.instance.currency}`);

    // Add more details if available in the original transaction object
    if (transaction.original.account) {
      listItem.append("div")
      .style("color", "var(--color-text-secondary)")
      .text(`Account: ${transaction.original.account}`);
    }

    if (transaction.original.date) {
      const dateObj = new Date(transaction.original.date);
      const formattedDate = `${dateObj.getDate().toString().padStart(2, "0")}.${(dateObj.getMonth() + 1).toString().padStart(2, "0")}.${dateObj.getFullYear()}`;
      listItem.append("div")
        .style("color", "var(--color-text-secondary)")
        .text(`Date: ${formattedDate}`);
    }

    if (transaction.original.time) {
      listItem.append("div")
      .style("color", "var(--color-text-secondary)")
      .text(`Time: ${transaction.original.time}`);
    }

    if (transaction.original.category) {
      listItem.append("div")
      .style("color", "var(--color-text-secondary)")
      .text(`Category: ${transaction.original.category}`);
    }

    if (transaction.original.comment) {
      listItem.append("div")
      .style("color", "var(--color-text-secondary)")
      .style("font-style", "italic")
      .text(`Comment: ${transaction.original.comment}`);
    }

    // --- Project details for Smile, Fire, Grow ---
    const category = (transaction.original.category || "").replace(/^@/, "");
    // SmileProjects
    if (
      typeof SmileProjectsComponent !== "undefined" &&
      Array.isArray(AppStateService.instance.allSmileProjects)
    ) {
      const smileProject = AppStateService.instance.allSmileProjects.find(
      (proj: any) => proj.title === category
      );
      if (smileProject) {
      // Calculate totals from buckets
      const totalTarget = smileProject.buckets?.reduce((sum: number, b: any) => sum + (b.target || 0), 0) || 0;
      const totalAmount = smileProject.buckets?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0;
      listItem.append("div")
        .style("margin-top", "6px")
        .style("color", "#1976d2")
        .html(
        `<strong>Smile Project:</strong> ${smileProject.title}<br/>` +
        `Target: ${totalTarget.toFixed(2)} ${AppStateService.instance.currency}<br/>` +
        `Current: ${totalAmount.toFixed(2)} ${AppStateService.instance.currency}`
        );
      }
    }
    // FireEmergencies
    if (
      typeof FireEmergenciesComponent !== "undefined" &&
      Array.isArray(AppStateService.instance.allFireEmergencies)
    ) {
      const fireProject = AppStateService.instance.allFireEmergencies.find(
      (proj: any) => proj.title === category
      );
      if (fireProject) {
      listItem.append("div")
        .style("margin-top", "6px")
        .style("color", "#d32f2f")
        .html(
        `<strong>Fire Emergency:</strong> ${fireProject.title}<br/>` +
        `Target: ${IncomeStatementService.getTotalFireTarget(fireProject)?.toFixed(2) ?? "-"} ${AppStateService.instance.currency}<br/>` +
        `Current: ${IncomeStatementService.getTotalFireAmount(fireProject)?.toFixed(2) ?? "-"} ${AppStateService.instance.currency}`
        );
      }
    }
    // GrowProjects (show more info)
    if (
      typeof GrowComponent !== "undefined" &&
      Array.isArray(AppStateService.instance.allGrowProjects)
    ) {
      const growProject = AppStateService.instance.allGrowProjects.find(
      (proj: any) => proj.title === category
      );
      if (growProject) {
      let html = `<strong>Grow Project:</strong> ${growProject.title}<br/>`;
      if (growProject.description) html += `<span style="color:var(--color-text-secondary);">${growProject.description}</span><br/>`;
      if (growProject.sub)
        html += `Title: ${growProject.sub}<br/>`;
      if (growProject.status)
        html += `Status: ${growProject.status}<br/>`;
      if (growProject.strategy !== undefined)
        html += `Strategy: ${growProject.strategy}<br/>`;
      if (growProject.risks)
        html += `Risks: ${growProject.risks}<br/>`;
      if (growProject.share)
        html += `Share: ${growProject.share.price} ${AppStateService.instance.currency} x ${growProject.share.quantity}<br/>`;
      if (growProject.investment)
        html += `Mortage: ${growProject.investment.amount} ${AppStateService.instance.currency}<br/>`;
      if (growProject.cashflow && growProject.cashflow != 0)
        html += `CASHFLOW: ${growProject.cashflow}<br/>`;
      if (growProject.amount)
        html += `Amount: ${Number(growProject.amount).toFixed(2)} ${AppStateService.instance.currency}<br/>`;
      listItem.append("div")
        .style("margin-top", "6px")
        .style("color", "#388e3c")
        .html(html);
      }
    }
    });

  // Add backdrop
  d3.select("body")
    .append("div")
    .attr("class", "modal-backdrop")
    .style("position", "fixed")
    .style("top", "0")
    .style("left", "0")
    .style("width", "100%")
    .style("height", "100%")
    .style("background", "rgba(0, 0, 0, 0.5)")
    .style("z-index", "999")
    .on("click", () => {
      modal.remove();
      d3.select(".modal-backdrop").remove();
    });
}
/**
 * Creates a pie chart based on the specified data.
 */
export function createPieChart() {
  // Reset BI state when switching to pie chart
  if (StatsComponent.isBIDashboard) {
    StatsComponent.filterType = 'all';
    StatsComponent.selectedMonth = '';
    StatsComponent.customDateStart = '';
    StatsComponent.customDateEnd = '';
    StatsComponent.isBIDashboard = false;
  }

  d3.select("#chart-container").selectAll("span").remove();
  d3.select("#chart-container").selectAll("div").remove();
  d3.select("#chart-container").selectAll("button").remove();

  // Always use current window dimensions for pie chart
  const width = window.innerWidth - 20;
  const height = window.innerHeight - 110;

  // Use filtered transactions for pie chart
  const filteredTransactions = ChartFilterService.filterTransactions(StatsComponent.chartFilter);
  const getFilteredAmount = (account: string, p: number) => {
    let result = 0.0;
    for (const t of filteredTransactions) {
      if (t.account === account) {
        result += t.amount;
      } else if (t.account === 'Income') {
        result += Math.round(((t.amount * p) + Number.EPSILON) * 100) / 100;
      }
    }
    return result;
  };

  const dailyValue = getFilteredAmount("Daily", AppStateService.instance.daily / 100);
  const splurgeValue = getFilteredAmount("Splurge", AppStateService.instance.splurge / 100);
  const smileValue = getFilteredAmount("Smile", AppStateService.instance.smile / 100);
  const fireValue = getFilteredAmount("Fire", AppStateService.instance.fire / 100);
  const totalAmount = Math.round((dailyValue + splurgeValue + smileValue + fireValue) * 100) / 100;

  const data = [
    { label: `${Math.round(dailyValue * 100 / totalAmount * 100) / 100} %`, value: dailyValue },
    { label: `${Math.round(splurgeValue * 100 / totalAmount * 100) / 100} %`, value: splurgeValue },
    { label: `${Math.round(smileValue * 100 / totalAmount * 100) / 100} %`, value: smileValue },
    { label: `${Math.round(fireValue * 100 / totalAmount * 100) / 100} %`, value: fireValue }
  ];

  const radius = Math.min(width, height) / 2;

  const color = d3.scaleOrdinal()
    .range(d3.schemeCategory10); // Use a predefined color scheme from D3.js

  let svg = d3.select("#chart-container")
    .select("svg");

  // Create SVG if it doesn't exist
  if (svg.empty()) {
    svg = d3.select("#chart-container")
      .append("svg");
  }

  // Remove existing chart content
  svg.selectAll("*").remove();

  svg.attr("width", width)
    .attr("height", height - 10)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif; display: block; margin: 0 auto;");

  const pie = d3.pie()
    .value((d: any) => Math.abs(d.value));

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  const customColors = ["#115f9a", "#1984c5", "#22a7f0", "#48b5c4"]; // Add your own 4 colors here
  const customColorsMinus = ["#ffcccc", "#ff9999", "#ff6666", "#ff3333"];

  const arcs = svg.selectAll("arc")
    .data(pie(data))
    .enter()
    .append("g")
    .attr("class", "arc");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", (d: any, i: number) => d.data.value >= 0 ? customColors[i] : customColorsMinus[i]); // Use the customColors array for positive values and customColorsMinus array for negative values

  arcs.append("text")
    .attr("transform", (d: any) => `translate(${arc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px") // Set the font size to 16 pixels
    .attr("fill", "white") // Set the text color to white
    .text((d: any) => d.data.label);
    // Add one dot in the legend for each name.
    svg.selectAll("mydots")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", -width / 2 + 50)
      .attr("cy", function (d, i) { return height / 2 - 30 - i * 25 }) // 100 is where the first dot appears. 25 is the distance between dots
      .attr("r", 9)
      .style("fill", (d: any, i: number) => d.value >= 0 ? customColors[i] : customColorsMinus[i])

    // Add one dot in the legend for each name.
    svg.selectAll("mylabels")
      .data(data)
      .enter()
      .append("text")
      .attr("x", -width / 2 + 50 + 20) // 20px to the right of the legend dot
      .attr("y", function (d, i) { return height / 2 - 30 - i * 25 }) // align with dot
      .style("fill", (d: any, i: number) => d.value >= 0 ? customColors[i] : customColorsMinus[i])
      .attr("font-size", "16px")
      .text(function (d, i) { return StatsComponent.translatedValues[i] })
      .attr("text-anchor", "start") // use "start" for left alignment
      .style("alignment-baseline", "middle")
      .attr("dx", 0); // ensure no additional offset, 20px gap is set in .attr("x")
}

// ===================================================================
// BUSINESS INTELLIGENCE DASHBOARDS
// Based on thesis requirements for BI & Analytics
// ===================================================================

/**
 * Main entry point for BI Dashboards
 * @param dashboardNumber - 1, 2, or 3 for the respective dashboard
 */
