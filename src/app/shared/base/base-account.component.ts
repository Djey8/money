import { ViewChild, inject, Directive, OnDestroy } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subscription as RxSubscription } from 'rxjs';
import { AppComponent } from 'src/app/app.component';
import { InfoComponent } from 'src/app/panels/info/info.component';
import { AccountingComponent } from 'src/app/main/accounting/accounting.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { TransactionFilterService } from 'src/app/shared/services/transaction-filter.service';
import { AppStateService } from '../services/app-state.service';

/**
 * Base class for account-based transaction views (Daily, Splurge, Smile, Fire).
 * Provides shared table setup, filtering, searching, sorting, and pagination.
 * Each child defines its own `allowedAccounts`, `classReference`, and account-specific logic.
 */
@Directive()
export abstract class BaseAccountComponent implements OnDestroy {

  protected _liveAnnouncer = inject(LiveAnnouncer);
  private txSub?: RxSubscription;
  private tableInitialized = false;
  private paginatorSynced = false;
  displayedColumns: string[] = ['id', 'account', 'amount', 'category', 'date'];
  searchTextField = "";

  public get appReference() { return AppComponent; }
  public settingsReference = SettingsComponent;
  public accountingReference = AccountingComponent;
  public appState = AppStateService.instance;

  /** Each child sets this to its own class so templates can access static props */
  abstract classReference: any;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('topPaginator') topPaginator!: MatPaginator;
  @ViewChild('bottomPaginator') bottomPaginator!: MatPaginator;

  constructor(protected router: Router, protected filterService: TransactionFilterService) {}

  /**
   * Shared constructor initialization. Call from child constructor.
   * Sets up allTransactions, dataSource filtering, date, and available filters.
   */
  protected initAccount(cls: any) {
    cls.allTransactions = AppStateService.instance.allTransactions;

    // Filter to show only allowed accounts initially
    AccountingComponent.dataSource.data = AppStateService.instance.allTransactions.map((transaction, index) => {
      return {
        ...transaction,
        id: index,
        visible: cls.allowedAccounts.includes(transaction.account)
      };
    });

    // Set filter predicate to show only visible transactions
    AccountingComponent.dataSource.filterPredicate = (data: any) => {
      return data.visible !== false;
    };
    AccountingComponent.dataSource.filter = 'apply';

    // Initialize advanced filter
    cls.setDate();
    cls.availableAccounts = this.filterService.getAvailableAccounts(
      AppStateService.instance.allTransactions,
      cls.allowedAccounts
    );
    cls.availableTags = this.filterService.getAvailableTags(
      AppStateService.instance.allTransactions.filter(t => cls.allowedAccounts.includes(t.account))
    );
  }

  ngOnInit() {
    this.applyCustomSorting(AccountingComponent.dataSource);

    // Re-init when transactions are reloaded (e.g. subscription processing adds transactions)
    this.txSub = AppStateService.instance.transactionsUpdated$.subscribe(() => {
      this.initAccount(this.classReference);
      if (this.bottomPaginator) {
        AccountingComponent.dataSource.paginator = this.bottomPaginator;
      }
      if (this.sort) {
        AccountingComponent.dataSource.sort = this.sort;
      }
    });
  }

  ngOnDestroy() {
    this.txSub?.unsubscribe();
  }

  /**
   * Called every change detection cycle. Detects when the table elements
   * first appear in the DOM (after *ngIf="!isLoading" becomes true)
   * and initializes filters, paginators, and sorting.
   */
  ngAfterViewChecked() {
    if (!this.tableInitialized && this.bottomPaginator) {
      this.tableInitialized = true;
      setTimeout(() => {
        this.initAccount(this.classReference);
        this.setupTableFeatures();
      });
    }
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

      setTimeout(() => {
        this.topPaginator.length = this.bottomPaginator.length;
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

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    AccountingComponent.dataSource.filter = filterValue.trim().toLowerCase();
  }

  applyCustomSorting(dataSource: MatTableDataSource<any>) {
    dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'id':
          return item.id;
        case 'amount':
          return item.amount;
        case 'category':
          return item.category.toLowerCase();
        case 'date':
          return new Date(item.date).getTime();
        default:
          return item[property];
      }
    };
  }

  announceSortChange(sortState: any) {
    if (sortState && sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  /**
   * Applies the current advanced filter criteria (date range, accounts, tags, sort, search)
   * to all transactions and updates the accounting data source.
   *
   * Marks each row with a `visible` flag based on filter match and allowed accounts,
   * sets a custom filter predicate on the MatTableDataSource, and resets pagination.
   */
  applyAdvancedFilters() {
    const cls = this.classReference;
    AppComponent.gotoTop();

    const filteredTransactions = this.filterService.applyFilters(
      AppStateService.instance.allTransactions,
      cls.advancedFilter,
      cls.allowedAccounts
    );

    AccountingComponent.dataSource.data = AppStateService.instance.allTransactions.map((transaction, index) => {
      const isVisible = filteredTransactions.some(t =>
        t.date === transaction.date &&
        t.amount === transaction.amount &&
        t.category === transaction.category &&
        t.comment === transaction.comment &&
        t.account === transaction.account
      ) && cls.allowedAccounts.includes(transaction.account);
      return { ...transaction, id: index, visible: isVisible };
    });

    AccountingComponent.dataSource.filterPredicate = (data: any) => {
      return data.visible !== false;
    };
    AccountingComponent.dataSource.filter = 'apply';

    setTimeout(() => {
      if (this.topPaginator && this.bottomPaginator) {
        this.topPaginator.pageIndex = 0;
        this.bottomPaginator.pageIndex = 0;
        this.topPaginator.length = this.bottomPaginator.length;
      }
    });
  }

  clearAdvancedFilters() {
    const cls = this.classReference;
    cls.advancedFilter = {
      startDate: '',
      endDate: cls.endDateTextField,
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

    AccountingComponent.dataSource.data = AppStateService.instance.allTransactions.map((transaction, index) => {
      return {
        ...transaction,
        id: index,
        visible: cls.allowedAccounts.includes(transaction.account)
      };
    });

    AccountingComponent.dataSource.filterPredicate = (data: any) => {
      return data.visible !== false;
    };
    AccountingComponent.dataSource.filter = 'apply';

    setTimeout(() => {
      if (this.topPaginator && this.bottomPaginator) {
        this.topPaginator.pageIndex = 0;
        this.bottomPaginator.pageIndex = 0;
        this.topPaginator.length = this.bottomPaginator.length;
      }
    });
  }

  search() {
    const cls = this.classReference;
    const searchTerms = this.searchTextField.toLowerCase().split(',');
    AccountingComponent.dataSource.filterPredicate = (data, filter) => {
      return searchTerms.some(term => {
        const trimmedTerm = term.trim();

        let dateMatches = data.date.toLowerCase().includes(trimmedTerm);
        if (!dateMatches && data.date) {
          const dateObj = new Date(data.date);
          if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const shortYear = String(year).slice(-2);
            const ddmmyyyy = `${day}.${month}.${year}`;
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
    cls.isSearched = true;
  }

  clearSearch() {
    this.searchTextField = "";
    this.classReference.isSearched = false;
    AccountingComponent.dataSource.filter = '';
  }

  clickRow(index: number) {
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
}
