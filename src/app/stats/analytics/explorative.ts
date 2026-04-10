import { StatsComponent } from '../stats.component';
import * as d3 from 'd3';
import { ChartFilterService } from '../../shared/services/chart-filter.service';
import { AppStateService } from '../../shared/services/app-state.service';

export function createExplorativeAnalytics(container: any) {
  const contentDiv = container.append("div")
    .attr("id", "explorative-main-container")
    .style("padding", "20px")
    .style("padding-bottom", "80px")
    .style("overflow-y", "auto");

  // Title
  contentDiv.append("h2")
    .style("color", "#1976d2")
    .style("margin-bottom", "20px")
    .style("text-align", "center")
    .text(StatsComponent.translateService.instant('BI.explorativeTitle'));

  // Breadcrumb Navigation
  createBreadcrumbNavigation(contentDiv);

  // Time Filter (above custom filter)
  StatsComponent.createTimeFilter(contentDiv);

  // Filter Panel Placeholder (filter will be moved here from HTML template)
  contentDiv.append("div")
    .attr("id", "explorative-filter-placeholder");

  // Period Comparison Toggle
  createPeriodComparisonToggle(contentDiv);

  // Placeholder for visualization (will be filled by update)
  contentDiv.append("div")
    .attr("id", "explorative-viz-placeholder");

  // Placeholder for transaction table (will be filled by update)
  contentDiv.append("div")
    .attr("id", "explorative-table-placeholder");

  // Initial render
  updateExplorativeView();
}/**
 * Breadcrumb Navigation for tracking analysis steps
 */
export function createBreadcrumbNavigation(container: any) {
  const breadcrumbDiv = container.append("div")
    .attr("id", "explorative-breadcrumb")
    .style("background", "var(--color-surface)")
    .style("padding", "15px")
    .style("margin-bottom", "15px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "10px")
    .style("flex-wrap", "wrap");

  // Home icon
  breadcrumbDiv.append("span")
    .style("cursor", "pointer")
    .style("color", "#1976d2")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('BI.explorativeOverview'))
    .on("click", (event) => {
      // Prevent click during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      StatsComponent.explorativeBreadcrumbs = [];
      StatsComponent.explorativeDrilldownLevel = "overview";
      StatsComponent.explorativeDrilldownAccount = "";
      StatsComponent.explorativeDrilldownCategory = "";
      updateBreadcrumbNavigation();
      updateExplorativeView();
    });

  // Breadcrumb items
  StatsComponent.explorativeBreadcrumbs.forEach((crumb, index) => {
    breadcrumbDiv.append("span")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.explorativeBreadcrumbSeparator'));

    breadcrumbDiv.append("span")
      .style("cursor", "pointer")
      .style("color", index === StatsComponent.explorativeBreadcrumbs.length - 1 ? "var(--color-text)" : "#1976d2")
      .style("font-weight", index === StatsComponent.explorativeBreadcrumbs.length - 1 ? "bold" : "normal")
      .text(`${crumb.level}: ${crumb.value}`)
      .on("click", (event) => {
        // Prevent click during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
        // Navigate back to this level
        StatsComponent.explorativeBreadcrumbs = StatsComponent.explorativeBreadcrumbs.slice(0, index + 1);
        if (crumb.level === StatsComponent.translateService.instant('BI.breadcrumbAccount')) {
          StatsComponent.explorativeDrilldownLevel = "account";
          StatsComponent.explorativeDrilldownAccount = crumb.value;
          StatsComponent.explorativeDrilldownCategory = "";
        } else if (crumb.level === StatsComponent.translateService.instant('BI.breadcrumbCategory')) {
          StatsComponent.explorativeDrilldownLevel = "category";
          StatsComponent.explorativeDrilldownCategory = crumb.value;
        }
        updateBreadcrumbNavigation();
        updateExplorativeView();
      });
  });
}/**
 * Update Breadcrumb Navigation without recreating the entire dashboard
 */
