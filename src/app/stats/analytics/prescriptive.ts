import { StatsComponent } from '../stats.component';
import * as d3 from 'd3';
import { AppStateService } from '../../shared/services/app-state.service';

export function createPraeskriptiveAnalytics(container: any) {
  const contentDiv = container.append("div")
    .attr("id", "praeskriptive-main-container")
    .style("width", "100%")
    .style("padding", "20px")
    .style("padding-bottom", "80px")
    .style("box-sizing", "border-box");

  contentDiv.append("h2")
    .style("color", "#1976d2")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveTitle'));

  contentDiv.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("text-align", "center")
    .style("margin-bottom", "30px")
    .style("font-style", "italic")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveDescription'));

  // Scenario Selector
  createScenarioSelector(contentDiv);

  // Scenario Configuration Panel (with container ID)
  const configContainer = contentDiv.append("div").attr("id", "scenario-config-container");
  createScenarioConfig(configContainer);

  // Results Comparison (with container ID)
  const resultsContainer = contentDiv.append("div").attr("id", "scenario-results-container");
  createScenarioResults(resultsContainer);
}/**
 * Create scenario selector buttons
 */
export function createScenarioSelector(container: any) {
  const selectorPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  selectorPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveSelectScenario'));

  const scenariosDiv = selectorPanel.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(250px, 1fr))")
    .style("gap", "15px");

  const scenarios = [
    { id: 'optimize-savings-rate', label: StatsComponent.translateService.instant('BI.praeskriptiveScenario1'), icon: '', desc: StatsComponent.translateService.instant('BI.praeskriptiveScenario1Desc') },
    { id: 'accelerate-mojo', label: StatsComponent.translateService.instant('BI.praeskriptiveScenario2'), icon: '', desc: StatsComponent.translateService.instant('BI.praeskriptiveScenario2Desc') },
    { id: 'savings-goal-simulator', label: StatsComponent.translateService.instant('BI.praeskriptiveScenario3'), icon: '', desc: StatsComponent.translateService.instant('BI.praeskriptiveScenario3Desc') }
  ];

  if (!StatsComponent.selectedScenario) {
    StatsComponent.selectedScenario = 'optimize-savings-rate';
  }

  scenarios.forEach(scenario => {
    const card = scenariosDiv.append("div")
      .attr("data-scenario-id", scenario.id)
      .style("padding", "20px")
      .style("border", "2px solid " + (StatsComponent.selectedScenario === scenario.id ? "#1976d2" : "#ddd"))
      .style("border-radius", "8px")
      .style("background", StatsComponent.selectedScenario === scenario.id ? "var(--color-info-surface)" : "var(--color-surface)")
      .style("cursor", "pointer")
      .style("transition", "all 0.3s")
      .style("text-align", "center")
      .on("click", (event) => {
        // Prevent click during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
        StatsComponent.selectedScenario = scenario.id;
        refreshScenario();
      })
      .on("mouseover", function() {
        if (StatsComponent.selectedScenario !== scenario.id) {
          d3.select(this)
            .style("border-color", "#1976d2")
            .style("background", "#f5f5f5");
        }
      })
      .on("mouseout", function() {
        if (StatsComponent.selectedScenario !== scenario.id) {
          d3.select(this)
            .style("border-color", "#ddd")
            .style("background", "var(--color-surface)");
        }
      });

    card.append("div")
      .style("font-size", "48px")
      .style("margin-bottom", "10px")
      .text(scenario.icon);

    card.append("div")
      .style("font-weight", "bold")
      .style("color", "#1976d2")
      .style("font-size", "16px")
      .style("margin-bottom", "5px")
      .text(scenario.label);

    card.append("div")
      .style("font-size", "12px")
      .style("color", "var(--color-text-secondary)")
      .text(scenario.desc);
  });
}/**
 * Create scenario configuration panel
 */
export function createScenarioConfig(container: any) {
  const configPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("max-width", "1400px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  configPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveScenarioParameters'));

  if (StatsComponent.selectedScenario === 'optimize-savings-rate') {
    createOptimizeSavingsRateConfig(configPanel);
  } else if (StatsComponent.selectedScenario === 'accelerate-mojo') {
    createAccelerateMojoConfig(configPanel);
  } else if (StatsComponent.selectedScenario === 'savings-goal-simulator') {
    createSavingsGoalSimulatorConfig(configPanel);
  }
}/**
 * Szenario 1: Optimize Savings Rate
 */
export function createOptimizeSavingsRateConfig(container: any) {
  // Sub-scenario selector
  const subScenarioDiv = container.append("div")
    .style("margin-bottom", "20px");

  subScenarioDiv.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "10px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveOptimizationMethod'));

  const methodButtons = subScenarioDiv.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("margin-bottom", "20px");

  if (!StatsComponent.savingsOptimizationMethod) {
    StatsComponent.savingsOptimizationMethod = 'reduce-category';
  }

  const methods = [
    { id: 'reduce-category', label: StatsComponent.translateService.instant('BI.praeskriptiveMethodReduceCategory') },
    { id: 'increase-income', label: StatsComponent.translateService.instant('BI.praeskriptiveMethodIncreaseIncome') }
  ];

  methods.forEach(method => {
    methodButtons.append("button")
      .style("flex", "1")
      .style("padding", "10px")
      .style("border", "2px solid " + (StatsComponent.savingsOptimizationMethod === method.id ? "#1976d2" : "#ddd"))
      .style("border-radius", "6px")
      .style("background", StatsComponent.savingsOptimizationMethod === method.id ? "var(--color-info-surface)" : "var(--color-surface)")
      .style("cursor", "pointer")
      .style("font-size", "14px")
      .style("font-weight", StatsComponent.savingsOptimizationMethod === method.id ? "bold" : "normal")
      .style("color", StatsComponent.savingsOptimizationMethod === method.id ? "#1976d2" : "var(--color-text-secondary)")
      .text(method.label)
      .on("click", (event) => {
        // Prevent click during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
        StatsComponent.savingsOptimizationMethod = method.id;
        refreshScenario();
      });
  });

  if (StatsComponent.savingsOptimizationMethod === 'reduce-category') {
    createCategoryReductionControls(container);
  } else if (StatsComponent.savingsOptimizationMethod === 'increase-income') {
    createIncomeIncreaseControls(container);
  }
}/**
 * Category reduction controls with baseline display - supports multiple categories
 */
export function createCategoryReductionControls(container: any) {
  // Get top spending categories based on total spending (average over all transactions)
  const categoryTotals = new Map<string, number>();
  const monthlyData = new Map<string, Map<string, number>>();
  
  AppStateService.instance.allTransactions
    .filter(t => Number(t.amount) < 0)
    .forEach(t => {
      const month = t.date.substring(0, 7);
      if (!monthlyData.has(month)) {
        monthlyData.set(month, new Map());
      }
      const monthData = monthlyData.get(month)!;
      const amount = Math.abs(Number(t.amount));
      monthData.set(t.category, (monthData.get(t.category) || 0) + amount);
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + amount);
    });

  const allCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by total spending (biggest to lowest)
    .map(([cat]) => cat)
    .filter(cat => cat);

  // Initialize if empty or if first entry has no category
  if (StatsComponent.categoryReductions.length === 0 || !StatsComponent.categoryReductions[0].category) {
    StatsComponent.categoryReductions = [{
      category: allCategories[0] || "",
      method: "percentage",
      percent: 10,
      amount: 50
    }];
  }

  const controlsDiv = container.append("div")
    .style("max-width", "1200px")
    .style("margin-left", "auto")
    .style("margin-right", "auto");

  // Render each category reduction entry
  StatsComponent.categoryReductions.forEach((reduction, index) => {
    createSingleCategoryReduction(controlsDiv, reduction, index, allCategories, monthlyData);
  });

  // Add button to add more categories
  const selectedCategories = new Set(StatsComponent.categoryReductions.map(r => r.category));
  const availableCategories = allCategories.filter(cat => !selectedCategories.has(cat));
  
  if (availableCategories.length > 0) {
    controlsDiv.append("button")
      .style("display", "block")
      .style("width", "50px")
      .style("height", "50px")
      .style("margin", "20px auto")
      .style("padding", "0")
      .style("background", "#1976d2")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "50%")
      .style("cursor", "pointer")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("line-height", "50px")
      .style("text-align", "center")
      .style("box-shadow", "0 2px 8px rgba(25, 118, 210, 0.3)")
      .style("transition", "transform 0.2s")
      .text("+")
      .on("mouseover", function() {
        d3.select(this).style("transform", "scale(1.1)");
      })
      .on("mouseout", function() {
        d3.select(this).style("transform", "scale(1)");
      })
      .on("click", () => {
        StatsComponent.categoryReductions.push({
          category: "",  // Start empty, user must select
          method: "percentage",
          percent: 10,
          amount: 50
        });
        refreshScenario();
      });
  }
}/**
 * Create a single category reduction entry
 */
