import { InfoComponent } from 'src/app/panels/info/info.component';
import { AppComponent } from 'src/app/app.component';
import { StatsComponent } from 'src/app/stats/stats.component';
import { GameModeService } from 'src/app/shared/services/game-mode.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { Router } from '@angular/router';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { CsvService } from 'src/app/shared/services/csv.service';
import { AddComponent } from 'src/app/panels/add/add.component';
import { MatDividerModule } from '@angular/material/divider';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import {AfterViewInit, Component, ViewChild, inject, OnDestroy} from '@angular/core';
import {MatSort, Sort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Transaction } from 'src/app/interfaces/transaction';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { RouterModule } from '@angular/router';
import { SharedFilterComponent } from 'src/app/shared/components/shared-filter/shared-filter.component';



/**
 * Represents the AccountingComponent class.
 */
@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, SharedFilterComponent],
  templateUrl: './accounting.component.html',
  styleUrls: ['./accounting.component.css', '../../app.component.css', '../../shared/styles/table.css']
})
export class AccountingComponent implements OnDestroy {

  private _liveAnnouncer = inject(LiveAnnouncer);
  private tableInitialized = false;
  private paginatorSynced = false;
  private txSub: any;
  displayedColumns: string[] = ['id', 'account', 'amount', 'category', 'date'];
  static dataSource = new MatTableDataSource<any>([]);

  static isSearched = false;
  static allTransactions = []
  static allSearchedTransactions = []

  searchTextField = "";

  static roundCount = 0;

  // Advanced filter system
  static advancedFilter: IncomeFilter = {
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
  
  static isAdvancedFilterExpanded = false;
  static isSearchHelpVisible = false;
  static availableAccounts: string[] = ['Income', 'Daily', 'Splurge', 'Smile', 'Fire', 'Mojo'];
  static availableTags: string[] = [];
  static d: Date;
  static startDateTextField: string;
  static endDateTextField: string;

  public get appReference() { return AppComponent; }
  public classReference = AccountingComponent;
  public settingsReference = SettingsComponent;
  public appState = AppStateService.instance;

  /**
   * Constructs a new AccountingComponent.
   * @param router - The router service.
   */
  constructor(private router: Router, private csvService: CsvService) {
    AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
    AccountingComponent.dataSource = new MatTableDataSource<any>(AccountingComponent.allTransactions);
    AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
      return { ...transaction, id: index };
    });
    AccountingComponent.calculateroundCount();
    
    // Initialize advanced filter
    AccountingComponent.isAdvancedFilterExpanded = false;
    AccountingComponent.setDate();
    AccountingComponent.advancedFilter = {
      startDate: '',
      endDate: AccountingComponent.endDateTextField,
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
    
    // Update available tags
    this.updateAvailableTags();
  }

  /**
   * Calculate how many times salary was received minus 1
   */
  static calculateroundCount() {
    if (AppStateService.instance.allTransactions) {
      // Calculate months between first and last transaction dates
      if (AppStateService.instance.allTransactions.length > 0) {
        const dates = AppStateService.instance.allTransactions.map(tx => new Date(tx.date)).sort((a, b) => a.getTime() - b.getTime());
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        
        const monthsBetween = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                             (lastDate.getMonth() - firstDate.getMonth());
        AccountingComponent.roundCount = Math.max(0, monthsBetween);
      }
      
    } else {
      AccountingComponent.roundCount = 0;
    }
  }

  /**
   * Decrease salary count
   */
  decreaseRoundCount() {
    if (AccountingComponent.roundCount > 0) {
      AccountingComponent.roundCount--;
      GameModeService.instance.moveTransactionsOneMonthForwardAndRemoveCurrentSubscriptions();
    }
  }

  /**
   * Increase salary count
   */
  increaseRoundCount() {
    AccountingComponent.roundCount++;
    GameModeService.instance.moveTransactionsOneMonthBackAndAddCurrentSubscriptions();

  }

