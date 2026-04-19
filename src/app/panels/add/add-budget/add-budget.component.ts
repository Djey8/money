import { Component } from '@angular/core';
import { ProfileComponent } from '../../profile/profile.component';
import { MenuComponent } from '../../menu/menu.component';
import { InfoComponent } from '../../info/info.component';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { Router } from '@angular/router';
import { SmileProjectsComponent } from 'src/app/main/smile/smile-projects/smile-projects.component';
import { LocalService } from 'src/app/shared/services/local.service';
import { FireEmergenciesComponent } from 'src/app/main/fire/fire-emergencies/fire-emergencies.component';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { FireComponent } from 'src/app/main/fire/fire.component';
import { IncomeComponent } from 'src/app/main/cashflow/income/income.component';
import { BalanceComponent } from 'src/app/main/cashflow/balance/balance.component';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { SettingsComponent } from '../../settings/settings.component';
import { GrowComponent } from 'src/app/main/grow/grow.component';
import { BudgetComponent } from 'src/app/main/budget/budget.component';
import { PlanComponent } from 'src/app/main/budget/plan/plan.component';
import { AuthService } from 'src/app/shared/services/auth.service';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

@Component({
  selector: 'app-add-budget',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-budget.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-budget.component.css']
})
export class AddBudgetComponent extends BaseAddComponent {
  static amountTextField = "";
  static categoryTextField = "@";
  static dateTextField = "";
  
  showCategoryOptions = false;

  static url = "/plan";
  static zIndex;
  static isAdd;
  static isError;
  public classReference = AddBudgetComponent;
  public settingsReference = SettingsComponent;

  /**
   * Constructs a new instance of the AddComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param afAuth - The AngularFireAuth service.
   * @param authService - The centralized authentication service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private localStorage: LocalService, private database: DatabaseService, public afAuth: AngularFireAuth, private authService: AuthService, private frontendLogger: FrontendLoggerService) {
    super(router);
    AddBudgetComponent.isAdd = false;
    this.initStatic(AddBudgetComponent);
  }

  
  static categoryOptions = [
    { value: '@Food', label: 'Food' },
    { value: '@Transport', label: 'Transport' },
    { value: '@Entertainment', label: 'Entertainment' },
    // Add more options as needed
  ];

  
  ngOnInit() {
    AddBudgetComponent.populateCategoryOptions();
  }

  ngAfterViewInit() {
    // Add any additional logic you want to execute when the component is visible
  }


  static populateCategoryOptions() {
    const categories = new Set<string>();
    if (!Array.isArray(AppStateService.instance.allTransactions)) {
      AppStateService.instance.allTransactions = [];
    }
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

    AddBudgetComponent.categoryOptions = Array.from(categories).map(category => ({
      value: category,
      label: category.replace('@', '')
    }));
  }

  selectedCategory() {
    const selectedCategory = AddBudgetComponent.categoryTextField;

    // Map to store total per month for the selected category
    const monthTotals = new Map<string, number>();

    if (Array.isArray(AppStateService.instance.allTransactions)) {
      for (const tx of AppStateService.instance.allTransactions) {
        if (tx.category === selectedCategory && tx.date) {
          // Extract year-month as key
          const [txYear, txMonth] = tx.date.split('-');
          const key = `${txYear}-${txMonth}`;
          const amount = Number(tx.amount) || 0;
          monthTotals.set(key, (monthTotals.get(key) || 0) + amount);
        }
      }
    }

    // Calculate average over all months where this category is present
    const total = Array.from(monthTotals.values()).reduce((sum, val) => sum + Math.abs(val), 0);
    const count = monthTotals.size;
    const average = count > 0 ? total / count : 0;

    const roundedAverage = Math.ceil(average);
    AddBudgetComponent.amountTextField = String(roundedAverage);
  }

  toggleCategoryOptions() {
    this.showCategoryOptions = !this.showCategoryOptions;
  }
  

  highlight() {
    AddBudgetComponent.zIndex = AddBudgetComponent.zIndex + 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
  }

  override closeWindow() {
    AddBudgetComponent.isAdd = false;
    AddBudgetComponent.amountTextField = "";
    AddBudgetComponent.categoryTextField = "@";
    super.closeWindow();
  }

  async addBudget() {
    this.clearError();

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
    //Validation (check if Amount is not empty)
    if (!this.validateRequired([
      { name: 'category', value: AddBudgetComponent.categoryTextField === '@' ? '' : AddBudgetComponent.categoryTextField, label: 'Category' },
      { name: 'date', value: AddBudgetComponent.dateTextField, label: 'Date' }
    ])) {
      // field errors shown inline
    } else {
          
          const date = AddBudgetComponent.dateTextField;
          const tag = AddBudgetComponent.categoryTextField;
          const amount = Math.abs(isNaN(parseFloat(AddBudgetComponent.amountTextField)) ? 0 : parseFloat(AddBudgetComponent.amountTextField));

          // Find if a budget for the same month and category already exists
          let existingBudget = AppStateService.instance.allBudgets.find(
            (b: any) => b.date === AddBudgetComponent.dateTextField && b.tag === tag
          );

          if (existingBudget) {
            // Update the amount
            existingBudget.amount = amount;
          } else {
            // Create new budget entry
            let newBudget = {
              date,
              tag,
              amount
            }
            AppStateService.instance.allBudgets.push(newBudget);
          }
          PlanComponent.refreshDataSources();

          // Clean Up close Window
          AddBudgetComponent.dateTextField = "";
          AddBudgetComponent.amountTextField = "";
          AddBudgetComponent.categoryTextField = "@";
          this.clearError();
          this.closeWindow();
          AppStateService.instance.isSaving = true;


      try {
        //WRITE to Storage
        // In selfhosted mode, writeObject returns Observables that need to be subscribed
        if (environment.mode === 'selfhosted') {
          const budgetWrite = this.database.writeObject("budget", AppStateService.instance.allBudgets) as Observable<any>;
          budgetWrite.subscribe({
            next: () => {
              // Log user activity
              this.frontendLogger.logActivity('add_budget', 'info', {
                category: AddBudgetComponent.categoryTextField,
                amount: AddBudgetComponent.amountTextField,
                date: AddBudgetComponent.dateTextField
              });
              this.finalizeAddBudget();
            },
            error: (error) => {
              AppStateService.instance.isSaving = false;
              this.toastService.show(error.message || 'Database write failed', 'error');
            }
          });
        } else {
          // Log user activity
          this.frontendLogger.logActivity('add_budget', 'info', {
            category: AddBudgetComponent.categoryTextField,
            amount: AddBudgetComponent.amountTextField,
            date: AddBudgetComponent.dateTextField
          });
          this.database.writeObject("budget", AppStateService.instance.allBudgets);
          // Firebase mode - writes complete synchronously
          this.finalizeAddBudget();
        }

      } catch (error) {
        AppStateService.instance.isSaving = false;
        this.toastService.show(error.message || 'Database write failed', 'error');
      }
    }
  }

  finalizeAddBudget() {
    if (!AddBudgetComponent.isError) {
      this.showCategoryOptions = false;
      this.localStorage.saveData("budget", JSON.stringify(AppStateService.instance.allBudgets));
      AppStateService.instance.isSaving = false;
      this.toastService.show('Budget added', 'success');
      gotoTop();
      this.router.navigate([AddBudgetComponent.url]);
    }
  }
}
