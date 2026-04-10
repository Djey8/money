import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { Expense } from 'src/app/interfaces/expense';
import { Revenue } from 'src/app/interfaces/revenue';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Share } from 'src/app/interfaces/share';
import { Asset } from 'src/app/interfaces/asset';
import { Liability } from 'src/app/interfaces/liability';
import { Investment } from 'src/app/interfaces/investment';
import { AuthService } from 'src/app/shared/services/auth.service';
import { forkJoin, of, Observable } from 'rxjs';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { environment } from 'src/environments/environment';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { SettingsComponent } from '../../settings/settings.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let AccountingComponent: any; setTimeout(() => import('../../../main/accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let SmileProjectsComponent: any; setTimeout(() => import('../../../main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('../../../main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let FireComponent: any; setTimeout(() => import('../../../main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let IncomeComponent: any; setTimeout(() => import('../../../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let BalanceComponent: any; setTimeout(() => import('../../../main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let GrowComponent: any; setTimeout(() => import('../../../main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let DailyComponent: any; setTimeout(() => import('../../../main/daily/daily.component').then(m => DailyComponent = m.DailyComponent));
let BudgetComponent: any; setTimeout(() => import('../../../main/budget/budget.component').then(m => BudgetComponent = m.BudgetComponent));
let PlanComponent: any; setTimeout(() => import('../../../main/budget/plan/plan.component').then(m => PlanComponent = m.PlanComponent));
let ProfileComponent: any; setTimeout(() => import('../../profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('../../menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('../../add/add.component').then(m => AddComponent = m.AddComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-info-budget',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-budget.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-budget.component.css']
})
export class InfoBudgetComponent extends BaseInfoComponent {

  // Static properties
  static index = 1;
  static date = "2025-10";
  static tag = "car";
  static amount = 145.3;


  settingsReference = SettingsComponent

  static setInfoComponent(id: number, date: string, tag: string, amount: number) {
    InfoBudgetComponent.index = id;
    InfoBudgetComponent.date = date;
    InfoBudgetComponent.tag = tag;
    InfoBudgetComponent.amount = amount;
    InfoBudgetComponent.isInfo = true;
  }

  dateTextField = InfoBudgetComponent.date;
  categoryTextField = InfoBudgetComponent.tag;
  amountTextField = InfoBudgetComponent.amount;

  // Static properties
  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoBudgetComponent;

  constructor(router: Router, private localStorage: LocalService, private database: DatabaseService, private afAuth: AngularFireAuth, private authService: AuthService, private frontendLogger: FrontendLoggerService) {
    super(router);
    this.initStatic(InfoBudgetComponent);
  }

  getDate(){
    const [year, month] = this.dateTextField.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  showCategoryOptions = false;
  categoryOptions = [
    { value: '@Food', label: 'Food' },
    { value: '@Transport', label: 'Transport' },
    { value: '@Entertainment', label: 'Entertainment' },
    // Add more options as needed
  ];

  ngOnInit() {
    this.populateCategoryOptions();
  }

  populateCategoryOptions() {
    const categories = new Set<string>();
    for (let i = AppStateService.instance.allTransactions.length - 1; i >= 0; i--) {
      if(AppStateService.instance.allTransactions[i].account != "Income"){
        categories.add(AppStateService.instance.allTransactions[i].category);
      }
    }

    for(let i = 0; i < AppStateService.instance.allBudgets.length; i++){
      const date = AppStateService.instance.allBudgets[i].date
      const tag = AppStateService.instance.allBudgets[i].tag

      let selectedDate = PlanComponent.selectedMonthYear
      ? `${PlanComponent.selectedMonthYear.split(' ')[1]}-${('0' + (new Date(`${PlanComponent.selectedMonthYear.split(' ')[0]} 1`).getMonth() + 1)).slice(-2)}`
      : '';
      if (date === selectedDate) {
        categories.delete(tag);
      }
    }

    this.categoryOptions = Array.from(categories).map(category => ({
      value: category,
      label: category.replace('@', '')
    }));
  }

  selectedCategory(){
    const selectedCategory = this.categoryTextField;
    const [selectedYear, selectedMonth] = this.dateTextField.split('-').map(Number);

    // Calculate previous month and year
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    // Sum amounts for the selected category in the previous month
    let totalAmount = 0;
    if (Array.isArray(AppStateService.instance.allTransactions)) {
      for (const tx of AppStateService.instance.allTransactions) {
        if (tx.category === selectedCategory && tx.date) {
          const [txYear, txMonth] = tx.date.split('-').map(Number);
          if (txYear === prevYear && txMonth === prevMonth) {
            totalAmount += Number(tx.amount) || 0;
          }
        }
      }
    }
    totalAmount = Math.abs(totalAmount);
    this.amountTextField = totalAmount;
  }

  toggleCategoryOptions() {
    this.showCategoryOptions = !this.showCategoryOptions;
  }

  /**
   * Highlights the InfoComponent.
   */
  highlight() {
    InfoBudgetComponent.zIndex = InfoBudgetComponent.zIndex + 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
  }

  goLeft() {
    InfoBudgetComponent.index = InfoBudgetComponent.index - 1;
    if (InfoBudgetComponent.index < 0) {
      InfoBudgetComponent.index = AppStateService.instance.allBudgets.length - 1;
    }
    this.update(InfoBudgetComponent.index);
  }

  goRight() {
    InfoBudgetComponent.index = InfoBudgetComponent.index + 1;
    if (InfoBudgetComponent.index >= AppStateService.instance.allBudgets.length) {
      InfoBudgetComponent.index = 0;
    }
    this.update(InfoBudgetComponent.index);
  }

  update(index: number) {
    const budget = AppStateService.instance.allBudgets[index];
    InfoBudgetComponent.date = budget.date;
    InfoBudgetComponent.tag = budget.tag;
    InfoBudgetComponent.amount = budget.amount;
  }

  /**
   * Closes the InfoComponent window.
   */
  override closeWindow() {
    super.closeWindow();
  }

  /**
   * Copies the transaction.
   */
  copyBudget() {
    AppComponent.gotoTop();
    AppComponent.copyBudget(InfoBudgetComponent.date, InfoBudgetComponent.tag, InfoBudgetComponent.amount)
  }

  /**
   * Edits the transaction.
   */
  editBudget() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoBudgetComponent.isError = false;
    this.dateTextField = InfoBudgetComponent.date;
    this.categoryTextField = InfoBudgetComponent.tag;
    this.amountTextField = InfoBudgetComponent.amount;
  }

  /**
   * Handles the click event on the image.
   */
  clickImage() {
  }

  /**
   * Updates the transaction with the new values.
   */
  updateBudget() {
    // Validation (check if Amount is not empty)
    if (this.categoryTextField === "" || this.categoryTextField === "@" || this.dateTextField === "") {
      this.showError("Please fill out all required fields.");
    } else {

      // Update budget values
      AppStateService.instance.allBudgets[InfoBudgetComponent.index].date = this.dateTextField;
      AppStateService.instance.allBudgets[InfoBudgetComponent.index].tag = this.categoryTextField;
      AppStateService.instance.allBudgets[InfoBudgetComponent.index].amount = Math.abs(this.amountTextField);
      PlanComponent.refreshDataSources();

      // Update InfoComponent values
      InfoBudgetComponent.date = this.dateTextField;
      InfoBudgetComponent.tag = this.categoryTextField;
      InfoBudgetComponent.amount = this.amountTextField;

      // Log user activity
      this.frontendLogger.logActivity('update_budget', 'info', {
        category: this.categoryTextField,
        amount: this.amountTextField,
        date: this.dateTextField
      });

      // Write to DB
      this.updateStorage();

      // Clean Up close Window
      this.clearError();
      this.isEdit = false;
      this.toastService.show('Budget updated', 'update');
      AppComponent.gotoTop();
    }
  }

  /**
   * Deletes a transaction at the specified index.
   * @param index - The index of the transaction to be deleted.
   */
  deleteBudget(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteBudget'), () => {
      // Save data before deleting
      const deletedTag = AppStateService.instance.allBudgets[index].tag;
      
      // Delete now Transaction
      AppStateService.instance.allBudgets.splice(index, 1);
      PlanComponent.refreshDataSources();
      InfoBudgetComponent.isInfo = false;
      
      // Log user activity
      this.frontendLogger.logActivity('delete_budget', 'info', {
        category: deletedTag,
        index: index
      });
      
      // WRITE to Storage
      this.updateStorage();
      this.toastService.show('Budget deleted', 'delete');
      this.isEdit = false;
    });
  }


  async updateStorage() {
    // Check authentication using the centralized service
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      this.showError(authResult.error || "Session expired. Please log in again.");
      if (this.authService.getMode() === 'firebase') {
        this.afAuth.signOut();
      }
      return;
    }

    // User is authenticated
    try {
      // WRITE to Storage
      // In selfhosted mode, writeObject returns Observables that need to be subscribed
      if (environment.mode === 'selfhosted') {
        const budgetWrite = this.database.writeObject("budget", AppStateService.instance.allBudgets) as Observable<any>;
        budgetWrite.subscribe({
          next: () => {
            InfoBudgetComponent.isInfo = false;
            InfoBudgetComponent.isError = false;
            this.localStorage.saveData("budget", JSON.stringify(AppStateService.instance.allBudgets));
          },
          error: (error) => {
            this.showError(error);
          }
        });
      } else {
        // Firebase mode - writes complete synchronously
        this.database.writeObject("budget", AppStateService.instance.allBudgets);
        InfoBudgetComponent.isInfo = false;
        InfoBudgetComponent.isError = false;
        this.localStorage.saveData("budget", JSON.stringify(AppStateService.instance.allBudgets));
      }

    } catch (error) {
      this.showError(error);
    }
  }
}