export function createSingleCategoryReduction(container: any, reduction: any, index: number, allCategories: string[], monthlyData: Map<string, Map<string, number>>) {
  const entryDiv = container.append("div")
    .style("padding", "15px")
    .style("margin-bottom", "15px")
    .style("background", "var(--color-surface-hover)")
    .style("border", "1px solid #ddd")
    .style("border-radius", "8px")
    .style("position", "relative");

  // Delete button (only show if more than one entry)
  if (StatsComponent.categoryReductions.length > 1) {
    entryDiv.append("button")
      .style("position", "absolute")
      .style("top", "10px")
      .style("right", "10px")
      .style("background", "#f44336")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "4px")
      .style("padding", "5px 10px")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .text(StatsComponent.translateService.instant('BI.deleteButton'))
      .on("click", () => {
        StatsComponent.categoryReductions.splice(index, 1);
        refreshScenario();
      });
  }

  // Calculate average monthly spending for selected category
  const numMonths = monthlyData.size || 1;
  let categoryAverage = 0;
  monthlyData.forEach(monthData => {
    categoryAverage += monthData.get(reduction.category) || 0;
  });
  categoryAverage = categoryAverage / numMonths;

  // Main grid layout for category and method selector
  const topRow = entryDiv.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(250px, 1fr))")
    .style("gap", "20px")
    .style("margin-bottom", "20px");

  // Category selector
  const categoryControl = topRow.append("div");
  
  categoryControl.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "8px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveCategory'));

  const selectedCategories = new Set(StatsComponent.categoryReductions.map((r, i) => i === index ? "" : r.category));
  const availableCategories = allCategories.filter(cat => !selectedCategories.has(cat));

  const select = categoryControl.append("select")
    .style("width", "100%")
    .style("padding", "8px")
    .style("border", "1px solid #ddd")
    .style("border-radius", "4px")
    .style("font-size", "14px")
    .on("change", function() {
      reduction.category = this.value;
      refreshScenario();
    });

  // For new entries (index > 0), add empty placeholder option
  if (index > 0 && !reduction.category) {
    select.append("option")
      .attr("value", "")
      .property("selected", true)
      .text(StatsComponent.translateService.instant('BI.praeskriptiveSelectCategory'));
  }

  availableCategories.forEach(cat => {
    select.append("option")
      .attr("value", cat)
      .property("selected", cat === reduction.category)
      .text(cat);
  });

  // Show baseline amount
  categoryControl.append("div")
    .style("margin-top", "8px")
    .style("padding", "10px")
    .style("background", "#fff")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .html(`<strong>Baseline:</strong> Ø ${categoryAverage.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}/Monat`);

  // Method selector
  const methodControl = topRow.append("div");
  
  methodControl.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "8px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveReductionMethod'));

  const methodButtons = methodControl.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("margin-bottom", "20px");

  // Percentage button
  methodButtons.append("button")
    .style("flex", "1")
    .style("padding", "10px")
    .style("border", "2px solid " + (reduction.method === "percentage" ? "#1976d2" : "#ddd"))
    .style("background", reduction.method === "percentage" ? "var(--color-info-surface)" : "var(--color-surface)")
    .style("border-radius", "6px")
    .style("cursor", "pointer")
    .style("font-size", "14px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveMethodPercentage'))
    .on("click", function() {
      reduction.method = "percentage";
      refreshScenario();
    });

  // Fixed amount button
  methodButtons.append("button")
    .style("flex", "1")
    .style("padding", "10px")
    .style("border", "2px solid " + (reduction.method === "fixed" ? "#1976d2" : "#ddd"))
    .style("background", reduction.method === "fixed" ? "var(--color-info-surface)" : "var(--color-surface)")
    .style("border-radius", "6px")
    .style("cursor", "pointer")
    .style("font-size", "14px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveMethodFixed'))
    .on("click", function() {
      reduction.method = "fixed";
      refreshScenario();
    });

  // Input based on method
  if (reduction.method === "percentage") {
    entryDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text(StatsComponent.translateService.instant('BI.praeskriptiveReductionPercent'));

    const inputGroup = entryDiv.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "10px")
      .style("align-items", "center");

    inputGroup.append("input")
      .attr("type", "number")
      .attr("min", "1")
      .attr("max", "100")
      .attr("step", "1")
      .attr("value", reduction.percent)
      .attr("id", `reduction-percent-input-${index}`)
      .style("width", "100px")
      .style("min-width", "100px")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        reduction.percent = parseFloat(this.value);
        d3.select(`#reduction-percent-slider-${index}`).property("value", this.value);
        refreshScenario();
      });

    inputGroup.append("span")
      .style("color", "var(--color-text-secondary)")
      .text("%");

    inputGroup.append("input")
      .attr("type", "range")
      .attr("min", "1")
      .attr("max", "100")
      .attr("step", "1")
      .attr("value", reduction.percent)
      .attr("id", `reduction-percent-slider-${index}`)
      .style("flex", "1")
      .style("min-width", "150px")
      .on("input", function() {
        reduction.percent = parseInt(this.value);
        d3.select(`#reduction-percent-input-${index}`).property("value", this.value);
        d3.select(`#reduction-value-display-${index}`).text(this.value + "%");
      })
      .on("change", () => {
        refreshScenario();
      });

    inputGroup.append("span")
      .attr("id", `reduction-value-display-${index}`)
      .style("color", "var(--color-text-secondary)")
      .style("font-weight", "bold")
      .style("min-width", "50px")
      .style("text-align", "right")
      .text(reduction.percent + "%");
  } else {
    entryDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text("Reduktion in " + AppStateService.instance.currency + ":");

    const inputGroup = entryDiv.append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("align-items", "center");

    inputGroup.append("input")
      .attr("type", "number")
      .attr("min", "0")
      .attr("step", "5")
      .attr("value", reduction.amount)
      .style("flex", "1")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        reduction.amount = parseFloat(this.value);
        refreshScenario();
      });

    inputGroup.append("span")
      .style("color", "var(--color-text-secondary)")
      .text(AppStateService.instance.currency);
  }
}/**
 * Income increase controls - supports multiple income increases
 */