export function updateBreadcrumbNavigation() {
  const breadcrumbDiv = d3.select("#explorative-breadcrumb");
  if (breadcrumbDiv.empty()) return;
  
  // Clear existing content
  breadcrumbDiv.selectAll("*").remove();
  
  // Rebuild breadcrumb items
  // Home icon
  breadcrumbDiv.append("span")
    .style("cursor", "pointer")
    .style("color", "#1976d2")
    .style("font-weight", "bold")
    .text(StatsComponent.translateService.instant('BI.explorativeOverview'))
    .on("click", (event) => {
      // Prevent click during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      StatsComponent.explorativeBreadcrumbs = [];
      StatsComponent.explorativeDrilldownLevel = "overview";
      StatsComponent.explorativeDrilldownAccount = "";
      StatsComponent.explorativeDrilldownCategory = "";
      updateBreadcrumbNavigation();
      updateExplorativeView();
    });

  // Breadcrumb items
  StatsComponent.explorativeBreadcrumbs.forEach((crumb, index) => {
    breadcrumbDiv.append("span")
      .style("color", "var(--color-text-secondary)")
      .text(StatsComponent.translateService.instant('BI.explorativeBreadcrumbSeparator'));

    breadcrumbDiv.append("span")
      .style("cursor", "pointer")
      .style("color", index === StatsComponent.explorativeBreadcrumbs.length - 1 ? "var(--color-text)" : "#1976d2")
      .style("font-weight", index === StatsComponent.explorativeBreadcrumbs.length - 1 ? "bold" : "normal")
      .text(`${crumb.level}: ${crumb.value}`)
      .on("click", (event) => {
        // Prevent click during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
        // Navigate back to this level
        StatsComponent.explorativeBreadcrumbs = StatsComponent.explorativeBreadcrumbs.slice(0, index + 1);
        if (crumb.level === StatsComponent.translateService.instant('BI.breadcrumbAccount')) {
          StatsComponent.explorativeDrilldownLevel = "account";
          StatsComponent.explorativeDrilldownAccount = crumb.value;
          StatsComponent.explorativeDrilldownCategory = "";
        } else if (crumb.level === StatsComponent.translateService.instant('BI.breadcrumbCategory')) {
          StatsComponent.explorativeDrilldownLevel = "category";
          StatsComponent.explorativeDrilldownCategory = crumb.value;
        }
        updateBreadcrumbNavigation();
        updateExplorativeView();
      });
  });
}/**
 * Period Comparison Toggle
 */
export function createPeriodComparisonToggle(container: any) {
  const toggleDiv = container.append("div")
    .style("background", "var(--color-surface)")
    .style("padding", "15px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "15px");

  toggleDiv.append("span")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .text(StatsComponent.translateService.instant('BI.explorativePeriodComparison'));

  toggleDiv.append("label")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "10px")
    .style("cursor", "pointer")
    .html(`
      <input type="checkbox" ${StatsComponent.explorativeComparisonMode ? 'checked' : ''} 
             style="width: 20px; height: 20px; cursor: pointer;">
      <span>${StatsComponent.translateService.instant('BI.buttonShowComparison')}</span>
    `)
    .on("change", function() {
      StatsComponent.explorativeComparisonMode = this.querySelector('input').checked;
      updateExplorativeView();
    });

  toggleDiv.append("span")
    .style("margin-left", "auto")
    .style("font-size", "12px")
    .style("color", "var(--color-text-hint)")
    .text(StatsComponent.translateService.instant('BI.explorativePeriodComparisonDesc'));
}/**
 * Main Visualization based on drill-down level
 */
export function createExplorativeVisualization(container: any) {
  // Container is now the placeholder, so we don't create another div with ID
  container
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  const transactions = getExplorativeFilteredTransactions();

  if (StatsComponent.explorativeComparisonMode) {
    createPeriodComparisonView(container, transactions);
  } else {
    switch(StatsComponent.explorativeDrilldownLevel) {
      case "overview":
        createExplorativeOverview(container, transactions);
        break;
      case "account":
        createExplorativeAccountDetail(container, transactions);
        break;
      case "category":
        createExplorativeCategoryDetail(container, transactions);
        break;
    }
  }
}/**
 * Get filtered transactions based on explorative filters
 */
