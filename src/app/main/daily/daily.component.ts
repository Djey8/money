import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { Router } from '@angular/router';
import { Component } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { TransactionFilterService } from 'src/app/shared/services/transaction-filter.service';
import { BaseAccountComponent } from 'src/app/shared/base/base-account.component';
import { AppStateService } from '../../shared/services/app-state.service';
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


// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let HomeComponent: any; setTimeout(() => import('../home/home.component').then(m => HomeComponent = m.HomeComponent));
let StatsComponent: any; setTimeout(() => import('src/app/stats/stats.component').then(m => StatsComponent = m.StatsComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
/**
 * Represents the DailyComponent class.
 */
@Component({
  selector: 'app-daily',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, SharedFilterComponent],
  templateUrl: './daily.component.html',
  styleUrls: ['./daily.component.css', '../../app.component.css', '../../shared/styles/table.css']
})
export class DailyComponent extends BaseAccountComponent {

  static dailyAmount = AppStateService.instance.getAmount("Daily", AppStateService.instance.daily / 100);

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
  static allowedAccounts = ['Daily', 'Income'];
  static d: Date;
  static startDateTextField: string;
  static endDateTextField: string;

  public classReference = DailyComponent;

  /**
   * Constructs a new DailyComponent.
   * @param router - The router service.
   * @param filterService - The transaction filter service.
   */
  constructor(router: Router, filterService: TransactionFilterService) {
    super(router, filterService);
    DailyComponent.dailyAmount = AppStateService.instance.getAmount("Daily", AppStateService.instance.daily / 100);
    this.initAccount(DailyComponent);
  }

  

  /**
   * Updates the dailyAmount value.
   */
  static updateDailyAmount() {
    DailyComponent.dailyAmount = AppStateService.instance.getAmount("Daily", AppStateService.instance.daily / 100);
  }

  addTransaction() {
    AppComponent.addTransaction("Daily", "@", "daily");
  }

  static setDate() {
    DailyComponent.d = new Date();
    DailyComponent.startDateTextField = "";
    DailyComponent.endDateTextField = DailyComponent.d.getFullYear() + "-" + DailyComponent.zeroPadded(DailyComponent.d.getMonth() + 1) + "-" + DailyComponent.zeroPadded(DailyComponent.d.getDate());
    DailyComponent.advancedFilter.startDate = "";
    DailyComponent.advancedFilter.endDate = DailyComponent.endDateTextField;
  }

  static zeroPadded(val: number): string {
    return val >= 10 ? String(val) : '0' + val;
  }

  goToDailyStats() {
    StatsComponent.resetBIStateIfNeeded("daily");
    StatsComponent.modus = "daily";
    MenuComponent.openStats = true;
    StatsComponent.isSwitch = true;
    this.router.navigate(['/stats']);
    AppComponent.gotoTop();
  }
}
