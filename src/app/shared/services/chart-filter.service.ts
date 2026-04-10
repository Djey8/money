import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TransactionFilterService } from './transaction-filter.service';
import { AppStateService } from './app-state.service';

export interface ChartFilterState {
  filterType: 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  selectedIndex: number; // offset from current period (0 = current, -1 = previous, etc.)
  customDateStart: string;
  customDateEnd: string;
  barGrouping: 'auto' | 'week' | 'month' | 'quarter' | 'year'; // cashflow bar grouping
  selectedAccounts: string[];
  selectedCategories: string[];
  searchText: string;
  searchFields: {
    account: boolean;
    amount: boolean;
    date: boolean;
    time: boolean;
    category: boolean;
    comment: boolean;
  };
}

@Injectable({ providedIn: 'root' })
/**
 * Unified chart time-range filtering system.
 * Provides date range computation, label formatting, and transaction filtering
 * for all chart/KPI views using a shared `ChartFilterState`.
 */
export class ChartFilterService {

  private static translateService: TranslateService;

  constructor(translate: TranslateService) {
    ChartFilterService.translateService = translate;
  }

  static defaultState(): ChartFilterState {
    return {
      filterType: 'all',
      selectedIndex: 0,
      customDateStart: '',
      customDateEnd: '',
      barGrouping: 'month',
      selectedAccounts: [],
      selectedCategories: [],
      searchText: '',
      searchFields: {
        account: true,
        amount: true,
        date: true,
        time: true,
        category: true,
        comment: true
      }
    };
  }

  /**
   * Calculate the date range for a given period type and index offset.
   * Returns { startDate, endDate } or null for 'all'.
   */
  static getDateRange(filterType: string, selectedIndex: number): { startDate: Date; endDate: Date } | null {
    if (filterType === 'all') return null;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (filterType === 'week') {
      const dayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
      const tempDate = new Date(now);
      tempDate.setDate(now.getDate() + dayOffset + (selectedIndex * 7));
      startDate = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate());
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
    } else if (filterType === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth() + selectedIndex, 1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    } else if (filterType === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const targetQuarter = currentQuarter + selectedIndex;
      const targetYear = now.getFullYear() + Math.floor(targetQuarter / 4);
      const quarterStartMonth = ((targetQuarter % 4 + 4) % 4) * 3;
      startDate = new Date(targetYear, quarterStartMonth, 1);
      endDate = new Date(targetYear, quarterStartMonth + 3, 0);
    } else if (filterType === 'year') {
      startDate = new Date(now.getFullYear() + selectedIndex, 0, 1);
      endDate = new Date(now.getFullYear() + selectedIndex, 11, 31);
    } else {
      return null;
    }

    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }

  /**
   * Format a date range for display.
   */
  static formatDateRange(filterType: string, startDate: Date, endDate: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (filterType === 'week') {
      return `${startDate.getDate()} ${months[startDate.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
    } else if (filterType === 'month') {
      return `${months[startDate.getMonth()]} ${startDate.getFullYear()}`;
    } else if (filterType === 'quarter') {
      const q = Math.floor(startDate.getMonth() / 3) + 1;
      return `Q${q} ${startDate.getFullYear()}`;
    } else if (filterType === 'year') {
      return `${startDate.getFullYear()}`;
    } else if (filterType === 'custom') {
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }
    return '';
  }

  /**
   * Filter transactions based on the full chart filter state.
   * Core method: basic mode filters by period, advanced mode adds account/category/search.
   */
  static filterTransactions(state: ChartFilterState, excludeMojo = true): any[] {
    let transactions = AppStateService.instance.allTransactions;

    if (excludeMojo) {
      transactions = transactions.filter(t => t.account !== 'Mojo');
    }

    // Time range filter
    if (state.filterType === 'custom') {
      if (state.customDateStart) {
        transactions = transactions.filter(t => t.date >= state.customDateStart);
      }
      if (state.customDateEnd) {
        transactions = transactions.filter(t => t.date <= state.customDateEnd);
      }
    } else if (state.filterType !== 'all') {
      const range = this.getDateRange(state.filterType, state.selectedIndex);
      if (range) {
        transactions = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= range.startDate && d <= range.endDate;
        });
      }
    }

    // Account filter
    if (state.selectedAccounts.length > 0) {
      transactions = transactions.filter(t =>
        state.selectedAccounts.includes(t.account)
      );
    }

    // Category filter
    if (state.selectedCategories.length > 0) {
      transactions = transactions.filter(t => {
        const clean = (t.category || '').replace('@', '');
        return state.selectedCategories.includes(clean);
      });
    }

    // Search text filter with boolean logic (delegates to TransactionFilterService for operator-aware matching)
    if (state.searchText.trim()) {
      transactions = transactions.filter(t => {
        let expr = state.searchText
          .replace(/\band\b/gi, '&&')
          .replace(/\bor\b/gi, '||')
          .replace(/\bnot\b/gi, '!');

        const orGroups = expr.split('||').map(g => g.trim());

        for (const orGroup of orGroups) {
          const andTerms = orGroup.split('&&').map(term => term.trim());
          let allMatch = true;

          for (const andTerm of andTerms) {
            const isNegated = andTerm.startsWith('!');
            const searchTerm = (isNegated ? andTerm.substring(1).trim() : andTerm).toLowerCase();
            if (!searchTerm) continue;

            let termMatches = TransactionFilterService.checkSearchTermMatch(t, searchTerm, state.searchFields);

            if (isNegated) termMatches = !termMatches;
            if (!termMatches) { allMatch = false; break; }
          }

          if (allMatch && andTerms.length > 0) return true;
        }
        return false;
      });
    }

    return transactions;
  }
}
