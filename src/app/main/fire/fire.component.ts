import { Router } from '@angular/router';
import { InfoFireComponent } from 'src/app/panels/info/info-fire/info-fire.component';
import { LocalService } from 'src/app/shared/services/local.service';
import { Component } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { TransactionFilterService } from 'src/app/shared/services/transaction-filter.service';
import { BaseAccountComponent } from 'src/app/shared/base/base-account.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { SharedFilterComponent } from 'src/app/shared/components/shared-filter/shared-filter.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';


/**
 * Represents the FireComponent class.
 */

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let HomeComponent: any; setTimeout(() => import('../home/home.component').then(m => HomeComponent = m.HomeComponent));
let StatsComponent: any; setTimeout(() => import('src/app/stats/stats.component').then(m => StatsComponent = m.StatsComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
@Component({
  selector: 'app-fire',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, SharedFilterComponent, InfoFireComponent],
  templateUrl: './fire.component.html',
  styleUrls: ['./fire.component.css', '../../app.component.css', '../../shared/styles/table.css']
})
export class FireComponent extends BaseAccountComponent {

  static fireAmount: number;
  

  static dataSource = new MatTableDataSource<any>([]);

  static isSearched = false;
  static allTransactions = []
  static allSearchedTransactions = []

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
  static availableAccounts: string[] = [];
  static availableTags: string[] = [];
  static allowedAccounts = ['Fire', 'Income'];
  static d: Date;
  static startDateTextField: string;
  static endDateTextField: string;

  static get mojo() { return AppStateService.instance.mojo; }
  static set mojo(v: any) { AppStateService.instance.mojo = v; }

  public classReference = FireComponent;
  /**
   * Constructs a new FireComponent.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param filterService - The transaction filter service.
   */
  constructor(router: Router, private localStorage: LocalService, filterService: TransactionFilterService) {
    super(router, filterService);
    AppStateService.instance.mojo = this.localStorage.getData("mojo")=="" ? {target: 2000.0, amount: 0} : JSON.parse(this.localStorage.getData("mojo"));
    FireComponent.fireAmount = AppStateService.instance.getAmount("Fire", AppStateService.instance.fire/100);
    this.initAccount(FireComponent);
  }

  static updateDailyAmount() {
    FireComponent.fireAmount = AppStateService.instance.getAmount("Fire", AppStateService.instance.fire / 100);
  }

  override ngOnInit() {
    super.ngOnInit();
    FireComponent.fireAmount = AppStateService.instance.getAmount("Fire", AppStateService.instance.fire / 100);
  }

  getAverageMonthlyExpenses(): number {
    // Parse transactions and group by month
    const transactions = AppStateService.instance.allTransactions.map(t => ({
      date: new Date(t.date),
      month: `${new Date(t.date).getFullYear()}-${(new Date(t.date).getMonth() + 1).toString().padStart(2, '0')}`,
      amount: Number(t.amount),
      account: t.account,
      category: t.category || "Other"
    }));

    // Group by month and sum expenses (exclude "Income" account)
    const monthExpenseMap = new Map<string, number>();
    transactions.forEach((t: any) => {
      if (t.account !== "Income") {
        if (!monthExpenseMap.has(t.month)) {
          monthExpenseMap.set(t.month, 0);
        }
        monthExpenseMap.set(t.month, monthExpenseMap.get(t.month)! + t.amount);
      }
    });

    // Remove current month
    const now = new Date();
    const filteredMonthlyExpenses: [string, number][] = Array.from(monthExpenseMap.entries()).filter(([month]) => {
      const [year, mon] = month.split('-').map(Number);
      return !(year === now.getFullYear() && mon === now.getMonth() + 1);
    });

    if (filteredMonthlyExpenses.length === 0) return 0;

    // Calculate average
    const total = filteredMonthlyExpenses.reduce((sum: number, [, expense]) => sum + expense, 0);
    return total / filteredMonthlyExpenses.length;
  }

  getEmergencyCoverage(): number {
    const start = this.getStartOfLastMonth();
    const end = this.getEndOfLastMonth();

    const avgMonthExpenses = this.getAverageMonthlyExpenses() * -1

    return this.classReference.mojo.amount / (avgMonthExpenses || 1);
  }

  getCoverageColor(ratio: number): string {
    if (ratio <= 1) return 'red';
    if (ratio <= 2) return 'orange';
    if (ratio < 3) return 'lightgreen';
    return 'green';
  }

  getStartOfLastMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  getEndOfLastMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0);
  }

  generateGaugePath(ratio: number): string {
    const clampedRatio = Math.min(ratio, 3); // Cap to 3x
    const angle = (clampedRatio / 3) * Math.PI; // 0 to π radians
    const x = 50 + 40 * Math.cos(Math.PI - angle);
    const y = 50 - 40 * Math.sin(Math.PI - angle);
    return `M 10 50 A 40 40 0 0 1 ${x} ${y}`;
  }

  calculateNeedleX(ratio: number): number {
    const clampedRatio = Math.min(ratio, 3);
    const angle = (clampedRatio / 3) * Math.PI;
    return 50 + 40 * Math.cos(Math.PI - angle);
  }

  calculateNeedleY(ratio: number): number {
    const clampedRatio = Math.min(ratio, 3);
    const angle = (clampedRatio / 3) * Math.PI;
    return 50 - 40 * Math.sin(Math.PI - angle);
  }

  addTransaction() {
    AppComponent.addTransaction("Fire", "@", "fire");
  }

  static setDate() {
    FireComponent.d = new Date();
    FireComponent.startDateTextField = "";
    FireComponent.endDateTextField = FireComponent.d.getFullYear() + "-" + FireComponent.zeroPadded(FireComponent.d.getMonth() + 1) + "-" + FireComponent.zeroPadded(FireComponent.d.getDate());
    FireComponent.advancedFilter.startDate = "";
    FireComponent.advancedFilter.endDate = FireComponent.endDateTextField;
  }

  static zeroPadded(val: number): string {
    return val >= 10 ? String(val) : '0' + val;
  }

  clickMojo(){
    // TODO: Mojo info panel needs separate component - Fire panel is now bucket-based
    console.log('Mojo click - needs dedicated info panel');
  }

  /**
   * Adds a transaction to the mojo.
   */
  addToMojo() {
    AppComponent.addTransaction("Fire", "@Mojo", "fire");
  }

  goToFireProjects(){
    this.router.navigate(['/fireemergencies']);
  }

  /**
   * Navigates to the Fire Stats page.
   */
  goToFireStats() {
    StatsComponent.resetBIStateIfNeeded("fire");
    StatsComponent.modus = "fire";
    MenuComponent.openStats = !MenuComponent.openStats;
    StatsComponent.isSwitch = true;
    this.router.navigate(['/stats']);
    AppComponent.gotoTop();
  }
}
