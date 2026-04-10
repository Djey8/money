import { StatsComponent } from './stats.component';
import { ChartFilterService } from '../shared/services/chart-filter.service';
import { AppStateService } from '../shared/services/app-state.service';

export function addMonths(monthStr: string, months: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${newYear}-${newMonth}`;
}

// ===================================================================
// KPI CALCULATION FUNCTIONS
// ===================================================================/**
 * Calculate Savings Rate (Sparquote)
 * Formula: (Income - Expenses) / Income * 100
 */
export function calculateSavingsRate(month?: string): number {
  const accounts = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  
  let transactions = AppStateService.instance.allTransactions;
  
  if (month && month !== 'all') {
    if (month.includes('-Q')) {
      // Quarter filter (format: YYYY-Qn)
      const [year, quarter] = month.split('-');
      const quarterNum = parseInt(quarter.charAt(1));
      const startMonth = (quarterNum - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      transactions = AppStateService.instance.allTransactions.filter(t => {
        const tDate = new Date(t.date);
        const tYear = tDate.getFullYear();
        const tMonth = tDate.getMonth() + 1;
        return tYear === parseInt(year) && tMonth >= startMonth && tMonth <= endMonth;
      });
    } else if (month.includes('-H')) {
      // Half-year filter (format: YYYY-Hn)
      const [year, half] = month.split('-');
      const halfNum = parseInt(half.charAt(1));
      const startMonth = halfNum === 1 ? 1 : 7;
      const endMonth = halfNum === 1 ? 6 : 12;
      transactions = AppStateService.instance.allTransactions.filter(t => {
        const tDate = new Date(t.date);
        const tYear = tDate.getFullYear();
        const tMonth = tDate.getMonth() + 1;
        return tYear === parseInt(year) && tMonth >= startMonth && tMonth <= endMonth;
      });
    } else if (month.startsWith('custom:')) {
      // Custom range (format: custom:YYYY-MM-DD:YYYY-MM-DD)
      const parts = month.split(':');
      const startDate = parts[1];
      const endDate = parts[2];
      transactions = AppStateService.instance.allTransactions.filter(t => 
        t.date >= startDate && t.date <= endDate
      );
    } else if (month.length === 4) {
      // Year filter
      transactions = AppStateService.instance.allTransactions.filter(t => t.date.startsWith(month));
    } else {
      // Month filter
      transactions = AppStateService.instance.allTransactions.filter(t => t.date.substring(0, 7) === month);
    }
  }
  
  // Filter out inter-account transfers (with @ stripping) and zero amounts
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  
  const validTransactions = transactions.filter(t => {
    // Exclude zero amount transactions
    if (t.amount === 0.0) return false;
    
    // For expenses: must be from one of the 4 main expense accounts AND not an inter-account transfer
    if (expenseAccounts.includes(t.account)) {
      // Strip @ from category before comparing
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory);
    }
    // For income: must be from Income account
    return t.account === 'Income';
  });
  
  // If showAverageView is enabled and we have multiple months, calculate monthly average of savings rates
  if (StatsComponent.showAverageView && (!month || month === 'all' || month.includes('-Q') || month.includes('-H') || month.length === 4 || month.startsWith('custom:'))) {
    // Group transactions by month (excluding current month for average calculation)
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthlyData = new Map<string, { income: number, expenses: number }>();
    
    validTransactions.forEach(t => {
      const monthKey = t.date.substring(0, 7);
      // Exclude current month from average savings rate calculation
      if (monthKey === currentMonth) return;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expenses: 0 });
      }
      const data = monthlyData.get(monthKey)!;
      
      if (t.account === 'Income' && Number(t.amount) > 0) {
        data.income += Number(t.amount);
      } else if (expenseAccounts.includes(t.account) && Number(t.amount) < 0) {
        data.expenses += Math.abs(Number(t.amount));
      }
    });
    
    // Calculate savings rate for each month and average them
    const monthlySavingsRates: number[] = [];
    monthlyData.forEach((data, monthKey) => {
      if (data.income > 0) {
        const monthRate = ((data.income - data.expenses) / data.income) * 100;
        monthlySavingsRates.push(monthRate);
      }
    });
    
    // Return arithmetic mean of monthly savings rates (only for months with income)
    if (monthlySavingsRates.length === 0) return 0;
    return monthlySavingsRates.reduce((sum, rate) => sum + rate, 0) / monthlySavingsRates.length;
  }
  
  // Default behavior: calculate total-based savings rate
  const income = validTransactions
    .filter(t => t.account === 'Income' && Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Only count expenses from the 4 main accounts
  const expenses = Math.abs(validTransactions
    .filter(t => expenseAccounts.includes(t.account) && Number(t.amount) < 0)
    .reduce((sum, t) => sum + Number(t.amount), 0));
  
  if (income === 0) return 0;
  return ((income - expenses) / income) * 100;
}/**
 * Calculate Budget Compliance for an account
 * Formula: max(0, 100 - |Ist-% - Soll-%| / 20 * 100)
 */
export function calculateBudgetCompliance(account: string, targetPercent: number, month?: string): number {
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  
  let transactions = AppStateService.instance.allTransactions;
  
  if (month && month !== 'all') {
    if (month.includes('-Q')) {
      // Quarter filter (format: YYYY-Qn)
      const [year, quarter] = month.split('-');
      const quarterNum = parseInt(quarter.charAt(1));
      const startMonth = (quarterNum - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      transactions = AppStateService.instance.allTransactions.filter(t => {
        const tDate = new Date(t.date);
        const tYear = tDate.getFullYear();
        const tMonth = tDate.getMonth() + 1;
        return tYear === parseInt(year) && tMonth >= startMonth && tMonth <= endMonth;
      });
    } else if (month.includes('-H')) {
      // Half-year filter (format: YYYY-Hn)
      const [year, half] = month.split('-');
      const halfNum = parseInt(half.charAt(1));
      const startMonth = halfNum === 1 ? 1 : 7;
      const endMonth = halfNum === 1 ? 6 : 12;
      transactions = AppStateService.instance.allTransactions.filter(t => {
        const tDate = new Date(t.date);
        const tYear = tDate.getFullYear();
        const tMonth = tDate.getMonth() + 1;
        return tYear === parseInt(year) && tMonth >= startMonth && tMonth <= endMonth;
      });
    } else if (month.startsWith('custom:')) {
      // Custom range (format: custom:YYYY-MM-DD:YYYY-MM-DD)
      const parts = month.split(':');
      const startDate = parts[1];
      const endDate = parts[2];
      transactions = AppStateService.instance.allTransactions.filter(t => 
        t.date >= startDate && t.date <= endDate
      );
    } else if (month.length === 4) {
      // Year filter
      transactions = AppStateService.instance.allTransactions.filter(t => t.date.startsWith(month));
    } else {
      // Month filter
      transactions = AppStateService.instance.allTransactions.filter(t => t.date.substring(0, 7) === month);
    }
  }
  
  // Filter out inter-account transfers (with @ stripping) and zero amounts
  const validTransactions = transactions.filter(t => {
    if (t.amount === 0.0) return false;
    const cleanCategory = t.category.replace('@', '');
    return !accountCategoriesToExclude.includes(cleanCategory);
  });
  
  // Calculate total expenses - only from the 4 main accounts to ensure percentages sum to 100%
  const totalExpenses = Math.abs(validTransactions
    .filter(t => expenseAccounts.includes(t.account) && Number(t.amount) < 0)
    .reduce((sum, t) => sum + Number(t.amount), 0));
  
  // Don't combine Fire with Mojo - use only the specified account
  const accountExpenses = Math.abs(validTransactions
    .filter(t => t.account === account && Number(t.amount) < 0)
    .reduce((sum, t) => sum + Number(t.amount), 0));
  
  if (totalExpenses === 0) return 0;
  
  const actualPercent = (accountExpenses / totalExpenses) * 100;
  const deviation = Math.abs(actualPercent - targetPercent);
  
  return Math.max(0, 100 - (deviation / 20) * 100);
}/**
 * Calculate Fixed Costs Ratio (Fixkostenquote)
 * Uses actual transaction amounts to calculate fixed costs
 */
export function calculateFixedCostsRatio(month?: string): number {
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  
  // Get subscription categories to identify fixed costs
  const subscriptionCategories = new Set(
    AppStateService.instance.allSubscriptions.map(sub => sub.category.replace('@', ''))
  );
  if (month && month !== 'all') {
    let validTransactions;
    
    if (month.includes('-Q')) {
      // Quarter filter
      const [year, quarter] = month.split('-');
      const quarterNum = parseInt(quarter.charAt(1));
      const startMonth = (quarterNum - 1) * 3;
      const periodStart = new Date(parseInt(year), startMonth, 1);
      const periodEnd = new Date(parseInt(year), startMonth + 3, 0);
      
      validTransactions = AppStateService.instance.allTransactions.filter(t => {
        if (t.amount === 0.0) return false;
        const tDate = new Date(t.date);
        if (tDate < periodStart || tDate > periodEnd) return false;
        if (!expenseAccounts.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      });
    } else if (month.includes('-H')) {
      // Half-year filter
      const [year, half] = month.split('-');
      const halfNum = parseInt(half.charAt(1));
      const startMonth = halfNum === 1 ? 0 : 6;
      const periodStart = new Date(parseInt(year), startMonth, 1);
      const periodEnd = new Date(parseInt(year), startMonth + 6, 0);
      
      validTransactions = AppStateService.instance.allTransactions.filter(t => {
        if (t.amount === 0.0) return false;
        const tDate = new Date(t.date);
        if (tDate < periodStart || tDate > periodEnd) return false;
        if (!expenseAccounts.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      });
    } else if (month.startsWith('custom:')) {
      // Custom range
      const parts = month.split(':');
      const periodStart = new Date(parts[1]);
      const periodEnd = new Date(parts[2]);
      
      validTransactions = AppStateService.instance.allTransactions.filter(t => {
        if (t.amount === 0.0) return false;
        const tDate = new Date(t.date);
        if (tDate < periodStart || tDate > periodEnd) return false;
        if (!expenseAccounts.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      });
    } else if (month.length === 4) {
      // Year filter
      validTransactions = AppStateService.instance.allTransactions.filter(t => {
        if (t.amount === 0.0) return false;
        if (!t.date.startsWith(month)) return false;
        if (!expenseAccounts.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      });
    } else {
      // Month filter
      validTransactions = AppStateService.instance.allTransactions.filter(t => {
        if (t.amount === 0.0) return false;
        if (t.date.substring(0, 7) !== month) return false;
        if (!expenseAccounts.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      });
    }
    
    // Calculate fixed costs from actual transactions
    let fixedCosts = 0;
    let totalExpenses = 0;
    
    validTransactions
      .filter(t => Number(t.amount) < 0)
      .forEach(t => {
        const amount = Math.abs(Number(t.amount));
        totalExpenses += amount;
        
        const cleanCategory = t.category.replace('@', '');
        if (subscriptionCategories.has(cleanCategory)) {
          fixedCosts += amount;
        }
      });
    if (totalExpenses === 0) return 0;
    return (fixedCosts / totalExpenses) * 100;
  } else {
    // Calculate for all months
    const validTransactions = AppStateService.instance.allTransactions
      .filter(t => {
        if (t.amount === 0.0) return false;
        if (!expenseAccounts.includes(t.account)) return false;
        const cleanCategory = t.category.replace('@', '');
        return !accountCategoriesToExclude.includes(cleanCategory);
      });
    
    let fixedCosts = 0;
    let totalExpenses = 0;
    
    validTransactions
      .filter(t => Number(t.amount) < 0)
      .forEach(t => {
        const amount = Math.abs(Number(t.amount));
        totalExpenses += amount;
        
        const cleanCategory = t.category.replace('@', '');
        if (subscriptionCategories.has(cleanCategory)) {
          fixedCosts += amount;
        }
      });
    if (totalExpenses === 0) return 0;
    return (fixedCosts / totalExpenses) * 100;
  }
}/**
 * Get monthly aggregated data for time series
 */
export function getMonthlyData(): Array<{month: string, date: Date, income: number, expenses: number, savings: number}> {
  const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
  const accountCategoriesToExclude = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
  const monthlyMap = new Map<string, {income: number, expenses: number}>();
  
  // Get current month for filtering
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  // Filter transactions: only expense accounts (Daily, Splurge, Smile, Fire) and exclude inter-account transfers
  // Match cashflow logic: exclude transactions with amount === 0
  const validTransactions = AppStateService.instance.allTransactions.filter(t => {
    // Exclude zero amount transactions (match cashflow logic)
    if (t.amount === 0.0) return false;
    
    // For expenses: must be from one of the 4 main expense accounts AND not an inter-account transfer
    if (expenseAccounts.includes(t.account)) {
      // Strip @ from category before comparing
      const cleanCategory = t.category.replace('@', '');
      return !accountCategoriesToExclude.includes(cleanCategory);
    }
    // For income: must be from Income account
    return t.account === 'Income';
  });
  
  validTransactions.forEach(t => {
    const month = t.date.substring(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {income: 0, expenses: 0});
    }
    
    const data = monthlyMap.get(month)!;
    const amount = Number(t.amount);
    
    if (t.account === 'Income' && amount > 0) {
      data.income += amount;
    } else if (amount < 0) {
      data.expenses += Math.abs(amount);
    }
  });
  
  let monthlyDataArray = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      date: new Date(month + '-01'),
      income: data.income,
      expenses: data.expenses,
      savings: data.income - data.expenses
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Exclude current month only when showing average view
  if (StatsComponent.showAverageView) {
    monthlyDataArray = monthlyDataArray.filter(m => m.month !== currentMonth);
  }
  
  return monthlyDataArray;
}/**
 * Get filtered transactions based on current filter settings
 */
export function getFilteredTransactions(): any[] {
  const selectedMonth = StatsComponent.selectedMonth;
  const filterType = StatsComponent.filterType;
  
  if (filterType === 'all' || !selectedMonth || selectedMonth === 'all') {
    return AppStateService.instance.allTransactions;
  }
  
  if (filterType === 'month' && selectedMonth) {
    return AppStateService.instance.allTransactions.filter(t => t.date.substring(0, 7) === selectedMonth);
  }
  
  if (filterType === 'quarter' && selectedMonth.includes('-Q')) {
    const [year, quarter] = selectedMonth.split('-');
    const quarterNum = parseInt(quarter.charAt(1));
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return AppStateService.instance.allTransactions.filter(t => {
      const tDate = new Date(t.date);
      const tYear = tDate.getFullYear();
      const tMonth = tDate.getMonth() + 1;
      return tYear === parseInt(year) && tMonth >= startMonth && tMonth <= endMonth;
    });
  }
  
  if (filterType === 'halfyear' && selectedMonth.includes('-H')) {
    const [year, half] = selectedMonth.split('-');
    const halfNum = parseInt(half.charAt(1));
    const startMonth = halfNum === 1 ? 1 : 7;
    const endMonth = halfNum === 1 ? 6 : 12;
    return AppStateService.instance.allTransactions.filter(t => {
      const tDate = new Date(t.date);
      const tYear = tDate.getFullYear();
      const tMonth = tDate.getMonth() + 1;
      return tYear === parseInt(year) && tMonth >= startMonth && tMonth <= endMonth;
    });
  }
  
  if (filterType === 'year' && selectedMonth) {
    return AppStateService.instance.allTransactions.filter(t => t.date.startsWith(selectedMonth));
  }
  
  if (filterType === 'custom' && selectedMonth.startsWith('custom:')) {
    const parts = selectedMonth.split(':');
    const startDate = parts[1];
    const endDate = parts[2];
    return AppStateService.instance.allTransactions.filter(t => t.date >= startDate && t.date <= endDate);
  }
  
  return AppStateService.instance.allTransactions;
}

// ===================================================================
// DASHBOARD 1: FINANCIAL OVERVIEW (Finanzielle Übersicht)
// ===================================================================
