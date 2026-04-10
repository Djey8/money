import { AppComponent } from 'src/app/app.component';
import { StatsComponent } from 'src/app/stats/stats.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { Router } from '@angular/router';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { InfoSubscriptionComponent } from 'src/app/panels/info/info-subscription/info-subscription.component';
import { MatDividerModule } from '@angular/material/divider';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import { Subscription } from 'rxjs';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import {AfterViewInit, Component, ViewChild, inject, OnDestroy} from '@angular/core';
import {MatSort, Sort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BalanceComponent } from '../cashflow/balance/balance.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { RouterModule } from '@angular/router';
import { ToastService } from 'src/app/shared/services/toast.service';
import { SubscriptionProcessingService } from 'src/app/shared/services/subscription-processing.service';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, InfoSubscriptionComponent],
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.css', '../../app.component.css', '../../shared/styles/table.css' ] // '../../shared/styles/table.css'
})

export class SubscriptionComponent implements OnDestroy {
  private _liveAnnouncer = inject(LiveAnnouncer);
  private tableInitialized = false;

  static isSearched = false;
  static allSubscriptions = []
  static allSearchedSubscriptions = []

  displayedColumns: string[] = ['id', 'title', 'account', 'amount', 'startDate'];
  displayedColumnsIn: string[] = ['id', 'title', 'account', 'amount', 'endDate'];

  static activeDataSource = new MatTableDataSource<any>([]);
  static inactiveDataSource = new MatTableDataSource<any>([]);

  isChecked = true;
  frequencyFilter = 'all';  // Frequency filter state
  isRefreshing = false;  // Refresh button state

  searchTextField = "";

  public get appReference() { return AppComponent; }
  public classReference = SubscriptionComponent;
  public settingsReference = SettingsComponent;
  public profileReference = ProfileComponent;
  public appState = AppStateService.instance;

  /**
   * Constructs a new SubscriptionComponent.
   * @param router - The router service.
   * @param toastService - The toast notification service.
   * @param subscriptionProcessingService - The subscription processing service.
   * @param frontendLogger - The frontend logger service.
   */
  constructor(
    private router: Router,
    private toastService: ToastService,
    private subscriptionProcessingService: SubscriptionProcessingService,
    private frontendLogger: FrontendLoggerService
  ) {
    SubscriptionComponent.allSubscriptions = AppStateService.instance.allSubscriptions;
    SubscriptionComponent.activeDataSource = new MatTableDataSource<Subscription>([...SubscriptionComponent.allSubscriptions]);
    SubscriptionComponent.activeDataSource.data = SubscriptionComponent.activeDataSource.data.map((subscription, index) => {
      return { ...subscription, id: index };
    });
    SubscriptionComponent.inactiveDataSource = new MatTableDataSource<Subscription>([...SubscriptionComponent.allSubscriptions]);
    SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.inactiveDataSource.data.map((subscription, index) => {
      return { ...subscription, id: index };
    });
  }

  @ViewChild('activeSort') activeSort!: MatSort;
  @ViewChild('inactiveSort') inactiveSort!: MatSort;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  getSubscriptionIndex(subscription: Subscription): number {
    return SubscriptionComponent.allSubscriptions.findIndex(
      (sub) => sub === subscription
    );
  }

