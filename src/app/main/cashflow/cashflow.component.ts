import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppComponent } from 'src/app/app.component';
import { IncomeComponent } from './income/income.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { StatsComponent } from 'src/app/stats/stats.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { SharedFilterComponent } from 'src/app/shared/components/shared-filter/shared-filter.component';


@Component({
  selector: 'app-cashflow',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDatePipe, AppNumberPipe, SharedFilterComponent],
  templateUrl: './cashflow.component.html',
  styleUrls: ['./cashflow.component.css', '../../app.component.css']
})
export class CashflowComponent {

  public get appReference() { return AppComponent; }
  public incomeReference = IncomeComponent;
  public classReference = CashflowComponent;
  public settingsReference = SettingsComponent;
  
  /**
   * Creates an instance of the CashflowComponent.
   * @param {Router} router - The router service used for navigation.
   */
  constructor(private router:Router){ 
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

  goToBalance() {
    this.router.navigate(['/balance']);
    AppComponent.gotoTop();
  }

  goToIncome() {
    this.router.navigate(['/income']);
    AppComponent.gotoTop();
  }

  goToStats(){
    this.router.navigate(['/stats']);
    StatsComponent.resetBIStateIfNeeded("cashflow");
    StatsComponent.modus = "cashflow"
    StatsComponent.period = "month";
    MenuComponent.openStats = true;
    AppComponent.gotoTop();
  }

  applyDateFilter() {
    IncomeComponent.applyFilters();
  }

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

}
