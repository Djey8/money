import { Router } from '@angular/router';
import { AppComponent } from 'src/app/app.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import {AfterViewInit, Component, ElementRef, HostListener, ViewChild, inject, ChangeDetectorRef, ChangeDetectionStrategy} from '@angular/core';
import {MatSort, Sort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import { AddBudgetComponent } from 'src/app/panels/add/add-budget/add-budget.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { InfoComponent } from 'src/app/panels/info/info.component';
import { BudgetComponent } from '../budget.component';
import { InfoBudgetComponent } from 'src/app/panels/info/info-budget/info-budget.component';
import { GrowComponent } from '../../grow/grow.component';
import { AddComponent } from 'src/app/panels/add/add.component';
import { AddSmileComponent } from 'src/app/panels/add/add-smile/add-smile.component';
import { InfoSmileComponent } from 'src/app/panels/info/info-smile/info-smile.component';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from 'src/app/shared/services/auth.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { forkJoin, of, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { TrapFocusDirective } from '../../../shared/directives/trap-focus.directive';

// Interface for cached calculations
interface BudgetRow {
  id: number;
  date: string;
  tag: string;
  amount: number;
  actual: number;
  diff: number;
}

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, InfoBudgetComponent],
  templateUrl: './plan.component.html',
  styleUrls: ['./plan.component.css', '../../../app.component.css', '../../../shared/styles/table.css'],
  changeDetection: ChangeDetectionStrategy.OnPush // Enable OnPush for better performance
})
export class PlanComponent {
  public get appReference() { return AppComponent; }
  public classReference = PlanComponent;
  public settingsReference = SettingsComponent;
  private static instance: PlanComponent;

  static isOptions = false;
  static zIndex = 0;

  static isSelectMonth = false;
  static selectedMonthYear = ""
  static selectedCopyDate = ""
  static selectedMonthCategories = []

  private _liveAnnouncer = inject(LiveAnnouncer);
  private toastService = inject(ToastService);
  displayedColumns: string[] = ['id', 'category', 'plan', 'actual', 'diff'];
  static dataSource = new MatTableDataSource<BudgetRow>([]);
  static zeroPlanDataSource = new MatTableDataSource<BudgetRow>([]);

  // Cache for performance
  private actualsCache: Map<string, number> = new Map();
  private selectedYearMonth: { year: number; month: number } = { year: 0, month: 0 };
  
  // Pre-computed values
  budgetAmount: number = 0;
  othersActuals: number = 0;
  hasOthers: boolean = false;

  constructor(
    private router: Router, 
    private localStorage: LocalService, 
    private database: DatabaseService, 
    public afAuth: AngularFireAuth,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) { 
    PlanComponent.instance = this;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    PlanComponent.selectedMonthYear = `${year}-${month}`;
    PlanComponent.selectedCopyDate = `${year}-${month}`;
    
    this.updateSelectedMonth();
    this.rebuildDataSources();
  }

  static refreshDataSources() {
    if (PlanComponent.instance) {
      PlanComponent.instance.rebuildDataSources();
    }
  }

