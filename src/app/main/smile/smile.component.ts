import { Router } from '@angular/router';
import { AppComponent } from 'src/app/app.component';
import { HomeComponent } from '../home/home.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { StatsComponent } from 'src/app/stats/stats.component';
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
 * Represents the SmileComponent class.
 */
@Component({
  selector: 'app-smile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, RouterModule, SharedFilterComponent],
  templateUrl: './smile.component.html',
  styleUrls: ['./smile.component.css', '../../app.component.css', '../../shared/styles/table.css']
})
export class SmileComponent extends BaseAccountComponent {

  static smileAmount = AppStateService.instance.getAmount("Smile", AppStateService.instance.smile/100);

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
  static allowedAccounts = ['Smile', 'Income'];
  static d: Date;
  static startDateTextField: string;
  static endDateTextField: string;

  public classReference = SmileComponent;
  
  /**
   * Creates an instance of SmileComponent.
   * @param router - The router service.
   * @param filterService - The transaction filter service.
   */
  constructor(router: Router, filterService: TransactionFilterService) {
    super(router, filterService);
    SmileComponent.smileAmount = AppStateService.instance.getAmount("Smile", AppStateService.instance.smile/100);
    this.initAccount(SmileComponent);
  }

  static updateDailyAmount() {
    SmileComponent.smileAmount = AppStateService.instance.getAmount("Smile", AppStateService.instance.smile / 100);
  }

  addTransaction() {
    AppComponent.addTransaction("Smile", "@", "smile");
  }

  static setDate() {
    SmileComponent.d = new Date();
    SmileComponent.startDateTextField = "";
    SmileComponent.endDateTextField = SmileComponent.d.getFullYear() + "-" + SmileComponent.zeroPadded(SmileComponent.d.getMonth() + 1) + "-" + SmileComponent.zeroPadded(SmileComponent.d.getDate());
    SmileComponent.advancedFilter.startDate = "";
    SmileComponent.advancedFilter.endDate = SmileComponent.endDateTextField;
  }

  static zeroPadded(val: number): string {
    return val >= 10 ? String(val) : '0' + val;
  }

  goToSmileProjects() {
    this.router.navigate(['/smileprojects'])
  }

  goToSmileStats() {
    StatsComponent.resetBIStateIfNeeded("smile");
    StatsComponent.modus = "smile";
    MenuComponent.openStats = !MenuComponent.openStats;
    StatsComponent.isSwitch = true;
    this.router.navigate(['/stats']);
    AppComponent.gotoTop();
  }
}