export function createIncomeIncreaseControls(container: any) {
  // Detect current salary from last month's largest income transaction
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStr = lastMonth.toISOString().substring(0, 7);
  
  const lastMonthIncomes = AppStateService.instance.allTransactions.filter(t => 
    t.date.startsWith(lastMonthStr) && Number(t.amount) > 0
  );
  
  let currentSalary = 0;
  if (lastMonthIncomes.length > 0) {
    // Find the largest income transaction (likely the salary)
    currentSalary = Math.max(...lastMonthIncomes.map(t => Number(t.amount)));
  }

  // Initialize if empty
  if (StatsComponent.incomeIncreases.length === 0) {
    StatsComponent.incomeIncreases = [{
      method: "fixed",
      amount: 500,
      percent: 10
    }];
  }

  const controlsDiv = container.append("div")
    .style("max-width", "1200px")
    .style("margin-left", "auto")
    .style("margin-right", "auto");

  // Show detected salary baseline
  if (currentSalary > 0) {
    container.append("div")
      .style("padding", "15px")
      .style("background", "var(--color-info-surface)")
      .style("border-left", "4px solid #1976d2")
      .style("border-radius", "6px")
      .style("margin-bottom", "20px")
      .style("max-width", "1200px")
      .style("margin-left", "auto")
      .style("margin-right", "auto")
      .html(`
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 5px;"><strong>${StatsComponent.translateService.instant('BI.baselineLabel')}</strong></div>
        <div style="font-size: 14px; color: var(--color-text);">
          <strong>${StatsComponent.translateService.instant('BI.currentSalary')}</strong> ${currentSalary.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}
        </div>
      `);
  }

  // Render each income increase entry
  StatsComponent.incomeIncreases.forEach((increase, index) => {
    createSingleIncomeIncrease(controlsDiv, increase, index, currentSalary);
  });

  // Add button to add more income increases
  controlsDiv.append("button")
    .style("display", "block")
    .style("width", "50px")
    .style("height", "50px")
    .style("margin", "20px auto")
    .style("padding", "0")
    .style("background", "#1976d2")
    .style("color", "white")
    .style("border", "none")
    .style("border-radius", "50%")
    .style("cursor", "pointer")
    .style("font-size", "24px")
    .style("font-weight", "bold")
    .style("line-height", "50px")
    .style("text-align", "center")
    .style("box-shadow", "0 2px 8px rgba(25, 118, 210, 0.3)")
    .style("transition", "transform 0.2s")
    .text("+")
    .on("mouseover", function() {
      d3.select(this).style("transform", "scale(1.1)");
    })
    .on("mouseout", function() {
      d3.select(this).style("transform", "scale(1)");
    })
    .on("click", () => {
      StatsComponent.incomeIncreases.push({
        method: "fixed",
        amount: 500,
        percent: 10
      });
      refreshScenario();
    });
}/**
 * Create a single income increase entry
 */
export function createSingleIncomeIncrease(container: any, increase: any, index: number, currentSalary: number) {
  const entryDiv = container.append("div")
    .style("padding", "15px")
    .style("margin-bottom", "15px")
    .style("background", "var(--color-surface-hover)")
    .style("border", "1px solid #ddd")
    .style("border-radius", "8px")
    .style("position", "relative");

  // Delete button (only show if more than one entry)
  if (StatsComponent.incomeIncreases.length > 1) {
    entryDiv.append("button")
      .style("position", "absolute")
      .style("top", "10px")
      .style("right", "10px")
      .style("background", "#f44336")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "4px")
      .style("padding", "5px 10px")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .text(StatsComponent.translateService.instant('BI.deleteButton'))
      .on("click", () => {
        StatsComponent.incomeIncreases.splice(index, 1);
        refreshScenario();
      });
  }

  // Method selector
  entryDiv.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "10px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveIncreaseMethod'));

  const methodButtons = entryDiv.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("margin-bottom", "20px");

  // Fixed amount button
  methodButtons.append("button")
    .style("flex", "1")
    .style("padding", "10px")
    .style("border", "2px solid " + (increase.method === "fixed" ? "#1976d2" : "#ddd"))
    .style("background", increase.method === "fixed" ? "var(--color-info-surface)" : "var(--color-surface)")
    .style("border-radius", "6px")
    .style("cursor", "pointer")
    .style("font-size", "14px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveMethodFixed'))
    .on("click", function() {
      increase.method = "fixed";
      refreshScenario();
    });

  // Percentage button
  methodButtons.append("button")
    .style("flex", "1")
    .style("padding", "10px")
    .style("border", "2px solid " + (increase.method === "percentage" ? "#1976d2" : "#ddd"))
    .style("background", increase.method === "percentage" ? "var(--color-info-surface)" : "var(--color-surface)")
    .style("border-radius", "6px")
    .style("cursor", "pointer")
    .style("font-size", "14px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveMethodPercentage'))
    .on("click", function() {
      increase.method = "percentage";
      refreshScenario();
    });

  // Input based on method
  if (increase.method === "fixed") {
    entryDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text(StatsComponent.translateService.instant('BI.additionalMonthlyIncome'));

    const inputGroup = entryDiv.append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("align-items", "center");

    inputGroup.append("input")
      .attr("type", "number")
      .attr("min", "0")
      .attr("step", "50")
      .attr("value", increase.amount)
      .style("flex", "1")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        increase.amount = parseFloat(this.value);
        refreshScenario();
      });

    inputGroup.append("span")
      .style("color", "var(--color-text-secondary)")
      .text(AppStateService.instance.currency);
  } else {
    entryDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text(StatsComponent.translateService.instant('BI.salaryIncreasePercent'));

    const inputGroup = entryDiv.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "10px")
      .style("align-items", "center");

    inputGroup.append("input")
      .attr("type", "number")
      .attr("min", "1")
      .attr("max", "100")
      .attr("step", "1")
      .attr("value", increase.percent)
      .attr("id", `income-percent-input-${index}`)
      .style("width", "80px")
      .style("min-width", "80px")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        increase.percent = parseFloat(this.value);
        d3.select(`#income-percent-slider-${index}`).property("value", this.value);
        refreshScenario();
      });

    inputGroup.append("span")
      .style("color", "var(--color-text-secondary)")
      .text("%");

    inputGroup.append("input")
      .attr("type", "range")
      .attr("min", "1")
      .attr("max", "100")
      .attr("step", "1")
      .attr("value", increase.percent)
      .attr("id", `income-percent-slider-${index}`)
      .style("flex", "1")
      .style("min-width", "150px")
      .on("input", function() {
        increase.percent = parseInt(this.value);
        d3.select(`#income-percent-input-${index}`).property("value", this.value);
        d3.select(`#income-value-display-${index}`).text(this.value + "%");
      })
      .on("change", () => {
        refreshScenario();
      });

    inputGroup.append("span")
      .attr("id", `income-value-display-${index}`)
      .style("color", "var(--color-text-secondary)")
      .style("font-weight", "bold")
      .style("min-width", "50px")
      .style("text-align", "right")
      .text(increase.percent + "%");

    // Show new salary after percentage increase
    if (currentSalary > 0) {
      const newSalary = currentSalary * (1 + increase.percent / 100);
      entryDiv.append("div")
        .style("margin-top", "10px")
        .style("padding", "10px")
        .style("background", "#fff")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("color", "var(--color-text-secondary)")
        .html(`<strong>Neues Gehalt:</strong> ${newSalary.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency} (+${(newSalary - currentSalary).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency})`);
    }
  }
}/**
 * Szenario 2: Accelerate Mojo Goal
 */
