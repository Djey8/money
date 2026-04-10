import { AppComponent } from 'src/app/app.component';
import { HomeComponent } from '../home/home.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { StatsComponent } from 'src/app/stats/stats.component';
import { Router } from '@angular/router';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
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

/**
 * Represents the SplurgeComponent class.
 */
@Component({
  selector: 'app-splurge',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, SharedFilterComponent],
  templateUrl: './splurge.component.html',
  styleUrls: ['./splurge.component.css', '../../app.component.css', '../../shared/styles/table.css']
})
export class SplurgeComponent extends BaseAccountComponent {
  
  static splurgeAmount = AppStateService.instance.getAmount("Splurge", AppStateService.instance.splurge/100);

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
  static allowedAccounts = ['Splurge', 'Income'];
  static d: Date;
  static startDateTextField: string;
  static endDateTextField: string;
  
  public classReference = SplurgeComponent;

  /**
   * Creates an instance of SplurgeComponent.
   * @param router - The router service.
   * @param filterService - The transaction filter service.
   */
  constructor(router: Router, filterService: TransactionFilterService) {
    super(router, filterService);
    SplurgeComponent.splurgeAmount = AppStateService.instance.getAmount("Splurge", AppStateService.instance.splurge/100);
    this.initAccount(SplurgeComponent);
  }

  /**
   * Updates the dailyAmount value.
   */
  static updateDailyAmount() {
    SplurgeComponent.splurgeAmount = AppStateService.instance.getAmount("Splurge", AppStateService.instance.daily / 100);
  }

  addTransaction() {
    AppComponent.addTransaction("Splurge", "@", "splurge");
  }

  static setDate() {
    SplurgeComponent.d = new Date();
    SplurgeComponent.startDateTextField = "";
    SplurgeComponent.endDateTextField = SplurgeComponent.d.getFullYear() + "-" + SplurgeComponent.zeroPadded(SplurgeComponent.d.getMonth() + 1) + "-" + SplurgeComponent.zeroPadded(SplurgeComponent.d.getDate());
    SplurgeComponent.advancedFilter.startDate = "";
    SplurgeComponent.advancedFilter.endDate = SplurgeComponent.endDateTextField;
  }

  static zeroPadded(val: number): string {
    return val >= 10 ? String(val) : '0' + val;
  }

  goToSplurgeStats() {
    StatsComponent.resetBIStateIfNeeded("splurge");
    StatsComponent.modus = "splurge";
    MenuComponent.openStats = !MenuComponent.openStats;
    StatsComponent.isSwitch = true;
    this.router.navigate(['/stats']);
    AppComponent.gotoTop();
  }
}
