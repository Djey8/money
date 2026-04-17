import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Subscription } from 'src/app/interfaces/subscription';
import { MatTableDataSource } from '@angular/material/table';
import { AuthService } from 'src/app/shared/services/auth.service';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { migrateSmileArray } from 'src/app/shared/smile-migration.utils';
import { migrateFireArray } from 'src/app/shared/fire-migration.utils';


// Deferred imports — resolved after module init to break circular chains
let ProfileComponent: any; setTimeout(() => import('../../profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('../../menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let InfoComponent: any; setTimeout(() => import('../../info/info.component').then(m => InfoComponent = m.InfoComponent));
let SmileProjectsComponent: any; setTimeout(() => import('src/app/main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('src/app/main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let FireComponent: any; setTimeout(() => import('src/app/main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let IncomeComponent: any; setTimeout(() => import('src/app/main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let BalanceComponent: any; setTimeout(() => import('src/app/main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let SubscriptionComponent: any; setTimeout(() => import('src/app/main/subscription/subscription.component').then(m => SubscriptionComponent = m.SubscriptionComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-add-subscription',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-subscription.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-subscription.component.css']
})

export class AddSubscriptionComponent extends BaseAddComponent {
  static titleTextField = "Spotify"
  static selectedOption = "Daily";
  static amountTextField = "";
  d = new Date();
  startDateTextField = this.d.getFullYear() + "-" + this.zeroPadded(this.d.getMonth() + 1) + "-" + this.zeroPadded(this.d.getDate());
  endDateTextField = "";
  static categoryTextField = "@";
  static commentTextField = "";
  static frequencyField = "monthly";  // Default frequency for new subscriptions

  static url = "/subscription";
  static zIndex;
  static isAdd;
  static isError;
  public classReference = AddSubscriptionComponent;


  /**
   * Constructs a new instance of the AddComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param authService - The centralized authentication service.
   * @param afAuth - The AngularFireAuth service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private localStorage: LocalService, public afAuth: AngularFireAuth, private authService: AuthService, private frontendLogger: FrontendLoggerService, private persistence: PersistenceService) {
    super(router);
    AddSubscriptionComponent.isAdd = false;
    this.initStatic(AddSubscriptionComponent);
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
      categories.add(AppStateService.instance.allTransactions[i].category);
    }

    this.categoryOptions = Array.from(categories).map(category => ({
      value: category,
      label: category.replace('@', '')
    }));
  }

  toggleCategoryOptions() {
    this.showCategoryOptions = !this.showCategoryOptions;
  }

  highlight() {
    AddSubscriptionComponent.zIndex = AddSubscriptionComponent.zIndex + 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
  }

  override closeWindow() {
    AddSubscriptionComponent.isAdd = false;
    AddSubscriptionComponent.amountTextField = "";
    AddSubscriptionComponent.commentTextField = "";
    AddSubscriptionComponent.categoryTextField = "@";
    super.closeWindow();
  }

  async addSubscription() {
    this.errorTextLable = "";
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
    //update from local Storage
    AppStateService.instance.allRevenues = this.localStorage.getData("revenues") == "" ? [] : JSON.parse(this.localStorage.getData("revenues"));
    AppStateService.instance.allIntrests = this.localStorage.getData("interests") == "" ? [] : JSON.parse(this.localStorage.getData("interests"));
    AppStateService.instance.allProperties = this.localStorage.getData("properties") == "" ? [] : JSON.parse(this.localStorage.getData("properties"));

    AppStateService.instance.dailyExpenses = this.localStorage.getData("dailyEx") == "" ? [] : JSON.parse(this.localStorage.getData("dailyEx"));
    AppStateService.instance.splurgeExpenses = this.localStorage.getData("splurgeEx") == "" ? [] : JSON.parse(this.localStorage.getData("splurgeEx"));
    AppStateService.instance.smileExpenses = this.localStorage.getData("smileEx") == "" ? [] : JSON.parse(this.localStorage.getData("smileEx"));
    AppStateService.instance.fireExpenses = this.localStorage.getData("fireEx") == "" ? [] : JSON.parse(this.localStorage.getData("fireEx"));
    AppStateService.instance.mojoExpenses = this.localStorage.getData("mojoEx") == "" ? [] : JSON.parse(this.localStorage.getData("mojoEx"));

    AppStateService.instance.allAssets = this.localStorage.getData("assets") == "" ? [] : JSON.parse(this.localStorage.getData("assets"));
    AppStateService.instance.allShares = this.localStorage.getData("shares") == "" ? [] : JSON.parse(this.localStorage.getData("shares"));
    AppStateService.instance.allInvestments = this.localStorage.getData("investments") == "" ? [] : JSON.parse(this.localStorage.getData("investments"));
    AppStateService.instance.liabilities = this.localStorage.getData("liabilities") == "" ? [] : JSON.parse(this.localStorage.getData("liabilities"));
    
    AppStateService.instance.allSmileProjects = this.localStorage.getData("smile") == "" ? [] : migrateSmileArray(JSON.parse(this.localStorage.getData("smile")));
    AppStateService.instance.allFireEmergencies = this.localStorage.getData("fire") == "" ? [] : migrateFireArray(JSON.parse(this.localStorage.getData("fire")));

    //Validation (check if Amount is not empty)
    if (!this.validateRequired([
      { name: 'account', value: AddSubscriptionComponent.selectedOption, label: 'Account' },
      { name: 'amount', value: AddSubscriptionComponent.amountTextField, label: 'Amount' },
      { name: 'category', value: AddSubscriptionComponent.categoryTextField === '@' ? '' : AddSubscriptionComponent.categoryTextField, label: 'Category' }
    ])) {
      // field errors shown inline
    } else {

      // ready to writek to Database new Transaction
      let newSubscritpion: Subscription = { 
        title: AddSubscriptionComponent.titleTextField, 
        account: AddSubscriptionComponent.selectedOption, 
        amount: parseFloat(AddSubscriptionComponent.amountTextField), 
        startDate: this.startDateTextField, 
        endDate: this.endDateTextField, 
        category: AddSubscriptionComponent.categoryTextField, 
        comment: AddSubscriptionComponent.commentTextField,
        frequency: AddSubscriptionComponent.frequencyField as any,
        changeHistory: []
      }
      
      // Log the add subscription activity
      this.frontendLogger.logDataOperation('add', 'subscription', undefined, {
        title: newSubscritpion.title,
        account: newSubscritpion.account,
        amount: newSubscritpion.amount,
        category: newSubscritpion.category,
        startDate: newSubscritpion.startDate
      });
      
      AppStateService.instance.allSubscriptions.push(newSubscritpion);
      SubscriptionComponent.allSubscriptions = AppStateService.instance.allSubscriptions;
      SubscriptionComponent.activeDataSource.data = SubscriptionComponent.allSubscriptions;
      SubscriptionComponent.activeDataSource.data = SubscriptionComponent.activeDataSource.data.map((subscription, index) => {
        return { ...subscription, id: index };
      });
      SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.allSubscriptions;
      SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.inactiveDataSource.data.map((subscription, index) => {
        return { ...subscription, id: index };
      });
      // Clean Up close Window
      this.startDateTextField = this.d.getFullYear() + "-" + this.zeroPadded(this.d.getMonth() + 1) + "-" + this.zeroPadded(this.d.getDate());
      this.endDateTextField = "";
      AddSubscriptionComponent.selectedOption = "Daily";
      AddSubscriptionComponent.amountTextField = "";
      AddSubscriptionComponent.commentTextField = "";
      AddSubscriptionComponent.categoryTextField = "@";
      this.clearError();
      this.persistence.batchWriteAndSync({
        writes: [
          { tag: "income/revenue/interests", data: AppStateService.instance.allIntrests },
          { tag: "income/revenue/properties", data: AppStateService.instance.allProperties },
          { tag: "income/revenue/revenues", data: AppStateService.instance.allRevenues },
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { tag: "balance/liabilities", data: AppStateService.instance.liabilities }
          ] : []),
          { tag: "income/expenses/daily", data: AppStateService.instance.dailyExpenses },
          { tag: "income/expenses/splurge", data: AppStateService.instance.splurgeExpenses },
          { tag: "income/expenses/smile", data: AppStateService.instance.smileExpenses },
          { tag: "income/expenses/fire", data: AppStateService.instance.fireExpenses },
          { tag: "income/expenses/mojo", data: AppStateService.instance.mojoExpenses },
          ...(AppStateService.instance.tier2Loaded ? [
            { tag: "smile", data: AppStateService.instance.allSmileProjects },
            { tag: "fire", data: AppStateService.instance.allFireEmergencies },
            { tag: "mojo", data: AppStateService.instance.mojo }
          ] : []),
          { tag: "transactions", data: AppStateService.instance.allTransactions },
          { tag: "subscriptions", data: AppStateService.instance.allSubscriptions }
        ],
        localStorageSaves: [
          { key: "interests", data: JSON.stringify(AppStateService.instance.allIntrests) },
          { key: "properties", data: JSON.stringify(AppStateService.instance.allProperties) },
          { key: "revenues", data: JSON.stringify(AppStateService.instance.allRevenues) },
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) }
          ] : []),
          { key: "dailyEx", data: JSON.stringify(AppStateService.instance.dailyExpenses) },
          { key: "splurgeEx", data: JSON.stringify(AppStateService.instance.splurgeExpenses) },
          { key: "smileEx", data: JSON.stringify(AppStateService.instance.smileExpenses) },
          { key: "fireEx", data: JSON.stringify(AppStateService.instance.fireExpenses) },
          { key: "mojoEx", data: JSON.stringify(AppStateService.instance.mojoExpenses) },
          ...(AppStateService.instance.tier2Loaded ? [
            { key: "smile", data: JSON.stringify(AppStateService.instance.allSmileProjects) },
            { key: "fire", data: JSON.stringify(AppStateService.instance.allFireEmergencies) },
            { key: "mojo", data: JSON.stringify(AppStateService.instance.mojo) }
          ] : []),
          { key: "transactions", data: JSON.stringify(AppStateService.instance.allTransactions) },
          { key: "subscriptions", data: JSON.stringify(AppStateService.instance.allSubscriptions) }
        ],
        logEvent: 'add_subscription',
        logMetadata: {
          title: AddSubscriptionComponent.titleTextField,
          account: AddSubscriptionComponent.selectedOption,
          category: AddSubscriptionComponent.categoryTextField,
          amount: AddSubscriptionComponent.amountTextField
        },
        onSuccess: () => {
          this.closeWindow();
          this.toastService.show('Subscription added', 'success');
          AppComponent.gotoTop();
          this.router.navigate([AddSubscriptionComponent.url]);
        },
        onError: (error) => {
          this.showError(error);
        }
      });
    }
  }

}