  /**
   * Checks if the current period for a subscription is already paid.
   * Period definition varies by frequency:
   * - Weekly: Current week (Monday-Sunday)
   * - Biweekly: Current 2-week period based on start date
   * - Monthly: Current month
   * - Quarterly: Current quarter (Q1, Q2, Q3, Q4)
   * - Yearly: Current year
   * 
   * @param subscription - The subscription to check
   * @returns true if current period is paid, false otherwise
   */
  isPeriodPaid(subscription: any): boolean {
    const frequency = subscription.frequency || 'monthly';
    const today = new Date();
    const commentCompare = subscription.comment
      ? subscription.title + " + " + subscription.comment
      : subscription.title;

    // Determine the current period start/end dates based on frequency
    let periodStart: Date;
    let periodEnd: Date;

    switch (frequency) {
      case 'weekly':
        // Current week: Monday 00:00 to Sunday 23:59
        periodStart = new Date(today);
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust so Monday = 0
        periodStart.setDate(today.getDate() - daysFromMonday);
        periodStart.setHours(0, 0, 0, 0);
        
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 6); // Sunday
        periodEnd.setHours(23, 59, 59, 999);
        break;

      case 'biweekly':
        // Current 2-week period based on subscription start date
        const startDate = new Date(subscription.startDate);
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentBiweekIndex = Math.floor(daysSinceStart / 14);
        
        periodStart = new Date(startDate);
        periodStart.setDate(startDate.getDate() + (currentBiweekIndex * 14));
        periodStart.setHours(0, 0, 0, 0);
        
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 13); // 14 days total (0-13)
        periodEnd.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Current month: 1st 00:00 to last day 23:59
        periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
        periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        break;

      case 'quarterly':
        // Current quarter: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
        const currentQuarter = Math.floor(today.getMonth() / 3);
        periodStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
        periodEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
        break;

      case 'yearly':
        // Current year: Jan 1 00:00 to Dec 31 23:59
        periodStart = new Date(today.getFullYear(), 0, 1);
        periodEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;

      default:
        // Fallback to monthly
        periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
        periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Check if any transaction exists for this subscription within the current period
    for (const t of AppStateService.instance.allTransactions) {
      const transactionDate = new Date(t.date);
      
      if (
        transactionDate >= periodStart &&
        transactionDate <= periodEnd &&
        t.account === subscription.account &&
        t.amount === subscription.amount &&
        t.category === subscription.category &&
        t.comment === commentCompare
      ) {
        return true; // Found a matching transaction in current period
      }
    }