  /**
   * Parse selected month once and cache it
   */
  private updateSelectedMonth(): void {
    const [yearStr, monthStr] = PlanComponent.selectedMonthYear.split('-');
    this.selectedYearMonth = {
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10) - 1
    };
  }

  /**
   * Calculate actuals for the selected month excluding Income and Mojo accounts
   */
  private calculateActualsForSelectedMonth(): number {
    const { year, month } = this.selectedYearMonth;
    let totalActuals = 0;

    for (const tx of AppStateService.instance.allTransactions) {
      const txDate = new Date(tx.date);
      if (
        txDate.getFullYear() === year && 
        txDate.getMonth() === month &&
        tx.account !== "Income" && 
        tx.account !== "Mojo" &&
        tx.amount < 0
      ) {
        totalActuals += Number(tx.amount) || 0;
      }
    }

    return totalActuals;
  }

  /**
   * Build actuals cache for the selected month
   * This runs once per month change instead of multiple times per row
   */
  private buildActualsCache(): void {
    this.actualsCache.clear();
    const { year, month } = this.selectedYearMonth;

    // Get active categories for the selected month
    const activeCategories = new Set<string>();
    for (const budget of AppStateService.instance.allBudgets) {
      const [budgetYear, budgetMonth] = budget.date.split('-').map(Number);
      if (budgetYear === year && (budgetMonth - 1) === month) {
        activeCategories.add(budget.tag);
      }
    }

    // Calculate actuals per category
    const categoryTotals = new Map<string, number>();
    let othersTotal = 0;

    for (const tx of AppStateService.instance.allTransactions) {
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === year && txDate.getMonth() === month) {
        const amount = Number(tx.amount) || 0;
        
        // Update category total
        const currentTotal = categoryTotals.get(tx.category) || 0;
        categoryTotals.set(tx.category, currentTotal + amount);

        // Update others total if not in active categories and not Income
        if (!activeCategories.has(tx.category) && tx.account !== "Income") {
          othersTotal += amount;
        }
      }
    }

    // Store in cache
    for (const [category, total] of categoryTotals) {
      this.actualsCache.set(category, total);
    }

    // Calculate @others actuals (including transactions with @others category)
    let othersWithCategory = othersTotal;
    for (const tx of AppStateService.instance.allTransactions) {
      const txDate = new Date(tx.date);
      if (
        txDate.getFullYear() === year && 
        txDate.getMonth() === month &&
        tx.category === "@others"
      ) {
        othersWithCategory += Number(tx.amount) || 0;
      }
    }
    
    this.actualsCache.set('@others', othersWithCategory);
    this.othersActuals = othersTotal;
  }

  /**
   * Get actuals from cache - O(1) instead of O(n)
   */
  getActualsCached(tag: string): number {
    return this.actualsCache.get(tag) || 0;
  }

  /**
   * Rebuild both data sources with pre-calculated values
   */
  private rebuildDataSources(): void {
    this.buildActualsCache();
    
    const { year, month } = this.selectedYearMonth;
    
    // Filter budgets for selected month and calculate all values at once
    const monthBudgets: BudgetRow[] = [];
    let totalBudget = 0;
    let hasOthersTag = false;

    for (let i = 0; i < AppStateService.instance.allBudgets.length; i++) {
      const budget = AppStateService.instance.allBudgets[i];
      const [budgetYear, budgetMonth] = budget.date.split('-').map(Number);
      
      if (budgetYear === year && (budgetMonth - 1) === month) {
        const actual = this.getActualsCached(budget.tag);
        const amount = Number(budget.amount) || 0;
        
        monthBudgets.push({
          id: i,
          date: budget.date,
          tag: budget.tag,
          amount: amount,
          actual: actual,
          diff: amount + actual
        });
        
        totalBudget += amount;
        
        if (budget.tag === "@others") {
          hasOthersTag = true;
        }
      }
    }

    this.budgetAmount = totalBudget;
    this.hasOthers = hasOthersTag;

    // Update main data source
    PlanComponent.dataSource.data = monthBudgets;

    // Build zero-plan data source
    this.buildZeroPlanDataSource(monthBudgets);
    
    // Trigger change detection
    this.cdr.markForCheck();
  }

  /**
   * Build zero-plan data source (optimized)
   */
  private buildZeroPlanDataSource(monthBudgets: BudgetRow[]): void {
    const { year, month } = this.selectedYearMonth;
    
    // Get planned categories (as a Set for O(1) lookup)
    const plannedCategories = new Set(monthBudgets.map(b => b.tag));

    // Get transaction categories for the month (excluding Income & Mojo)
    const transactionCategories = new Set<string>();
    for (const tx of AppStateService.instance.allTransactions) {
      const txDate = new Date(tx.date);
      if (
        txDate.getFullYear() === year &&
        txDate.getMonth() === month &&
        tx.account !== "Income" &&
        tx.account !== "Mojo"
      ) {
        transactionCategories.add(tx.category);
      }
    }

    // Find unplanned categories
    const zeroPlanBudgets: BudgetRow[] = [];
    let index = 0;
    
    for (const cat of transactionCategories) {
      if (!plannedCategories.has(cat) && cat !== "@others") {
        const actual = this.getActualsCached(cat);
        zeroPlanBudgets.push({
          id: index++,
          date: PlanComponent.selectedMonthYear,
          tag: cat,
          amount: 0,
          actual: actual,
          diff: actual
        });
      }
    }

    PlanComponent.zeroPlanDataSource.data = zeroPlanBudgets;
  }

  /**
   * Optimized method to check if a budget row is for the selected month
   * Uses cached year/month instead of parsing every time
   */
  isSelectedOptimized(row: BudgetRow): boolean {
    // Since we're filtering data sources, all rows are already selected
    // This method is kept for backwards compatibility but always returns true
    return true;
  }

  // Keep original methods but call optimized versions
  populateZeroPlanDataSource() {
    this.updateSelectedMonth();
    this.rebuildDataSources();
  }

  getBudgetAmount(): number {
    return this.budgetAmount;
  }

  getActualsLeftAmount(): number {
    return this.budgetAmount + this.calculateActualsForSelectedMonth();
  }

  getOthersActuals(): number {
    return this.othersActuals;
  }

  hasOthersTag(): boolean {
    return this.hasOthers;
  }

  getActuals(tag: string): number {
    return this.getActualsCached(tag);
  }

  isSelected(date: string): boolean {
    // Since we filter data at the source level, this always returns true
    return true;
  }

  goToPreviousMonth() {
    const [yearStr, monthStr] = PlanComponent.selectedMonthYear.split('-');
    const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    date.setMonth(date.getMonth() - 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    PlanComponent.selectedMonthYear = `${newYear}-${newMonth}`;
    this.populateZeroPlanDataSource();
  }

  goToNextMonth() {
    const [yearStr, monthStr] = PlanComponent.selectedMonthYear.split('-');
    const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    date.setMonth(date.getMonth() + 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    PlanComponent.selectedMonthYear = `${newYear}-${newMonth}`;
    this.populateZeroPlanDataSource();
  }

  @ViewChild('confirmationDialog') confirmationDialog!: ElementRef;
  showConfirmation: boolean = false;

  openConfirmation(): void {
    this.showConfirmation = true;
  }

  closeConfirmation(confirm: boolean): void {
    this.showConfirmation = false;

    if (confirm) {
      this.delete();
    } else {
      this.closeWindow();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      this.onSwipeLeft();
    } else if (event.key === 'ArrowRight') {
      this.onSwipeRight();
    }
  }

  @HostListener('swipeleft', ['$event'])
  onSwipeLeftEvent(event: any) {
    this.onSwipeLeft();
  }

  @HostListener('swiperight', ['$event'])
  onSwipeRightEvent(event: any) {
    this.onSwipeRight();
  }

  onSwipeLeft() {
    this.goToPreviousMonth();
  }

  onSwipeRight() {
    this.goToNextMonth();
  }

  closeWindow() {
    PlanComponent.isOptions = false;
    PlanComponent.zIndex = 0;
  }

  fill() {
    const [yearStr, monthStr] = PlanComponent.selectedMonthYear.split('-');
    let currentYear = parseInt(yearStr, 10);
    let currentMonth = parseInt(monthStr, 10);

    let lastBudgetDate: string | null = null;
    let lastYear = currentYear;
    let lastMonth = currentMonth;

    for (let i = 1; i <= 120; i++) {
      let checkMonth = currentMonth - i;
      let checkYear = currentYear;
      while (checkMonth <= 0) {
        checkMonth += 12;
        checkYear -= 1;
      }
      const checkMonthStr = String(checkMonth).padStart(2, '0');
      const checkDateStr = `${checkYear}-${checkMonthStr}`;
      const found = AppStateService.instance.allBudgets.some(b => b.date === checkDateStr);
      if (found) {
        lastBudgetDate = checkDateStr;
        lastYear = checkYear;
        lastMonth = checkMonth;
        break;
      }
    }

    if (!lastBudgetDate) return;

    while (lastYear < currentYear || (lastYear === currentYear && lastMonth < currentMonth)) {
      let nextMonth = lastMonth + 1;
      let nextYear = lastYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const nextMonthStr = String(nextMonth).padStart(2, '0');
      const nextDateStr = `${nextYear}-${nextMonthStr}`;

      const prevBudgets = AppStateService.instance.allBudgets.filter(b => b.date === lastBudgetDate);

      for (const prevBudget of prevBudgets) {
        const exists = AppStateService.instance.allBudgets.some(
          b => b.date === nextDateStr && b.tag === prevBudget.tag
        );
        if (!exists) {
          AppStateService.instance.allBudgets.push({
            ...prevBudget,
            date: nextDateStr
          });
        }
      }

      lastBudgetDate = nextDateStr;
      lastYear = nextYear;
      lastMonth = nextMonth;
    }

    this.updateStorage();
    this.toastService.show('Budget filled', 'update');
  }

  copy() {
    const copyDate = PlanComponent.selectedCopyDate;
    if (!copyDate) return;

    const budgetsToCopy = AppStateService.instance.allBudgets.filter(b => b.date === copyDate);
    const targetDate = PlanComponent.selectedMonthYear;

    for (const budget of budgetsToCopy) {
      const existingIndex = AppStateService.instance.allBudgets.findIndex(
        b => b.date === targetDate && b.tag === budget.tag
      );
      if (existingIndex === -1) {
        AppStateService.instance.allBudgets.push({
          ...budget,
          date: targetDate
        });
      } else {
        if (AppStateService.instance.allBudgets[existingIndex].amount !== budget.amount) {
          AppStateService.instance.allBudgets[existingIndex].amount = budget.amount;
        }
      }
    }

    this.updateStorage();
    this.toastService.show('Budget copied', 'update');
  }

  subscriptions() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthlyCategoryAmounts: { [date: string]: { [category: string]: number } } = {};

    for (const sub of AppStateService.instance.allSubscriptions) {
      if (sub.account === "Income") continue;

      const [subYearStr, subMonthStr, subDayStr] = sub.startDate.split('-');
      let subYear = parseInt(subYearStr, 10);
      let subMonth = parseInt(subMonthStr, 10);
      let subDay = subDayStr ? parseInt(subDayStr, 10) : 1;

      let endYear = currentYear;
      let endMonth = currentMonth;
      let endDay = 1;
      if (sub.endDate) {
        const [endYearStr, endMonthStr, endDayStr] = sub.endDate.split('-');
        endYear = parseInt(endYearStr, 10);
        endMonth = parseInt(endMonthStr, 10);
        endDay = endDayStr ? parseInt(endDayStr, 10) : 1;
      }

      while (
        subYear < endYear ||
        (subYear === endYear && subMonth <= endMonth)
      ) {
        const budgetDate = `${subYear}-${String(subMonth).padStart(2, '0')}`;
        let shouldAdd = true;

        if (
          subYear === endYear &&
          subMonth === endMonth &&
          sub.endDate &&
          endDay > subDay
        ) {
          const hasTransaction = AppStateService.instance.allTransactions.some(tx => {
            const txDate = new Date(tx.date);
            return (
              tx.category === sub.category &&
              txDate.getFullYear() === endYear &&
              txDate.getMonth() + 1 === endMonth
            );
          });
          shouldAdd = hasTransaction;
        } else if (subYear === endYear && subMonth === endMonth && sub.endDate && endDay <= subDay) {
          shouldAdd = false;
        }

        if (shouldAdd) {
          if (!monthlyCategoryAmounts[budgetDate]) {
            monthlyCategoryAmounts[budgetDate] = {};
          }
          if (!monthlyCategoryAmounts[budgetDate][sub.category]) {
            monthlyCategoryAmounts[budgetDate][sub.category] = 0;
          }
          monthlyCategoryAmounts[budgetDate][sub.category] += Math.abs(sub.amount);
        }

        subMonth++;
        if (subMonth > 12) {
          subMonth = 1;
          subYear++;
        }
        if (subYear > endYear || (subYear === endYear && subMonth > endMonth)) {
          break;
        }
      }
    }

    for (const date in monthlyCategoryAmounts) {
      for (const category in monthlyCategoryAmounts[date]) {
        const totalAmount = monthlyCategoryAmounts[date][category];
        const existingIndex = AppStateService.instance.allBudgets.findIndex(
          b => b.date === date && b.tag === category
        );
        if (existingIndex === -1) {
          AppStateService.instance.allBudgets.push({
            date,
            tag: category,
            amount: totalAmount
          });
        } else {
          AppStateService.instance.allBudgets[existingIndex].amount = totalAmount;
        }
      }
    }

    this.updateStorage();
    this.toastService.show('Subscriptions imported', 'update');
  }

  delete() {
    const { year, month } = this.selectedYearMonth;
    const selectedYear = year;
    const selectedMonth = month + 1;

    AppStateService.instance.allBudgets = AppStateService.instance.allBudgets.filter(budget => {
      const [budgetYear, budgetMonth] = budget.date.split('-').map(Number);
      return !(budgetYear === selectedYear && budgetMonth === selectedMonth);
    });

    this.updateStorage();
    this.toastService.show('Budget deleted', 'delete');
  }

  async updateStorage() {
    // Check authentication using the centralized service
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      console.error("Authentication failed:", authResult.error);
      if (this.authService.getMode() === 'firebase') {
        this.afAuth.signOut();
      }
      return;
    }

    // User is authenticated
    this.rebuildDataSources();

    let isError = false;
    try {
      // In selfhosted mode, writeObject returns Observables that need to be subscribed
      if (environment.mode === 'selfhosted') {
        const budgetWrite = this.database.writeObject("budget", AppStateService.instance.allBudgets) as Observable<any>;
        budgetWrite.subscribe({
          next: () => {
            this.finalizeSave();
          },
          error: (error) => {
            isError = true;
          }
        });
      } else {
        // Firebase mode - writes complete synchronously
        this.database.writeObject("budget", AppStateService.instance.allBudgets);
        this.finalizeSave();
      }

    } catch (error) {
      isError = true;
    }
  }

  finalizeSave() {
    this.localStorage.saveData("budget", JSON.stringify(AppStateService.instance.allBudgets));
    this.closeWindow();
  }

  highlight() {
    PlanComponent.zIndex = PlanComponent.zIndex + 1;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
    InfoSmileComponent.zIndex = 0;
  }

  clickOptions() {
    AppComponent.gotoTop();
    PlanComponent.isOptions = !PlanComponent.isOptions;
    PlanComponent.zIndex = 1;
    InfoComponent.isInfo = false;
    AddComponent.isAdd = false;
  }

  addBudget() {
    AddBudgetComponent.populateCategoryOptions();
    AddBudgetComponent.categoryTextField = "@";
    AddBudgetComponent.dateTextField = PlanComponent.selectedMonthYear;
    AddBudgetComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  goToBudget() {
    this.router.navigate(['/budget']);
    AppComponent.gotoTop();
  }

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('otherSort') zeroPlanSort!: MatSort;
  
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    PlanComponent.dataSource.filter = filterValue.trim().toLowerCase();
    PlanComponent.zeroPlanDataSource.filter = filterValue.trim().toLowerCase();
  }

  applyCustomSorting(dataSource: MatTableDataSource<any>) {
    dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'id':
          return item.id;
        case 'category':
          return item.tag.toLowerCase();
        case 'plan':
          return item.amount;
        case 'actual':
          return item.actual; // Use pre-calculated value
        case 'diff':
          return item.diff; // Use pre-calculated value
        default:
          return item[property];
      }
    };
  }

  ngAfterViewInit() {
    if (this.sort) {
      setTimeout(() => {
        PlanComponent.dataSource.sort = this.sort;
        this.sort.active = 'id';
        this.sort.direction = 'asc';

        this.zeroPlanSort.active = 'id';
        PlanComponent.zeroPlanDataSource.sort = this.zeroPlanSort;
        this.zeroPlanSort.direction = 'asc';

        setTimeout(() => {
          this.sort.sortChange.emit();
          this.zeroPlanSort.sortChange.emit();
        });
      });
    } else {
      console.warn('MatSort is not initialized yet.');
    }
  }

  ngOnInit() { 
    this.applyCustomSorting(PlanComponent.dataSource);
    this.applyCustomSorting(PlanComponent.zeroPlanDataSource);
  }
  
  announceSortChange(sortState: any) {
    if (sortState && sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }
  
  clickRow(index: number) {
    AppComponent.gotoTop();
    InfoBudgetComponent.setInfoComponent(
      index,
      AppStateService.instance.allBudgets[index].date,
      AppStateService.instance.allBudgets[index].tag,
      AppStateService.instance.allBudgets[index].amount
    );
  }

  clickOtherRow(tag: string, amount: number) {
    AppComponent.gotoTop();
    AddBudgetComponent.populateCategoryOptions();
    AddBudgetComponent.categoryTextField = tag;
    AddBudgetComponent.dateTextField = PlanComponent.selectedMonthYear;
    AddBudgetComponent.amountTextField = String(amount * -1);
    AddBudgetComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  selectedDate: Date = new Date();
  onMonthYearChange(event: any) {
    if (event && event.value) {
      this.selectedDate = event.value;
      const year = this.selectedDate.getFullYear();
      const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
      PlanComponent.selectedMonthYear = `${year}-${month}`;
      this.populateZeroPlanDataSource();
    }
  }

  selectMonth() {
    this.populateZeroPlanDataSource();
  }
}
