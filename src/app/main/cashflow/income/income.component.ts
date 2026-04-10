import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppComponent } from 'src/app/app.component';
import { Revenue } from 'src/app/interfaces/revenue';
import { Interest } from 'src/app/interfaces/interest';
import { Property } from 'src/app/interfaces/property';
import { Expense } from 'src/app/interfaces/expense';
import { Transaction } from 'src/app/interfaces/transaction';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { LocalService } from 'src/app/shared/services/local.service';
import { InfoInterestsComponent } from 'src/app/panels/info/info-interests/info-interests.component';
import { InfoPropertiesComponent } from 'src/app/panels/info/info-properties/info-properties.component';
import { BalanceComponent } from '../balance/balance.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { StatsComponent } from 'src/app/stats/stats.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { SharedFilterComponent } from 'src/app/shared/components/shared-filter/shared-filter.component';

/**
 * Component for managing income statements.
 */
@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDatePipe, AppNumberPipe, SharedFilterComponent, InfoInterestsComponent, InfoPropertiesComponent],
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.css', '../../../app.component.css', '../../../shared/styles/table.css']
})
export class IncomeComponent {

  static get allRevenues(): Revenue[] { return AppStateService.instance.allRevenues; }
  static set allRevenues(v: Revenue[]) { AppStateService.instance.allRevenues = v; }
  static get allIntrests(): Interest[] { return AppStateService.instance.allIntrests; }
  static set allIntrests(v: Interest[]) { AppStateService.instance.allIntrests = v; }
  static get allProperties(): Property[] { return AppStateService.instance.allProperties; }
  static set allProperties(v: Property[]) { AppStateService.instance.allProperties = v; }

  static get dailyExpenses(): Expense[] { return AppStateService.instance.dailyExpenses; }
  static set dailyExpenses(v: Expense[]) { AppStateService.instance.dailyExpenses = v; }
  static get splurgeExpenses(): Expense[] { return AppStateService.instance.splurgeExpenses; }
  static set splurgeExpenses(v: Expense[]) { AppStateService.instance.splurgeExpenses = v; }
  static get smileExpenses(): Expense[] { return AppStateService.instance.smileExpenses; }
  static set smileExpenses(v: Expense[]) { AppStateService.instance.smileExpenses = v; }
  static get fireExpenses(): Expense[] { return AppStateService.instance.fireExpenses; }
  static set fireExpenses(v: Expense[]) { AppStateService.instance.fireExpenses = v; }
  static get mojoExpenses(): Expense[] { return AppStateService.instance.mojoExpenses; }
  static set mojoExpenses(v: Expense[]) { AppStateService.instance.mojoExpenses = v; }


  // Filtered Income
  static allRevenuesF: Revenue[];
  static allIntrestsF: Interest[];
  static allPropertiesF: Property[];

  static dailyExpensesF: Expense[];
  static splurgeExpensesF: Expense[];
  static smileExpensesF: Expense[];
  static fireExpensesF: Expense[];
  static mojoExpensesF: Expense[];

  static d: Date;
  static startDateTextField: string;
  static endDateTextField: string;

  isRevenues = true;
  isInterests = true;
  isProperties = true;
  isDailyExpenses = true;
  isSplurgeExpenses = true;
  isSmileExpenses = true;
  isFireExpenses = true;
  isMojoExpenses = true;
  totalAmount = 0.0