export function getExplorativeFilteredTransactions(): any[] {
  // Start with time-filtered transactions (respects the period filter)
  let transactions = StatsComponent.getFilteredTransactions();

  // Custom date range filter (if dates are set) - works on top of period filter
  if (StatsComponent.customDateStart) {
    transactions = transactions.filter(t => t.date >= StatsComponent.customDateStart);
  }
  if (StatsComponent.customDateEnd) {
    transactions = transactions.filter(t => t.date <= StatsComponent.customDateEnd);
  }

  // Account filter
  if (StatsComponent.explorativeSelectedAccounts.length > 0) {
    transactions = transactions.filter(t => 
      StatsComponent.explorativeSelectedAccounts.includes(t.account)
    );
  }

  // Category filter (compare without @ symbol)
  if (StatsComponent.explorativeSelectedCategories.length > 0) {
    transactions = transactions.filter(t => {
      const cleanCategory = t.category.replace('@', '');
      return StatsComponent.explorativeSelectedCategories.includes(cleanCategory);
    });
  }

  // Amount range filter (using actual negative values)
  transactions = transactions.filter(t => {
    const amount = Number(t.amount);
    return amount >= StatsComponent.explorativeAmountMin && 
           amount <= StatsComponent.explorativeAmountMax;
  });

  // Search text filter with boolean logic and field selection
  if (StatsComponent.explorativeSearchText.trim()) {
    transactions = transactions.filter(t => {
      // Replace word operators with symbols for easier parsing
      let searchExpression = StatsComponent.explorativeSearchText
        .replace(/\band\b/gi, '&&')
        .replace(/\bor\b/gi, '||')
        .replace(/\bnot\b/gi, '!');
      
      // Split by || (OR) to get OR groups
      const orGroups = searchExpression.split('||').map(g => g.trim());
      
      // Check if any OR group matches
      let matchFound = false;
      
      for (const orGroup of orGroups) {
        // Split by && (AND) to get AND terms within this OR group
        const andTerms = orGroup.split('&&').map(term => term.trim());
        
        // All AND terms must match for this OR group to match
        let allAndTermsMatch = true;
        
        for (const andTerm of andTerms) {
          // Check for NOT operator
          const isNegated = andTerm.startsWith('!');
          const searchTerm = (isNegated ? andTerm.substring(1).trim() : andTerm).toLowerCase();
          
          if (!searchTerm) continue;
          
          // Check if this term matches any selected field
          let termMatches = checkExplorativeSearchTerm(t, searchTerm);
          
          // Apply negation if needed
          if (isNegated) {
            termMatches = !termMatches;
          }
          
          // If this AND term doesn't match, this OR group fails
          if (!termMatches) {
            allAndTermsMatch = false;
            break;
          }
        }
        
        // If all AND terms matched in this OR group, we found a match
        if (allAndTermsMatch && andTerms.length > 0) {
          matchFound = true;
          break;
        }
      }
      
      return matchFound;
    });
  }

  // Drill-down filters
  if (StatsComponent.explorativeDrilldownAccount) {
    transactions = transactions.filter(t => 
      t.account === StatsComponent.explorativeDrilldownAccount
    );
  }

  if (StatsComponent.explorativeDrilldownCategory) {
    transactions = transactions.filter(t => 
      t.category === StatsComponent.explorativeDrilldownCategory
    );
  }

  return transactions;
}/**
 * Helper method to check if a search term matches any selected field in a transaction
 */
export function checkExplorativeSearchTerm(transaction: any, searchTerm: string): boolean {
  if (StatsComponent.explorativeSearchFields.account && 
      transaction.account.toLowerCase().includes(searchTerm)) {
    return true;
  }
  
  if (StatsComponent.explorativeSearchFields.amount) {
    const comparisonMatch = searchTerm.match(/^(>=|<=|>|<)(.+)$/);
    if (comparisonMatch) {
      const operator = comparisonMatch[1];
      const value = parseFloat(comparisonMatch[2]);
      if (!isNaN(value)) {
        const amount = Number(transaction.amount);
        switch (operator) {
          case '>': if (amount > value) return true; break;
          case '<': if (amount < value) return true; break;
          case '>=': if (amount >= value) return true; break;
          case '<=': if (amount <= value) return true; break;
        }
      }
    } else if (transaction.amount.toString().includes(searchTerm)) {
      return true;
    }
  }
  
  if (StatsComponent.explorativeSearchFields.date) {
    const comparisonMatch = searchTerm.match(/^(>=|<=|>|<)(.+)$/);
    if (comparisonMatch) {
      const operator = comparisonMatch[1];
      const dateStr = comparisonMatch[2];
      const dateMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];
        if (year.length === 2) {
          year = '20' + year;
        }
        const isoDate = `${year}-${month}-${day}`;
        switch (operator) {
          case '>': if (transaction.date > isoDate) return true; break;
          case '<': if (transaction.date < isoDate) return true; break;
          case '>=': if (transaction.date >= isoDate) return true; break;
          case '<=': if (transaction.date <= isoDate) return true; break;
        }
      }
    } else {
      if (transaction.date.toLowerCase().includes(searchTerm)) {
        return true;
      }
      const dateMatch = searchTerm.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];
        if (year.length === 2) {
          year = '20' + year;
        }
        const isoDate = `${year}-${month}-${day}`;
        if (transaction.date === isoDate) {
          return true;
        }
      }
    }
  }
  
  if (StatsComponent.explorativeSearchFields.time) {
    if (!transaction.time || transaction.time.trim() === '') {
      return false;
    }
    
    const comparisonMatch = searchTerm.match(/^(>=|<=|>|<)(.+)$/);
    const timeToCheck = comparisonMatch ? comparisonMatch[2].trim() : searchTerm;
    
    if (/^\d{1,2}:\d{2}$/.test(timeToCheck)) {
      const normalizeTime = (time: string): string => {
        const parts = time.split(':');
        return parts[0].padStart(2, '0') + ':' + parts[1];
      };
      
      const normalizedTransaction = normalizeTime(transaction.time);
      const normalizedSearch = normalizeTime(timeToCheck);
      
      if (comparisonMatch) {
        const operator = comparisonMatch[1];
        switch (operator) {
          case '>': if (normalizedTransaction > normalizedSearch) return true; break;
          case '<': if (normalizedTransaction < normalizedSearch) return true; break;
          case '>=': if (normalizedTransaction >= normalizedSearch) return true; break;
          case '<=': if (normalizedTransaction <= normalizedSearch) return true; break;
        }
      } else if (normalizedTransaction.includes(normalizedSearch)) {
        return true;
      }
    }
  }
  
  if (StatsComponent.explorativeSearchFields.category) {
    const cleanCategory = transaction.category.replace('@', '');
    if (cleanCategory.toLowerCase().includes(searchTerm)) {
      return true;
    }
  }
  
  if (StatsComponent.explorativeSearchFields.comment && 
      (transaction.comment || "").toLowerCase().includes(searchTerm)) {
    return true;
  }

  return false;
}/**
 * Update explorative view without recreating entire dashboard
 */
