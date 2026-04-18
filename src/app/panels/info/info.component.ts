import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { IncomeStatementService } from 'src/app/shared/services/income-statement.service';
import { Expense } from 'src/app/interfaces/expense';
import { Revenue } from 'src/app/interfaces/revenue';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Share } from 'src/app/interfaces/share';
import { Asset } from 'src/app/interfaces/asset';
import { Liability } from 'src/app/interfaces/liability';
import { Investment } from 'src/app/interfaces/investment';
import { AuthService } from 'src/app/shared/services/auth.service';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { SettingsComponent } from '../settings/settings.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';


/**
 * Represents the InfoComponent class.
 */

// Deferred imports — resolved after module init to break circular chains
let ProfileComponent: any; setTimeout(() => import('../profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('../menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('../add/add.component').then(m => AddComponent = m.AddComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-info',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppDatePipe, AppNumberPipe],
  templateUrl: './info.component.html',
  styleUrls: ['../../shared/styles/info-panel.css', './info.component.css']
})
export class InfoComponent extends BaseInfoComponent {

  // Static properties
  static index = 1;
  static img = "smile";
  static account = "Smile";
  static amount = 145.3;
  static date = "2023-07-07";
  static time = "10:04";
  static category = "car";
  static comment = "petrol";

  settingsReference = SettingsComponent
  /**
   * Sets the values of the InfoComponent properties.
   * @param id - The ID of the component.
   * @param account - The account name.
   * @param amount - The transaction amount.
   * @param date - The transaction date.
   * @param time - The transaction time.
   * @param category - The transaction category.
   * @param comment - The transaction comment.
   */
  static setInfoComponent(id: number, account: string, amount: number, date: string, time: string, category: string, comment: string) {
    InfoComponent.index = id;
    InfoComponent.img = account.toLowerCase();
    InfoComponent.account = account;
    InfoComponent.amount = amount;
    InfoComponent.date = date;
    InfoComponent.time = time;
    InfoComponent.category = category;
    InfoComponent.comment = comment
    InfoComponent.isInfo = true;
  }

  selectedOption = InfoComponent.account;
  amountTextField = InfoComponent.amount;
  dateTextField = InfoComponent.date;
  timeTextField = InfoComponent.time;
  categoryTextField = InfoComponent.category;
  commentTextField = InfoComponent.comment;

  // Static properties
  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoComponent;
  constructor(
    router: Router, 
    private localStorage: LocalService, 
    private afAuth: AngularFireAuth,
    private authService: AuthService,
    private frontendLogger: FrontendLoggerService,
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService
  ) {
    super(router);
    this.initStatic(InfoComponent);
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

  /**
   * Highlights the InfoComponent.
   */
  highlight() {
    InfoComponent.zIndex = InfoComponent.zIndex + 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
  }

  goLeft() {
    InfoComponent.index = InfoComponent.index - 1;
    if (InfoComponent.index < 0) {
      InfoComponent.index = AppStateService.instance.allTransactions.length - 1;
    }
    this.update(InfoComponent.index);
  }

  goRight() {
    InfoComponent.index = InfoComponent.index + 1;
    if (InfoComponent.index >= AppStateService.instance.allTransactions.length) {
      InfoComponent.index = 0;
    }
    this.update(InfoComponent.index);
  }

  update(index: number) {
    const transaction = AppStateService.instance.allTransactions[index];
    InfoComponent.img = transaction.account.toLocaleLowerCase();
    InfoComponent.account = transaction.account;
    InfoComponent.amount = transaction.amount;
    InfoComponent.date = transaction.date;
    InfoComponent.time = transaction.time;
    InfoComponent.category = transaction.category;
    InfoComponent.comment = transaction.comment;
  }

  /**
   * Copies the transaction.
   */
  copyTransaction() {
    AppComponent.gotoTop();
    AppComponent.copyTransaction(InfoComponent.account, InfoComponent.amount, `${InfoComponent.category}`, InfoComponent.comment, "transactions");
  }

  /**
   * Edits the transaction.
   */
  editTransaction() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoComponent.isError = false;
    this.selectedOption = InfoComponent.account;
    this.amountTextField = InfoComponent.amount;
    this.dateTextField = InfoComponent.date;
    this.timeTextField = InfoComponent.time;
    this.categoryTextField = InfoComponent.category;
    this.commentTextField = InfoComponent.comment;
  }

  /**
   * Handles the click event on the image.
   */
  clickImage() {
  }

  /**
   * Handle amount field changes - NO LONGER updates bucket tags
   * Bucket tag updates are handled by updateBucketAllocationTags with proper capping
   */
  onAmountChange(newAmount: string) {
    // Amount change is handled - bucket tags will be updated with capping in updateTransaction
  }

  /**
   * Updates the transaction with the new values.
   */
  updateTransaction() {
    // Validation (check if Amount is not empty)
    if (this.categoryTextField === "" || this.categoryTextField === "@" || this.selectedOption === "") {
      this.showError("Please fill out all required fields.");
    } else {
      let clean_comment = AppStateService.instance.allTransactions[InfoComponent.index].comment;
      if(AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Liabilitie")) {
        let split = clean_comment.split(";");
        clean_comment = split[1];
        clean_comment = clean_comment.trimStart();
      }
      let clean_local_comment = this.commentTextField;
      if(this.commentTextField.includes("Liabilitie")) {
        let split = clean_local_comment.split(";");
        clean_local_comment = split[1];
        clean_local_comment = clean_local_comment.trimStart();
      }
      // Update existing transaction (PATCH)
      if (clean_comment.includes("Buy Asset")) {
        let split_old = clean_comment.split(" ");
        let quantity_old = split_old[3];
        let price_old = split_old[5];
        let amount_old = parseFloat(quantity_old) * parseFloat(price_old);
        let split = clean_local_comment.split(" ");
        let title = split[2];
        let quantity = split[3];

        let price = split[5];
        let amount = parseFloat(quantity) * parseFloat(price);

        let amount_diff = amount_old - amount;

        for (let i = 0; i < AppStateService.instance.allAssets.length; i++) {

          if (AppStateService.instance.allAssets[i].tag === title) {
            AppStateService.instance.allAssets[i].amount -= amount_diff;
          }
        }

        for (let i = 0; i < AppStateService.instance.allGrowProjects.length; i++) {
          if (AppStateService.instance.allGrowProjects[i].title === title) {
            AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount)-amount_diff;
          }
        }
        
        this.amountTextField = amount*-1;

      }

      // Update existing transaction (PATCH)
      if (clean_comment.includes("Sell Asset")) {
        let split_old = clean_comment.split(" ");
        let quantity_old = split_old[3];
        let price_old = split_old[5];
        let amount_old = parseFloat(quantity_old) * parseFloat(price_old);
        
        let split = clean_local_comment.split(" ");
        let title = split[2];
        let quantity = split[3];

        let price = split[5];
        let amount = parseFloat(quantity) * parseFloat(price);
        let amount_diff = amount_old - amount;

        if(quantity_old !== quantity){
          let found = false;
          for (let i = 0; i < AppStateService.instance.allAssets.length; i++) {
            if (AppStateService.instance.allAssets[i].tag === title) {
              AppStateService.instance.allAssets[i].amount += amount_diff;
              AppStateService.instance.allAssets[i].amount = parseFloat(AppStateService.instance.allAssets[i].amount.toFixed(2));
              found = true;
            }
          }

          if (!found) {
            let newAsset: Asset = {tag: title, amount: amount};
            AppStateService.instance.allAssets.push(newAsset);
          }
        }
        
        this.amountTextField = amount;

      }

      if (clean_comment.includes("Buy Share")) {
        let split_old = clean_comment.split(" ");
        let quantity_old = split_old[3];
        let price_old = split_old[5];

        let split = clean_local_comment.split(" ");
        let title = split[2];
        let quantity = split[3];

        let quantity_diff = parseFloat(quantity_old) - parseFloat(quantity);

        let price = split[5];
        let amount = parseFloat(quantity) * parseFloat(price);
        let amount_old = parseFloat(quantity_old) * parseFloat(price_old);
        let amount_diff = amount_old - amount;

        for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
          if (AppStateService.instance.allShares[i].tag === title) {
            AppStateService.instance.allShares[i].quantity -= quantity_diff;
            AppStateService.instance.allShares[i].price = parseFloat(price);
          }
        }

        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === title){
            AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) - amount_diff;
            AppStateService.instance.allGrowProjects[i].share.quantity -= quantity_diff;
            AppStateService.instance.allGrowProjects[i].share.price = parseFloat(price);
          }
        }
        
        this.amountTextField = amount*-1;

      }

      // Update existing transaction (PATCH)
      if (clean_comment.includes("Sell Share")) {
        let split_old = clean_comment.split(" ");
        let quantity_old = split_old[3];
        
        let split = clean_local_comment.split(" ");
        let title = split[2];
        let quantity = split[3];

        let quantity_diff = parseFloat(quantity_old) - parseFloat(quantity);

        let price = split[5];
        let amount = parseFloat(quantity) * parseFloat(price);

        let found = false;
        for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
          if (AppStateService.instance.allShares[i].tag === title) {
            AppStateService.instance.allShares[i].quantity = Number(AppStateService.instance.allShares[i].quantity) + quantity_diff;
            AppStateService.instance.allShares[i].price = parseFloat(price);
            found = true;
            if (parseFloat(AppStateService.instance.allShares[i].quantity.toFixed(2)) === 0) {
              AppStateService.instance.allShares.splice(i, 1);
            }
          }
          
        }

        if (!found && quantity_diff != 0) {
          let newShare: Share = {tag: title, quantity: quantity_diff, price: parseFloat(price)};
          AppStateService.instance.allShares.push(newShare);
        }

        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === title){
            AppStateService.instance.allGrowProjects[i].share.quantity = Number(AppStateService.instance.allGrowProjects[i].share.quantity) + quantity_diff;
            AppStateService.instance.allGrowProjects[i].share.price = parseFloat(price);
          }
        }
        
        this.amountTextField = amount;

      }

      if (clean_comment.includes("Buy Investment")) {
        let split_old = clean_comment.split(" ");
        let deposit_old = split_old[3];
        let mortage_old = split_old[4];

        let split = clean_local_comment.split(" ");
        let title = split[2];
        let deposit = split[3];
        let mortage = split[4];

        let deposit_diff = parseFloat(deposit_old) - parseFloat(deposit);
        let mortage_diff = parseFloat(mortage_old) - parseFloat(mortage);

        for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
          if (AppStateService.instance.allInvestments[i].tag === title) {
            AppStateService.instance.allInvestments[i].deposit -= deposit_diff;
            AppStateService.instance.allInvestments[i].amount -= mortage_diff;
          }
        }

        for(let i = 0; i < AppStateService.instance.liabilities.length; i++){
          if(AppStateService.instance.liabilities[i].tag === "M-"+title){
            AppStateService.instance.liabilities[i].amount -= mortage_diff;
          }
        }
        // calculate new deposit
        let growAmount_diff = parseFloat(deposit);
        if(this.commentTextField.includes("Liabilitie")){
          let split = this.commentTextField.split(" ");
          let liabilitAmount = parseFloat(split[1]);
          let newDeposit = parseFloat(deposit) - liabilitAmount;
          
          let split_old = AppStateService.instance.allTransactions[InfoComponent.index].comment.split(" ");
          let liabilitAmount_old = parseFloat(split_old[1]);
          let newDeposit_old = parseFloat(deposit_old) - liabilitAmount_old;
          growAmount_diff = newDeposit - newDeposit_old;
        } 

        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === title){
            AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount)+growAmount_diff;
            AppStateService.instance.allGrowProjects[i].investment.deposit -= deposit_diff;
            AppStateService.instance.allGrowProjects[i].investment.amount -= mortage_diff;
          }
        }
        
        this.amountTextField = parseFloat(deposit)*-1;

      }

      if (AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Payback Liabilitie")) {
        let split_old = AppStateService.instance.allTransactions[InfoComponent.index].comment.split(" ");
        let amount_old = split_old[2];
        let credit_old = split_old[3]; 
        
        let split = this.commentTextField.split(" ");
        let amount_new = split[2];
        let credit_new = split[3];

        let amount_diff = parseFloat(amount_new) - parseFloat(amount_old);
        let credit_diff = parseFloat(credit_new) - parseFloat(credit_old);

        let found = false;
        for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
          if (AppStateService.instance.liabilities[i].tag.replace("@", "") === InfoComponent.category.replace("@", "")) {
            AppStateService.instance.liabilities[i].amount -= amount_diff;
            AppStateService.instance.liabilities[i].credit -= credit_diff;;
            found = true;
            if (AppStateService.instance.liabilities[i].amount == 0 && AppStateService.instance.liabilities[i].credit == 0) {
              AppStateService.instance.liabilities.splice(i, 1);
            }
          }
        }
        if (!found && amount_diff != 0) {
          let investemt = false;
          for(let i = 0; i < AppStateService.instance.allAssets.length; i++){
            if (AppStateService.instance.allAssets[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
              investemt = true;
            }
          }
          for(let i = 0; i < AppStateService.instance.allShares.length; i++){
            if (AppStateService.instance.allShares[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
              investemt = true;
            }
          }
          for(let i = 0; i < AppStateService.instance.allInvestments.length; i++){
            if (AppStateService.instance.allInvestments[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
              investemt = true;
            }
          }
          for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
            if(AppStateService.instance.allGrowProjects[i].title === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
              investemt = AppStateService.instance.allGrowProjects[i].isAsset || AppStateService.instance.allGrowProjects[i].share != null || AppStateService.instance.allGrowProjects[i].investment != null;
            }
          }
          let newLiability: Liability = { tag: AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", ""), amount: amount_diff*-1, credit: credit_diff*-1, investment: investemt }  
          AppStateService.instance.liabilities.push(newLiability);
        }

        // Update Smile Project
        if(this.selectedOption === "Smile") {
          for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
            if (AppStateService.instance.allSmileProjects[i].title === InfoComponent.category.replace("@", "")) {
              const project = AppStateService.instance.allSmileProjects[i];
              // Distribute amount_diff equally across all buckets
              if (project.buckets?.length > 0) {
                const amountPerBucket = amount_diff / project.buckets.length;
                project.buckets.forEach(bucket => { 
                  bucket.amount = Math.round((bucket.amount + amountPerBucket) * 100) / 100; 
                });
              }
            }
          }
        }

        // Fire Emergency amounts are recalculated by incomeStatement.recalculate()
        // No manual updates needed - bucket amounts are computed from transactions

        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
            AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) + amount_diff;
            if(AppStateService.instance.allGrowProjects[i].liabilitie){
              AppStateService.instance.allGrowProjects[i].liabilitie.amount -= amount_diff;
              AppStateService.instance.allGrowProjects[i].liabilitie.credit -= credit_diff;

              if (AppStateService.instance.allGrowProjects[i].liabilitie.amount == 0 && AppStateService.instance.allGrowProjects[i].liabilitie.credit == 0) {
                AppStateService.instance.allGrowProjects[i].liabilitie = null;
              }

            } else {
              let newLiabilitie: Liability = { tag: AppStateService.instance.allGrowProjects[i].title, amount: amount_diff*-1, credit: credit_diff*-1, investment: (AppStateService.instance.allGrowProjects[i].isAsset || AppStateService.instance.allGrowProjects[i].share != null || AppStateService.instance.allGrowProjects[i].investment != null) }
              AppStateService.instance.allGrowProjects[i].liabilitie = newLiabilitie;
            }
          }
        }

        this.amountTextField = (parseFloat(amount_new) + parseFloat(credit_new))*-1;
      } else {
        if (AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Liabilitie")) {
          let split_old = AppStateService.instance.allTransactions[InfoComponent.index].comment.split(" ");
          let amount_old = split_old[1];
          let credit_old = split_old[2];

          if(!this.commentTextField.includes("Liabilitie")){
            // remove from liablities
            for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
              if (AppStateService.instance.liabilities[i].tag.replace("@", "") === InfoComponent.category.replace("@", "")) {
                AppStateService.instance.liabilities[i].amount -= parseFloat(amount_old);
                AppStateService.instance.liabilities[i].credit -= parseFloat(credit_old);
                if (AppStateService.instance.liabilities[i].amount == 0 && AppStateService.instance.liabilities[i].credit == 0) {
                  AppStateService.instance.liabilities.splice(i, 1);
                }
              }
            }
            // remove from Grow Projects
            for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === InfoComponent.category.replace("@", "")){
                if(AppStateService.instance.allGrowProjects[i].liabilitie){
                  AppStateService.instance.allGrowProjects[i].liabilitie.amount -= parseFloat(amount_old);
                  AppStateService.instance.allGrowProjects[i].liabilitie.credit -= parseFloat(credit_old);
                  if (AppStateService.instance.allGrowProjects[i].liabilitie.amount == 0 && AppStateService.instance.allGrowProjects[i].liabilitie.credit == 0) {
                    AppStateService.instance.allGrowProjects[i].liabilitie = null;
                  }
                }
              }
            }
          } else {
            let split = this.commentTextField.split(" ");
            let amount_new = split[1];
            let credit_new = split[2];
            if (credit_new.includes("%")){
              let percentage = parseFloat(split[2].replace("%", ""));
              credit_new = parseFloat((Math.round((parseFloat(amount_new) * percentage) / 100 * 100) / 100).toFixed(2)).toString();
              this.commentTextField = `${split[0]} ${split[1]} ${credit_new};`;
            }
            
    
            let amount_diff = parseFloat(amount_new) - parseFloat(amount_old);
            let credit_diff = parseFloat(credit_new) - parseFloat(credit_old);

            for(let i=0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === InfoComponent.category.replace("@", "")){
                if(AppStateService.instance.allGrowProjects[i].liabilitie) {
                  AppStateService.instance.allGrowProjects[i].liabilitie.amount += amount_diff;
                  AppStateService.instance.allGrowProjects[i].liabilitie.credit += credit_diff;
                } else {
                  let invstment = AppStateService.instance.allGrowProjects[i].isAsset || AppStateService.instance.allGrowProjects[i].share != null || AppStateService.instance.allGrowProjects[i].investment != null;
                  let newLiability: Liability = { tag: InfoComponent.category.replace("@", ""), amount: amount_diff*-1, credit: credit_diff*-1, investment: invstment }
                  AppStateService.instance.allGrowProjects[i].liabilitie = newLiability;
                }
                
              }
            }
            for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
              if (AppStateService.instance.liabilities[i].tag.replace("@", "") === InfoComponent.category.replace("@", "")) {
                AppStateService.instance.liabilities[i].amount += amount_diff;
                AppStateService.instance.liabilities[i].credit += credit_diff;;
              }
            }
    
            // Update Smile Project
            if(this.selectedOption === "Smile") {
              for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
                if (AppStateService.instance.allSmileProjects[i].title === InfoComponent.category.replace("@", "")) {
                  const project = AppStateService.instance.allSmileProjects[i];
                  // Distribute amount_diff equally across all buckets
                  if (project.buckets?.length > 0) {
                    const amountPerBucket = amount_diff / project.buckets.length;
                    project.buckets.forEach(bucket => { 
                      bucket.amount = Math.round((bucket.amount + amountPerBucket) * 100) / 100; 
                    });
                  }
                }
              }
            }
    
            // Fire Emergency amounts are recalculated by incomeStatement.recalculate()
            
            this.amountTextField = this.amountTextField + parseFloat(amount_new);
          }
          
          
  
        }
      }

      if (clean_comment.includes("Sell Investment")) {
        let split_old = clean_comment.split(" ");
        let deposit_old = split_old[3];
        let mortage_old = split_old[4];

        let split = clean_local_comment.split(" ");
        let title = split[2];
        let deposit = split[3];
        let mortage = split[4];

        let deposit_diff = parseFloat(deposit_old) - parseFloat(deposit);
        let mortage_diff = parseFloat(mortage_old) - parseFloat(mortage);

        for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
          if (AppStateService.instance.allInvestments[i].tag === title) {
            AppStateService.instance.allInvestments[i].deposit -= deposit_diff;
            AppStateService.instance.allInvestments[i].amount -= mortage_diff;
          }
        }

        for(let i = 0; i < AppStateService.instance.liabilities.length; i++){
          if(AppStateService.instance.liabilities[i].tag === "M-"+title){
            AppStateService.instance.liabilities[i].amount -= mortage_diff;
          }
        }
        // calculate new deposit
        let newDeposit = parseFloat(deposit);
        if(this.commentTextField.includes("Payback Liabilitie")){
          let split = this.commentTextField.split(" ");
          let liabilitAmount = parseFloat(split[2]);
          newDeposit = parseFloat(deposit) - liabilitAmount;
        } 

        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === title){
            AppStateService.instance.allGrowProjects[i].amount = newDeposit;
            AppStateService.instance.allGrowProjects[i].investment.deposit -= deposit_diff;
            AppStateService.instance.allGrowProjects[i].investment.amount -= mortage_diff;
          }
        }
        
        this.amountTextField = parseFloat(deposit)*-1;

      }

      // Handle @Mojo category- can add from any account
      if (this.categoryTextField === "@Mojo") {
        this.addToMojo();
      }

      // Handle Smile projects - can add from any account (except when category is @Mojo to avoid double-processing)
      if (this.categoryTextField != "@Mojo") {
        this.addToSmileProject(this.categoryTextField);
      }
      
      // Handle Fire emergencies - can add from any account (except when category is @Mojo to avoid double-processing)
      if (this.categoryTextField != "@Mojo") {
        this.addToFireEmergencie(this.categoryTextField);
      }

      // Special handling for Mojo account
      if (this.selectedOption === "Mojo") {
        this.updateMojo();
      }

      if (this.selectedOption != "Mojo" && AppStateService.instance.allTransactions[InfoComponent.index].account == "Mojo") {
        this.addMojo();
      }
      if (this.selectedOption == "Mojo" && AppStateService.instance.allTransactions[InfoComponent.index].account != "Mojo") {
        this.removeFromMojo();
      }

      // UPDATE Income Statement
      if (this.selectedOption === "Income") {
        this.updateInterests(this.categoryTextField);
        this.updateProperties(this.categoryTextField);
        this.updateRevenues(this.categoryTextField);
      }
      if (this.selectedOption === "Daily") {
        this.updateDailyExpense(this.categoryTextField);
      }
      if (this.selectedOption === "Splurge") {
        this.updateSplurgeExpense(this.categoryTextField);
      }
      if (this.selectedOption === "Smile") {
        this.updateSmileExpense(this.categoryTextField);
      }
      if (this.selectedOption === "Fire") {
        this.updateFireExpense(this.categoryTextField);
      }
      if (this.selectedOption === "Mojo") {
        this.updateMojoExpense(this.categoryTextField);
      }

      if (this.commentTextField.includes("payback")) {
        // Update Balance Sheet
        this.updateLiabilities(this.categoryTextField);
      }

      let needsChange = false;
      // Call function in SettingsComponent when category is changed
      if (this.categoryTextField !== AppStateService.instance.allTransactions[InfoComponent.index].category || this.selectedOption !== AppStateService.instance.allTransactions[InfoComponent.index].account) {
        needsChange = true;
      }

      // Update transaction values
      AppStateService.instance.allTransactions[InfoComponent.index].account = this.selectedOption;
      AppStateService.instance.allTransactions[InfoComponent.index].amount = this.amountTextField;
      AppStateService.instance.allTransactions[InfoComponent.index].date = this.dateTextField;
      AppStateService.instance.allTransactions[InfoComponent.index].time = this.timeTextField;
      AppStateService.instance.allTransactions[InfoComponent.index].category = this.categoryTextField;
      AppStateService.instance.allTransactions[InfoComponent.index].comment = this.commentTextField;

      // Update bucket allocation tags if amount changed and transaction has bucket tags
      this.updateBucketAllocationTags(AppStateService.instance.allTransactions[InfoComponent.index]);

      // Sync back any changes made by updateBucketAllocationTags (e.g., capped amounts)
      this.amountTextField = AppStateService.instance.allTransactions[InfoComponent.index].amount;
      this.commentTextField = AppStateService.instance.allTransactions[InfoComponent.index].comment;

      import('../../main/accounting/accounting.component').then(m => {
        m.AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
        m.AccountingComponent.dataSource.data = AppStateService.instance.allTransactions.map((transaction: any, index: number) => {
          return { ...transaction, id: index };
        });
      });
      import('../../main/daily/daily.component').then(m => m.DailyComponent.updateDailyAmount());

      // Update InfoComponent values
      InfoComponent.img = this.selectedOption.toLocaleLowerCase();
      InfoComponent.account = this.selectedOption;
      InfoComponent.amount = this.amountTextField; // Use synced amount (may have been capped)
      InfoComponent.date = this.dateTextField;
      InfoComponent.time = this.timeTextField;
      InfoComponent.category = this.categoryTextField;
      InfoComponent.comment = this.commentTextField; // Use synced comment (may have been updated)

      // Log user activity
      this.frontendLogger.logActivity('update_transaction', 'info', {
        account: this.selectedOption,
        category: this.categoryTextField,
        amount: this.amountTextField,
        date: this.dateTextField
      });

      // Write to DB
      this.updateStorage();

      // Always recalculate income statement when transaction is updated
      // This ensures bucket amounts are always in sync with transaction allocations
      this.incomeStatement.recalculate();

      if (needsChange) {
        this.updateBasedOnTransaction();
      }

      // Clean Up close Window
      this.clearError();
      this.isEdit = false;
      this.toastService.show('Transaction updated', 'update');
      AppComponent.gotoTop();
    }
  }

  updateBasedOnTransaction() {
    // AppState is already up-to-date from the calling code.
    // Do NOT re-read from localStorage — it may be stale if a prior
    // batchWriteAndSync hasn't returned yet.
    
    // Recalculate all income statement values from transactions
    this.incomeStatement.recalculate();

    try {
      const writes = [
        ...this.incomeStatement.getWrites(),
        // Only write balance/grow data if it has been loaded (Tier 3 on-demand).
        // Writing before load would overwrite real DB data with empty arrays.
        ...(AppStateService.instance.tier3BalanceLoaded ? [
          { tag: "balance/liabilities", data: AppStateService.instance.liabilities },
          { tag: "balance/asset/assets", data: AppStateService.instance.allAssets },
          { tag: "balance/asset/shares", data: AppStateService.instance.allShares },
          { tag: "balance/asset/investments", data: AppStateService.instance.allInvestments }
        ] : []),
        ...(AppStateService.instance.tier3GrowLoaded ? [
          { tag: "grow", data: AppStateService.instance.allGrowProjects }
        ] : [])
      ];

      this.persistence.batchWriteAndSync({
        writes,
        localStorageSaves: [
          { key: "interests", data: JSON.stringify(AppStateService.instance.allIntrests) },
          { key: "properties", data: JSON.stringify(AppStateService.instance.allProperties) },
          { key: "revenues", data: JSON.stringify(AppStateService.instance.allRevenues) },
          { key: "dailyEx", data: JSON.stringify(AppStateService.instance.dailyExpenses) },
          { key: "splurgeEx", data: JSON.stringify(AppStateService.instance.splurgeExpenses) },
          ...(AppStateService.instance.tier2Loaded ? [
            { key: "smileEx", data: JSON.stringify(AppStateService.instance.smileExpenses) },
            { key: "fireEx", data: JSON.stringify(AppStateService.instance.fireExpenses) },
            { key: "mojoEx", data: JSON.stringify(AppStateService.instance.mojoExpenses) },
            { key: "smile", data: JSON.stringify(AppStateService.instance.allSmileProjects) },
            { key: "fire", data: JSON.stringify(AppStateService.instance.allFireEmergencies) },
            { key: "mojo", data: JSON.stringify(AppStateService.instance.mojo) },
          ] : []),
          { key: "transactions", data: JSON.stringify(AppStateService.instance.allTransactions) },
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) },
            { key: "shares", data: JSON.stringify(AppStateService.instance.allShares) },
            { key: "assets", data: JSON.stringify(AppStateService.instance.allAssets) },
            { key: "investments", data: JSON.stringify(AppStateService.instance.allInvestments) }
          ] : []),
          ...(AppStateService.instance.tier3GrowLoaded ? [
            { key: "grow", data: JSON.stringify(AppStateService.instance.allGrowProjects) }
          ] : [])
        ]
      });
    } catch (error) {
    }
  }

  /**
   * Updates the liabilities with the new amount based on the category.
   * @param category - The category of the transaction.
   */
  updateLiabilities(category: String) {
    for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.liabilities[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.liabilities[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
      }
    }
  }

  /**
   * Deletes a transaction at the specified index.
   * @param index - The index of the transaction to be deleted.
   */
  deleteTransaction(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteTransaction'), () => {
      // Save transaction data before deleting
      const deletedTransaction = {
      account: AppStateService.instance.allTransactions[index].account,
      category: AppStateService.instance.allTransactions[index].category,
      amount: AppStateService.instance.allTransactions[index].amount,
      date: AppStateService.instance.allTransactions[index].date
    };
    
    let clean_comment = AppStateService.instance.allTransactions[InfoComponent.index].comment;
      if(AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Liabilitie")) {
        let split = clean_comment.split(";");
        clean_comment = split[1];
        clean_comment = clean_comment.trimStart();
      }
    if (clean_comment.includes("Buy Asset")) {
      let split = clean_comment.split(" ");      
      let title = split[2];
      let quantity = parseFloat(split[3]);
      let price = parseFloat(split[5])
      let amount = quantity * price

      for (let i = 0; i < AppStateService.instance.allAssets.length; i++) {
        if (AppStateService.instance.allAssets[i].tag === title) {
          AppStateService.instance.allAssets[i].amount -= amount;
          AppStateService.instance.allAssets[i].amount = parseFloat(AppStateService.instance.allAssets[i].amount.toFixed(2))
        }
        if (AppStateService.instance.allAssets[i].amount == 0) {
          AppStateService.instance.allAssets.splice(i, 1);
        }
        for(let i=0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === title){
            if(Number(AppStateService.instance.allGrowProjects[i].amount) != amount){
              AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) - amount;
            }
          }
        } 

      }

    }

    if (clean_comment.includes("Sell Asset")) {
      let split = clean_comment.split(" ");      
      let title = split[2];
      let quantity = parseFloat(split[3]);
      let price = parseFloat(split[5]);
      let amount = quantity * price;

      let found = false;
      for (let i = 0; i < AppStateService.instance.allAssets.length; i++) {
        if (AppStateService.instance.allAssets[i].tag === title) {
          AppStateService.instance.allAssets[i].amount += amount;
          AppStateService.instance.allAssets[i].amount = parseFloat(AppStateService.instance.allAssets[i].amount.toFixed(2))
          if (AppStateService.instance.allAssets[i].amount == 0) {  
            AppStateService.instance.allAssets.splice(i, 1);
          }
          found = true;
        }
      }
      if(!found && amount != 0){
        let asset: Asset = { tag: title, amount: amount }
        AppStateService.instance.allAssets.push(asset);
      }

      for(let i = 0; i < AppStateService.instance.allRevenues.length; i++){
        if (AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase() === ("@" + title.toLocaleLowerCase())){
          AppStateService.instance.allRevenues[i].amount += AppStateService.instance.allTransactions[InfoComponent.index].amount;
        }
        AppStateService.instance.allRevenues[i].amount = parseFloat(AppStateService.instance.allRevenues[i].amount.toFixed(2));
        //check if tag is emty -> delete
        if (AppStateService.instance.allRevenues[i].amount == 0) {
          AppStateService.instance.allRevenues.splice(i, 1);
        } 
      
      }
    }
    if (clean_comment.includes("Buy Share")) {
      let split = clean_comment.split(" ");      
      let title = split[2];
      let quantity = parseFloat(split[3]);
      let price = parseFloat(split[5]);

      for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
        if (AppStateService.instance.allShares[i].tag === title) {
          AppStateService.instance.allShares[i].quantity -= quantity;
          if(AppStateService.instance.allShares[i].quantity == 0) {
            AppStateService.instance.allShares.splice(i, 1);
          }
        }
      }


      for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
        if(AppStateService.instance.allGrowProjects[i].title === title){         
          if(AppStateService.instance.allTransactions[InfoComponent.index].amount*-1 != AppStateService.instance.allGrowProjects[i].amount){
            AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) + AppStateService.instance.allTransactions[InfoComponent.index].amount;
          }
          if(AppStateService.instance.allGrowProjects[i].share.quantity != quantity){
            AppStateService.instance.allGrowProjects[i].share.quantity -= quantity;
          }
        }
      }
    }

    if (clean_comment.includes("Sell Share")) {
      let split = clean_comment.split(" ");      
      let title = split[2];
      let quantity = parseFloat(split[3]);
      let price = parseFloat(split[5]);

      let found = false;
      for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
        if (AppStateService.instance.allShares[i].tag === title) {
          AppStateService.instance.allShares[i].quantity = Number(AppStateService.instance.allShares[i].quantity) + quantity;
          AppStateService.instance.allShares[i].quantity = parseFloat(AppStateService.instance.allShares[i].quantity.toFixed(2));
          if (AppStateService.instance.allShares[i].quantity == 0) {
            AppStateService.instance.allShares.splice(i, 1);
          }
          found = true;
        }
      }
      if (!found && quantity != 0) {
        let share: Share = { tag: title, quantity: quantity, price: price };
        AppStateService.instance.allShares.push(share);
      }

      for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
        if (AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase() === ("@" + title.toLocaleLowerCase())) {
          AppStateService.instance.allIntrests[i].amount += AppStateService.instance.allTransactions[InfoComponent.index].amount;
        }
        AppStateService.instance.allIntrests[i].amount = parseFloat(AppStateService.instance.allIntrests[i].amount.toFixed(2));
        //check if tag is empty -> delete
        if (AppStateService.instance.allIntrests[i].amount == 0) {
          AppStateService.instance.allIntrests.splice(i, 1);
        }
      }

      for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
        if(AppStateService.instance.allGrowProjects[i].title === title){
          AppStateService.instance.allGrowProjects[i].share.quantity = Number(AppStateService.instance.allGrowProjects[i].share.quantity) + quantity;
          AppStateService.instance.allGrowProjects[i].share.price = price;
        }
      }
      
    }

    if (clean_comment.includes("Buy Investment")) {
      let split = clean_comment.split(" ");      
      let title = split[2];
      let deposit = parseFloat(split[3]);
      let mortage = parseFloat(split[4]);

      for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
        if (AppStateService.instance.allInvestments[i].tag === title) {
          AppStateService.instance.allInvestments[i].deposit -= deposit;
          AppStateService.instance.allInvestments[i].amount -= mortage;
          AppStateService.instance.allInvestments[i].deposit = parseFloat(AppStateService.instance.allInvestments[i].deposit.toFixed(2));
          AppStateService.instance.allInvestments[i].amount = parseFloat(AppStateService.instance.allInvestments[i].amount.toFixed(2));
          if(AppStateService.instance.allInvestments[i].deposit == 0 && AppStateService.instance.allInvestments[i].amount == 0) {
            AppStateService.instance.allInvestments.splice(i, 1);
          }
        }
      }

      //remove Hypothek
      for(let i=0; i < AppStateService.instance.liabilities.length; i++){
        if(AppStateService.instance.liabilities[i].tag === "M-"+title){
          AppStateService.instance.liabilities[i].amount -= mortage;
          AppStateService.instance.liabilities[i].amount = parseFloat(AppStateService.instance.liabilities[i].amount.toFixed(2));
        }
        if(AppStateService.instance.liabilities[i].amount == 0){
          AppStateService.instance.liabilities.splice(i, 1);
        }
      }

      let growAmount = deposit;
      if(AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Liabilitie")){
        let liabilitie_split = InfoComponent.comment.split(" ");
        let liabilitAmount = parseFloat(liabilitie_split[1]);
        growAmount -= liabilitAmount;
      }

      for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
        if(AppStateService.instance.allGrowProjects[i].title === title){
          if(AppStateService.instance.allGrowProjects[i].investment.deposit != deposit){
            AppStateService.instance.allGrowProjects[i].investment.deposit -= deposit;
          }
          if(AppStateService.instance.allGrowProjects[i].investment.amount != mortage){
            AppStateService.instance.allGrowProjects[i].investment.amount -= mortage;
          }
          if(AppStateService.instance.allGrowProjects[i].amount != growAmount){
            AppStateService.instance.allGrowProjects[i].amount -= growAmount;
          }
        }
      }
    }

    if (clean_comment.includes("Sell Investment")) {
      let split = clean_comment.split(" ");      
      let title = split[2];
      let deposit = parseFloat(split[3]);
      let mortage = parseFloat(split[4]);

      let found = false;
      for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
        if (AppStateService.instance.allInvestments[i].tag === title) {
          found = true;
          AppStateService.instance.allInvestments[i].deposit = Number(AppStateService.instance.allInvestments[i].deposit) + deposit;
          AppStateService.instance.allInvestments[i].amount = Number(AppStateService.instance.allInvestments[i].amount) + mortage;
        }
      }
      if(!found){
        let investment: Investment = { tag: title, deposit: deposit, amount: mortage }
        AppStateService.instance.allInvestments.push(investment);
      }

      let foundM = false;
      //remove Hypothek
      for(let i=0; i < AppStateService.instance.liabilities.length; i++){
        if(AppStateService.instance.liabilities[i].tag === "M-"+title){
          foundM = true;
          AppStateService.instance.liabilities[i].amount = Number(AppStateService.instance.liabilities[i].amount) + mortage;
        }
      }
      if(!foundM){
        let newLiabilitie: Liability = { tag: "M-"+title, amount: mortage, credit: 0, investment: true }
        AppStateService.instance.liabilities.push(newLiabilitie);
      }

      for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
        if(AppStateService.instance.allGrowProjects[i].title === title){
          AppStateService.instance.allGrowProjects[i].investment.deposit = Number(AppStateService.instance.allGrowProjects[i].investment.deposit) + deposit;
          AppStateService.instance.allGrowProjects[i].investment.amount = Number(AppStateService.instance.allGrowProjects[i].investment.amount) + mortage;
          AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) + deposit;
        }
      }
    }

    if (AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Payback Liabilitie")) {
      let split = AppStateService.instance.allTransactions[InfoComponent.index].comment.split(" ");      
      let amount = parseFloat(split[2]);
      let credit = parseFloat(split[3]);

      let found = false;
      for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
        if (AppStateService.instance.liabilities[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")) {
          AppStateService.instance.liabilities[i].amount = Number(AppStateService.instance.liabilities[i].amount) + amount;
          AppStateService.instance.liabilities[i].credit = Number(AppStateService.instance.liabilities[i].credit) + credit;

          AppStateService.instance.liabilities[i].amount = parseFloat(AppStateService.instance.liabilities[i].amount.toFixed(2));
          AppStateService.instance.liabilities[i].credit = parseFloat(AppStateService.instance.liabilities[i].credit.toFixed(2));
          found = true;
        }
        if (AppStateService.instance.liabilities[i].amount == 0 && AppStateService.instance.liabilities[i].credit == 0) {
          AppStateService.instance.liabilities.splice(i, 1);
        }
      }
      
      if (!found) {
        let investemt = false;
        for(let i = 0; i < AppStateService.instance.allAssets.length; i++){
          if (AppStateService.instance.allAssets[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
            investemt = true;
          }
        }
        for(let i = 0; i < AppStateService.instance.allShares.length; i++){
          if (AppStateService.instance.allShares[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
            investemt = true;
          }
        }
        for(let i = 0; i < AppStateService.instance.allInvestments.length; i++){
          if (AppStateService.instance.allInvestments[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
            investemt = true;
          }
        }
        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if (AppStateService.instance.allGrowProjects[i].title === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
            investemt = AppStateService.instance.allGrowProjects[i].isAsset || AppStateService.instance.allGrowProjects[i].share != null || AppStateService.instance.allGrowProjects[i].investment != null;
          }
        }
        let newLiability: Liability = { tag: AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", ""), amount: amount, credit: credit, investment: investemt }  
        AppStateService.instance.liabilities.push(newLiability);
      }

      // Update Smile projects - can remove from any account based on category
      for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
        if (AppStateService.instance.allTransactions[InfoComponent.index].category === ("@" + AppStateService.instance.allSmileProjects[i].title)) {
          const project = AppStateService.instance.allSmileProjects[i];
          const comment = AppStateService.instance.allTransactions[InfoComponent.index].comment;
          const bucketIdMatch = comment?.match(/#bucket:([^\s]+)/);
          
          if (bucketIdMatch && project.buckets) {
            const bucket = project.buckets.find(b => b.id === bucketIdMatch[1]);
            if (bucket) bucket.amount = Math.round((bucket.amount + amount) * 100) / 100;
          } else if (project.buckets?.length > 0) {
            const amountPerBucket = amount / project.buckets.length;
            project.buckets.forEach(bucket => { 
              bucket.amount = Math.round((bucket.amount + amountPerBucket) * 100) / 100; 
            });
          }
          
          // Log smile project removal from delete transaction
          this.frontendLogger.logActivity('update_smile_project_from_transaction', 'info', {
            projectType: 'smile',
            projectTitle: project.title,
            amount: -amount,  // negative because we're removing/reversing
            bucketId: bucketIdMatch?.[1],
            category: AppStateService.instance.allTransactions[InfoComponent.index].category,
            source: 'delete_transaction'
          });
        }
      }
      // Fire emergency amounts are recalculated by incomeStatement.recalculate()
      // No manual updates needed - bucket amounts are computed from transactions

      for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
        if(AppStateService.instance.allGrowProjects[i].title === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")){
          AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) - amount;
          if(AppStateService.instance.allGrowProjects[i].liabilitie){
            AppStateService.instance.allGrowProjects[i].liabilitie.amount += amount;
            AppStateService.instance.allGrowProjects[i].liabilitie.credit += credit;
          } else {
            let newLiabilitie: Liability = { tag: AppStateService.instance.allGrowProjects[i].title, amount: amount, credit: credit, investment: (AppStateService.instance.allGrowProjects[i].isAsset || AppStateService.instance.allGrowProjects[i].share != null || AppStateService.instance.allGrowProjects[i].investment != null) }
            AppStateService.instance.allGrowProjects[i].liabilitie = newLiabilitie;
          }
        }
      }

    } else {
      if (AppStateService.instance.allTransactions[InfoComponent.index].comment.includes("Liabilitie")) {
        let split = AppStateService.instance.allTransactions[InfoComponent.index].comment.split(" ");      
        let amount = parseFloat(split[1]);
        let credit = parseFloat(split[2]);
  
        for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
          if (AppStateService.instance.liabilities[i].tag === AppStateService.instance.allTransactions[InfoComponent.index].category.replace("@", "")) {
            AppStateService.instance.liabilities[i].amount -= amount;
            AppStateService.instance.liabilities[i].credit -= credit;
  
            AppStateService.instance.liabilities[i].amount = parseFloat(AppStateService.instance.liabilities[i].amount.toFixed(2));
            AppStateService.instance.liabilities[i].credit = parseFloat(AppStateService.instance.liabilities[i].credit.toFixed(2));
          }
          if (AppStateService.instance.liabilities[i].amount == 0 && AppStateService.instance.liabilities[i].credit == 0) {
            AppStateService.instance.liabilities.splice(i, 1);
          }
        }
  
        // Update Smile
        if (AppStateService.instance.allTransactions[InfoComponent.index].account === "Smile") {
          for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
            if (AppStateService.instance.allTransactions[InfoComponent.index].category === ("@" + AppStateService.instance.allSmileProjects[i].title)) {
              const project = AppStateService.instance.allSmileProjects[i];
              const comment = AppStateService.instance.allTransactions[InfoComponent.index].comment;
              const bucketIdMatch = comment?.match(/#bucket:([^\s]+)/);
              
              if (bucketIdMatch && project.buckets) {
                const bucket = project.buckets.find(b => b.id === bucketIdMatch[1]);
                if (bucket) bucket.amount = Math.round((bucket.amount - amount) * 100) / 100;
              } else if (project.buckets?.length > 0) {
                const amountPerBucket = amount / project.buckets.length;
                project.buckets.forEach(bucket => { 
                  bucket.amount = Math.round((bucket.amount - amountPerBucket) * 100) / 100; 
                });
              }
            }
          }
        }
        // Update Fire Emergencie
        // Fire emergency amounts are recalculated by incomeStatement.recalculate()
        // No manual updates needed
        
        // Update Grow Project
        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if (AppStateService.instance.allTransactions[InfoComponent.index].category === ("@" + AppStateService.instance.allGrowProjects[i].title)) {
            if(AppStateService.instance.allGrowProjects[i].liabilitie.amount != amount){
              AppStateService.instance.allGrowProjects[i].liabilitie.amount -= amount;
            }
            if(AppStateService.instance.allGrowProjects[i].liabilitie.credit != credit){
              AppStateService.instance.allGrowProjects[i].liabilitie.credit -= credit;
            }
          }
        }
      }
    }

    if (AppStateService.instance.allTransactions[index].account === "Smile") {
      this.removeFromSmileProject(AppStateService.instance.allTransactions[index].category);
    }
    if (AppStateService.instance.allTransactions[index].account === "Fire") {
      if (AppStateService.instance.allTransactions[index].category != "@Mojo") {
        this.removeFromFireEmergencie(AppStateService.instance.allTransactions[index].category)
      }
    }
    if (AppStateService.instance.allTransactions[index].category === "@Mojo") {
      this.removeFromMojo();
    }
    if (AppStateService.instance.allTransactions[index].account === "Mojo") {
      this.addMojo();
      this.removeFromFireEmergencie(AppStateService.instance.allTransactions[index].category)
      this.removeFromSmileProject(AppStateService.instance.allTransactions[index].category);
    }

    if (AppStateService.instance.allTransactions[index].account === "Income") {
      this.removeFromInterests(AppStateService.instance.allTransactions[index].category);
      this.removeFromProperties(AppStateService.instance.allTransactions[index].category);
      this.removeFromReveneus(AppStateService.instance.allTransactions[index].category);
    }
    if (AppStateService.instance.allTransactions[index].account === "Daily") {
      this.removeFromDailyExpenses(AppStateService.instance.allTransactions[index].category)
    }
    if (AppStateService.instance.allTransactions[index].account === "Splurge") {
      this.removeFromSplurgeExpenses(AppStateService.instance.allTransactions[index].category)
    }
    if (AppStateService.instance.allTransactions[index].account === "Smile") {
      this.removeFromSmileExpenses(AppStateService.instance.allTransactions[index].category)
    }
    if (AppStateService.instance.allTransactions[index].account === "Fire") {
      this.removeFromFireExpenses(AppStateService.instance.allTransactions[index].category)
    }
    if (AppStateService.instance.allTransactions[index].account === "Mojo") {
      this.removeFromMojoExpenses(AppStateService.instance.allTransactions[index].category)
    }
    if (this.commentTextField.includes("payback")) {
      this.removeFromLiabiltities(AppStateService.instance.allTransactions[index].category)
    }
    // Delete now Transaction
    AppStateService.instance.allTransactions.splice(index, 1);
    import('../../main/accounting/accounting.component').then(m => {
      m.AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
      m.AccountingComponent.dataSource.data = AppStateService.instance.allTransactions.map((transaction: any, index: number) => {
        return { ...transaction, id: index };
      });
    });
    import('../../main/daily/daily.component').then(m => m.DailyComponent.updateDailyAmount());
    
    // Log user activity
    this.frontendLogger.logActivity('delete_transaction', 'info', {
      account: deletedTransaction.account,
      category: deletedTransaction.category,
      amount: deletedTransaction.amount,
      date: deletedTransaction.date,
      index: index
    });
    
    // Recalculate all income statement values from remaining transactions
    // This ensures bucket amounts and other project amounts are correct
    this.incomeStatement.recalculate();
    
    // WRITE to Storage
    this.updateStorage();
    this.toastService.show('Transaction deleted', 'delete');
    this.isEdit = false;
    InfoComponent.isInfo = false;
    });
  }

  /**
   * Parses manual bucket allocations from comment and validates they sum to the transaction amount.
   * Returns the allocations if valid, null otherwise.
   */
  parseManualBucketAllocations(comment: string | undefined, transactionAmount: number, projectBuckets: any[]): Array<{bucketName: string, amount: number}> | null {
    if (!comment) return null;
    
    // Find all bucket tags in comment
    const bucketTagMatches = comment.match(/#bucket:([^:]+):([\d.]+)/g);
    if (!bucketTagMatches || bucketTagMatches.length === 0) return null;
    
    // Parse allocations
    const allocations: Array<{bucketName: string, amount: number}> = [];
    let totalAllocated = 0;
    
    for (const tag of bucketTagMatches) {
      const match = tag.match(/#bucket:([^:]+):([\d.]+)/);
      if (!match) continue;
      
      const bucketName = match[1];
      const amount = parseFloat(match[2]);
      
      // Validate bucket exists in project
      const bucketExists = projectBuckets.some(b => b.title === bucketName);
      if (!bucketExists) return null; // Invalid bucket name
      
      allocations.push({ bucketName, amount });
      totalAllocated += amount;
    }
    
    // Validate total matches transaction amount (with 0.01 tolerance for rounding)
    const expectedAmount = Math.abs(transactionAmount);
    if (Math.abs(totalAllocated - expectedAmount) > 0.01) {
      return null; // Manual allocations don't add up to transaction amount
    }
    
    return allocations;
  }

  /**
   * Updates bucket allocation tags in transaction comment when amount changes.
   * Handles both single bucket tags and distributed bucket tags.
   * Supports both Smile projects and Fire emergencies.
   */
  updateBucketAllocationTags(transaction: any) {
    if (!transaction.comment) return;
    
    // Try Smile projects first
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (transaction.category === ("@" + AppStateService.instance.allSmileProjects[i].title)) {
        const project = AppStateService.instance.allSmileProjects[i];
        
        // Check if there are valid manual bucket allocations in the comment
        const manualAllocations = this.parseManualBucketAllocations(
          transaction.comment,
          transaction.amount,
          project.buckets || []
        );
        
        if (manualAllocations) {
          // User has valid manual allocations that add up - keep them as-is
          // No need to recalculate or modify
          return;
        }
        
        // No valid manual allocations - check if comment contains bucket tags to update
        const bucketTagMatches = transaction.comment.match(/#bucket:([^:]+):([\d.]+)/g);
        if (!bucketTagMatches) {
          // Transaction has no bucket tags - add smart allocation tags
          if (project.buckets?.length > 0) {
            const amount = transaction.amount;
            const result = this.distributeAmountToBuckets(project.buckets, amount);
            const { allocations, adjustedAmount } = result;
            
            // Update transaction amount if capped
            if (adjustedAmount !== undefined) {
              transaction.amount = adjustedAmount;
            }
            
            // Create allocation tags
            const allocationTags = allocations
              .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
              .join(' ');
            
            // Append to existing comment
            transaction.comment = transaction.comment
              ? `${transaction.comment}\n${allocationTags}`
              : allocationTags;
          }
          return;
        }
        
        if (bucketTagMatches.length === 1 && project.buckets?.length >= 1) {
          // Single bucket tag - user manually selected one bucket
          // Check bucket's remaining capacity and cap if needed
          const match = bucketTagMatches[0].match(/#bucket:([^:]+):([\d.]+)/);
          if (match) {
            const bucketName = match[1];
            const oldContribution = parseFloat(match[2]);
            const requestedAmount = Math.abs(transaction.amount);
            
            // Find the bucket to check its remaining capacity
            const bucket = project.buckets.find(b => b.title === bucketName);
            if (bucket) {
              // Add back the old contribution since bucket.amount includes it
              const remaining = Math.max(0, bucket.target - bucket.amount + oldContribution);
              
              // Cap the amount at the bucket's remaining capacity
              const cappedAmount = Math.min(requestedAmount, remaining);
              const actualAmount = Math.round(cappedAmount * 100) / 100;
              
              // Always update transaction amount to match the tag
              transaction.amount = transaction.amount < 0 ? -actualAmount : actualAmount;
              
              // Update the tag with the actual (possibly capped) amount
              transaction.comment = transaction.comment.replace(
                `#bucket:${bucketName}:${match[2]}`,
                `#bucket:${bucketName}:${actualAmount.toFixed(2)}`
              );
            }
          }
        } else if (bucketTagMatches.length > 1) {
          // Multiple bucket tags - this was a distributed transaction
          // Recalculate distribution with smart allocation
          const amount = transaction.amount;
          
          // Remove old bucket tags
          let cleanComment = transaction.comment;
          bucketTagMatches.forEach(tag => {
            cleanComment = cleanComment.replace(tag, '').trim();
          });
          
          // Recalculate smart allocation
          const result = this.distributeAmountToBuckets(project.buckets, amount);
          const { allocations, adjustedAmount } = result;
          
          // Update transaction amount if needed
          if (adjustedAmount !== undefined) {
            transaction.amount = adjustedAmount;
          }
          
          // Create new allocation tags
          const allocationTags = allocations
            .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
            .join(' ');
          
          // Append to cleaned comment
          transaction.comment = cleanComment
            ? `${cleanComment}\n${allocationTags}`
            : allocationTags;
        }
        
        return; // Exit after updating Smile
      }
    }
    
    // Try Fire emergencies
    for (let i = 0; i < AppStateService.instance.allFireEmergencies.length; i++) {
      if (transaction.category === ("@" + AppStateService.instance.allFireEmergencies[i].title)) {
        const fire = AppStateService.instance.allFireEmergencies[i];
        
        // Check if there are valid manual bucket allocations in the comment
        const manualAllocations = this.parseManualBucketAllocations(
          transaction.comment,
          transaction.amount,
          fire.buckets || []
        );
        
        if (manualAllocations) {
          // User has valid manual allocations that add up - keep them as-is
          return;
        }
        
        // No valid manual allocations - check if comment contains bucket tags to update
        const bucketTagMatches = transaction.comment.match(/#bucket:([^:]+):([\d.]+)/g);
        if (!bucketTagMatches) {
          // Transaction has no bucket tags - add smart allocation tags
          if (fire.buckets?.length > 0) {
            const amount = transaction.amount;
            const result = this.distributeAmountToBuckets(fire.buckets, amount);
            const { allocations, adjustedAmount } = result;
            
            // Update transaction amount if capped
            if (adjustedAmount !== undefined) {
              transaction.amount = adjustedAmount;
            }
            
            // Create allocation tags
            const allocationTags = allocations
              .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
              .join(' ');
            
            // Append to existing comment
            transaction.comment = transaction.comment
              ? `${transaction.comment}\n${allocationTags}`
              : allocationTags;
          }
          return;
        }
        
        if (bucketTagMatches.length === 1 && fire.buckets?.length >= 1) {
          // Single bucket tag - user manually selected one bucket
          // Check bucket's remaining capacity and cap if needed
          const match = bucketTagMatches[0].match(/#bucket:([^:]+):([\d.]+)/);
          if (match) {
            const bucketName = match[1];
            const oldContribution = parseFloat(match[2]);
            const requestedAmount = Math.abs(transaction.amount);
            
            // Find the bucket to check its remaining capacity
            const bucket = fire.buckets.find(b => b.title === bucketName);
            if (bucket) {
              // Add back the old contribution since bucket.amount includes it
              const remaining = Math.max(0, bucket.target - bucket.amount + oldContribution);
              
              // Cap the amount at the bucket's remaining capacity
              const cappedAmount = Math.min(requestedAmount, remaining);
              const actualAmount = Math.round(cappedAmount * 100) / 100;
              
              // Always update transaction amount to match the tag
              transaction.amount = transaction.amount < 0 ? -actualAmount : actualAmount;
              
              // Update the tag with the actual (possibly capped) amount
              transaction.comment = transaction.comment.replace(
                `#bucket:${bucketName}:${match[2]}`,
                `#bucket:${bucketName}:${actualAmount.toFixed(2)}`
              );
            }
          }
        } else if (bucketTagMatches.length > 1) {
          // Multiple bucket tags - this was a distributed transaction
          // Recalculate distribution with smart allocation
          const amount = transaction.amount;
          
          // Remove old bucket tags
          let cleanComment = transaction.comment;
          bucketTagMatches.forEach(tag => {
            cleanComment = cleanComment.replace(tag, '').trim();
          });
          
          // Recalculate smart allocation
          const result = this.distributeAmountToBuckets(fire.buckets, amount);
          const { allocations, adjustedAmount } = result;
          
          // Update transaction amount if needed
          if (adjustedAmount !== undefined) {
            transaction.amount = adjustedAmount;
          }
          
          // Create new allocation tags
          const allocationTags = allocations
            .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
            .join(' ');
          
          // Append to cleaned comment
          transaction.comment = cleanComment
            ? `${cleanComment}\n${allocationTags}`
            : allocationTags;
        }
        
        return; // Exit after updating Fire
      }
    }
  }

  /**
   * Smart allocation algorithm - same as in AddComponent
   */
  distributeAmountToBuckets(buckets: any[], transactionAmount: number): { 
    allocations: Array<{bucketName: string, amount: number}>,
    adjustedAmount?: number 
  } {
    const amountToDistribute = Math.abs(transactionAmount);
    const allocations: Array<{bucketName: string, amount: number}> = [];
    
    const bucketInfo = buckets.map(bucket => ({
      bucket,
      remaining: Math.max(0, bucket.target - bucket.amount),
      allocated: 0
    }));
    
    let remainingToDistribute = amountToDistribute;
    let activeBuckets = bucketInfo.filter(b => b.remaining > 0);
    
    if (activeBuckets.length === 0) {
      const perBucket = amountToDistribute / buckets.length;
      buckets.forEach(bucket => {
        allocations.push({
          bucketName: bucket.title,
          amount: perBucket
        });
      });
      return { allocations };
    }
    
    while (remainingToDistribute > 0.01 && activeBuckets.length > 0) {
      const perBucket = remainingToDistribute / activeBuckets.length;
      let overflow = 0;
      const bucketsToRemove: any[] = [];
      
      activeBuckets.forEach(info => {
        if (perBucket <= info.remaining + 0.01) {
          info.allocated += perBucket;
          info.remaining -= perBucket;
        } else {
          overflow += (perBucket - info.remaining);
          info.allocated += info.remaining;
          info.remaining = 0;
          bucketsToRemove.push(info);
        }
      });
      
      activeBuckets.forEach(info => {
        info.allocated = Math.round(info.allocated * 100) / 100;
      });
      bucketsToRemove.forEach(info => {
        info.allocated = Math.round(info.allocated * 100) / 100;
      });
      
      activeBuckets = activeBuckets.filter(b => !bucketsToRemove.includes(b));
      remainingToDistribute = overflow;
    }
    
    bucketInfo.forEach(info => {
      if (info.allocated > 0.01) {
        allocations.push({
          bucketName: info.bucket.title,
          amount: Math.round(info.allocated * 100) / 100
        });
      }
    });
    
    let adjustedAmount: number | undefined;
    if (remainingToDistribute > 0.01 && activeBuckets.length === 0) {
      const totalAllocated = bucketInfo.reduce((sum, info) => sum + info.allocated, 0);
      adjustedAmount = transactionAmount < 0 ? -totalAllocated : totalAllocated;
    }
    
    return { allocations, adjustedAmount };
  }

  /**
   * Removes the liabilities based on the category.
   * @param category - The category of the transaction.
   */
  removeFromLiabiltities(category: string) {
    for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.liabilities[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.liabilities[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
      }
    }
  }

  removeFromSmileProject(category: string) {
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allSmileProjects[i].title.toLocaleLowerCase())) {
        const project = AppStateService.instance.allSmileProjects[i];
        const amount = AppStateService.instance.allTransactions[InfoComponent.index].amount;
        const comment = AppStateService.instance.allTransactions[InfoComponent.index].comment;
        
        // Extract bucket ID from comment
        const bucketIdMatch = comment?.match(/#bucket:([^\s]+)/);
        
        if (bucketIdMatch && project.buckets) {
          // Remove from specific bucket
          const bucketId = bucketIdMatch[1];
          const bucket = project.buckets.find(b => b.id === bucketId);
          if (bucket) {
            bucket.amount = Math.round((bucket.amount + amount) * 100) / 100;
          }
        } else if (project.buckets?.length > 0) {
          // No bucket tag - distribute removal equally across all buckets
          const amountPerBucket = amount / project.buckets.length;
          project.buckets.forEach(bucket => {
            bucket.amount = Math.round((bucket.amount + amountPerBucket) * 100) / 100;
          });
        }
        
        // Log smile project removal from delete transaction
        this.frontendLogger.logActivity('update_smile_project_from_transaction', 'info', {
          projectType: 'smile',
          projectTitle: project.title,
          amount: -amount,  // negative to show reversal
          bucketId: bucketIdMatch?.[1],
          category: category,
          source: 'delete_transaction'
        });
      }
    }
  }

  removeFromFireEmergencie(category: string) {
    // Fire emergency amounts are recalculated automatically by incomeStatement.recalculate()
    // No manual updates needed - the service recalculates all bucket amounts from transactions
  }

  updateStorage() {
    // Skip blocking authentication check for better UX
    // Database writes will fail gracefully if user is not authenticated

    // User is authenticated
    try {
      // Close dialog immediately for better UX
      InfoComponent.isInfo = false;
      InfoComponent.isError = false;

      this.persistence.batchWriteAndSync({
        writes: [
          { tag: "income/revenue/interests", data: AppStateService.instance.allIntrests },
          { tag: "income/revenue/properties", data: AppStateService.instance.allProperties },
          { tag: "income/revenue/revenues", data: AppStateService.instance.allRevenues },
          { tag: "income/expenses/daily", data: AppStateService.instance.dailyExpenses },
          { tag: "income/expenses/splurge", data: AppStateService.instance.splurgeExpenses },
          // Only write tier2 data (smile/fire/mojo) if tier2 has been loaded.
          // Writing before load would overwrite real DB data with empty defaults.
          ...(AppStateService.instance.tier2Loaded ? [
            { tag: "income/expenses/smile", data: AppStateService.instance.smileExpenses },
            { tag: "income/expenses/fire", data: AppStateService.instance.fireExpenses },
            { tag: "income/expenses/mojo", data: AppStateService.instance.mojoExpenses },
            { tag: "smile", data: AppStateService.instance.allSmileProjects },
            { tag: "fire", data: AppStateService.instance.allFireEmergencies },
            { tag: "mojo", data: AppStateService.instance.mojo },
          ] : []),
          // Only write balance/grow data if it has been loaded (Tier 3 on-demand).
          // Writing before load would overwrite real DB data with empty arrays.
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { tag: "balance/asset/assets", data: AppStateService.instance.allAssets },
            { tag: "balance/asset/shares", data: AppStateService.instance.allShares },
            { tag: "balance/asset/investments", data: AppStateService.instance.allInvestments },
            { tag: "balance/liabilities", data: AppStateService.instance.liabilities }
          ] : []),
          { tag: "transactions", data: AppStateService.instance.allTransactions },
          ...(AppStateService.instance.tier3GrowLoaded ? [
            { tag: "grow", data: AppStateService.instance.allGrowProjects }
          ] : [])
        ],
        localStorageSaves: [
          { key: "transactions", data: JSON.stringify(AppStateService.instance.allTransactions) },
          { key: "interests", data: JSON.stringify(AppStateService.instance.allIntrests) },
          { key: "properties", data: JSON.stringify(AppStateService.instance.allProperties) },
          { key: "revenues", data: JSON.stringify(AppStateService.instance.allRevenues) },
          { key: "dailyEx", data: JSON.stringify(AppStateService.instance.dailyExpenses) },
          { key: "splurgeEx", data: JSON.stringify(AppStateService.instance.splurgeExpenses) },
          ...(AppStateService.instance.tier2Loaded ? [
            { key: "smileEx", data: JSON.stringify(AppStateService.instance.smileExpenses) },
            { key: "fireEx", data: JSON.stringify(AppStateService.instance.fireExpenses) },
            { key: "mojoEx", data: JSON.stringify(AppStateService.instance.mojoExpenses) },
            { key: "smile", data: JSON.stringify(AppStateService.instance.allSmileProjects) },
            { key: "fire", data: JSON.stringify(AppStateService.instance.allFireEmergencies) },
            { key: "mojo", data: JSON.stringify(AppStateService.instance.mojo) },
          ] : []),
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) },
            { key: "assets", data: JSON.stringify(AppStateService.instance.allAssets) },
            { key: "shares", data: JSON.stringify(AppStateService.instance.allShares) },
            { key: "investments", data: JSON.stringify(AppStateService.instance.allInvestments) }
          ] : []),
          ...(AppStateService.instance.tier3GrowLoaded ? [
            { key: "grow", data: JSON.stringify(AppStateService.instance.allGrowProjects) }
          ] : [])
        ],
        onError: (error) => {
          this.showError(error);
        }
      });
    } catch (error) {
      this.showError(error);
    }
  }

  removeFromInterests(category: string) {
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allIntrests[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
      }
      AppStateService.instance.allIntrests[i].amount = parseFloat(AppStateService.instance.allIntrests[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if(AppStateService.instance.allIntrests[i].amount == 0){
        AppStateService.instance.allIntrests.splice(i, 1);
      }
    }
  }
  removeFromProperties(category: string) {
    for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allProperties[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
      }
      AppStateService.instance.allProperties[i].amount = parseFloat(AppStateService.instance.allProperties[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if(AppStateService.instance.allProperties[i].amount == 0){
        AppStateService.instance.allProperties.splice(i, 1);
      }
    }
  }
  removeFromReveneus(category: string) {
    for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase())) {
        AppStateService.instance.allRevenues[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
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
        AppStateService.instance.dailyExpenses[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
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
        AppStateService.instance.splurgeExpenses[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
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
        AppStateService.instance.smileExpenses[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
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
        AppStateService.instance.fireExpenses[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
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
        AppStateService.instance.mojoExpenses[i].amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
      }
      AppStateService.instance.mojoExpenses[i].amount = parseFloat(AppStateService.instance.mojoExpenses[i].amount.toFixed(2));
      //check if tag is emty -> delete
      if (AppStateService.instance.mojoExpenses[i].amount == 0) {
        AppStateService.instance.mojoExpenses.splice(i, 1);
      }
    }
  }

  removeFromMojo() {
    AppStateService.instance.mojo.amount += AppStateService.instance.allTransactions[InfoComponent.index].amount;
    // Log mojo removal from delete transaction
    this.frontendLogger.logActivity('update_mojo_from_transaction', 'info', {
      projectType: 'mojo',
      amount: -AppStateService.instance.allTransactions[InfoComponent.index].amount,  // negative to show reversal
      newBalance: AppStateService.instance.mojo.amount,
      target: AppStateService.instance.mojo.target,
      source: 'delete_transaction'
    });
  }
  addMojo() {
    AppStateService.instance.mojo.amount -= AppStateService.instance.allTransactions[InfoComponent.index].amount;
  }

  updateMojo() {
    const amountDiff = this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
    AppStateService.instance.mojo.amount += amountDiff;
    // Log mojo update from update transaction (spending FROM Mojo)
    this.frontendLogger.logActivity('update_mojo_from_transaction', 'info', {
      projectType: 'mojo',
      amount: -amountDiff,  // negative because spending from Mojo
      newBalance: AppStateService.instance.mojo.amount,
      target: AppStateService.instance.mojo.target,
      source: 'update_transaction'
    });
  }

  addToMojo() {
    const oldAmount = AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0;
    let amountDiff = this.amountTextField - oldAmount;
    // Cap: don't exceed Mojo target
    if (AppStateService.instance.mojo.amount - amountDiff > AppStateService.instance.mojo.target) {
      amountDiff = AppStateService.instance.mojo.amount - AppStateService.instance.mojo.target;
      this.amountTextField = oldAmount + amountDiff;
    }
    AppStateService.instance.mojo.amount -= amountDiff;
    // Log mojo update from update transaction
    this.frontendLogger.logActivity('update_mojo_from_transaction', 'info', {
      projectType: 'mojo',
      amount: amountDiff,
      newBalance: AppStateService.instance.mojo.amount,
      target: AppStateService.instance.mojo.target,
      source: 'update_transaction'
    });
  }

  addToSmileProject(category: string) {
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allSmileProjects[i].title.toLocaleLowerCase())) {
        const project = AppStateService.instance.allSmileProjects[i];
        const oldAmount = AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0;
        let amountDiff = this.amountTextField - oldAmount;
        const oldComment = AppStateService.instance.allTransactions[InfoComponent.index]?.comment || '';
        const newComment = this.commentTextField;
        
        // Extract bucket IDs from old and new comments
        const oldBucketMatch = oldComment.match(/#bucket:([^\s]+)/);
        const newBucketMatch = newComment.match(/#bucket:([^\s]+)/);
        
        // Calculate total target to check cap
        const totalTarget = project.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
        const totalAmount = project.buckets.reduce((sum, b) => sum + (b.amount || 0), 0);
        
        // Cap: don't exceed the project target
        if (totalAmount - amountDiff > totalTarget) {
          amountDiff = totalAmount - totalTarget;
          this.amountTextField = oldAmount + amountDiff;
        }
        
        // If bucket changed, remove from old and add to new
        if (oldBucketMatch?.[1] !== newBucketMatch?.[1]) {
          // Remove from old bucket
          if (oldBucketMatch && project.buckets) {
            const bucket = project.buckets.find(b => b.id === oldBucketMatch[1]);
            if (bucket) bucket.amount = Math.round((bucket.amount + oldAmount) * 100) / 100;
          } else if (project.buckets?.length > 0) {
            // Distribute old amount removal equally
            const amountPerBucket = oldAmount / project.buckets.length;
            project.buckets.forEach(bucket => { 
              bucket.amount = Math.round((bucket.amount + amountPerBucket) * 100) / 100; 
            });
          }
          
          // Add to new bucket
          if (newBucketMatch && project.buckets) {
            const bucket = project.buckets.find(b => b.id === newBucketMatch[1]);
            if (bucket) bucket.amount = Math.round((bucket.amount - this.amountTextField) * 100) / 100;
          } else if (project.buckets?.length > 0) {
            // Distribute new amount equally
            const amountPerBucket = this.amountTextField / project.buckets.length;
            project.buckets.forEach(bucket => { 
              bucket.amount = Math.round((bucket.amount - amountPerBucket) * 100) / 100; 
            });
          }
        } else {
          // Same bucket, just update the difference
          if (newBucketMatch && project.buckets) {
            const bucket = project.buckets.find(b => b.id === newBucketMatch[1]);
            if (bucket) bucket.amount = Math.round((bucket.amount - amountDiff) * 100) / 100;
          } else if (project.buckets?.length > 0) {
            // Distribute difference equally
            const amountPerBucket = amountDiff / project.buckets.length;
            project.buckets.forEach(bucket => { 
              bucket.amount = Math.round((bucket.amount - amountPerBucket) * 100) / 100; 
            });
          }
        }
        
        // Log smile project update from update transaction
        this.frontendLogger.logActivity('update_smile_project_from_transaction', 'info', {
          projectType: 'smile',
          projectTitle: project.title,
          amount: -amountDiff,  // negative of the diff to show project contribution
          bucketId: newBucketMatch?.[1],
          category: category,
          source: 'update_transaction'
        });
      }
    }
  }
  addToFireEmergencie(category: string) {
    // Fire emergency amounts are recalculated automatically by incomeStatement.recalculate()
    // No manual updates or target capping needed - the service handles all calculations
  }

  updateInterests(category: string) {
    for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.allIntrests[i].amount;
        AppStateService.instance.allIntrests[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'interest',
          itemTag: AppStateService.instance.allIntrests[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.allIntrests[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
  updateProperties(category: string) {
    for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.allProperties[i].amount;
        AppStateService.instance.allProperties[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'property',
          itemTag: AppStateService.instance.allProperties[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.allProperties[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
  updateRevenues(category: string) {
    for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.allRevenues[i].amount;
        AppStateService.instance.allRevenues[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'revenue',
          itemTag: AppStateService.instance.allRevenues[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.allRevenues[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }

  updateDailyExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.dailyExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.dailyExpenses[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.dailyExpenses[i].amount;
        AppStateService.instance.dailyExpenses[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'dailyExpense',
          itemTag: AppStateService.instance.dailyExpenses[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.dailyExpenses[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
  updateSplurgeExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.splurgeExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.splurgeExpenses[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.splurgeExpenses[i].amount;
        AppStateService.instance.splurgeExpenses[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'splurgeExpense',
          itemTag: AppStateService.instance.splurgeExpenses[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.splurgeExpenses[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
  updateSmileExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.smileExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.smileExpenses[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.smileExpenses[i].amount;
        AppStateService.instance.smileExpenses[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'smileExpense',
          itemTag: AppStateService.instance.smileExpenses[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.smileExpenses[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
  updateFireExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.fireExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.fireExpenses[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.fireExpenses[i].amount;
        AppStateService.instance.fireExpenses[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'fireExpense',
          itemTag: AppStateService.instance.fireExpenses[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.fireExpenses[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
  updateMojoExpense(category: string) {
    for (let i = 0; i < AppStateService.instance.mojoExpenses.length; i++) {
      if (category.toLocaleLowerCase() === ("@" + AppStateService.instance.mojoExpenses[i].tag.toLocaleLowerCase())) {
        const oldAmount = AppStateService.instance.mojoExpenses[i].amount;
        AppStateService.instance.mojoExpenses[i].amount += this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0);
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'mojoExpense',
          itemTag: AppStateService.instance.mojoExpenses[i].tag,
          amount: this.amountTextField - (AppStateService.instance.allTransactions[InfoComponent.index]?.amount ?? 0),
          oldTotal: oldAmount,
          newTotal: AppStateService.instance.mojoExpenses[i].amount,
          operation: 'update',
          source: 'update_transaction'
        });
      }
    }
  }
}