  /**
   * Check if cashflow game mode is active
   */
  isCashflowGame(): boolean {
    return GameModeService.isCashflowGame();
  }

  @ViewChild(MatSort) sort!: MatSort;

  @ViewChild('topPaginator') topPaginator!: MatPaginator;
  @ViewChild('bottomPaginator') bottomPaginator!: MatPaginator;

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    AccountingComponent.dataSource.filter = filterValue.trim().toLowerCase();
  }

  /**
   * Custom sorting function for MatTableDataSource.
   * @param dataSource - The data source to apply the custom sorting.
   */
  applyCustomSorting(dataSource: MatTableDataSource<any>) {
    dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'id':
          return item.id; // Example: Sort by id as a number
        case 'amount':
          return item.amount; // Example: Sort by amount as a number
        case 'category':
          return item.category.toLowerCase(); // Example: Sort by title case-insensitively
        case 'date':
          return new Date(item.date).getTime(); // Example: Sort by startDate as a timestamp
        default:
          return item[property]; // Default sorting
      }
    };
  }


  ngAfterViewInit() {
    // Handled by ngAfterViewChecked to support *ngIf="!isLoading" timing
  }

  ngAfterViewChecked() {
    if (!this.tableInitialized && this.bottomPaginator) {
      this.tableInitialized = true;
      this.setupTableFeatures();
    }
  }

  ngOnDestroy() {
    this.txSub?.unsubscribe();
  }

  private setupTableFeatures() {
    this.applyCustomSorting(AccountingComponent.dataSource);
    AccountingComponent.dataSource.paginator = this.bottomPaginator;

    if (this.topPaginator && this.bottomPaginator && !this.paginatorSynced) {
      this.paginatorSynced = true;

      this.topPaginator.page.subscribe((pageEvent) => {
        if (this.bottomPaginator.pageIndex !== pageEvent.pageIndex || 
            this.bottomPaginator.pageSize !== pageEvent.pageSize) {
          this.bottomPaginator.pageIndex = pageEvent.pageIndex;
          this.bottomPaginator.pageSize = pageEvent.pageSize;
          this.bottomPaginator.page.emit(pageEvent);
        }
      });
      
      this.bottomPaginator.page.subscribe((pageEvent) => {
        if (this.topPaginator.pageIndex !== pageEvent.pageIndex || 
            this.topPaginator.pageSize !== pageEvent.pageSize) {
          this.topPaginator.pageIndex = pageEvent.pageIndex;
          this.topPaginator.pageSize = pageEvent.pageSize;
        }
      });
    }

    if (this.sort) {
      AccountingComponent.dataSource.sort = this.sort;
      setTimeout(() => {
        this.sort.active = 'id';
        this.sort.direction = 'desc';
        this.sort.sortChange.emit();
      });
    }
  }

  ngOnInit() { 
    // Apply custom sorting
    this.applyCustomSorting(AccountingComponent.dataSource);

    // Re-init when transactions are reloaded
    this.txSub = AppStateService.instance.transactionsUpdated$.subscribe(() => {
      AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
      AccountingComponent.dataSource.data = AppStateService.instance.allTransactions.map((transaction, index) => {
        return { ...transaction, id: index };
      });
      AccountingComponent.calculateroundCount();
      if (this.bottomPaginator) {
        AccountingComponent.dataSource.paginator = this.bottomPaginator;
      }
      if (this.sort) {
        AccountingComponent.dataSource.sort = this.sort;
      }
    });
  }

  /** Announce the change in sort state for assistive technology. */
  announceSortChange(sortState: any) {
    if (sortState && sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }


  /**
   * Set date range for filtering
   */
  static setDate() {
    AccountingComponent.d = new Date();
    const todayYear = AccountingComponent.d.getFullYear();
    const todayMonth = (AccountingComponent.d.getMonth() + 1).toString().padStart(2, '0');
    const todayDay = AccountingComponent.d.getDate().toString().padStart(2, '0');
    AccountingComponent.endDateTextField = `${todayYear}-${todayMonth}-${todayDay}`;
    AccountingComponent.startDateTextField = '';
  }

  /**
   * Update available tags from all transactions
   */
  updateAvailableTags() {
    const tagsSet = new Set<string>();
    for (let i = AppStateService.instance.allTransactions.length - 1; i >= 0; i--) {
      const transaction = AppStateService.instance.allTransactions[i];
      if (transaction.category) {
        tagsSet.add(transaction.category.replace('@', ''));
      }
    }
    AccountingComponent.availableTags = Array.from(tagsSet);
  }

  /**
   * Helper method to check if a search term matches any selected field in a transaction.
   * Auto-detects the format of the search term (date, time, amount, text) and only
   * checks the corresponding field to avoid cross-field false positives.
   */
  private static checkSearchTermMatch(transaction: Transaction, searchTerm: string): boolean {
    const searchFields = AccountingComponent.advancedFilter.searchFields;

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
   * Apply advanced filters
   */
  applyAdvancedFilters() {
    AppComponent.gotoTop();
    const filteredTransactions = AppStateService.instance.allTransactions.filter((transaction: Transaction) => {
      // Date range filter
      if (AccountingComponent.advancedFilter.startDate && transaction.date < AccountingComponent.advancedFilter.startDate) {
        return false;
      }
      if (AccountingComponent.advancedFilter.endDate && transaction.date > AccountingComponent.advancedFilter.endDate) {
        return false;
      }

      // Account filter
      if (AccountingComponent.advancedFilter.selectedAccounts.length > 0) {
        if (!AccountingComponent.advancedFilter.selectedAccounts.includes(transaction.account)) {
          return false;
        }
      }

      // Tag filter
      if (AccountingComponent.advancedFilter.selectedTags.length > 0) {
        const cleanCategory = transaction.category.replace('@', '');
        if (!AccountingComponent.advancedFilter.selectedTags.includes(cleanCategory)) {
          return false;
        }
      }

      // Search text filter with boolean logic
      if (AccountingComponent.advancedFilter.searchText.trim()) {
        let searchExpression = AccountingComponent.advancedFilter.searchText
          .replace(/\band\b/gi, '&&')
          .replace(/\bor\b/gi, '||')
          .replace(/\bnot\b/gi, '!');
        
        const orGroups = searchExpression.split('||').map(g => g.trim());
        let matchFound = false;
        
        for (const orGroup of orGroups) {
          const andTerms = orGroup.split('&&').map(t => t.trim());
          let allAndTermsMatch = true;
          
          for (const andTerm of andTerms) {
            const isNegated = andTerm.startsWith('!');
            const searchTerm = (isNegated ? andTerm.substring(1).trim() : andTerm).toLowerCase();
            
            if (!searchTerm) continue;
            
            let termMatches = AccountingComponent.checkSearchTermMatch(transaction, searchTerm);
            
            if (isNegated) {
              termMatches = !termMatches;
            }
            
            if (!termMatches) {
              allAndTermsMatch = false;
              break;
            }
          }
          
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

    // Mark transactions as visible/hidden instead of removing them
    AccountingComponent.dataSource.data = AccountingComponent.allTransactions.map((transaction, index) => {
      const isVisible = filteredTransactions.some(t => 
        t.date === transaction.date && 
        t.amount === transaction.amount &&
        t.category === transaction.category &&
        t.comment === transaction.comment &&
        t.account === transaction.account
      );
      return { ...transaction, id: index, visible: isVisible };
    });
    
    // Update filter predicate to only show visible transactions
    AccountingComponent.dataSource.filterPredicate = (data: any) => {
      return data.visible !== false;
    };
    AccountingComponent.dataSource.filter = 'apply';
    
    // Update top paginator length to match filtered data and reset to page 1
    setTimeout(() => {
      if (this.topPaginator && this.bottomPaginator) {
        this.topPaginator.pageIndex = 0;
        this.bottomPaginator.pageIndex = 0;
        this.topPaginator.length = this.bottomPaginator.length;
      }
    });
  }

  /**
   * Clear all advanced filters
   */
  clearAdvancedFilters() {
    AccountingComponent.advancedFilter = {
      startDate: '',
      endDate: AccountingComponent.endDateTextField,
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
    
    // Reset to all transactions - make all visible
    AccountingComponent.dataSource.data = AccountingComponent.allTransactions.map((transaction, index) => {
      return { ...transaction, id: index, visible: true };
    });
    
    // Reset filter
    AccountingComponent.dataSource.filter = '';
    
    // Update top paginator length to match cleared data and reset to page 1
    setTimeout(() => {
      if (this.topPaginator && this.bottomPaginator) {
        this.topPaginator.pageIndex = 0;
        this.bottomPaginator.pageIndex = 0;
        this.topPaginator.length = this.bottomPaginator.length;
      }
    });
  }


  /**
  * Performs a search based on the searchTextField value.
  */
  search() {
    const searchTerms = this.searchTextField.toLowerCase().split(',');

    AccountingComponent.dataSource.filterPredicate = (data, filter) => {
      return searchTerms.some(term => {
        const trimmedTerm = term.trim();
        
        // Handle date format conversions for search
        let dateMatches = data.date.toLowerCase().includes(trimmedTerm);
        if (!dateMatches && data.date) {
          const dateObj = new Date(data.date);
          if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const shortYear = String(year).slice(-2);
        
        // Check dd.mm.yyyy format
        const ddmmyyyy = `${day}.${month}.${year}`;
        // Check dd.mm.yy format
        const ddmmyy = `${day}.${month}.${shortYear}`;
        
        dateMatches = ddmmyyyy.includes(trimmedTerm) || ddmmyy.includes(trimmedTerm);
          }
        }
        
        return data.account.toLowerCase().includes(trimmedTerm) ||
           String(data.amount).includes(trimmedTerm) ||
           dateMatches ||
           data.time.toLowerCase().includes(trimmedTerm) ||
           data.category.toLowerCase().includes(trimmedTerm) ||
           data.comment.toLowerCase().includes(trimmedTerm);
      });
    };

    AccountingComponent.dataSource.filter = this.searchTextField.trim().toLowerCase();
    AccountingComponent.isSearched = true;
  }
  /**
   * Clears the search results.
   */
  clearSearch() {
    this.searchTextField = "";
    AccountingComponent.isSearched = false;
    AccountingComponent.dataSource.filter = '';
  }
  

  /**
   * Downloads the transactions as a CSV file.
   */
  downloadTransactions() {
    this.csvService.downloadCsv(AppStateService.instance.allTransactions);
  }
  
  /**
   * Handles the click event on a row in the accounting table.
   * @param index - The index of the clicked row.
   */
  clickRow(index: number){
    AppComponent.gotoTop();
    InfoComponent.setInfoComponent(
      index,
      AppStateService.instance.allTransactions[index].account,
      AppStateService.instance.allTransactions[index].amount,
      AppStateService.instance.allTransactions[index].date,
      AppStateService.instance.allTransactions[index].time,
      AppStateService.instance.allTransactions[index].category,
      AppStateService.instance.allTransactions[index].comment
    );
  }

  /**
   * Adds a new transaction.
   */
  addTransaction() {
    AppComponent.addTransaction("Daily", "@", "transactions");
  }

  /**
   * Navigates to the stats page.
   */
  goToStats(){
    this.router.navigate(['/stats']);
    StatsComponent.resetBIStateIfNeeded("income");
    StatsComponent.modus = "income";
    MenuComponent.openStats = true;
    StatsComponent.isSwitch = true;
    AppComponent.gotoTop();
  }

  /**
   * Navigates to the subription page.
   */
  goToSubscription(){
    this.router.navigate(['/subscription']);

    AppComponent.gotoTop();
  }
}