export function updateExplorativeView() {
  // Clear placeholders
  d3.select("#explorative-viz-placeholder").selectAll("*").remove();
  d3.select("#explorative-table-placeholder").selectAll("*").remove();

  // Recreate visualization and table in placeholders
  const vizPlaceholder = d3.select("#explorative-viz-placeholder");
  const tablePlaceholder = d3.select("#explorative-table-placeholder");

  createExplorativeVisualization(vizPlaceholder);
  createExplorativeTransactionTable(tablePlaceholder);
}/**
 * Create overview visualization with drill-down capability
 */
export function createExplorativeOverview(container: any, transactions: any[]) {
  container.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(`${StatsComponent.translateService.instant('BI.labelOverview')} – ${StatsComponent.translateService.instant('BI.labelExpenses')} ${StatsComponent.translateService.instant('BI.labelBy')} ${StatsComponent.translateService.instant('BI.labelAccounts')}`);

  // Group by account (exclude Mojo account)
  const accountMap = new Map<string, number>();
  transactions.filter(t => Number(t.amount) < 0 && t.account !== 'Mojo').forEach(t => {
    const amount = Math.abs(Number(t.amount));
    accountMap.set(t.account, (accountMap.get(t.account) || 0) + amount);
  });

  const data = Array.from(accountMap.entries())
    .map(([account, amount]) => ({ account, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Create bar chart with drill-down - responsive sizing
  const containerWidth = container.node()?.getBoundingClientRect().width || 800;
  const svgWidth = Math.min(containerWidth - 40, 800); // Max 800px, responsive
  const svgHeight = 400;
  const screenWidth = window.innerWidth;
  const isMobile = screenWidth < 600;
  const margin = { top: 20, right: 20, bottom: 80, left: isMobile ? 70 : 80 };
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("height", svgHeight)
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("max-width", "100%")
    .style("display", "block")
    .style("margin", "0 auto");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.account))
    .range([0, width])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.amount) as number])
    .nice()
    .range([height, 0]);

  // Bars with click to drill-down
  g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.account) as number)
    .attr("y", d => y(d.amount))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.amount))
    .attr("fill", "#1976d2")
    .style("cursor", "pointer")
    .on("mouseover", function() {
      d3.select(this).attr("fill", "#ff9800");
    })
    .on("mouseout", function() {
      d3.select(this).attr("fill", "#1976d2");
    })
    .on("click", (event, d) => {
      // Prevent click during scrolling
      if (StatsComponent.currentInstance?.isScrollingActive()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      StatsComponent.explorativeDrilldownLevel = "account";
      StatsComponent.explorativeDrilldownAccount = d.account;
      StatsComponent.explorativeBreadcrumbs.push({ level: StatsComponent.translateService.instant('BI.breadcrumbAccount'), value: d.account });
      updateBreadcrumbNavigation();
      updateExplorativeView();
    });

  // Value labels
  g.selectAll(".value-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value-label")
    .attr("x", d => (x(d.account) as number) + x.bandwidth() / 2)
    .attr("y", d => y(d.amount) - 5)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "var(--color-text)")
    .text(d => d.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("font-size", "12px")
    .style("font-weight", "bold");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .style("font-size", "11px");

  // Click instruction
  container.append("p")
    .style("text-align", "center")
    .style("color", "var(--color-text-secondary)")
    .style("font-size", "12px")
    .style("margin-top", "10px")
    .text(StatsComponent.translateService.instant('BI.clickAccountDetails'));
}/**
 * Create account detail view showing categories
 */