export function createAccelerateMojoConfig(container: any) {
  // Get baseline from Prädiktive Analytics Mojo forecast (exclude current month)
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  
  const mojoTransactions = AppStateService.instance.allTransactions.filter(t => 
    t.category === '@Mojo' &&
    Number(t.amount) < 0 &&
    new Date(t.date) >= threeMonthsAgo &&
    t.date.substring(0, 7) !== `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );

  // Calculate average monthly contribution using Map to count actual months
  const monthlyContributions = new Map<string, number>();
  mojoTransactions.forEach(t => {
    const month = t.date.substring(0, 7);
    monthlyContributions.set(month, (monthlyContributions.get(month) || 0) + Math.abs(Number(t.amount)));
  });

  const avgMonthlyContribution = monthlyContributions.size > 0
    ? Array.from(monthlyContributions.values()).reduce((sum, v) => sum + v, 0) / monthlyContributions.size
    : 0;
  
  const currentBalance = AppStateService.instance.mojo.amount;
  const targetAmount = AppStateService.instance.mojo.target;
  const remainingAmount = targetAmount - currentBalance;
  const baselineMonthsToGoal = avgMonthlyContribution > 0 ? Math.ceil(remainingAmount / avgMonthlyContribution) : Infinity;
  
  const baselineDate = new Date();
  baselineDate.setMonth(baselineDate.getMonth() + baselineMonthsToGoal);

  if (!StatsComponent.mojoIncreaseAmount) {
    StatsComponent.mojoIncreaseAmount = 100;
  }
  if (!StatsComponent.mojoIncreasePercent) {
    StatsComponent.mojoIncreasePercent = 10;
  }
  if (!StatsComponent.mojoIncreaseMethod) {
    StatsComponent.mojoIncreaseMethod = "fixed";
  }

  // Display baseline
  container.append("div")
    .style("padding", "15px")
    .style("background", "var(--color-info-surface)")
    .style("border-left", "4px solid #1976d2")
    .style("border-radius", "6px")
    .style("margin-bottom", "20px")
    .html(`
      <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 5px;"><strong>${StatsComponent.translateService.instant('BI.baselineLabel')}</strong></div>
      <div style="font-size: 14px; color: var(--color-text);">
        <strong>${StatsComponent.translateService.instant('BI.currentDeposit')}</strong> Ø ${avgMonthlyContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}${StatsComponent.translateService.instant('BI.perMonth')}<br>
        <strong>${StatsComponent.translateService.instant('BI.remainingGoal')}</strong> ${remainingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}<br>
        <strong>${StatsComponent.translateService.instant('BI.goalAchievement')}</strong> ${baselineMonthsToGoal !== Infinity ? baselineMonthsToGoal + ' ' + StatsComponent.translateService.instant('BI.months') + ' (' + baselineDate.toLocaleDateString('de-DE', {month: 'short', year: 'numeric'}) + ')' : 'Unbekannt'}
      </div>
    `);

  // Method selector
  const controlsDiv = container.append("div")
    .style("max-width", "500px");

  controlsDiv.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "10px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveIncreaseMethod'));

  const methodButtons = controlsDiv.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("margin-bottom", "20px");

  // Fixed amount button
  methodButtons.append("button")
    .attr("data-method", "fixed")
    .style("flex", "1")
    .style("padding", "10px")
    .style("border", "2px solid " + (StatsComponent.mojoIncreaseMethod === "fixed" ? "#1976d2" : "#ddd"))
    .style("background", StatsComponent.mojoIncreaseMethod === "fixed" ? "var(--color-info-surface)" : "var(--color-surface)")
    .style("border-radius", "6px")
    .style("cursor", "pointer")
    .style("font-size", "14px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveMethodFixed'))
    .on("click", function() {
      StatsComponent.mojoIncreaseMethod = "fixed";
      refreshScenario();
    });

  // Percentage button
  methodButtons.append("button")
    .attr("data-method", "percentage")
    .style("flex", "1")
    .style("padding", "10px")
    .style("border", "2px solid " + (StatsComponent.mojoIncreaseMethod === "percentage" ? "#1976d2" : "#ddd"))
    .style("background", StatsComponent.mojoIncreaseMethod === "percentage" ? "var(--color-info-surface)" : "var(--color-surface)")
    .style("border-radius", "6px")
    .style("cursor", "pointer")
    .style("font-size", "14px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveMethodPercentage'))
    .on("click", function() {
      StatsComponent.mojoIncreaseMethod = "percentage";
      refreshScenario();
    });

  // Input based on method
  if (StatsComponent.mojoIncreaseMethod === "fixed") {
    controlsDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text(StatsComponent.translateService.instant('BI.increasePaymentBy'));

    const inputGroup = controlsDiv.append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("align-items", "center");

    inputGroup.append("input")
      .attr("type", "number")
      .attr("min", "0")
      .attr("step", "10")
      .attr("value", StatsComponent.mojoIncreaseAmount)
      .style("flex", "1")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        StatsComponent.mojoIncreaseAmount = parseFloat(this.value);
        refreshScenario();
      });

    inputGroup.append("span")
      .style("color", "var(--color-text-secondary)")
      .text(AppStateService.instance.currency);
  } else {
    controlsDiv.append("label")
      .style("display", "block")
      .style("font-weight", "bold")
      .style("color", "var(--color-text)")
      .style("margin-bottom", "8px")
      .text(StatsComponent.translateService.instant('BI.increasePaymentBy'));

    const inputGroup = controlsDiv.append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("align-items", "center");

    inputGroup.append("input")
      .attr("type", "number")
      .attr("min", "1")
      .attr("max", "100")
      .attr("step", "1")
      .attr("value", StatsComponent.mojoIncreasePercent)
      .style("flex", "1")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .on("change", function() {
        StatsComponent.mojoIncreasePercent = parseFloat(this.value);
        refreshScenario();
      });

    inputGroup.append("span")
      .style("color", "var(--color-text-secondary)")
      .text("%");
  }
}/**
 * Szenario 3: Savings Goal Simulator
 */
export function createSavingsGoalSimulatorConfig(container: any) {
  if (!StatsComponent.savingsGoalAmount) {
    StatsComponent.savingsGoalAmount = 10000;
  }

  const controlsDiv = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(250px, 1fr))")
    .style("gap", "20px");

  // Goal amount input
  const goalControl = controlsDiv.append("div");
  goalControl.append("label")
    .style("display", "block")
    .style("font-weight", "bold")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "8px")
    .text(StatsComponent.translateService.instant('BI.savingsGoalLabel'));

  const goalInputGroup = goalControl.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("align-items", "center");

  goalInputGroup.append("input")
    .attr("type", "number")
    .attr("min", "0")
    .attr("step", "100")
    .attr("value", StatsComponent.savingsGoalAmount)
    .style("flex", "1")
    .style("padding", "8px")
    .style("border", "1px solid #ddd")
    .style("border-radius", "4px")
    .style("font-size", "14px")
    .on("change", function() {
      StatsComponent.savingsGoalAmount = parseFloat(this.value);
      refreshScenario();
    });

  goalInputGroup.append("span")
    .style("color", "var(--color-text-secondary)")
    .text(AppStateService.instance.currency);

  // Reuse savings optimization controls
  const optimizationDiv = container.append("div")
    .style("margin-top", "20px");

  optimizationDiv.append("h4")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.adjustSavingsRate'));

  createOptimizeSavingsRateConfig(optimizationDiv);
}/**
 * Get last N months in YYYY-MM format
 */
export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}/**
 * Deprecated - use createOptimizeSavingsRateConfig instead
 */
export function createCategoryReductionConfig(container: any) {
  // Deprecated
}/**
 * Deprecated - now part of createAccelerateMojoConfig
 */
export function createIncreaseSavingsConfig(container: any) {
  // Deprecated
}/**
 * Deprecated - now part of createOptimizeSavingsRateConfig
 */
export function createIncomeIncreaseConfig(container: any) {
  // Deprecated
}/**
 * Create scenario results comparison
 */
export function createScenarioResults(container: any) {
  if (StatsComponent.selectedScenario === 'optimize-savings-rate') {
    createOptimizeSavingsRateResults(container);
  } else if (StatsComponent.selectedScenario === 'accelerate-mojo') {
    createAccelerateMojoResults(container);
  } else if (StatsComponent.selectedScenario === 'savings-goal-simulator') {
    createSavingsGoalSimulatorResults(container);
  }
}/**
 * Results for Scenario 1: Optimize Savings Rate
 */
export function createOptimizeSavingsRateResults(container: any) {
  // === CALCULATION 1: For Sparquote (left box) - use Descriptive Analytics logic ===
  // Filter transactions the same way as Descriptive Analytics heatmap
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  
  // Filter out inter-account transfers and Mojo account
  const filteredForRate = AppStateService.instance.allTransactions.filter(t => {
    if (t.amount === 0.0) return false;
    if (t.account === "Mojo") return false;
    // For expenses: must be from one of the 4 main expense accounts AND not an inter-account transfer
    if (expenseAccounts.includes(t.account)) {
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory);
    }
    // For income: must be from Income account
    return t.account === 'Income';
  });
  
  const totalIncomeForRate = filteredForRate
    .filter(t => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalExpensesForRate = filteredForRate
    .filter(t => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  
  const savingsRate = totalIncomeForRate > 0
    ? ((totalIncomeForRate - totalExpensesForRate) / totalIncomeForRate) * 100
    : 0;
  
  // === CALCULATION 2: Build monthly data for category expense calculations ===
  
  const transactions = AppStateService.instance.allTransactions;
  
  // Filter out inter-account transfers and zero amounts
  const validTransactions = transactions.filter(t => {
    if (t.amount === 0.0) return false;
    const cleanCategory = t.category.replace('@', '');
    return !accountCategoriesToExclude.includes(cleanCategory);
  });
  
  // Group by month and exclude current month
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthlyDataForRate = new Map<string, {income: number, expenses: number, categoryExpenses: Map<string, number>}>();
  
  validTransactions.forEach(t => {
    const monthKey = t.date.substring(0, 7);
    if (monthKey === currentMonth) return; // Exclude current month
    
    if (!monthlyDataForRate.has(monthKey)) {
      monthlyDataForRate.set(monthKey, { income: 0, expenses: 0, categoryExpenses: new Map() });
    }
    const data = monthlyDataForRate.get(monthKey)!;
    const amount = Number(t.amount);
    
    if (t.account === 'Income' && amount > 0) {
      data.income += amount;
    } else if (expenseAccounts.includes(t.account) && amount < 0) {
      data.expenses += Math.abs(amount);
      const cat = t.category;
      data.categoryExpenses.set(cat, (data.categoryExpenses.get(cat) || 0) + Math.abs(amount));
    }
  });
  
  // === CALCULATION 2: For Monatliches Sparen (right box) - use same filtering as baseline ===
  const filteredTransactions = AppStateService.instance.allTransactions.filter(t => {
    if (t.amount === 0.0) return false;
    if (t.account === "Mojo") return false;
    // For expenses: must be from one of the 4 main expense accounts AND not an inter-account transfer
    if (expenseAccounts.includes(t.account)) {
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory);
    }
    // For income: must be from Income account
    return t.account === 'Income';
  });
  
  const totalIncome = filteredTransactions
    .filter(t => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalExpenses = filteredTransactions
    .filter(t => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  
  // Get unique months to calculate averages
  const uniqueMonths = new Set<string>();
  filteredTransactions.forEach(t => {
    uniqueMonths.add(t.date.substring(0, 7));
  });
  const numMonths = uniqueMonths.size || 1;
  
  const income = totalIncome / numMonths;
  const expenses = totalExpenses / numMonths;
  const baselineSavings = income - expenses;
  
  // Build monthly data for category expense calculations
  let scenarioExpenses = expenses;
  let scenarioIncome = income;
  let scenarioDescription = "";
  let totalReduction = 0;
  let totalIncrease = 0;

  if (StatsComponent.savingsOptimizationMethod === 'reduce-category') {
    const reductionDescriptions: string[] = [];
    
    // Build monthlyData for consistent calculations (same as baseline - exclude Mojo)
    const monthlyDataForCalc = new Map<string, Map<string, number>>();
    AppStateService.instance.allTransactions
      .filter(t => Number(t.amount) < 0 && t.account !== "Mojo")
      .forEach(t => {
        const month = t.date.substring(0, 7);
        if (!monthlyDataForCalc.has(month)) {
          monthlyDataForCalc.set(month, new Map());
        }
        const monthData = monthlyDataForCalc.get(month)!;
        const amount = Math.abs(Number(t.amount));
        monthData.set(t.category, (monthData.get(t.category) || 0) + amount);
      });
    
    // Process all category reductions using same data as baseline display
    StatsComponent.categoryReductions.forEach(reduction => {
      const categoryMonthlyTotals: number[] = [];
      monthlyDataForCalc.forEach(monthData => {
        const catAmount = monthData.get(reduction.category) || 0;
        categoryMonthlyTotals.push(catAmount);
      });
      const numMonthsForCalc = monthlyDataForCalc.size || 1;
      const categoryAmount = categoryMonthlyTotals.reduce((sum, v) => sum + v, 0) / numMonthsForCalc;
      
      // Calculate reduction based on method
      const reductionAmount = reduction.method === "percentage"
        ? categoryAmount * (reduction.percent / 100)
        : reduction.amount;
      
      totalReduction += reductionAmount;
      
      // Add description for this reduction
      if (reduction.method === "percentage") {
        reductionDescriptions.push(`${reduction.category} -${reduction.percent}% (-${reductionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency})`);
      } else {
        const reductionPercent = categoryAmount > 0 ? (reductionAmount / categoryAmount * 100) : 0;
        reductionDescriptions.push(`${reduction.category} -${reductionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency} (-${reductionPercent.toFixed(1)}%)`);
      }
    });
    
    scenarioExpenses = expenses - totalReduction;
    scenarioDescription = reductionDescriptions.join(', ');
    
  } else if (StatsComponent.savingsOptimizationMethod === 'increase-income') {
    // Detect current salary for percentage calculation
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStr = lastMonth.toISOString().substring(0, 7);
    
    const lastMonthIncomes = AppStateService.instance.allTransactions.filter(t => 
      t.date.startsWith(lastMonthStr) && Number(t.amount) > 0
    );
    
    let currentSalary = 0;
    if (lastMonthIncomes.length > 0) {
      currentSalary = Math.max(...lastMonthIncomes.map(t => Number(t.amount)));
    }
    
    const increaseDescriptions: string[] = [];
    
    // Process all income increases
    StatsComponent.incomeIncreases.forEach((increase, index) => {
      const increaseAmount = increase.method === "percentage"
        ? currentSalary * (increase.percent / 100)
        : increase.amount;
      
      totalIncrease += increaseAmount;
      
      // Add description for this increase
      if (increase.method === "percentage") {
        const newSalary = currentSalary + increaseAmount;
        increaseDescriptions.push(`Einkommen +${increase.percent}% (+${increaseAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}, neues Gehalt: ${newSalary.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency})`);
      } else {
        increaseDescriptions.push(`Einkommen +${increaseAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);
      }
    });
    
    scenarioIncome = income + totalIncrease;
    scenarioDescription = increaseDescriptions.join(', ');
  }

  // Calculate scenario savings rate using same total method as baseline
  const scenarioTotalIncome = totalIncomeForRate + (totalIncrease * numMonths);
  const scenarioTotalExpenses = totalExpensesForRate - (totalReduction * numMonths);
  
  const scenarioSavingsRate = scenarioTotalIncome > 0
    ? ((scenarioTotalIncome - scenarioTotalExpenses) / scenarioTotalIncome) * 100
    : 0;

  // Calculate realistic monthly savings using the scenario savings rate applied to average monthly income
  // Baseline monthly savings: use the baseline savings rate applied to average monthly income
  const baselineMonthlySavings = income * (savingsRate / 100);
  
  // Scenario monthly savings: use the scenario savings rate applied to scenario average monthly income
  const scenarioMonthlySavings = scenarioIncome * (scenarioSavingsRate / 100);

  // Display results
  const resultsPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("max-width", "1400px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  resultsPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "10px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveImpactAnalysis'));

  // Show optimization strategy
  const strategyTitle = StatsComponent.savingsOptimizationMethod === 'reduce-category' 
    ? StatsComponent.translateService.instant('BI.strategyReduceExpenses') 
    : StatsComponent.translateService.instant('BI.additionalMonthlyIncome');
  
  resultsPanel.append("div")
    .style("padding", "12px")
    .style("background", "var(--color-info-surface)")
    .style("border-left", "4px solid #1976d2")
    .style("border-radius", "4px")
    .style("margin-bottom", "15px")
    .html(`
      <div style="font-weight: bold; color: #1976d2; margin-bottom: 5px;">${strategyTitle}</div>
      <div style="color: var(--color-text-secondary); font-size: 14px;">${scenarioDescription}</div>
    `);

  const comparisonDiv = resultsPanel.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(150px, 1fr))")
    .style("gap", "15px")
    .style("margin-bottom", "30px")
    .style("width", "100%");

  createComparisonBox(comparisonDiv, StatsComponent.translateService.instant('BI.savingsRate'), 
    savingsRate.toFixed(1) + "%", 
    scenarioSavingsRate.toFixed(1) + "%",
    scenarioSavingsRate > savingsRate);

  createComparisonBox(comparisonDiv, StatsComponent.translateService.instant('BI.savingsGoalLabel'), 
    baselineMonthlySavings.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency, 
    scenarioMonthlySavings.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency,
    scenarioMonthlySavings > baselineMonthlySavings);

  createComparisonChart(resultsPanel, savingsRate, scenarioSavingsRate, baselineMonthlySavings, scenarioMonthlySavings);
}/**
 * Results for Scenario 2: Accelerate Mojo Goal
 */