    return false; // No transaction found for current period
  }

  applyFilterActive(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    SubscriptionComponent.activeDataSource.filter = filterValue.trim().toLowerCase();
    SubscriptionComponent.inactiveDataSource.filter = filterValue.trim().toLowerCase();
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
        case 'title':
          return item.title.toLowerCase(); // Example: Sort by title case-insensitively
        case 'startDate':
          if (this.isChecked){
            return new Date(item.startDate).getDate();
          } else {
            return new Date(item.startDate).getTime();
          }
        default:
          return item[property]; // Default sorting
      }
    };
  }

  updateFilter(){
    this.isChecked = !this.isChecked;
    const filterValue = SubscriptionComponent.activeDataSource.filter;
    SubscriptionComponent.activeDataSource.filter = ''; // Reset the filter
    SubscriptionComponent.activeDataSource.filter = filterValue; // Reapply the filter
  }


  ngAfterViewInit() {
    // Handled by ngAfterViewChecked to support *ngIf="!isLoading" timing
  }

  ngAfterViewChecked() {
    if (!this.tableInitialized && this.paginator) {
      this.tableInitialized = true;
      this.setupTableFeatures();
    }
  }

  ngOnDestroy() {}

  private setupTableFeatures() {
    this.applyCustomSorting(SubscriptionComponent.activeDataSource);
    this.applyCustomSorting(SubscriptionComponent.inactiveDataSource);
    SubscriptionComponent.activeDataSource.paginator = this.paginator;

    if (this.activeSort) {
      SubscriptionComponent.activeDataSource.sort = this.activeSort;
      setTimeout(() => {
        this.activeSort.active = 'id';
        this.activeSort.direction = 'desc';
        this.activeSort.sortChange.emit();
      });
    }

    if (this.inactiveSort) {
      SubscriptionComponent.inactiveDataSource.sort = this.inactiveSort;
      setTimeout(() => {
        this.inactiveSort.active = 'id';
        this.inactiveSort.direction = 'desc';
        this.inactiveSort.sortChange.emit();
      });
    }
  }

  ngOnInit() { 
    // Apply custom sorting
    this.applyCustomSorting(SubscriptionComponent.activeDataSource);
    this.applyCustomSorting(SubscriptionComponent.inactiveDataSource);
  }

  /** Announce the change in sort state for assistive technology. */
  announceSortChange(sortState: any) {
    if (sortState && sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  static getCreditAmount(){
    let sum = 0;
    SubscriptionComponent.allSubscriptions.forEach(subscription => {
      const endDate = new Date(subscription.endDate);
      const today = new Date();
      if (subscription.account === 'Income' && (!subscription.endDate || endDate >= today)) {
        sum += subscription.amount;
      }
    });
    return sum;
  }

  static getDebitAmount(){
    let sum = 0;
    SubscriptionComponent.allSubscriptions.forEach(subscription => {
      const endDate = new Date(subscription.endDate);
      const today = new Date();
      if (subscription.account != 'Income' && (!subscription.endDate || endDate >= today)) {
        sum += subscription.amount;
      }
    });
    return sum;
  }

  static getTotalAmount(){
    let sum = 0;
    SubscriptionComponent.allSubscriptions.forEach(subscription => {
      const endDate = new Date(subscription.endDate);
      const today = new Date();
      if (!subscription.endDate || endDate >= today) {
        sum += subscription.amount;
      }
    });
    return sum;
  }

  static isActive(index){
    const endDate = new Date(SubscriptionComponent.allSubscriptions[index].endDate);
    const today = new Date();
    return !(!SubscriptionComponent.allSubscriptions[index].endDate || endDate >= today);
  }

  static noInactiveSubscriptions(){
    let noInactive = true;
    SubscriptionComponent.allSubscriptions.forEach(subscription => {
      const endDate = new Date(subscription.endDate);
      const today = new Date();
      if (subscription.endDate && endDate < today) {
        noInactive = false;
      }
    });
    return noInactive;
  }

  static noInactiveSubscriptionsFiltered(){
    let noInactive = true;
    SubscriptionComponent.allSearchedSubscriptions.forEach(subscription => {
      const endDate = new Date(subscription.endDate);
      const today = new Date();
      if (subscription.endDate && endDate < today && subscription.isFiltered) {
        noInactive = false;
      }
    });
    return noInactive;
  }




  /**
  * Performs a search based on the searchTextField value.
  */
  search() {
    const searchTerms = this.searchTextField.toLowerCase().split(',').map(term => term.trim());

    SubscriptionComponent.activeDataSource.filterPredicate = (data, filter) => {
      return searchTerms.some(term => 
      data.title.toLowerCase().includes(term.trim()) ||
      data.account.toLowerCase().includes(term.trim()) ||
      data.category.toLowerCase().includes(term.trim()) ||
      data.comment.toLowerCase().includes(term.trim()) ||
      data.startDate.toLowerCase().includes(term.trim()) ||
      String(data.amount).includes(term.trim())
      );
    };

    SubscriptionComponent.activeDataSource.filter = this.searchTextField.trim().toLowerCase();

    SubscriptionComponent.inactiveDataSource.filterPredicate = (data, filter) => {
      return searchTerms.some(term => 
      data.title.toLowerCase().includes(term.trim()) ||
      data.account.toLowerCase().includes(term.trim()) ||
      data.category.toLowerCase().includes(term.trim()) ||
      data.comment.toLowerCase().includes(term.trim()) ||
      data.startDate.toLowerCase().includes(term.trim()) ||
      String(data.amount).includes(term.trim())
      );
    };

    SubscriptionComponent.inactiveDataSource.filter = this.searchTextField.trim().toLowerCase();
    SubscriptionComponent.isSearched = true;
  }
  
  /**
   * Clears the search results.
   */
  clearSearch() {
    this.searchTextField = "";
    SubscriptionComponent.isSearched = false;

    SubscriptionComponent.activeDataSource.filter = '';
    SubscriptionComponent.inactiveDataSource.filter = '';
  }

  /**
   * Handles the click event on a row in the accounting table.
   * @param index - The index of the clicked row.
   */
  clickRow(index: number){
    AppComponent.gotoTop();
    InfoSubscriptionComponent.setInfoSubscriptionComponent(
      index,
      SubscriptionComponent.allSubscriptions[index].title,
      SubscriptionComponent.allSubscriptions[index].account,
      SubscriptionComponent.allSubscriptions[index].amount,
      SubscriptionComponent.allSubscriptions[index].startDate,
      SubscriptionComponent.allSubscriptions[index].endDate,
      SubscriptionComponent.allSubscriptions[index].category,
      SubscriptionComponent.allSubscriptions[index].comment,
      SubscriptionComponent.allSubscriptions[index].frequency
    );
  }

  /**
   * Adds a new transaction.
   */
  addSubscription() {
    AppComponent.addSubscription("Daily", "@", "subscription");
  }

  /**
   * Returns a human-readable label for the frequency.
   * @param frequency - The subscription frequency.
   * @returns Translated frequency label.
   */
  getFrequencyLabel(frequency: string): string {
    const labels: { [key: string]: string } = {
      weekly: 'Weekly',
      biweekly: 'Biweekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };
    return labels[frequency] || 'Monthly';
  }

  /**
   * Filters subscriptions by frequency.
   * Applies the selected frequency filter to both active and inactive data sources.
   */
  applyFrequencyFilter() {
    const filterFrequency = this.frequencyFilter;
    
    if (filterFrequency === 'all') {
      // Show all subscriptions
      SubscriptionComponent.activeDataSource.data = [...SubscriptionComponent.allSubscriptions].map((subscription, index) => {
        return { ...subscription, id: index };
      });
      SubscriptionComponent.inactiveDataSource.data = [...SubscriptionComponent.allSubscriptions].map((subscription, index) => {
        return { ...subscription, id: index };
      });
    } else {
      // Filter by selected frequency
      const filtered = SubscriptionComponent.allSubscriptions.filter(
        sub => sub.frequency === filterFrequency || (!sub.frequency && filterFrequency === 'monthly')
      );
      SubscriptionComponent.activeDataSource.data = filtered.map((subscription, index) => {
        return { ...subscription, id: index };
      });
      SubscriptionComponent.inactiveDataSource.data = filtered.map((subscription, index) => {
        return { ...subscription, id: index };
      });
    }
  }

  /**
   * Manually refreshes subscription transactions.
   * Calls SubscriptionProcessingService to generate any missing transactions,
   * then displays a toast notification with the results.
   */
  async refreshSubscriptions() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    this.frontendLogger.logActivity('subscription_refresh_start', 'info');
    
    try {
      const result = await this.subscriptionProcessingService.setTransactionsForSubscriptions();
      
      // Show success toast with transaction count
      if (result.transactionsCreated > 0) {
        this.toastService.show(
          `${result.transactionsCreated} subscription transaction${result.transactionsCreated !== 1 ? 's' : ''} created`,
          'success'
        );
      } else {
        this.toastService.show(
          'All subscription transactions are up to date',
          'info'
        );
      }
      
      this.frontendLogger.logActivity('subscription_refresh_complete', 'info', {
        transactionsCreated: result.transactionsCreated,
        subscriptionsProcessed: result.subscriptionsProcessed
      });
    } catch (error) {
      console.error('Failed to refresh subscriptions:', error);
      this.toastService.show('Failed to refresh subscriptions', 'error');
      this.frontendLogger.logError(error as Error, 'subscription_refresh_failed');
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Navigates to the stats page.
   */
  goToStats(){
    StatsComponent.resetBIStateIfNeeded("income");
    this.router.navigate(['/stats']);
    StatsComponent.modus = "income";
    MenuComponent.openStats = true;
    AppComponent.gotoTop();
  }

}