export function createExplorativeAccountDetail(container: any, transactions: any[]) {
  container.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(`Konto: ${StatsComponent.explorativeDrilldownAccount} – Ausgaben nach Kategorie`);

  // Group by category
  const categoryMap = new Map<string, number>();
  transactions.filter(t => Number(t.amount) < 0).forEach(t => {
    const amount = Number(t.amount);
    categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + amount);
  });

  const data = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => a.amount - b.amount); // Always sort by amount (most negative first)

  // Create table view
  const tableDiv = container.append("div")
    .style("max-height", "400px")
    .style("overflow-y", "auto");

  const table = tableDiv.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse");

  const thead = table.append("thead");
  thead.append("tr")
    .selectAll("th")
    .data([StatsComponent.translateService.instant('BI.columnRank'), StatsComponent.translateService.instant('BI.columnCategory'), StatsComponent.translateService.instant('BI.columnAmount'), StatsComponent.translateService.instant('BI.columnShare'), StatsComponent.translateService.instant('BI.columnAction')])
    .enter()
    .append("th")
    .style("padding", "12px")
    .style("background", "#1976d2")
    .style("color", "white")
    .style("text-align", "left")
    .style("position", "sticky")
    .style("top", "0")
    .text(d => d);

  const tbody = table.append("tbody");
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  data.forEach((d, i) => {
    const row = tbody.append("tr")
      .style("border-bottom", "1px solid var(--color-muted-light)");

    row.append("td")
      .style("padding", "10px")
      .text(i + 1);

    row.append("td")
      .style("padding", "10px")
      .style("font-weight", "bold")
      .text(d.category);

    row.append("td")
      .style("padding", "10px")
      .style("color", "#f44336")
      .text(d.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

    row.append("td")
      .style("padding", "10px")
      .text(((d.amount / total) * 100).toFixed(1) + "%");

    row.append("td")
      .style("padding", "10px")
      .append("button")
      .style("padding", "5px 10px")
      .style("background", "#1976d2")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "4px")
      .style("cursor", "pointer")
      .text(StatsComponent.translateService.instant('BI.buttonDetails'))
      .on("click", (event) => {
        // Prevent click during scrolling
        if (StatsComponent.currentInstance?.isScrollingActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
        StatsComponent.explorativeDrilldownLevel = "category";
        StatsComponent.explorativeDrilldownCategory = d.category;
        StatsComponent.explorativeBreadcrumbs.push({ level: StatsComponent.translateService.instant('BI.breadcrumbCategory'), value: d.category });
        updateBreadcrumbNavigation();
        updateExplorativeView();
      });
  });
}/**
 * Create category detail view showing individual transactions
 */
export function createExplorativeCategoryDetail(container: any, transactions: any[]) {
  container.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(`Kategorie: ${StatsComponent.explorativeDrilldownCategory} – Einzeltransaktionen`);

  const data = transactions
    .filter(t => Number(t.amount) < 0)
    .sort((a, b) => {
      if (StatsComponent.explorativeSortBy === 'amount') {
        const amountA = Math.abs(Number(a.amount));
        const amountB = Math.abs(Number(b.amount));
        return StatsComponent.explorativeSortOrder === 'desc' ? amountB - amountA : amountA - amountB;
      } else if (StatsComponent.explorativeSortBy === 'date') {
        return StatsComponent.explorativeSortOrder === 'desc' 
          ? b.date.localeCompare(a.date) 
          : a.date.localeCompare(b.date);
      }
      return 0;
    });

  container.append("p")
    .style("color", "var(--color-text-secondary)")
    .style("margin-bottom", "15px")
    .text(`${StatsComponent.translateService.instant('BI.foundTransactions')} ${data.length} ${StatsComponent.translateService.instant('BI.labelTransactions')} | ${StatsComponent.translateService.instant('BI.labelTotal')}: ${data.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}`);

  // This will show the detailed transaction table below
}/**
 * Create period comparison view
 */