export function createAccelerateMojoResults(container: any) {
  // Get baseline from Prädiktive Analytics (exclude current month)
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  
  const mojoTransactions = AppStateService.instance.allTransactions.filter(t => 
    t.category === '@Mojo' &&
    Number(t.amount) < 0 &&
    new Date(t.date) >= threeMonthsAgo &&
    t.date.substring(0, 7) !== `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );

  // Calculate average monthly contribution using Map to count actual months
  const monthlyContributions = new Map<string, number>();
  mojoTransactions.forEach(t => {
    const month = t.date.substring(0, 7);
    monthlyContributions.set(month, (monthlyContributions.get(month) || 0) + Math.abs(Number(t.amount)));
  });

  const baselineContribution = monthlyContributions.size > 0
    ? Array.from(monthlyContributions.values()).reduce((sum, v) => sum + v, 0) / monthlyContributions.size
    : 0;
  
  const currentBalance = AppStateService.instance.mojo.amount;
  const targetAmount = AppStateService.instance.mojo.target;
  const remainingAmount = targetAmount - currentBalance;
  
  const baselineMonthsToGoal = baselineContribution > 0 ? Math.ceil(remainingAmount / baselineContribution) : Infinity;
  
  // Calculate increase based on method
  const increaseAmount = StatsComponent.mojoIncreaseMethod === "percentage"
    ? baselineContribution * (StatsComponent.mojoIncreasePercent / 100)
    : StatsComponent.mojoIncreaseAmount;
  
  const scenarioContribution = baselineContribution + increaseAmount;
  const scenarioMonthsToGoal = scenarioContribution > 0 ? Math.ceil(remainingAmount / scenarioContribution) : Infinity;
  const timeSaved = baselineMonthsToGoal !== Infinity && scenarioMonthsToGoal !== Infinity 
    ? baselineMonthsToGoal - scenarioMonthsToGoal 
    : 0;

  const baselineDate = new Date();
  baselineDate.setMonth(baselineDate.getMonth() + baselineMonthsToGoal);
  const scenarioDate = new Date();
  scenarioDate.setMonth(scenarioDate.getMonth() + scenarioMonthsToGoal);

  // Display results
  const resultsPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("max-width", "1400px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  resultsPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "10px")
    .text(StatsComponent.translateService.instant('BI.mojoGoalAcceleration'));

  const descriptionText = StatsComponent.mojoIncreaseMethod === "percentage"
    ? `Einzahlung von ${baselineContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} auf ${scenarioContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}/Monat erhöht (+${increaseAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}/Monat, ${StatsComponent.mojoIncreasePercent}%)`
    : `Einzahlung von ${baselineContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} auf ${scenarioContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}/Monat erhöht (+${increaseAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}/Monat)`;

  resultsPanel.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "20px")
    .style("font-style", "italic")
    .text(descriptionText);

  const comparisonDiv = resultsPanel.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(150px, 1fr))")
    .style("gap", "15px")
    .style("margin-bottom", "30px")
    .style("width", "100%");

  createComparisonBox(comparisonDiv, StatsComponent.translateService.instant('BI.monthlyDeposit'), 
    baselineContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency, 
    scenarioContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency,
    scenarioContribution > baselineContribution);

  if (baselineMonthsToGoal !== Infinity) {
    createComparisonBox(comparisonDiv, StatsComponent.translateService.instant('BI.monthsToGoal'), 
      baselineMonthsToGoal.toString(), 
      scenarioMonthsToGoal.toString(),
      scenarioMonthsToGoal < baselineMonthsToGoal);

    createComparisonBox(comparisonDiv, "Zielerreichung", 
      baselineDate.toLocaleDateString('de-DE', {month: 'short', year: 'numeric'}), 
      scenarioDate.toLocaleDateString('de-DE', {month: 'short', year: 'numeric'}),
      scenarioMonthsToGoal < baselineMonthsToGoal);
  }

  // Time saved highlight
  if (timeSaved > 0) {
    const highlightBox = resultsPanel.append("div")
      .style("padding", "20px")
      .style("background", "var(--color-success-surface-light)")
      .style("border-left", "4px solid #4caf50")
      .style("border-radius", "8px")
      .style("margin-bottom", "20px");

    highlightBox.append("div")
      .style("font-size", "14px")
      .style("color", "var(--color-text-secondary)")
      .style("margin-bottom", "5px")
      .text(StatsComponent.translateService.instant('BI.timeSavings'));

    highlightBox.append("div")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("color", "var(--color-success-dark)")
      .text(`${timeSaved} ${timeSaved === 1 ? 'Monat' : 'Monate'} schneller`);
  }

  // Timeline visualization
  createTimelineChart(resultsPanel, baselineMonthsToGoal, scenarioMonthsToGoal, baselineDate, scenarioDate);
}/**
 * Results for Scenario 3: Savings Goal Simulator
 */
export function createSavingsGoalSimulatorResults(container: any) {
  // Calculate baseline using the same logic as Descriptive Analytics (heatmap)
  // Exclude Mojo account and calculate total income/expenses across all time
  const filteredTransactions = AppStateService.instance.allTransactions.filter(t => t.account !== "Mojo");
  
  const totalIncome = filteredTransactions
    .filter(t => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalExpenses = filteredTransactions
    .filter(t => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  
  // Calculate current total savings rate (like in Descriptive Analytics)
  const currentSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  
  // Get unique months to calculate monthly averages for scenario calculations
  const uniqueMonths = new Set<string>();
  filteredTransactions.forEach(t => {
    uniqueMonths.add(t.date.substring(0, 7));
  });
  const numMonths = uniqueMonths.size || 1;
  
  const income = totalIncome / numMonths;
  const expenses = totalExpenses / numMonths;
  const savings = income - expenses;
  
  // Build category expenses map for reduction calculations
  const monthlyData = new Map<string, {income: number, expenses: number, categoryExpenses: Map<string, number>}>();
  
  filteredTransactions.forEach(t => {
    const month = t.date.substring(0, 7);
    if (!monthlyData.has(month)) {
      monthlyData.set(month, {income: 0, expenses: 0, categoryExpenses: new Map()});
    }
    const data = monthlyData.get(month)!;
    const amount = Number(t.amount);
    
    if (amount > 0) {
      data.income += amount;
    } else {
      data.expenses += Math.abs(amount);
      const cat = t.category;
      data.categoryExpenses.set(cat, (data.categoryExpenses.get(cat) || 0) + Math.abs(amount));
    }
  });

  // Calculate scenario savings based on optimization method
  let scenarioExpenses = expenses;
  let scenarioIncome = income;
  let totalReduction = 0;
  let totalIncrease = 0;

  if (StatsComponent.savingsOptimizationMethod === 'reduce-category') {
    
    // Process all category reductions
    StatsComponent.categoryReductions.forEach(reduction => {
      const categoryMonthlyTotals: number[] = [];
      monthlyData.forEach(data => {
        const catAmount = data.categoryExpenses.get(reduction.category) || 0;
        categoryMonthlyTotals.push(catAmount);
      });
      const categoryAmount = categoryMonthlyTotals.reduce((sum, v) => sum + v, 0) / numMonths;
      
      // Calculate reduction based on method
      const reductionAmount = reduction.method === "percentage"
        ? categoryAmount * (reduction.percent / 100)
        : reduction.amount;
      
      totalReduction += reductionAmount;
    });
    
    scenarioExpenses = expenses - totalReduction;
    
  } else if (StatsComponent.savingsOptimizationMethod === 'increase-income') {
    // Detect current salary for percentage calculation
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStr = lastMonth.toISOString().substring(0, 7);
    
    const lastMonthIncomes = AppStateService.instance.allTransactions.filter(t => 
      t.date.startsWith(lastMonthStr) && Number(t.amount) > 0
    );
    
    let currentSalary = 0;
    if (lastMonthIncomes.length > 0) {
      currentSalary = Math.max(...lastMonthIncomes.map(t => Number(t.amount)));
    }
    
    // Process all income increases
    StatsComponent.incomeIncreases.forEach(increase => {
      const increaseAmount = increase.method === "percentage"
        ? currentSalary * (increase.percent / 100)
        : increase.amount;
      
      totalIncrease += increaseAmount;
    });
    
    scenarioIncome = income + totalIncrease;
  }

  // Calculate scenario savings rate using total method (like baseline)
  const scenarioTotalIncome = totalIncome + (totalIncrease * numMonths);
  const scenarioTotalExpenses = totalExpenses - (totalReduction * numMonths);
  
  const scenarioSavingsRate = scenarioTotalIncome > 0
    ? ((scenarioTotalIncome - scenarioTotalExpenses) / scenarioTotalIncome) * 100
    : 0;

  // Calculate realistic monthly savings using the savings rate applied to average monthly income
  const baselineMonthlySavings = income * (currentSavingsRate / 100);
  const scenarioMonthlySavings = scenarioIncome * (scenarioSavingsRate / 100);

  // Calculate months to goal
  const goalAmount = StatsComponent.savingsGoalAmount;
  const baselineMonthsToGoal = baselineMonthlySavings > 0 ? Math.ceil(goalAmount / baselineMonthlySavings) : Infinity;
  const scenarioMonthsToGoal = scenarioMonthlySavings > 0 ? Math.ceil(goalAmount / scenarioMonthlySavings) : Infinity;
  const timeSaved = baselineMonthsToGoal !== Infinity && scenarioMonthsToGoal !== Infinity 
    ? baselineMonthsToGoal - scenarioMonthsToGoal 
    : 0;

  const baselineDate = new Date();
  baselineDate.setMonth(baselineDate.getMonth() + baselineMonthsToGoal);
  const scenarioDate = new Date();
  scenarioDate.setMonth(scenarioDate.getMonth() + scenarioMonthsToGoal);

  // Display results
  const resultsPanel = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("max-width", "1200px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  resultsPanel.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "10px")
    .text(StatsComponent.translateService.instant('BI.savingsGoalSimulation'));

  resultsPanel.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "15px")
    .style("font-weight", "bold")
    .text(`Ziel: ${goalAmount.toFixed(0)} ${AppStateService.instance.currency}`);

  // Show optimization strategy
  const strategyTitle = StatsComponent.savingsOptimizationMethod === 'reduce-category' 
    ? StatsComponent.translateService.instant('BI.strategyReduceExpenses') 
    : StatsComponent.translateService.instant('BI.additionalMonthlyIncome');
  
  let strategyDescription = "";
  if (StatsComponent.savingsOptimizationMethod === 'reduce-category') {
    const reductionDescriptions: string[] = [];
    StatsComponent.categoryReductions.forEach(reduction => {
      if (reduction.method === "percentage") {
        reductionDescriptions.push(`${reduction.category} -${reduction.percent}%`);
      } else {
        reductionDescriptions.push(`${reduction.category} -${reduction.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);
      }
    });
    strategyDescription = reductionDescriptions.join(', ');
  } else {
    const increaseDescriptions: string[] = [];
    StatsComponent.incomeIncreases.forEach(increase => {
      if (increase.method === "percentage") {
        increaseDescriptions.push(`Einkommen +${increase.percent}%`);
      } else {
        increaseDescriptions.push(`Einkommen +${increase.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);
      }
    });
    strategyDescription = increaseDescriptions.join(', ');
  }
  
  resultsPanel.append("div")
    .style("padding", "12px")
    .style("background", "var(--color-info-surface)")
    .style("border-left", "4px solid #1976d2")
    .style("border-radius", "4px")
    .style("margin-bottom", "20px")
    .html(`
      <div style="font-weight: bold; color: #1976d2; margin-bottom: 5px;">${strategyTitle}</div>
      <div style="color: var(--color-text-secondary); font-size: 14px;">${strategyDescription}</div>
    `);

  const comparisonDiv = resultsPanel.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(150px, 1fr))")
    .style("gap", "15px")
    .style("margin-bottom", "30px")
    .style("width", "100%");

  createComparisonBox(comparisonDiv, "Monatliches Sparen", 
    baselineMonthlySavings.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency, 
    scenarioMonthlySavings.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency,
    scenarioMonthlySavings > baselineMonthlySavings);

  if (baselineMonthsToGoal !== Infinity) {
    createComparisonBox(comparisonDiv, "Monate bis Ziel", 
      baselineMonthsToGoal.toString(), 
      scenarioMonthsToGoal.toString(),
      scenarioMonthsToGoal < baselineMonthsToGoal);

    createComparisonBox(comparisonDiv, "Zielerreichung", 
      baselineDate.toLocaleDateString('de-DE', {month: 'short', year: 'numeric'}), 
      scenarioDate.toLocaleDateString('de-DE', {month: 'short', year: 'numeric'}),
      scenarioMonthsToGoal < baselineMonthsToGoal);
  }

  // Time saved highlight
  if (timeSaved > 0) {
    const highlightBox = resultsPanel.append("div")
      .style("padding", "20px")
      .style("background", "var(--color-success-surface-light)")
      .style("border-left", "4px solid #4caf50")
      .style("border-radius", "8px")
      .style("margin-bottom", "20px");

    highlightBox.append("div")
      .style("font-size", "14px")
      .style("color", "var(--color-text-secondary)")
      .style("margin-bottom", "5px")
      .text(StatsComponent.translateService.instant('BI.timeSavings'));

    highlightBox.append("div")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("color", "var(--color-success-dark)")
      .text(`${timeSaved} ${timeSaved === 1 ? StatsComponent.translateService.instant('BI.months').slice(0, -1) : StatsComponent.translateService.instant('BI.months')} ${StatsComponent.translateService.instant('BI.faster')}`);
  }

  // Timeline visualization
  createTimelineChart(resultsPanel, baselineMonthsToGoal, scenarioMonthsToGoal, baselineDate, scenarioDate);
}/**
 * Create timeline visualization chart
 */
export function createTimelineChart(container: any, baselineMonths: number, scenarioMonths: number, baselineDate: Date, scenarioDate: Date) {
  if (baselineMonths === Infinity || scenarioMonths === Infinity) return;

  const chartDiv = container.append("div")
    .style("margin-top", "20px");

  chartDiv.append("h4")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.timelineToGoal'));

  // Get container width dynamically
  const containerWidth = (chartDiv.node() as HTMLElement).getBoundingClientRect().width;
  const isMobile = containerWidth < 600;
  const width = Math.max(300, containerWidth - 40);
  const height = isMobile ? 120 : 150;
  const margin = isMobile
    ? {top: 20, right: 10, bottom: 40, left: 10}
    : {top: 20, right: 20, bottom: 40, left: 20};

  const svg = chartDiv.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("max-width", "100%")
    .style("height", "auto")
    .style("display", "block")
    .style("margin", "0 auto");

  const maxMonths = Math.max(baselineMonths, scenarioMonths);
  const xScale = d3.scaleLinear()
    .domain([0, maxMonths])
    .range([margin.left, width - margin.right]);

  // Baseline timeline
  svg.append("line")
    .attr("x1", xScale(0))
    .attr("x2", xScale(baselineMonths))
    .attr("y1", height / 2 - 20)
    .attr("y2", height / 2 - 20)
    .attr("stroke", "#1976d2")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round");

  svg.append("text")
    .attr("x", xScale(baselineMonths / 2))
    .attr("y", height / 2 - 30)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#1976d2")
    .text(`${StatsComponent.translateService.instant('BI.current')}: ${baselineMonths} ${StatsComponent.translateService.instant('BI.months')}`);

  // Scenario timeline
  svg.append("line")
    .attr("x1", xScale(0))
    .attr("x2", xScale(scenarioMonths))
    .attr("y1", height / 2 + 20)
    .attr("y2", height / 2 + 20)
    .attr("stroke", "#4caf50")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round");

  svg.append("text")
    .attr("x", xScale(scenarioMonths / 2))
    .attr("y", height / 2 + 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#4caf50")
    .text(`${StatsComponent.translateService.instant('BI.scenario')}: ${scenarioMonths} ${StatsComponent.translateService.instant('BI.months')}`);

  // Month axis
  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => d + " M"))
    .selectAll("text")
    .style("font-size", "10px");
}/**
 * Create comparison box for results
 */
export function createComparisonBox(container: any, label: string, baseline: string, scenario: string, isImprovement: boolean) {
  const box = container.append("div")
    .style("padding", "15px")
    .style("background", "#f5f5f5")
    .style("border-radius", "8px")
    .style("text-align", "center");

  box.append("div")
    .style("font-size", "12px")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "10px")
    .text(label);

  const valuesDiv = box.append("div")
    .style("display", "flex")
    .style("justify-content", "space-around")
    .style("align-items", "center");

  // Baseline value
  const baselineDiv = valuesDiv.append("div");
  baselineDiv.append("div")
    .style("font-size", "10px")
    .style("color", "var(--color-text-hint)")
    .text(StatsComponent.translateService.instant('BI.current'));
  baselineDiv.append("div")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .text(baseline);

  // Arrow
  valuesDiv.append("div")
    .style("font-size", "24px")
    .style("color", isImprovement ? "#4caf50" : "#f44336")
    .text(isImprovement ? "→" : "→");

  // Scenario value
  const scenarioDiv = valuesDiv.append("div");
  scenarioDiv.append("div")
    .style("font-size", "10px")
    .style("color", "var(--color-text-hint)")
    .text(StatsComponent.translateService.instant('BI.scenario'));
  scenarioDiv.append("div")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .style("color", isImprovement ? "var(--color-success-dark)" : "#c62828")
    .text(scenario);
}/**
 * Create comparison chart
 */
export function createComparisonChart(container: any, baselineSavingsRate: number, scenarioSavingsRate: number, 
                              baselineSavings: number, scenarioSavings: number) {
  const chartDiv = container.append("div")
    .style("margin-top", "20px")
    .style("width", "100%");

  chartDiv.append("h4")
    .style("color", "var(--color-text)")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.praeskriptiveVisualComparison'));

  // Get container width for responsive grid
  const containerWidth = (chartDiv.node() as HTMLElement).getBoundingClientRect().width;
  const isMobile = containerWidth < 600;
  const minCardWidth = isMobile ? 250 : 300;
  
  const chartsContainer = chartDiv.append("div")
    .style("display", "grid")
    .style("grid-template-columns", `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`)
    .style("gap", "20px")
    .style("width", "100%");

  // Chart 1: Savings Rate (%)
  createSingleMetricChart(chartsContainer, "Sparquote", 
    baselineSavingsRate, scenarioSavingsRate, "%");

  // Chart 2: Monthly Savings (€)
  createSingleMetricChart(chartsContainer, "Monatliches Sparen", 
    baselineSavings, scenarioSavings, " " + AppStateService.instance.currency);
}/**
 * Create single metric comparison chart
 */
export function createSingleMetricChart(container: any, title: string, baseline: number, scenario: number, unit: string) {
  const chartBox = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "15px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("width", "100%")
    .style("overflow", "hidden")
    .style("box-sizing", "border-box");

  chartBox.append("h5")
    .style("color", "#1976d2")
    .style("margin-bottom", "10px")
    .style("text-align", "center")
    .text(title);

  // Use a responsive SVG that fills the container
  const svgContainer = chartBox.append("div")
    .style("width", "100%")
    .style("position", "relative")
    .style("overflow", "hidden");

  // Force a small delay to ensure grid layout is complete
  setTimeout(() => {
    // Get actual container width after layout - use offsetWidth for content width
    const chartBoxElement = chartBox.node() as HTMLElement;
    const containerWidth = chartBoxElement.offsetWidth - 30; // Account for padding (15px * 2)
    const isMobile = containerWidth < 450; // Increased threshold
    const width = Math.max(250, containerWidth);
    const height = isMobile ? 250 : 350;
    const margin = isMobile 
      ? {top: 20, right: 50, bottom: 40, left: 50}
      : {top: 20, right: 60, bottom: 40, left: 60};

    const svg = svgContainer.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block");

    const data = [
      { label: StatsComponent.translateService.instant('BI.current'), value: baseline, color: "#1976d2" },
      { label: StatsComponent.translateService.instant('BI.scenario'), value: scenario, color: "#4caf50" }
    ];

    const x = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.3);

    // Calculate domain with proper handling for all cases
    const minValue = Math.min(baseline, scenario);
    const maxValue = Math.max(baseline, scenario);
    
    // Ensure we have a proper range with padding
    let domainMin, domainMax;
    
    if (minValue >= 0) {
      // Both values positive - start from 0
      domainMin = 0;
      domainMax = maxValue > 0 ? maxValue * 1.15 : 10;
    } else if (maxValue <= 0) {
      // Both values negative
      domainMin = minValue * 1.15;
      domainMax = 0;
    } else {
      // Mixed positive and negative
      domainMin = minValue * 1.15;
      domainMax = maxValue * 1.15;
    }
    
    const y = d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([height - margin.bottom, margin.top]);

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("font-size", "11px");

    // Y axis with unit
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
        const formatted = Math.abs(d) < 1 ? d.toFixed(2) : d.toFixed(0);
        return formatted + unit;
      }))
      .selectAll("text")
      .style("font-size", "10px");

    // Zero line if needed
    if (minValue < 0) {
      svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "var(--color-text-hint)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    }

    // Bars
    data.forEach(d => {
      const barHeight = Math.abs(y(d.value) - y(0));
      const barY = d.value >= 0 ? y(d.value) : y(0);
      
      svg.append("rect")
        .attr("x", x(d.label))
        .attr("y", barY)
        .attr("width", x.bandwidth())
        .attr("height", barHeight)
        .attr("fill", d.color);

      // Value labels
      svg.append("text")
        .attr("x", x(d.label) + x.bandwidth() / 2)
        .attr("y", barY - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", d.color)
        .text(d.value.toFixed(1) + unit);
    });
  }, 0);
}/**
 * Refresh scenario (config and results only)
 */
export function refreshScenario() {
  // Update scenario selector button styles
  d3.select("#praeskriptive-main-container").selectAll("[data-scenario-id]").each(function() {
    const card = d3.select(this);
    const scenarioId = card.attr("data-scenario-id");
    if (scenarioId) {
      const isActive = StatsComponent.selectedScenario === scenarioId;
      card
        .style("border", "2px solid " + (isActive ? "#1976d2" : "#ddd"))
        .style("background", isActive ? "var(--color-info-surface)" : "var(--color-surface)");
    }
  });

  // Clear and recreate config
  const configContainer = d3.select("#scenario-config-container");
  if (!configContainer.empty()) {
    configContainer.html("");
    createScenarioConfig(configContainer);
  }

  // Clear and recreate results
  const resultsContainer = d3.select("#scenario-results-container");
  if (!resultsContainer.empty()) {
    resultsContainer.html("");
    createScenarioResults(resultsContainer);
  }
}
