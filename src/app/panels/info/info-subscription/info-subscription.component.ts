import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import {MatTableDataSource} from '@angular/material/table';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { environment } from 'src/environments/environment';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { IncomeStatementService } from 'src/app/shared/services/income-statement.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let SmileProjectsComponent: any; setTimeout(() => import('../../../main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('../../../main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let FireComponent: any; setTimeout(() => import('../../../main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let IncomeComponent: any; setTimeout(() => import('../../../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let BalanceComponent: any; setTimeout(() => import('../../../main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let SubscriptionComponent: any; setTimeout(() => import('../../../main/subscription/subscription.component').then(m => SubscriptionComponent = m.SubscriptionComponent));
let AccountingComponent: any; setTimeout(() => import('../../../main/accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let ProfileComponent: any; setTimeout(() => import('../../profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('../../menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('../../add/add.component').then(m => AddComponent = m.AddComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-info-subscription',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe],
  templateUrl: './info-subscription.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-subscription.component.css']
})
export class InfoSubscriptionComponent extends BaseInfoComponent {

  // Static properties
  static index = 1;
  static title = "Spotify";
  static img = "daily";
  static account = "Daily";
  static amount = -5.99;
  static startDate = "2024-09-01";
  static endDate = "";
  static category = "entertainment";
  static comment = "";
  static frequency = "monthly";  // Default frequency
  static frequencyField = "monthly";  // Instance-accessible frequency field
  static isRefresh = false;

  /**
   * Sets the values of the InfoComponent properties.
   * @param id - The ID of the component.
   * @param title - The title of the subcritpion
   * @param account - The account name.
   * @param amount - The subcritpion amount.
   * @param startDate - The subcritpion start date.
   * @param endDate - The subcritpion end time.
   * @param category - The subcritpion category.
   * @param comment - The subcritpion comment.
   */
  static setInfoSubscriptionComponent(id: number, title: string, account: string, amount: number, startDate: string, endDate: string, category: string, comment: string, frequency: string) {
    InfoSubscriptionComponent.index = id;
    InfoSubscriptionComponent.title = title;
    InfoSubscriptionComponent.img = account.toLowerCase();
    InfoSubscriptionComponent.account = account;
    InfoSubscriptionComponent.amount = amount;
    InfoSubscriptionComponent.startDate = startDate;
    InfoSubscriptionComponent.endDate = endDate;
    InfoSubscriptionComponent.category = category;
    InfoSubscriptionComponent.comment = comment;
    InfoSubscriptionComponent.frequency = frequency;
    InfoSubscriptionComponent.frequencyField = frequency;
    InfoSubscriptionComponent.isInfo = true;
  }

  selectedOption = InfoSubscriptionComponent.account;
  titleTextField = InfoSubscriptionComponent.title;
  amountTextField = InfoSubscriptionComponent.amount;
  startDateTextField = InfoSubscriptionComponent.startDate;
  endDateTextField = InfoSubscriptionComponent.endDate;
  categoryTextField = InfoSubscriptionComponent.category;
  commentTextField = InfoSubscriptionComponent.comment;
  frequencyField = InfoSubscriptionComponent.frequency;

  // Static properties
  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoSubscriptionComponent;

  constructor(router: Router, private localStorage: LocalService, private database: DatabaseService, private frontendLogger: FrontendLoggerService, private incomeStatement: IncomeStatementService) {
    super(router);
    this.initStatic(InfoSubscriptionComponent);
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
    // if (this.showCategoryOptions) {
    //   if (this.categoryOptions.length > 0 ) {
    //     AddComponent.categoryTextField = this.categoryOptions[0].value;
    //   }
    // }
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
   * Highlights the InfoComponent.
   */
  highlight() {
    InfoSubscriptionComponent.zIndex = InfoSubscriptionComponent.zIndex + 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
  }

  goLeft() {
    InfoSubscriptionComponent.index = InfoSubscriptionComponent.index - 1;
    if (InfoSubscriptionComponent.index < 0) {
      InfoSubscriptionComponent.index = AppStateService.instance.allSubscriptions.length - 1;
    }
    this.update(InfoSubscriptionComponent.index);
  }

  goRight() {
    InfoSubscriptionComponent.index = InfoSubscriptionComponent.index + 1;
    if (InfoSubscriptionComponent.index >= AppStateService.instance.allSubscriptions.length) {
      InfoSubscriptionComponent.index = 0;
    }
    this.update(InfoSubscriptionComponent.index);
  }

  update(index: number) {
    const subscription = AppStateService.instance.allSubscriptions[index];
    InfoSubscriptionComponent.title = subscription.title;
    InfoSubscriptionComponent.img = subscription.account.toLocaleLowerCase();
    InfoSubscriptionComponent.account = subscription.account;
    InfoSubscriptionComponent.amount = subscription.amount;
    InfoSubscriptionComponent.startDate = subscription.startDate;
    InfoSubscriptionComponent.endDate = subscription.endDate;
    InfoSubscriptionComponent.category = subscription.category;
    InfoSubscriptionComponent.comment = subscription.comment;
    InfoSubscriptionComponent.frequency = subscription.frequency || 'monthly';
    InfoSubscriptionComponent.frequencyField = subscription.frequency || 'monthly';
    this.frequencyField = InfoSubscriptionComponent.frequency;
  }

  /**
   * Copies the subscription.
   */
  copySubscription() {
    AppComponent.gotoTop();
    AppComponent.copySubcription(InfoSubscriptionComponent.title, InfoSubscriptionComponent.account, InfoSubscriptionComponent.amount, `${InfoSubscriptionComponent.category}`, InfoSubscriptionComponent.comment, "subcription");
  }

  /**
   * Edits the subscription.
   */
  editSubscription() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoSubscriptionComponent.isError = false;
    this.selectedOption = InfoSubscriptionComponent.account;
    this.titleTextField = InfoSubscriptionComponent.title;
    this.amountTextField = InfoSubscriptionComponent.amount;
    this.startDateTextField = InfoSubscriptionComponent.startDate;
    this.endDateTextField = InfoSubscriptionComponent.endDate;
    this.categoryTextField = InfoSubscriptionComponent.category;
    this.commentTextField = InfoSubscriptionComponent.comment;
    this.frequencyField = InfoSubscriptionComponent.frequency;
  }

  /**
   * Handles the click event on the image.
   */
  clickImage() {
  }


  /**
   * Updates the subscription with the new values.
   */
  updateSubscription() {
    // Validation (check if Amount is not empty)
    if (!this.amountTextField || this.categoryTextField === "" || this.categoryTextField === "@" || this.selectedOption === "") {
      this.showError("Please fill out all required fields.");
    } else {
      // Update existing subscription (PATCH)
      if (
        this.titleTextField !== InfoSubscriptionComponent.title ||
        this.categoryTextField !== InfoSubscriptionComponent.category ||
        this.amountTextField !== InfoSubscriptionComponent.amount ||
        this.selectedOption !== InfoSubscriptionComponent.account ||
        this.commentTextField !== InfoSubscriptionComponent.comment ||
        this.startDateTextField !== InfoSubscriptionComponent.startDate ||
        this.frequencyField !== InfoSubscriptionComponent.frequency ||
        InfoSubscriptionComponent.isRefresh
      ) {
        this.deleteTransactions(InfoSubscriptionComponent.index);
      }

      // Update transaction values
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].title = this.titleTextField;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].account = this.selectedOption;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount = this.amountTextField;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].startDate = this.startDateTextField;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].endDate = this.endDateTextField;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].category = this.categoryTextField;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].comment = this.commentTextField;
      AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].frequency = this.frequencyField as any;

      SubscriptionComponent.allSubscriptions = AppStateService.instance.allSubscriptions;
      SubscriptionComponent.activeDataSource.data = SubscriptionComponent.allSubscriptions;
      SubscriptionComponent.activeDataSource.data = SubscriptionComponent.activeDataSource.data.map((subscription, index) => {
        return { ...subscription, id: index };
      });
      SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.allSubscriptions;
      SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.inactiveDataSource.data.map((subscription, index) => {
        return { ...subscription, id: index };
      });
      // Update InfoComponent values
      InfoSubscriptionComponent.title = this.titleTextField;
      InfoSubscriptionComponent.img = this.selectedOption.toLocaleLowerCase();
      InfoSubscriptionComponent.account = this.selectedOption;
      InfoSubscriptionComponent.amount = this.amountTextField;
      InfoSubscriptionComponent.startDate = this.startDateTextField;
      InfoSubscriptionComponent.endDate = this.endDateTextField;
      InfoSubscriptionComponent.category = this.categoryTextField;
      InfoSubscriptionComponent.comment = this.commentTextField;
      InfoSubscriptionComponent.frequency = this.frequencyField;
      InfoSubscriptionComponent.frequencyField = this.frequencyField;

      // Log user activity
      this.frontendLogger.logActivity('update_subscription', 'info', {
        title: this.titleTextField,
        account: this.selectedOption,
        category: this.categoryTextField,
        amount: this.amountTextField
      });

      // Write to DB
      this.updateStorage();

      // Clean Up close Window
      this.clearError();
      this.isEdit = false;
      this.toastService.show('Subscription updated', 'update');
      AppComponent.gotoTop();
    }
  }

  /**
   * Updates the liabilities with the new amount based on the category.
   * @param category - The category of the transaction.
   */
  updateLiabilities(category: String) {
    for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.liabilities[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.liabilities[i].amount += this.amountTextField - SubscriptionComponent.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }

  /**
   * Deletes a transaction at the specified index.
   * @param index - The index of the transaction to be deleted.
   */
  deleteTransaction(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteTransaction'), () => {
      // Delete now Subscription
      AppStateService.instance.allSubscriptions.splice(index, 1);
      SubscriptionComponent.allSubscriptions = AppStateService.instance.allSubscriptions;

      // Recalculate income statement from remaining transactions
      this.incomeStatement.recalculate();

      // WRITE to Storage
      this.updateStorage();
      this.toastService.show('Subscription deleted', 'delete');
    });
  }

  /**
   * Removes the liabilities based on the category.
   * @param category - The category of the transaction.
   */
  removeFromLiabiltities(category: string) {
    for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.liabilities[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.liabilities[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }

  removeFromSmileProject(category: string) {
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allSmileProjects[i].title.toLocaleLowerCase())) {
        const project = AppStateService.instance.allSmileProjects[i];
        const amount = AppStateService.instance.allSubscriptions[i].amount;
        // Distribute removal equally across all buckets
        if (project.buckets?.length > 0) {
          const amountPerBucket = amount / project.buckets.length;
          project.buckets.forEach(bucket => { 
            bucket.amount = Math.round((bucket.amount + amountPerBucket) * 100) / 100; 
          });
        }
      }
    }
  }

  removeFromFireEmergencie(category: string) {
    // Fire emergency amounts are recalculated automatically by incomeStatement.recalculate()
    // No manual updates needed - bucket amounts are computed from transactions
  }


  /**
   * Deletes a transaction at the specified index.
   * @param index - The index of the transaction to be deleted.
   */
  deleteSubscription(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteSubscription'), () => {
      let deletedTransactionsCount = 0;
      
      // Save data before deleting
      const deletedTitle = AppStateService.instance.allSubscriptions[index].title;
      
      // Only delete transactions if checkbox is ticked
      if (InfoSubscriptionComponent.isRefresh) {
      const account = AppStateService.instance.allSubscriptions[index].account;
      const amount = AppStateService.instance.allSubscriptions[index].amount;
      const category = AppStateService.instance.allSubscriptions[index].category;

      const initialLength = AppStateService.instance.allTransactions.length;
      AppStateService.instance.allTransactions = AppStateService.instance.allTransactions.filter(transaction => {
        return !(transaction.account === account && transaction.amount === amount && transaction.category === category);
      });
      deletedTransactionsCount = initialLength - AppStateService.instance.allTransactions.length;
      
      // Log mass deletion of transactions
      if (deletedTransactionsCount > 0) {
        this.frontendLogger.logActivity('mass_delete_transactions', 'warning', {
          subscriptionTitle: deletedTitle,
          account: account,
          category: category,
          amount: amount,
          transactionsDeleted: deletedTransactionsCount,
          reason: 'subscription_removal'
        });
      }

      // Recalculate income statement from remaining transactions
      if (deletedTransactionsCount > 0) {
        this.incomeStatement.recalculate();
      }
    }
    
    // Delete Subscription
    AppStateService.instance.allSubscriptions.splice(index, 1);
    SubscriptionComponent.allSubscriptions = AppStateService.instance.allSubscriptions;
    SubscriptionComponent.activeDataSource.data = SubscriptionComponent.allSubscriptions;
    SubscriptionComponent.activeDataSource.data = SubscriptionComponent.activeDataSource.data.map((subscription, index) => {
      return { ...subscription, id: index };
    });
    SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.allSubscriptions;
    SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.inactiveDataSource.data.map((subscription, index) => {
      return { ...subscription, id: index };
    });
    
    // Log user activity
    this.frontendLogger.logActivity('delete_subscription', 'info', {
      title: deletedTitle,
      index: index
    });
    
    // WRITE to Storage
    this.updateStorage();
    this.toastService.show('Subscription deleted', 'delete');
    this.isEdit = false;
    });
  }

  /**
   * Deletes a transaction at the specified index.
   * @param index - The index of the transaction to be deleted.
   */
  deleteTransactions(index: number) {
    let deletedTransactionsCount = 0;
    
    // Delete Transactions
    const account = AppStateService.instance.allSubscriptions[index].account;
    const amount = AppStateService.instance.allSubscriptions[index].amount;
    const category = AppStateService.instance.allSubscriptions[index].category;

    const initialLength = AppStateService.instance.allTransactions.length;
    AppStateService.instance.allTransactions = AppStateService.instance.allTransactions.filter(transaction => {
      return !(transaction.account === account && transaction.amount === amount && transaction.category === category);
    });
    deletedTransactionsCount = initialLength - AppStateService.instance.allTransactions.length;

    // Recalculate income statement from remaining transactions
    if (deletedTransactionsCount > 0) {
      this.incomeStatement.recalculate();
    }

    // WRITE to Storage
    this.updateStorage();
  }

  updateStorage() {
    try {
      // WRITE to StorageInfoComponent
      // Interests
      //write to database
      const write1 = this.database.writeObject("income/revenue/interests", AppStateService.instance.allIntrests);

      //Properties 
      //write to database
      const write2 = this.database.writeObject("income/revenue/properties", AppStateService.instance.allProperties);

      //Revenues
      //write to database
      const write3 = this.database.writeObject("income/revenue/revenues", AppStateService.instance.allRevenues);

      //Daily Expenses
      //DailyEx
      //write to database
      const write4 = this.database.writeObject("income/expenses/daily", AppStateService.instance.dailyExpenses);
      //SplurgeEx
      //write to database
      const write5 = this.database.writeObject("income/expenses/splurge", AppStateService.instance.splurgeExpenses);
      //SmileEx
      //write to database
      const write6 = this.database.writeObject("income/expenses/smile", AppStateService.instance.smileExpenses);
      //FireEx
      //write to database
      const write7 = this.database.writeObject("income/expenses/fire", AppStateService.instance.fireExpenses);
      //MojoEx
      //write to database
      const write8 = this.database.writeObject("income/expenses/mojo", AppStateService.instance.mojoExpenses);

      // Smile
      //update database
      const write9 = this.database.writeObject("smile", AppStateService.instance.allSmileProjects);

      // Fire
      //update database
      const write10 = this.database.writeObject("fire", AppStateService.instance.allFireEmergencies);

      // Mojo
      //update database
      const write11 = this.database.writeObject("mojo", AppStateService.instance.mojo);

      // Transaction      
      //update database
      const write12 = this.database.writeObject("transactions", AppStateService.instance.allTransactions);

      // Subscriptions
      // update subcritpions
      const write13 = this.database.writeObject("subscriptions", AppStateService.instance.allSubscriptions);

      //Liabilities
      const write14 = this.database.writeObject("balance/liabilities", AppStateService.instance.liabilities);

      if (environment.mode === 'selfhosted') {
        const observables = [];
        if (write1) observables.push(write1);
        if (write2) observables.push(write2);
        if (write3) observables.push(write3);
        if (write4) observables.push(write4);
        if (write5) observables.push(write5);
        if (write6) observables.push(write6);
        if (write7) observables.push(write7);
        if (write8) observables.push(write8);
        if (write9) observables.push(write9);
        if (write10) observables.push(write10);
        if (write11) observables.push(write11);
        if (write12) observables.push(write12);
        if (write13) observables.push(write13);
        if (write14) observables.push(write14);

        if (observables.length > 0) {
          let completed = 0;
          const handleComplete = () => {
            completed++;
            if (completed === observables.length) {
              InfoSubscriptionComponent.isInfo = false;
              InfoSubscriptionComponent.isError = false;
              this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests));
              this.localStorage.saveData("properties", JSON.stringify(AppStateService.instance.allProperties));
              this.localStorage.saveData("revenues", JSON.stringify(AppStateService.instance.allRevenues));
              this.localStorage.saveData("splurgeEx", JSON.stringify(AppStateService.instance.splurgeExpenses));
              this.localStorage.saveData("dailyEx", JSON.stringify(AppStateService.instance.dailyExpenses));
              this.localStorage.saveData("smileEx", JSON.stringify(AppStateService.instance.smileExpenses));
              this.localStorage.saveData("fireEx", JSON.stringify(AppStateService.instance.fireExpenses));
              this.localStorage.saveData("mojoEx", JSON.stringify(AppStateService.instance.mojoExpenses));
              //write to local Storage
              this.localStorage.saveData("smile", JSON.stringify(AppStateService.instance.allSmileProjects));
              //write to local Storage
              this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies));
              //write to local Storage
              this.localStorage.saveData("mojo", JSON.stringify(AppStateService.instance.mojo));
              //write to local Storage
              this.localStorage.saveData("transactions", JSON.stringify(AppStateService.instance.allTransactions));
              this.localStorage.saveData("subscriptions", JSON.stringify(AppStateService.instance.allSubscriptions));
              this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities));
              this.router.navigate(['/subscription']);
            }
          };

          observables.forEach(obs => {
            obs.subscribe({
              next: handleComplete,
              error: (error) => {
                this.showError(error.message || 'Database write failed');
              }
            });
          });
        }
      } else {
        // Firebase mode
        InfoSubscriptionComponent.isInfo = false;
        InfoSubscriptionComponent.isError = false;
        this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests));
        this.localStorage.saveData("properties", JSON.stringify(AppStateService.instance.allProperties));
        this.localStorage.saveData("revenues", JSON.stringify(AppStateService.instance.allRevenues));
        this.localStorage.saveData("splurgeEx", JSON.stringify(AppStateService.instance.splurgeExpenses));
        this.localStorage.saveData("dailyEx", JSON.stringify(AppStateService.instance.dailyExpenses));
        this.localStorage.saveData("smileEx", JSON.stringify(AppStateService.instance.smileExpenses));
        this.localStorage.saveData("fireEx", JSON.stringify(AppStateService.instance.fireExpenses));
        this.localStorage.saveData("mojoEx", JSON.stringify(AppStateService.instance.mojoExpenses));
        //write to local Storage
        this.localStorage.saveData("smile", JSON.stringify(AppStateService.instance.allSmileProjects));
        //write to local Storage
        this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies));
        //write to local Storage
        this.localStorage.saveData("mojo", JSON.stringify(AppStateService.instance.mojo));
        //write to local Storage
        this.localStorage.saveData("transactions", JSON.stringify(AppStateService.instance.allTransactions));
        this.localStorage.saveData("subscriptions", JSON.stringify(AppStateService.instance.allSubscriptions));
        this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities));
        this.router.navigate(['/subscription']);
      }
    } catch (error) {
      this.showError(error.message || 'Error occurred');
    }
  }

  removeFromInterests(category: string) {
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allIntrests[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      // //check if tag is emty -> delete
      // if(AppStateService.instance.allIntrests[i].amount == 0){
      //   AppStateService.instance.allIntrests.splice(i, 1);
      // }
    }
  }
  removeFromProperties(category: string) {
    for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allProperties[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      // //check if tag is emty -> delete
      // if(AppStateService.instance.allProperties[i].amount == 0){
      //   AppStateService.instance.allProperties.splice(i, 1);
      // }
    }
  }
  removeFromReveneus(category: string) {
    for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allRevenues[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      AppStateService.instance.allRevenues[i].amount = parseFloat(AppStateService.instance.allRevenues[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.allRevenues[i].amount == 0) {
        AppStateService.instance.allRevenues.splice(i, 1);
      }
    }
  }

  removeFromDailyExpenses(category: string) {
    for (let i = 0; i < AppStateService.instance.dailyExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.dailyExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.dailyExpenses[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      AppStateService.instance.dailyExpenses[i].amount = parseFloat(AppStateService.instance.dailyExpenses[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.dailyExpenses[i].amount == 0) {
        AppStateService.instance.dailyExpenses.splice(i, 1);
      }
    }
  }
  removeFromSplurgeExpenses(category: string) {
    for (let i = 0; i < AppStateService.instance.splurgeExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.splurgeExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.splurgeExpenses[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      AppStateService.instance.splurgeExpenses[i].amount = parseFloat(AppStateService.instance.splurgeExpenses[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.splurgeExpenses[i].amount == 0) {
        AppStateService.instance.splurgeExpenses.splice(i, 1);
      }
    }
  }
  removeFromSmileExpenses(category: string) {
    for (let i = 0; i < AppStateService.instance.smileExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.smileExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.smileExpenses[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      AppStateService.instance.smileExpenses[i].amount = parseFloat(AppStateService.instance.smileExpenses[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.smileExpenses[i].amount == 0) {
        AppStateService.instance.smileExpenses.splice(i, 1);
      }
    }
  }
  removeFromFireExpenses(category: string) {
    for (let i = 0; i < AppStateService.instance.fireExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.fireExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.fireExpenses[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      AppStateService.instance.fireExpenses[i].amount = parseFloat(AppStateService.instance.fireExpenses[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.fireExpenses[i].amount == 0) {
        AppStateService.instance.fireExpenses.splice(i, 1);
      }
    }
  }

  removeFromMojoExpenses(category: string) {
    for (let i = 0; i < AppStateService.instance.mojoExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.mojoExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.mojoExpenses[i].amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
      AppStateService.instance.mojoExpenses[i].amount = parseFloat(AppStateService.instance.mojoExpenses[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.mojoExpenses[i].amount == 0) {
        AppStateService.instance.mojoExpenses.splice(i, 1);
      }
    }
  }

  removeFromMojo() {
    AppStateService.instance.mojo.amount += AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
  }
  addMojo() {
    AppStateService.instance.mojo.amount -= AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
  }

  updateMojo() {
    AppStateService.instance.mojo.amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
  }

  addToMojo() {
    AppStateService.instance.mojo.amount -= this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
  }

  addToSmileProject(category: string) {
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allSmileProjects[i].title.toLocaleLowerCase())) {
        const project = AppStateService.instance.allSmileProjects[i];
        const amountDiff = this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
        // Distribute difference equally across all buckets
        if (project.buckets?.length > 0) {
          const amountPerBucket = amountDiff / project.buckets.length;
          project.buckets.forEach(bucket => { 
            bucket.amount = Math.round((bucket.amount - amountPerBucket) * 100) / 100; 
          });
        }
      }
    }
  }
  addToFireEmergencie(category: string) {
    // Fire emergency amounts are recalculated automatically by incomeStatement.recalculate()
    // No manual updates needed - bucket amounts are computed from transactions
  }

  updateInterests(category: string) {
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allIntrests[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
  updateProperties(category: string) {
    for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allProperties[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
  updateRevenues(category: string) {
    for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allRevenues[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }

  updateDailyExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.dailyExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.dailyExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.dailyExpenses[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
  updateSplurgeExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.splurgeExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.splurgeExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.splurgeExpenses[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
  updateSmileExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.smileExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.smileExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.smileExpenses[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
  updateFireExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.fireExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.fireExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.fireExpenses[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
  updateMojoExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.mojoExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.mojoExpenses[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.mojoExpenses[i].amount += this.amountTextField - AppStateService.instance.allSubscriptions[InfoSubscriptionComponent.index].amount;
      }
    }
  }
}