export function createPeriodComparisonView(container: any, transactions: any[]) {
  container.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.explorativePeriodComparisonTitle'));

  // Group transactions by month
  // Exclude: Mojo account, inter-account transfers (categories @Daily, @Splurge, @Smile, @Fire, @Income)
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  
  const monthlyData = new Map<string, number>();
  transactions.filter(t => {
    // Only count expenses (negative amounts) from expense accounts, not from Mojo
    if (Number(t.amount) >= 0) return false;
    if (!expenseAccounts.includes(t.account)) return false; // Exclude Mojo and Income
    
    // Exclude inter-account transfers
    const cleanCategory = t.category.replace('@', '');
    if (accountCategoriesToExclude.includes(cleanCategory)) return false;
    
    return true;
  }).forEach(t => {
    const month = t.date.substring(0, 7);
    const amount = Math.abs(Number(t.amount));
    monthlyData.set(month, (monthlyData.get(month) || 0) + amount);
  });

  const months = Array.from(monthlyData.keys()).sort();
  const comparisons: any[] = [];

  for (let i = 1; i < months.length; i++) {
    const prevMonth = months[i - 1];
    const currMonth = months[i];
    const prevAmount = monthlyData.get(prevMonth) || 0;
    const currAmount = monthlyData.get(currMonth) || 0;
    const diff = currAmount - prevAmount;
    const percentChange = prevAmount > 0 ? (diff / prevAmount) * 100 : 0;

    comparisons.push({
      prevMonth,
      currMonth,
      prevAmount,
      currAmount,
      diff,
      percentChange
    });
  }

  // Sort comparisons based on current sort settings
  comparisons.sort((a, b) => {
    let comparison = 0;
    
    switch (StatsComponent.periodComparisonSortColumn) {
      case 'period':
        comparison = a.currMonth.localeCompare(b.currMonth);
        break;
      case 'prevAmount':
        comparison = a.prevAmount - b.prevAmount;
        break;
      case 'currAmount':
        comparison = a.currAmount - b.currAmount;
        break;
      case 'diff':
        comparison = a.diff - b.diff;
        break;
      case 'percentChange':
        comparison = a.percentChange - b.percentChange;
        break;
      case 'trend':
        comparison = a.diff - b.diff; // Sort by diff (up/down trend)
        break;
    }
    
    return StatsComponent.periodComparisonSortOrder === 'desc' ? -comparison : comparison;
  });

  // Create comparison table
  const tableDiv = container.append("div")
    .style("overflow-x", "auto");

  const table = tableDiv.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse");

  const thead = table.append("thead");
  const headerRow = thead.append("tr");

  // Create sortable column headers
  const columns = [
    { key: 'period', label: StatsComponent.translateService.instant('BI.periodComparisonColPeriod') },
    { key: 'prevAmount', label: StatsComponent.translateService.instant('BI.periodComparisonColPrevMonth') },
    { key: 'currAmount', label: StatsComponent.translateService.instant('BI.periodComparisonColCurrent') },
    { key: 'diff', label: StatsComponent.translateService.instant('BI.periodComparisonColDiffAbs') },
    { key: 'percentChange', label: StatsComponent.translateService.instant('BI.periodComparisonColDiffPct') },
    { key: 'trend', label: StatsComponent.translateService.instant('BI.periodComparisonColTrend') }
  ];

  columns.forEach(col => {
    const th = headerRow.append("th")
      .style("padding", "12px")
      .style("background", "#1976d2")
      .style("color", "white")
      .style("text-align", "left")
      .style("position", "sticky")
      .style("top", "0")
      .style("cursor", "pointer")
      .style("user-select", "none");

    // Add white-space: nowrap to all columns except the first (period)
    if (col.key !== 'period') {
      th.style("white-space", "nowrap");
    }

    th.on("click", () => {
      if (StatsComponent.periodComparisonSortColumn === col.key) {
        // Toggle sort order
        StatsComponent.periodComparisonSortOrder = 
          StatsComponent.periodComparisonSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        // New column, default to ascending
        StatsComponent.periodComparisonSortColumn = col.key;
        StatsComponent.periodComparisonSortOrder = 'asc';
      }
      updateExplorativeView();
    })
    .on("mouseover", function() {
      d3.select(this).style("background", "#1565c0");
    })
    .on("mouseout", function() {
      d3.select(this).style("background", "#1976d2");
    });

    // Column label
    th.append("span")
      .text(col.label);

    // Sort indicator
    if (StatsComponent.periodComparisonSortColumn === col.key) {
      th.append("span")
        .style("margin-left", "5px")
        .style("font-size", "12px")
        .text(StatsComponent.periodComparisonSortOrder === 'asc' ? '▲' : '▼');
    }
  });

  const tbody = table.append("tbody");

  comparisons.forEach(comp => {
    const row = tbody.append("tr")
      .style("border-bottom", "1px solid var(--color-muted-light)");

    row.append("td")
      .style("padding", "10px")
      .style("font-weight", "bold")
      .text(`${comp.prevMonth} → ${comp.currMonth}`);

    row.append("td")
      .style("padding", "10px")
      .style("white-space", "nowrap")
      .text(comp.prevAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

    row.append("td")
      .style("padding", "10px")
      .style("white-space", "nowrap")
      .text(comp.currAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

    row.append("td")
      .style("padding", "10px")
      .style("white-space", "nowrap")
      .style("color", comp.diff > 0 ? "#f44336" : "#4caf50")
      .style("font-weight", "bold")
      .text((comp.diff > 0 ? "+" : "") + comp.diff.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

    row.append("td")
      .style("padding", "10px")
      .style("white-space", "nowrap")
      .style("color", comp.percentChange > 0 ? "#f44336" : "#4caf50")
      .style("font-weight", "bold")
      .text((comp.percentChange > 0 ? "+" : "") + comp.percentChange.toFixed(1) + "%");

    row.append("td")
      .style("padding", "10px")
      .style("white-space", "nowrap")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .text(comp.diff > 0 ? "📈" : comp.diff < 0 ? "📉" : "→");
  });
}/**
 * Create interactive transaction table with search and sort
 */
export function createExplorativeTransactionTable(container: any) {
  // Container is now the placeholder, so we don't create another div with ID
  container
    .style("background", "var(--color-surface)")
    .style("padding", "20px")
    .style("margin-bottom", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

  container.append("h3")
    .style("color", "#1976d2")
    .style("margin-bottom", "15px")
    .text(StatsComponent.translateService.instant('BI.detailedTransactionList'));

  // Detect outliers on ALL transactions for consistent detection
  const allGlobalTransactions = AppStateService.instance.allTransactions || [];
  const { outliers: allOutliers, recurringTransactions: allRecurring } = StatsComponent.detectOutliers(allGlobalTransactions);
  
  // Debug: Log outlier detection
  // Create a map from transaction unique key to outlier info
  const outlierMap = new Map<string, {type: string, isRecurring: boolean, metadata?: any}>();
  allGlobalTransactions.forEach((t, index) => {
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

  const allTransactions = getExplorativeFilteredTransactions()
    .filter(t => Number(t.amount) < 0);
  // Apply outlier info to filtered transactions
  const transactionsWithOutliers = allTransactions.map((t) => {
    const key = `${t.date}_${t.account}_${t.category}_${t.amount}_${t.comment || ''}`;
    const outlierInfo = outlierMap.get(key);
    const isOutlier = outlierInfo ? !outlierInfo.isRecurring : false;
    if (isOutlier) {
    }
    return {
      ...t,
      isOutlier: isOutlier,
      outlierType: outlierInfo?.type,
      outlierMetadata: outlierInfo?.metadata
    };
  });
  
  const outlierCount = transactionsWithOutliers.filter(t => t.isOutlier).length;
  // Sort transactions based on current sort settings
  const sortedTransactions = [...transactionsWithOutliers].sort((a, b) => {
    let comparison = 0;
    
    switch (StatsComponent.explorativeTableSortColumn) {
      case 'date':
        comparison = a.date.localeCompare(b.date);
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
    
    return StatsComponent.explorativeTableSortOrder === 'desc' ? -comparison : comparison;
  });

  // Outlier controls
  const controlsDiv = container.append("div")
    .style("display", "flex")
    .style("gap", "10px")
    .style("margin-bottom", "15px")
    .style("flex-wrap", "wrap")
    .style("justify-content", "center");

  // Outlier filter toggle (only show if there are outliers)
  if (outlierCount > 0) {
    const outlierFilterDiv = controlsDiv.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px")
      .style("padding", "10px")
      .style("background", StatsComponent.showOnlyOutliers ? "var(--color-warning-bg)" : "var(--color-background)")
      .style("border-radius", "5px")
      .style("border", `2px solid ${StatsComponent.showOnlyOutliers ? "#ff9800" : "#ccc"}`);
    
    outlierFilterDiv.append("span")
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .style("color", "var(--color-text-secondary)")
      .html(`⚠️ ${StatsComponent.translateService.instant('BI.labelOutliers')} (${outlierCount})`);
    
    outlierFilterDiv.append("button")
      .style("padding", "5px 15px")
      .style("background", StatsComponent.showOnlyOutliers ? "#ff9800" : "#9e9e9e")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "3px")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .text(StatsComponent.showOnlyOutliers ? StatsComponent.translateService.instant('BI.showAllButton') : StatsComponent.translateService.instant('BI.showOnlyOutliersButton'))
      .on("click", function() {
        StatsComponent.showOnlyOutliers = !StatsComponent.showOnlyOutliers;
        updateExplorativeView();
      });
  }
  
  // IQR Threshold control
  const thresholdDiv = controlsDiv.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "8px")
    .style("padding", "10px")
    .style("background", "#f5f5f5")
    .style("border-radius", "5px")
    .style("border", "2px solid #ccc");
  
  thresholdDiv.append("span")
    .style("font-size", "13px")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .text(StatsComponent.translateService.instant('BI.labelIQRThreshold') + ":");
  
  thresholdDiv.append("input")
    .attr("type", "number")
    .attr("min", "0.5")
    .attr("max", "3.0")
    .attr("step", "0.1")
    .attr("value", StatsComponent.iqrThreshold)
    .style("width", "60px")
    .style("padding", "5px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "3px")
    .style("font-size", "12px")
    .on("change", function() {
      const newValue = parseFloat((this as HTMLInputElement).value);
      if (newValue >= 0.5 && newValue <= 3.0) {
        StatsComponent.iqrThreshold = newValue;
        localStorage.setItem('iqrThreshold', newValue.toString());
        updateExplorativeView();
      }
    });
  
  thresholdDiv.append("span")
    .style("font-size", "11px")
    .style("color", "var(--color-text-hint)")
    .text("(0.5-3.0)");

  // Apply outlier filter if active
  const displayTransactions = StatsComponent.showOnlyOutliers 
    ? sortedTransactions.filter(t => t.isOutlier)
    : sortedTransactions;

  // Info bar with transaction count and total
  const infoBar = container.append("div")
    .style("display", "flex")
    .style("justify-content", "flex-start")
    .style("align-items", "center")
    .style("margin-bottom", "15px")
    .style("padding", "10px")
    .style("background-color", "#f5f5f5")
    .style("border-radius", "5px");

  infoBar.append("span")
    .style("font-weight", "bold")
    .style("color", "var(--color-text-secondary)")
    .html(`${displayTransactions.length} ${StatsComponent.translateService.instant('BI.labelOf')} ${transactionsWithOutliers.length} ${StatsComponent.translateService.instant('BI.labelTransactions')} | ${StatsComponent.translateService.instant('BI.labelTotal')}: <span style="color: #f44336;">${displayTransactions.reduce((sum, t) => sum + Number(t.amount), 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AppStateService.instance.currency}</span>`);

  // Transaction table
  const tableDiv = container.append("div")
    .style("max-height", "500px")
    .style("overflow-y", "auto")
    .style("overflow-x", "auto")
    .style("margin-bottom", "15px");

  const table = tableDiv.append("table")
    .style("width", "100%")
    .style("border-collapse", "collapse");

  const thead = table.append("thead");
  const headerRow = thead.append("tr");

  // Create sortable column headers
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
      .style("background", "#1976d2")
      .style("color", "white")
      .style("text-align", "left")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .style("position", "relative")
      .on("click", () => {
        if (StatsComponent.explorativeTableSortColumn === col.key) {
          // Toggle sort order
          StatsComponent.explorativeTableSortOrder = 
            StatsComponent.explorativeTableSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          // New column, default to descending
          StatsComponent.explorativeTableSortColumn = col.key;
          StatsComponent.explorativeTableSortOrder = 'desc';
        }
        updateExplorativeView();
      })
      .on("mouseover", function() {
        d3.select(this).style("background", "#1565c0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "#1976d2");
      });

    // Column label and sort indicator
    th.append("span")
      .text(col.label);

    if (StatsComponent.explorativeTableSortColumn === col.key) {
      th.append("span")
        .style("margin-left", "5px")
        .style("font-size", "12px")
        .text(StatsComponent.explorativeTableSortOrder === 'asc' ? '▲' : '▼');
    }
  });

  const tbody = table.append("tbody");

  displayTransactions.forEach(t => {
    const row = tbody.append("tr")
      .style("border-bottom", "1px solid var(--color-muted-light)")
      .style("background", t.isOutlier ? "var(--color-warning-bg)" : "var(--color-surface)")
      .style("border-left", t.isOutlier ? "4px solid #ff9800" : "none")
      .style("cursor", t.isOutlier ? "pointer" : "default")
      .on("mouseover", function() {
        d3.select(this).style("background", t.isOutlier ? "#ffe0b2" : "#f5f5f5");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", t.isOutlier ? "var(--color-warning-bg)" : "var(--color-surface)");
      })
      .on("click", () => {
        if (t.isOutlier) {
          StatsComponent.showOutlierAnalysis(t);
        }
      });

    const [year, month, day] = t.date.split('-');
    row.append("td")
      .style("padding", "10px")
      .style("white-space", "nowrap")
      .text(`${day}.${month}.${year}`);

    row.append("td")
      .style("padding", "10px")
      .text(t.account);

    const categoryCell = row.append("td")
      .style("padding", "10px");
    
    if (t.isOutlier) {
      categoryCell.append("span")
        .style("color", "#ff9800")
        .style("font-weight", "bold")
        .style("margin-right", "5px")
        .text("⚠️");
      
      categoryCell.append("span")
        .text(t.category);
    } else {
      categoryCell.text(t.category);
    }

    row.append("td")
      .style("padding", "10px")
      .style("font-weight", "bold")
      .style("color", "#f44336")
      .style("white-space", "nowrap")
      .text(Number(t.amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + AppStateService.instance.currency);

    row.append("td")
      .style("padding", "10px")
      .style("max-width", "300px")
      .style("word-wrap", "break-word")
      .text(t.comment || "-");
  });
}

// ===================================================================
// PRÄDIKTIVE ANALYTICS - PREDICTIVE FORECASTING
// ===================================================================

/**
 * Create Prädiktive Analytics Dashboard
 * Implements: Time-series predictions, goal achievement forecasts, trend analysis
 */