  // New unified filter system
  static currentFilter: IncomeFilter = {
    startDate: '',
    endDate: '',
    selectedAccounts: [],
    selectedTags: [],
    sortBy: 'none',
    sortOrder: 'desc',
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
  
  static isFiltered = false;
  static isAdvancedFilterExpanded = false;
  static isSearchHelpVisible = false;
  
  // Available accounts and tags for filtering
  static availableAccounts: string[] = ['Income', 'Daily', 'Splurge', 'Smile', 'Fire', 'Mojo'];
  static availableTags: string[] = [];

  // Individual table sort states for filtered results
  static tableSorts: {
    revenues: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    interests: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    properties: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    daily: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    splurge: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    smile: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    fire: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' },
    mojo: { column: 'tag' | 'amount' | null, direction: 'asc' | 'desc' }
  } = {
    revenues: { column: null, direction: 'asc' },
    interests: { column: null, direction: 'asc' },
    properties: { column: null, direction: 'asc' },
    daily: { column: null, direction: 'asc' },
    splurge: { column: null, direction: 'asc' },
    smile: { column: null, direction: 'asc' },
    fire: { column: null, direction: 'asc' },
    mojo: { column: null, direction: 'asc' }
  };

  // Filtered Icnome
  totalAmountF = 0.0

  public classReference = IncomeComponent;
  public get appReference() { return AppComponent; }
  public settingsReference = SettingsComponent;

  /**
   * Constructs a new IncomeComponent.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   */
  constructor(private router: Router, private localStorage: LocalService) {
    IncomeComponent.setDate();

    AppStateService.instance.allRevenues = this.localStorage.getData("revenues") == "" ? [] : JSON.parse(this.localStorage.getData("revenues"));
    AppStateService.instance.allIntrests = this.localStorage.getData("interests") == "" ? [] : JSON.parse(this.localStorage.getData("interests"));
    AppStateService.instance.allProperties = this.localStorage.getData("properties") == "" ? [] : JSON.parse(this.localStorage.getData("properties"));

    AppStateService.instance.dailyExpenses = this.localStorage.getData("dailyEx") == "" ? [] : JSON.parse(this.localStorage.getData("dailyEx"));
    AppStateService.instance.splurgeExpenses = this.localStorage.getData("splurgeEx") == "" ? [] : JSON.parse(this.localStorage.getData("splurgeEx"));
    AppStateService.instance.smileExpenses = this.localStorage.getData("smileEx") == "" ? [] : JSON.parse(this.localStorage.getData("smileEx"));
    AppStateService.instance.fireExpenses = this.localStorage.getData("fireEx") == "" ? [] : JSON.parse(this.localStorage.getData("fireEx"));
    AppStateService.instance.mojoExpenses = this.localStorage.getData("mojoEx") == "" ? [] : JSON.parse(this.localStorage.getData("mojoEx"));
    this.isInterests = this.localStorage.getData("isRevenues") == "false" ? false : true;
    this.isInterests = this.localStorage.getData("isInterests") == "false" ? false : true;
    this.isProperties = this.localStorage.getData("isProperties") == "false" ? false : true;
    this.isDailyExpenses = this.localStorage.getData("isDailyEx") == "false" ? false : true;
    this.isSplurgeExpenses = this.localStorage.getData("isSplurgeEx") == "false" ? false : true;
    this.isSmileExpenses = this.localStorage.getData("isSmileEx") == "false" ? false : true;
    this.isFireExpenses = this.localStorage.getData("isFireEx") == "false" ? false : true;
    this.isMojoExpenses = this.localStorage.getData("isMojoEx") == "false" ? false : true;

    IncomeComponent.allRevenuesF = [];
    IncomeComponent.allIntrestsF = [];
    IncomeComponent.allPropertiesF = [];

    IncomeComponent.dailyExpensesF = [];
    IncomeComponent.splurgeExpensesF = [];
    IncomeComponent.smileExpensesF = [];
    IncomeComponent.fireExpensesF = [];
    IncomeComponent.mojoExpensesF = [];

    IncomeComponent.isFiltered = false;
    IncomeComponent.isAdvancedFilterExpanded = false;
    
    // Reset all filter settings
    IncomeComponent.setDate();
    IncomeComponent.currentFilter = {
      startDate: '',
      endDate: IncomeComponent.endDateTextField,
      selectedAccounts: [],
      selectedTags: [],
      sortBy: 'none',
      sortOrder: 'desc',
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
    
    // Reset all table sort states
    IncomeComponent.tableSorts = {
      revenues: { column: null, direction: 'asc' },
      interests: { column: null, direction: 'asc' },
      properties: { column: null, direction: 'asc' },
      daily: { column: null, direction: 'asc' },
      splurge: { column: null, direction: 'asc' },
      smile: { column: null, direction: 'asc' },
      fire: { column: null, direction: 'asc' },
      mojo: { column: null, direction: 'asc' }
    };
    
    this.updateAvailableTags();
  }

  /**
   * Updates the list of available tags from all transactions
   */
  updateAvailableTags() {
    const tagsSet = new Set<string>();
    
    // Iterate in reverse to get most recent categories first
    for (let i = AppStateService.instance.allTransactions.length - 1; i >= 0; i--) {
      const transaction = AppStateService.instance.allTransactions[i];
      if (transaction.category) {
        tagsSet.add(transaction.category.replace('@', ''));
      }
    }
    
    IncomeComponent.availableTags = Array.from(tagsSet);
  }

  /**
     * Navigates to the stats page.
     */
    goToStats(){
      this.router.navigate(['/stats']);
      StatsComponent.resetBIStateIfNeeded("statement");
      StatsComponent.modus = "statement"
      MenuComponent.openStats = true;
      AppComponent.gotoTop();
    }

  /**
   * Scrolls to the filter section at the bottom of the page
   */
  scrollToFilter() {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  }

  /**
   * Helper method to check if a search term matches any selected field in a transaction.
   * Detects the format of the search term (date, time, amount, text) and only
   * Auto-detects the format of the search term (date, time, amount, text) and only
   * checks the corresponding field to avoid cross-field false positives.
   */
  private static checkSearchTermMatch(transaction: Transaction, searchTerm: string): boolean {
    const searchFields = IncomeComponent.currentFilter.searchFields;

    const parseAsDate = (value: string): string | null => {
      let m = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
      m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
      m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      return null;
    };

    const parseAsTime = (value: string): string | null => {
      let m = value.match(/^(\d{1,2}):(\d{2})$/);
      if (m) return m[1].padStart(2, '0') + ':' + m[2];
      m = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
      if (m) { let h = parseInt(m[1], 10); if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12; if (m[3].toLowerCase() === 'am' && h === 12) h = 0; return h.toString().padStart(2, '0') + ':' + m[2]; }
      m = value.match(/^(\d{1,2})\s*(am|pm)$/i);
      if (m) { let h = parseInt(m[1], 10); if (m[2].toLowerCase() === 'pm' && h !== 12) h += 12; if (m[2].toLowerCase() === 'am' && h === 12) h = 0; return h.toString().padStart(2, '0') + ':00'; }
      return null;
    };

    // Detect format: strip operator to inspect the value part
    const operatorMatch = searchTerm.match(/^(>=|<=|>|<)(.+)$/);
    const valuePart = operatorMatch ? operatorMatch[2].trim() : searchTerm;

    // Try to parse as date
    const parsedDate = parseAsDate(valuePart);
    if (parsedDate) {
      if (!searchFields.date) return false;
      if (operatorMatch) {
        switch (operatorMatch[1]) {
          case '>': return transaction.date > parsedDate;
          case '<': return transaction.date < parsedDate;
          case '>=': return transaction.date >= parsedDate;
          case '<=': return transaction.date <= parsedDate;
        }
      }
      return transaction.date === parsedDate;
    }

    // Try to parse as time
    const parsedTime = parseAsTime(valuePart);
    if (parsedTime) {
      if (!searchFields.time) return false;
      if (!transaction.time || transaction.time.trim() === '') return false;
      const normalizedTransaction = parseAsTime(transaction.time) || transaction.time;
      if (operatorMatch) {
        switch (operatorMatch[1]) {
          case '>': return normalizedTransaction > parsedTime;
          case '<': return normalizedTransaction < parsedTime;
          case '>=': return normalizedTransaction >= parsedTime;
          case '<=': return normalizedTransaction <= parsedTime;
        }
      }
      return normalizedTransaction.includes(parsedTime);
    }

    // Operator + pure number → amount comparison only
    if (operatorMatch && /^-?\d+\.?\d*$/.test(valuePart)) {
      if (!searchFields.amount) return false;
      const value = parseFloat(valuePart);
      if (isNaN(value)) return false;
      switch (operatorMatch[1]) {
        case '>': return transaction.amount > value;
        case '<': return transaction.amount < value;
        case '>=': return transaction.amount >= value;
        case '<=': return transaction.amount <= value;
      }
      return false;
    }

    // TEXT: no specific format — check all enabled fields as plain text contains
    if (searchFields.account && transaction.account.toLowerCase().includes(searchTerm)) return true;
    if (searchFields.amount && transaction.amount.toString().includes(searchTerm)) return true;
    if (searchFields.date && transaction.date.toLowerCase().includes(searchTerm)) return true;
    if (searchFields.time && transaction.time && transaction.time.toLowerCase().includes(searchTerm)) return true;
    if (searchFields.category) {
      const cleanCategory = transaction.category.replace('@', '');
      if (cleanCategory.toLowerCase().includes(searchTerm)) return true;
    }
    if (searchFields.comment && transaction.comment.toLowerCase().includes(searchTerm)) return true;

    return false;
  }

  /**
   * Apply all filters - main filter function
   */
  static applyFilters() {
    AppComponent.gotoTop();
    // Reset filtered arrays
    IncomeComponent.allRevenuesF = [];
    IncomeComponent.allIntrestsF = [];
    IncomeComponent.allPropertiesF = [];
    IncomeComponent.dailyExpensesF = [];
    IncomeComponent.splurgeExpensesF = [];
    IncomeComponent.smileExpensesF = [];
    IncomeComponent.fireExpensesF = [];
    IncomeComponent.mojoExpensesF = [];

    // Filter transactions based on all criteria
    const filteredTransactions = AppStateService.instance.allTransactions.filter((transaction: Transaction) => {
      // Date range filter
      if (IncomeComponent.currentFilter.startDate && transaction.date < IncomeComponent.currentFilter.startDate) {
        return false;
      }
      if (IncomeComponent.currentFilter.endDate && transaction.date > IncomeComponent.currentFilter.endDate) {
        return false;
      }

      // Account filter (if specific accounts are selected)
      if (IncomeComponent.currentFilter.selectedAccounts.length > 0) {
        if (!IncomeComponent.currentFilter.selectedAccounts.includes(transaction.account)) {
          return false;
        }
      }

      // Tag filter (if specific tags are selected)
      if (IncomeComponent.currentFilter.selectedTags.length > 0) {
        const cleanCategory = transaction.category.replace('@', '');
        if (!IncomeComponent.currentFilter.selectedTags.includes(cleanCategory)) {
          return false;
        }
      }

      // Search text filter across selected fields (supports boolean logic: &&, ||, and, or, not)
      if (IncomeComponent.currentFilter.searchText.trim()) {
        // Replace word operators with symbols for easier parsing
        let searchExpression = IncomeComponent.currentFilter.searchText
          .replace(/\band\b/gi, '&&')
          .replace(/\bor\b/gi, '||')
          .replace(/\bnot\b/gi, '!');
        
        // Split by || (OR) to get OR groups
        const orGroups = searchExpression.split('||').map(g => g.trim());
        
        // Check if any OR group matches
        let matchFound = false;
        
        for (const orGroup of orGroups) {
          // Split by && (AND) to get AND terms within this OR group
          const andTerms = orGroup.split('&&').map(t => t.trim());
          
          // All AND terms must match for this OR group to match
          let allAndTermsMatch = true;
          
          for (const andTerm of andTerms) {
            // Check for NOT operator
            const isNegated = andTerm.startsWith('!');
            const searchTerm = (isNegated ? andTerm.substring(1).trim() : andTerm).toLowerCase();
            
            if (!searchTerm) continue;
            
            // Check if this term matches any field
            let termMatches = IncomeComponent.checkSearchTermMatch(transaction, searchTerm);
            
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
        
        if (!matchFound) {
          return false;
        }
      }

      return transaction.amount !== 0.0;
    });

    // Build filtered income/expense arrays from filtered transactions
    filteredTransactions.forEach((transaction: Transaction) => {
      if (transaction.account === "Income") {
        IncomeComponent.processIncomeTransaction(transaction);
      } else if (transaction.account === "Daily") {
        IncomeComponent.processExpenseTransaction(transaction, IncomeComponent.dailyExpensesF);
      } else if (transaction.account === "Splurge") {
        IncomeComponent.processExpenseTransaction(transaction, IncomeComponent.splurgeExpensesF);
      } else if (transaction.account === "Smile") {
        IncomeComponent.processExpenseTransaction(transaction, IncomeComponent.smileExpensesF);
      } else if (transaction.account === "Fire") {
        IncomeComponent.processExpenseTransaction(transaction, IncomeComponent.fireExpensesF);
      } else if (transaction.account === "Mojo") {
        IncomeComponent.processExpenseTransaction(transaction, IncomeComponent.mojoExpensesF);
      }
    });

    // Apply sorting
    IncomeComponent.applySorting();
    
    IncomeComponent.isFiltered = true;
  }

  /**
   * Process income transactions (Revenue, Interest, Properties)
   */
  static processIncomeTransaction(transaction: Transaction) {
    const cleanTag = transaction.category.replace('@', '');
    
    // Check if it's an interest
    let found = false;
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      if (cleanTag === AppStateService.instance.allIntrests[i].tag) {
        const existing = IncomeComponent.allIntrestsF.find(item => item.tag === cleanTag);
        if (existing) {
          existing.amount += transaction.amount;
        } else {
          IncomeComponent.allIntrestsF.push({ tag: cleanTag, amount: transaction.amount });
        }
        found = true;
        break;
      }
    }
    
    // Check if it's a property
    if (!found) {
      for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
        if (cleanTag === AppStateService.instance.allProperties[i].tag) {
          const existing = IncomeComponent.allPropertiesF.find(item => item.tag === cleanTag);
          if (existing) {
            existing.amount += transaction.amount;
          } else {
            IncomeComponent.allPropertiesF.push({ tag: cleanTag, amount: transaction.amount });
          }
          found = true;
          break;
        }
      }
    }
    
    // Otherwise it's a revenue
    if (!found) {
      const existing = IncomeComponent.allRevenuesF.find(item => item.tag === cleanTag);
      if (existing) {
        existing.amount += transaction.amount;
      } else {
        IncomeComponent.allRevenuesF.push({ tag: cleanTag, amount: transaction.amount });
      }
    }
  }

  /**
   * Process expense transactions
   */
  static processExpenseTransaction(transaction: Transaction, expenseArray: Expense[]) {
    const cleanTag = transaction.category.replace('@', '');
    const existing = expenseArray.find(item => item.tag === cleanTag);
    
    if (existing) {
      existing.amount += transaction.amount;
    } else {
      expenseArray.push({ tag: cleanTag, amount: transaction.amount });
    }
  }

  /**
   * Apply sorting to filtered arrays
   */
  static applySorting() {
    // If using advanced filter sort, apply it to all individual table sorts
    if (IncomeComponent.currentFilter.sortBy !== 'none') {
      const column: 'tag' | 'amount' = IncomeComponent.currentFilter.sortBy === 'alphabetical' ? 'tag' : 'amount';
      const direction: 'asc' | 'desc' = IncomeComponent.currentFilter.sortOrder;
      
      // Set all tables to use the same sort
      IncomeComponent.tableSorts = {
        revenues: { column: column, direction: direction },
        interests: { column: column, direction: direction },
        properties: { column: column, direction: direction },
        daily: { column: column, direction: direction },
        splurge: { column: column, direction: direction },
        smile: { column: column, direction: direction },
        fire: { column: column, direction: direction },
        mojo: { column: column, direction: direction }
      };
    } else {
      // Reset all individual table sorts when "No Sorting" is selected
      IncomeComponent.tableSorts = {
        revenues: { column: null, direction: 'asc' },
        interests: { column: null, direction: 'asc' },
        properties: { column: null, direction: 'asc' },
        daily: { column: null, direction: 'asc' },
        splurge: { column: null, direction: 'asc' },
        smile: { column: null, direction: 'asc' },
        fire: { column: null, direction: 'asc' },
        mojo: { column: null, direction: 'asc' }
      };
    }

    const arrays = [
      IncomeComponent.allRevenuesF,
      IncomeComponent.allIntrestsF,
      IncomeComponent.allPropertiesF,
      IncomeComponent.dailyExpensesF,
      IncomeComponent.splurgeExpensesF,
      IncomeComponent.smileExpensesF,
      IncomeComponent.fireExpensesF,
      IncomeComponent.mojoExpensesF
    ];

    const sortFunction = IncomeComponent.getSortFunction();
    if (sortFunction) {
      arrays.forEach(arr => arr.sort(sortFunction));
    }
  }

  /**
   * Get sort function based on current filter settings
   */
  static getSortFunction(): ((a: any, b: any) => number) | null {
    if (IncomeComponent.currentFilter.sortBy === 'none') {
      return null;
    }

    if (IncomeComponent.currentFilter.sortBy === 'alphabetical') {
      return (a, b) => {
        const comparison = a.tag.toLowerCase().localeCompare(b.tag.toLowerCase());
        return IncomeComponent.currentFilter.sortOrder === 'asc' ? comparison : -comparison;
      };
    }

    if (IncomeComponent.currentFilter.sortBy === 'amount') {
      return (a, b) => {
        const comparison = a.amount - b.amount;
        return IncomeComponent.currentFilter.sortOrder === 'asc' ? comparison : -comparison;
      };
    }

    return null;
  }

  /**
   * Quick filter by date range only
   */
  quickFilterByDate() {
    IncomeComponent.applyFilters();
  }

  /**
   * Clears all filters
   */
  clearAllFilters() {
    IncomeComponent.setDate();
    IncomeComponent.currentFilter = {
      startDate: '',
      endDate: IncomeComponent.endDateTextField,
      selectedAccounts: [],
      selectedTags: [],
      sortBy: 'none',
      sortOrder: 'desc',
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
    
    IncomeComponent.allRevenuesF = [];
    IncomeComponent.allIntrestsF = [];
    IncomeComponent.allPropertiesF = [];
    IncomeComponent.dailyExpensesF = [];
    IncomeComponent.splurgeExpensesF = [];
    IncomeComponent.smileExpensesF = [];
    IncomeComponent.fireExpensesF = [];
    IncomeComponent.mojoExpensesF = [];

    // Reset all table sort states
    IncomeComponent.tableSorts = {
      revenues: { column: null, direction: 'asc' },
      interests: { column: null, direction: 'asc' },
      properties: { column: null, direction: 'asc' },
      daily: { column: null, direction: 'asc' },
      splurge: { column: null, direction: 'asc' },
      smile: { column: null, direction: 'asc' },
      fire: { column: null, direction: 'asc' },
      mojo: { column: null, direction: 'asc' }
    };

    IncomeComponent.isFiltered = false;
  }

  /**
   * Sort a specific table by tag or amount with visual indicators
   * Cycles through: ascending -> descending -> no sort
   */
  sortTable(tableType: 'revenues' | 'interests' | 'properties' | 'daily' | 'splurge' | 'smile' | 'fire' | 'mojo', column: 'tag' | 'amount') {
    const sortState = IncomeComponent.tableSorts[tableType];
    
    // Cycle through: asc -> desc -> none (original order)
    if (sortState.column === column) {
      if (sortState.direction === 'asc') {
        sortState.direction = 'desc';
      } else if (sortState.direction === 'desc') {
        // Reset to no sorting - reload data for this specific table
        sortState.column = null;
        sortState.direction = 'asc';
        
        if (IncomeComponent.isFiltered) {
          // Reapply filters without sorting to get original filtered order
          this.reapplyFiltersForTable(tableType);
        } else {
          // Reload from localStorage
          this.reloadOriginalData();
        }
        return;
      }
    } else {
      sortState.column = column;
      sortState.direction = 'asc';
    }

    // Get the appropriate array
    let arrayToSort: any[];
    if (IncomeComponent.isFiltered) {
      switch(tableType) {
        case 'revenues': arrayToSort = IncomeComponent.allRevenuesF; break;
        case 'interests': arrayToSort = IncomeComponent.allIntrestsF; break;
        case 'properties': arrayToSort = IncomeComponent.allPropertiesF; break;
        case 'daily': arrayToSort = IncomeComponent.dailyExpensesF; break;
        case 'splurge': arrayToSort = IncomeComponent.splurgeExpensesF; break;
        case 'smile': arrayToSort = IncomeComponent.smileExpensesF; break;
        case 'fire': arrayToSort = IncomeComponent.fireExpensesF; break;
        case 'mojo': arrayToSort = IncomeComponent.mojoExpensesF; break;
      }
    } else {
      switch(tableType) {
        case 'revenues': arrayToSort = AppStateService.instance.allRevenues; break;
        case 'interests': arrayToSort = AppStateService.instance.allIntrests; break;
        case 'properties': arrayToSort = AppStateService.instance.allProperties; break;
        case 'daily': arrayToSort = AppStateService.instance.dailyExpenses; break;
        case 'splurge': arrayToSort = AppStateService.instance.splurgeExpenses; break;
        case 'smile': arrayToSort = AppStateService.instance.smileExpenses; break;
        case 'fire': arrayToSort = AppStateService.instance.fireExpenses; break;
        case 'mojo': arrayToSort = AppStateService.instance.mojoExpenses; break;
      }
    }

    // Sort the array
    arrayToSort.sort((a, b) => {
      let comparison = 0;
      if (column === 'tag') {
        comparison = a.tag.toLowerCase().localeCompare(b.tag.toLowerCase());
      } else if (column === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Reapply filters for a specific table without affecting advanced filter sort
   */
  reapplyFiltersForTable(tableType: 'revenues' | 'interests' | 'properties' | 'daily' | 'splurge' | 'smile' | 'fire' | 'mojo') {
    // Temporarily store current sort settings
    const tempTableSorts = { ...IncomeComponent.tableSorts };
    const tempSortBy = IncomeComponent.currentFilter.sortBy;
    
    // Set to no sort to get original filtered order
    IncomeComponent.currentFilter.sortBy = 'none';
    
    // Reapply filters
    const filteredTransactions = AppStateService.instance.allTransactions.filter((transaction: Transaction) => {
      // Date range filter
      if (IncomeComponent.currentFilter.startDate && transaction.date < IncomeComponent.currentFilter.startDate) {
        return false;
      }
      if (IncomeComponent.currentFilter.endDate && transaction.date > IncomeComponent.currentFilter.endDate) {
        return false;
      }

      // Account filter
      if (IncomeComponent.currentFilter.selectedAccounts.length > 0) {
        if (!IncomeComponent.currentFilter.selectedAccounts.includes(transaction.account)) {
          return false;
        }
      }

      // Tag filter
      if (IncomeComponent.currentFilter.selectedTags.length > 0) {
        const cleanCategory = transaction.category.replace('@', '');
        if (!IncomeComponent.currentFilter.selectedTags.includes(cleanCategory)) {
          return false;
        }
      }

      // Search text filter
      if (IncomeComponent.currentFilter.searchText.trim()) {
        const searchTerms = IncomeComponent.currentFilter.searchText
          .split(/[;,]/)
          .map(term => term.trim().toLowerCase())
          .filter(term => term.length > 0);
        
        let matchFound = false;
        for (const searchTerm of searchTerms) {
          if (IncomeComponent.currentFilter.searchFields.account && transaction.account.toLowerCase().includes(searchTerm)) {
            matchFound = true;
            break;
          }
          if (IncomeComponent.currentFilter.searchFields.amount && transaction.amount.toString().includes(searchTerm)) {
            matchFound = true;
            break;
          }
          if (IncomeComponent.currentFilter.searchFields.date) {
            if (transaction.date.toLowerCase().includes(searchTerm)) {
              matchFound = true;
              break;
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
                matchFound = true;
                break;
              }
            }
          }
          if (IncomeComponent.currentFilter.searchFields.time && transaction.time.toLowerCase().includes(searchTerm)) {
            matchFound = true;
            break;
          }
          if (IncomeComponent.currentFilter.searchFields.category && transaction.category.toLowerCase().includes(searchTerm)) {
            matchFound = true;
            break;
          }
          if (IncomeComponent.currentFilter.searchFields.comment && transaction.comment.toLowerCase().includes(searchTerm)) {
            matchFound = true;
            break;
          }
        }
        if (!matchFound) {
          return false;
        }
      }

      return transaction.amount !== 0.0;
    });

    // Rebuild only the specified table
    switch(tableType) {
      case 'revenues':
        IncomeComponent.allRevenuesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Income") {
            const cleanTag = transaction.category.replace('@', '');
            let found = false;
            for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
              if (cleanTag === AppStateService.instance.allIntrests[i].tag) {
                found = true;
                break;
              }
            }
            if (!found) {
              for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
                if (cleanTag === AppStateService.instance.allProperties[i].tag) {
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              const existing = IncomeComponent.allRevenuesF.find(item => item.tag === cleanTag);
              if (existing) {
                existing.amount += transaction.amount;
              } else {
                IncomeComponent.allRevenuesF.push({ tag: cleanTag, amount: transaction.amount });
              }
            }
          }
        });
        break;
      case 'interests':
        IncomeComponent.allIntrestsF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Income") {
            const cleanTag = transaction.category.replace('@', '');
            for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
              if (cleanTag === AppStateService.instance.allIntrests[i].tag) {
                const existing = IncomeComponent.allIntrestsF.find(item => item.tag === cleanTag);
                if (existing) {
                  existing.amount += transaction.amount;
                } else {
                  IncomeComponent.allIntrestsF.push({ tag: cleanTag, amount: transaction.amount });
                }
                break;
              }
            }
          }
        });
        break;
      case 'properties':
        IncomeComponent.allPropertiesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Income") {
            const cleanTag = transaction.category.replace('@', '');
            for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
              if (cleanTag === AppStateService.instance.allProperties[i].tag) {
                const existing = IncomeComponent.allPropertiesF.find(item => item.tag === cleanTag);
                if (existing) {
                  existing.amount += transaction.amount;
                } else {
                  IncomeComponent.allPropertiesF.push({ tag: cleanTag, amount: transaction.amount });
                }
                break;
              }
            }
          }
        });
        break;
      case 'daily':
        IncomeComponent.dailyExpensesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Daily") {
            const cleanTag = transaction.category.replace('@', '');
            const existing = IncomeComponent.dailyExpensesF.find(item => item.tag === cleanTag);
            if (existing) {
              existing.amount += transaction.amount;
            } else {
              IncomeComponent.dailyExpensesF.push({ tag: cleanTag, amount: transaction.amount });
            }
          }
        });
        break;
      case 'splurge':
        IncomeComponent.splurgeExpensesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Splurge") {
            const cleanTag = transaction.category.replace('@', '');
            const existing = IncomeComponent.splurgeExpensesF.find(item => item.tag === cleanTag);
            if (existing) {
              existing.amount += transaction.amount;
            } else {
              IncomeComponent.splurgeExpensesF.push({ tag: cleanTag, amount: transaction.amount });
            }
          }
        });
        break;
      case 'smile':
        IncomeComponent.smileExpensesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Smile") {
            const cleanTag = transaction.category.replace('@', '');
            const existing = IncomeComponent.smileExpensesF.find(item => item.tag === cleanTag);
            if (existing) {
              existing.amount += transaction.amount;
            } else {
              IncomeComponent.smileExpensesF.push({ tag: cleanTag, amount: transaction.amount });
            }
          }
        });
        break;
      case 'fire':
        IncomeComponent.fireExpensesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Fire") {
            const cleanTag = transaction.category.replace('@', '');
            const existing = IncomeComponent.fireExpensesF.find(item => item.tag === cleanTag);
            if (existing) {
              existing.amount += transaction.amount;
            } else {
              IncomeComponent.fireExpensesF.push({ tag: cleanTag, amount: transaction.amount });
            }
          }
        });
        break;
      case 'mojo':
        IncomeComponent.mojoExpensesF = [];
        filteredTransactions.forEach((transaction: Transaction) => {
          if (transaction.account === "Mojo") {
            const cleanTag = transaction.category.replace('@', '');
            const existing = IncomeComponent.mojoExpensesF.find(item => item.tag === cleanTag);
            if (existing) {
              existing.amount += transaction.amount;
            } else {
              IncomeComponent.mojoExpensesF.push({ tag: cleanTag, amount: transaction.amount });
            }
          }
        });
        break;
    }
    
    // Restore sort settings
    IncomeComponent.tableSorts = tempTableSorts;
    IncomeComponent.currentFilter.sortBy = tempSortBy;
  }

  /**
   * Get sort arrow for column header
   */
  getSortArrow(tableType: 'revenues' | 'interests' | 'properties' | 'daily' | 'splurge' | 'smile' | 'fire' | 'mojo', column: 'tag' | 'amount'): string {
    const sortState = IncomeComponent.tableSorts[tableType];
    if (sortState.column !== column || sortState.column === null) return '';
    return sortState.direction === 'asc' ? ' ↑' : ' ↓';
  }

  /**
   * Reload original data from localStorage to restore unsorted order
   */
  reloadOriginalData() {
    AppStateService.instance.allRevenues = this.localStorage.getData("revenues") == "" ? [] : JSON.parse(this.localStorage.getData("revenues"));
    AppStateService.instance.allIntrests = this.localStorage.getData("interests") == "" ? [] : JSON.parse(this.localStorage.getData("interests"));
    AppStateService.instance.allProperties = this.localStorage.getData("properties") == "" ? [] : JSON.parse(this.localStorage.getData("properties"));

    AppStateService.instance.dailyExpenses = this.localStorage.getData("dailyEx") == "" ? [] : JSON.parse(this.localStorage.getData("dailyEx"));
    AppStateService.instance.splurgeExpenses = this.localStorage.getData("splurgeEx") == "" ? [] : JSON.parse(this.localStorage.getData("splurgeEx"));
    AppStateService.instance.smileExpenses = this.localStorage.getData("smileEx") == "" ? [] : JSON.parse(this.localStorage.getData("smileEx"));
    AppStateService.instance.fireExpenses = this.localStorage.getData("fireEx") == "" ? [] : JSON.parse(this.localStorage.getData("fireEx"));
    AppStateService.instance.mojoExpenses = this.localStorage.getData("mojoEx") == "" ? [] : JSON.parse(this.localStorage.getData("mojoEx"));
  }

  static setDate() {
    IncomeComponent.d = new Date();
    IncomeComponent.startDateTextField = "";
    IncomeComponent.endDateTextField = IncomeComponent.d.getFullYear() + "-" + IncomeComponent.zeroPadded(IncomeComponent.d.getMonth() + 1) + "-" + IncomeComponent.zeroPadded(IncomeComponent.d.getDate());
    IncomeComponent.currentFilter.startDate = "";
    IncomeComponent.currentFilter.endDate = IncomeComponent.endDateTextField;
  }

  static clear() {
    IncomeComponent.currentFilter.searchText = "";
    IncomeComponent.allRevenuesF = [];
    IncomeComponent.allIntrestsF = [];
    IncomeComponent.allPropertiesF = [];

    IncomeComponent.dailyExpensesF = [];
    IncomeComponent.splurgeExpensesF = [];
    IncomeComponent.smileExpensesF = [];
    IncomeComponent.fireExpensesF = [];
    IncomeComponent.mojoExpensesF = [];

    IncomeComponent.isFiltered = false;
    AppComponent.gotoTopAuto();
  }

  ngOnDestroy() {
    this.clear();
  }

  clear() {
    AppStateService.instance.allRevenues = this.localStorage.getData("revenues") == "" ? [] : JSON.parse(this.localStorage.getData("revenues"));
    AppStateService.instance.allIntrests = this.localStorage.getData("interests") == "" ? [] : JSON.parse(this.localStorage.getData("interests"));
    AppStateService.instance.allProperties = this.localStorage.getData("properties") == "" ? [] : JSON.parse(this.localStorage.getData("properties"));

    AppStateService.instance.dailyExpenses = this.localStorage.getData("dailyEx") == "" ? [] : JSON.parse(this.localStorage.getData("dailyEx"));
    AppStateService.instance.splurgeExpenses = this.localStorage.getData("splurgeEx") == "" ? [] : JSON.parse(this.localStorage.getData("splurgeEx"));
    AppStateService.instance.smileExpenses = this.localStorage.getData("smileEx") == "" ? [] : JSON.parse(this.localStorage.getData("smileEx"));
    AppStateService.instance.fireExpenses = this.localStorage.getData("fireEx") == "" ? [] : JSON.parse(this.localStorage.getData("fireEx"));
    AppStateService.instance.mojoExpenses = this.localStorage.getData("mojoEx") == "" ? [] : JSON.parse(this.localStorage.getData("mojoEx"));

    AppStateService.instance.allAssets = this.localStorage.getData("assets") == "" ? [] : JSON.parse(this.localStorage.getData("assets"));
    AppStateService.instance.allShares = this.localStorage.getData("shares") == "" ? [] : JSON.parse(this.localStorage.getData("shares"));
    AppStateService.instance.allInvestments = this.localStorage.getData("investments") == "" ? [] : JSON.parse(this.localStorage.getData("investments"));
    AppStateService.instance.liabilities = this.localStorage.getData("liabilities") == "" ? [] : JSON.parse(this.localStorage.getData("liabilities"));
  }

  static zeroPadded(val) {
    if (val >= 10)
      return val;
    else
      return "0" + val;
  }

  toggleRevenues() {
    this.isRevenues= !this.isRevenues;
    this.localStorage.saveData("isRevenues", this.isRevenues.toString());
  }

  toggleInterests() {
    this.isInterests = !this.isInterests;
    this.localStorage.saveData("isInterests", this.isInterests.toString());
  }

  toggleProperties() {
    this.isProperties = !this.isProperties;
    this.localStorage.saveData("isProperties", this.isProperties.toString());
  }

  toggleDailyExpense() {
    this.isDailyExpenses = !this.isDailyExpenses;
    this.localStorage.saveData("isDailyEx", this.isDailyExpenses.toString());
  }
  toggleSplurgeExpense() {
    this.isSplurgeExpenses = !this.isSplurgeExpenses;
    this.localStorage.saveData("isSplurgeEx", this.isSplurgeExpenses.toString());
  }
  toggleSmileExpense() {
    this.isSmileExpenses = !this.isSmileExpenses;
    this.localStorage.saveData("isSmileEx", this.isSmileExpenses.toString());
  }
  toggleFireExpense() {
    this.isFireExpenses = !this.isFireExpenses;
    this.localStorage.saveData("isFireEx", this.isFireExpenses.toString());
  }
  toggleMojoExpense() {
    this.isMojoExpenses = !this.isMojoExpenses;
    this.localStorage.saveData("isMojoEx", this.isMojoExpenses.toString());
  }

  static getRevenues() {
    if(!AppStateService.instance.allRevenues) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
      result += AppStateService.instance.allRevenues[i].amount;
    }
    return result;
  }

  static getRevenuesF() {
    if(!IncomeComponent.allRevenuesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.allRevenuesF.length; i++) {
      result += IncomeComponent.allRevenuesF[i].amount;
    }
    return result;
  }

  static getInterests() {
    if(!AppStateService.instance.allIntrests) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      result += AppStateService.instance.allIntrests[i].amount;
    }
    return result;
  }
  static getInterestsF() {
    if(!IncomeComponent.allIntrestsF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.allIntrestsF.length; i++) {
      result += IncomeComponent.allIntrestsF[i].amount;
    }
    return result;
  }

  static getProperties() {
    if(!AppStateService.instance.allProperties) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
      result += AppStateService.instance.allProperties[i].amount;
    }
    return result;
  }
  static getPropertiesF() {
    if(!IncomeComponent.allPropertiesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.allPropertiesF.length; i++) {
      result += IncomeComponent.allPropertiesF[i].amount;
    }
    return result;
  }

  static getDailyExpenses() {
    if(!AppStateService.instance.dailyExpenses) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.dailyExpenses.length; i++) {
      result += AppStateService.instance.dailyExpenses[i].amount;
    }
    return result;
  }
  static getDailyExpensesF() {
    if(!IncomeComponent.dailyExpensesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.dailyExpensesF.length; i++) {
      result += IncomeComponent.dailyExpensesF[i].amount;
    }
    return result;
  }

  static getSplurgeExpenses() {
    if(!AppStateService.instance.splurgeExpenses) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.splurgeExpenses.length; i++) {
      result += AppStateService.instance.splurgeExpenses[i].amount;
    }
    return result;
  }
  static getSplurgeExpensesF() {
    if(!IncomeComponent.splurgeExpensesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.splurgeExpensesF.length; i++) {
      result += IncomeComponent.splurgeExpensesF[i].amount;
    }
    return result;
  }

  static getSmileExpenses() {
    if(!AppStateService.instance.smileExpenses) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.smileExpenses.length; i++) {
      result += AppStateService.instance.smileExpenses[i].amount;
    }
    return result;
  }
  static getSmileExpensesF() {
    if(!IncomeComponent.smileExpensesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.smileExpensesF.length; i++) {
      result += IncomeComponent.smileExpensesF[i].amount;
    }
    return result;
  }

  static getFireExpenses() {
    if(!AppStateService.instance.fireExpenses) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.fireExpenses.length; i++) {
      result += AppStateService.instance.fireExpenses[i].amount;
    }
    return result;
  }
  static getFireExpensesF() {
    if(!IncomeComponent.fireExpensesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.fireExpensesF.length; i++) {
      result += IncomeComponent.fireExpensesF[i].amount;
    }
    return result;
  }

  static getMojoExpenses() {
    if(!AppStateService.instance.mojoExpenses) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.mojoExpenses.length; i++) {
      result += AppStateService.instance.mojoExpenses[i].amount;
    }
    return result;
  }
  static getMojoExpensesF() {
    if(!IncomeComponent.mojoExpensesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.mojoExpensesF.length; i++) {
      result += IncomeComponent.mojoExpensesF[i].amount;
    }
    return result;
  }

  static getTotalAmount() {
    let credit = IncomeComponent.getCreditAmount();
    let debit = IncomeComponent.getDebitAmount();
    return credit + debit;
  }
  static getTotalAmountF() {
    let credit = IncomeComponent.getCreditAmountF();
    let debit = IncomeComponent.getDebitAmountF();
    return credit + debit;
  }

  static getNettogewinnmarge() {
    let result = 0.0;
    let cashflow = IncomeComponent.getTotalAmount();
    let credit = IncomeComponent.getCreditAmount();
    if(credit > 0.0){
      result = cashflow / credit * 100;
    }
    return result;
  }

  static getEigenkaptitalRen() {
    let result = 0.0;
    let cashflow = IncomeComponent.getTotalAmount();
    let capital = BalanceComponent.getAssetsAmount();
    if(capital > 0.0){
      result = cashflow / capital * 100;
    }
    return result;
  }

  static getVerschuldungsgrad() {
    let result = 0.0;
    let credit = BalanceComponent.getAssetsAmount();
    let liabilitie = BalanceComponent.getLiabilities();
    if(credit > 0.0){
      result = liabilitie / credit ;
    }
    return parseFloat(result.toFixed(2));
  }

  static getGesamtkapital(){
    return BalanceComponent.getAssetsAmount() + BalanceComponent.getLiabilities();
  }

  static getEigenkapitalquote() {
    let result = 0.0;
    let credit = BalanceComponent.getAssetsAmount();
    let capital = BalanceComponent.getLiabilities() + credit;
    if(capital > 0.0){
      result = credit / capital * 100;
    }
    return result;
  }

  static getZinsaufwendungen() {
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.allTransactions.length; i++) {
      if(AppStateService.instance.allTransactions[i].comment.includes("Payback Liabilitie")){
        let split = AppStateService.instance.allTransactions[i].comment.split(" ");
        let credit = parseFloat(split[split.length - 1]);
        result += credit;
      }
    }
    return result;
  }

  static getZinsdeckungsgrad() {
    let result = 0.0;
    let cashflow = IncomeComponent.getTotalAmount();
    let credit = IncomeComponent.getZinsaufwendungen();
    if(credit > 0.0){
      result = cashflow / credit;
    }
    return parseFloat(result.toFixed(2));
  }

  static getDebitAmount() {
    if(!AppStateService.instance.dailyExpenses || !AppStateService.instance.splurgeExpenses || !AppStateService.instance.smileExpenses || !AppStateService.instance.fireExpenses ) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.dailyExpenses.length; i++) {
      result += AppStateService.instance.dailyExpenses[i].amount;
    }
    for (let i = 0; i < AppStateService.instance.splurgeExpenses.length; i++) {
      result += AppStateService.instance.splurgeExpenses[i].amount;
    }
    for (let i = 0; i < AppStateService.instance.smileExpenses.length; i++) {
      result += AppStateService.instance.smileExpenses[i].amount;
    }
    for (let i = 0; i < AppStateService.instance.fireExpenses.length; i++) {
      result += AppStateService.instance.fireExpenses[i].amount;
    }
    return result;
  }
  static getDebitAmountF() {
    if(!IncomeComponent.dailyExpensesF || !IncomeComponent.splurgeExpensesF || !IncomeComponent.smileExpensesF || !IncomeComponent.fireExpensesF ) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.dailyExpensesF.length; i++) {
      result += IncomeComponent.dailyExpensesF[i].amount;
    }
    for (let i = 0; i < IncomeComponent.splurgeExpensesF.length; i++) {
      result += IncomeComponent.splurgeExpensesF[i].amount;
    }
    for (let i = 0; i < IncomeComponent.smileExpensesF.length; i++) {
      result += IncomeComponent.smileExpensesF[i].amount;
    }
    for (let i = 0; i < IncomeComponent.fireExpensesF.length; i++) {
      result += IncomeComponent.fireExpensesF[i].amount;
    }
    return result;
  }

  static getCreditAmount() {
    if (!AppStateService.instance.allRevenues || !AppStateService.instance.allIntrests || !AppStateService.instance.allProperties) return 0.0;
    let result = 0.0;
    for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
      result += AppStateService.instance.allRevenues[i].amount;
    }
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      result += AppStateService.instance.allIntrests[i].amount;
    }
    for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
      result += AppStateService.instance.allProperties[i].amount;
    }
    return result;
  }
  static getCreditAmountF() {
    if(!IncomeComponent.allRevenuesF || !IncomeComponent.allIntrestsF || !IncomeComponent.allPropertiesF) return 0.0;
    let result = 0.0;
    for (let i = 0; i < IncomeComponent.allRevenuesF.length; i++) {
      result += IncomeComponent.allRevenuesF[i].amount;
    }
    for (let i = 0; i < IncomeComponent.allIntrestsF.length; i++) {
      result += IncomeComponent.allIntrestsF[i].amount;
    }
    for (let i = 0; i < IncomeComponent.allPropertiesF.length; i++) {
      result += IncomeComponent.allPropertiesF[i].amount;
    }
    return result;
  }

  goToBalance() {
    this.router.navigate(['/balance'])
    AppComponent.gotoTop();
  }

  goToCashflow() {
    this.router.navigate(['/cashflow']);
    AppComponent.gotoTop();
  }

  clickRevenue() {
  }

  clickExpenses() {
  }

  clickRow(index: number) {
    AppComponent.gotoTop();
  }

  clickRowInterests(index: number) {
    AppComponent.gotoTop();
    InfoInterestsComponent.setInfoInterestsComponent(
      index,
      AppStateService.instance.allIntrests[index].tag,
      AppStateService.instance.allIntrests[index].amount
    );
  }
  clickRowInterestsF(index: number) {
    AppComponent.gotoTop();
    InfoInterestsComponent.setInfoInterestsComponent(
      index,
      IncomeComponent.allIntrestsF[index].tag,
      IncomeComponent.allIntrestsF[index].amount
    );
  }

  clickRowProperties(index: number) {
    AppComponent.gotoTop();
    InfoPropertiesComponent.setInfoPropertiesComponent(
      index,
      AppStateService.instance.allProperties[index].tag,
      AppStateService.instance.allProperties[index].amount
    );
  }
  clickRowPropertiesF(index: number) {
    AppComponent.gotoTop();
    InfoPropertiesComponent.setInfoPropertiesComponent(
      index,
      IncomeComponent.allPropertiesF[index].tag,
      IncomeComponent.allPropertiesF[index].amount
    );
  }



  static getSalary() {
    if (AppStateService.instance.allRevenues) {
      let result = 0.0;
      for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
        result += AppStateService.instance.allRevenues[i].amount;
      }
      return result;
    }
    return 0.0;
  }
  static getSalaryF() {
    if (IncomeComponent.allRevenuesF) {
      let result = 0.0;
      for (let i = 0; i < IncomeComponent.allRevenuesF.length; i++) {
        result += IncomeComponent.allRevenuesF[i].amount;
      }
      return result;
    }
    return 0.0;
  }

  static getPassive() {
    if (AppStateService.instance.allIntrests) {
      let result = 0.0;
      for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
        result += AppStateService.instance.allIntrests[i].amount;
      }
      for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
        result += AppStateService.instance.allProperties[i].amount;
      }
      return result;
    }
    return 0.0;
  }
  static getPassiveF() {
    if (IncomeComponent.allIntrestsF) {
      let result = 0.0;
      for (let i = 0; i < IncomeComponent.allIntrestsF.length; i++) {
        result += IncomeComponent.allIntrestsF[i].amount;
      }
      for (let i = 0; i < IncomeComponent.allPropertiesF.length; i++) {
        result += IncomeComponent.allPropertiesF[i].amount;
      }
      return result;
    }
    return 0.0;
  }
}
