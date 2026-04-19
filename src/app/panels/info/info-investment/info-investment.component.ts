import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let BalanceComponent: any; setTimeout(() => import('../../../main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let IncomeComponent: any; setTimeout(() => import('../../../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
@Component({
  selector: 'app-info-investment',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-investment.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-investment.component.css']
})
export class InfoInvestmentComponent extends BaseInfoComponent {
  static index = 1;
  
  static title = "Driver Licence";
  static deposit = 0.0;
  static amount = 0.0;

  static setInfoInvestmentComponent(id:number, title: string, deposit: number, amount: number){
    InfoInvestmentComponent.index = id;
    InfoInvestmentComponent.title = title;
    InfoInvestmentComponent.deposit = deposit;
    InfoInvestmentComponent.amount = amount;
    InfoInvestmentComponent.isInfo = true;
  }

  //accountTextField = InfoComponent.account;
  titleTextField = InfoInvestmentComponent.title;
  depositTextField = InfoInvestmentComponent.deposit;
  amountTextField = InfoInvestmentComponent.amount;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoInvestmentComponent;
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    this.initStatic(InfoInvestmentComponent);
  }

  highlight() {
    InfoInvestmentComponent.zIndex = 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  override closeWindow() {
    super.closeWindow();
  }

  add(){
    AddComponent.categoryTextField = `@${InfoInvestmentComponent.title}`;
    AddComponent.selectedOption="Income";
    AddComponent.url = "/balance";
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    InfoInvestmentComponent.isInfo = false;
  }

  editInvestment(){
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoInvestmentComponent.isError = false;
    this.titleTextField = InfoInvestmentComponent.title;
    this.depositTextField = InfoInvestmentComponent.deposit;
    this.amountTextField = InfoInvestmentComponent.amount;
  }

  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allAssets, AppStateService.instance.allShares, AppStateService.instance.allInvestments], 'tag');
  }

  updateInvestment(){
    //Validation (check if Amount is not empty)
    if (this.titleTextField =="") {
      this.showError("Please fill out all required fields.");
    } else {
      if(AppStateService.instance.allInvestments[InfoInvestmentComponent.index].tag != this.titleTextField){
        if (this.invalidTitle(this.titleTextField)) {
          this.showError("This investment already exists.");
        }
      }
      if(!InfoInvestmentComponent.isError){
        //Check if tag is different
        if(AppStateService.instance.allInvestments[InfoInvestmentComponent.index].tag != this.titleTextField){
          //update Income properties
          for (let i=0; i < AppStateService.instance.allProperties.length; i++){
            if(AppStateService.instance.allProperties[i].tag == AppStateService.instance.allInvestments[InfoInvestmentComponent.index].tag){
              //update allProperties
              AppStateService.instance.allProperties[i].tag = this.titleTextField;
              this.persistence.writeAndSync({
                tag: 'income/revenue/properties',
                data: AppStateService.instance.allProperties,
                localStorageKey: 'properties',
                logEvent: 'update_investment_properties',
                logMetadata: { title: this.titleTextField },
                onSuccess: () => {
                  this.clearError();
                  this.isEdit = false;
                },
                onError: (error) => {
                  this.showError(error.message || 'Database write failed');
                }
              });
            }
          }
        }
        // update existing transaction (PATCH)
        //AppStateService.instance.allSmileProjects[InfoComponent.index].tit
        AppStateService.instance.allInvestments[InfoInvestmentComponent.index].tag = this.titleTextField;
        AppStateService.instance.allInvestments[InfoInvestmentComponent.index].deposit = this.depositTextField;
        AppStateService.instance.allInvestments[InfoInvestmentComponent.index].amount = this.amountTextField;

        InfoInvestmentComponent.title = this.titleTextField;
        InfoInvestmentComponent.deposit = this.depositTextField;
        InfoInvestmentComponent.amount = this.amountTextField;
        InfoInvestmentComponent.isInfo = false;
        InfoInvestmentComponent.isError = false;
        AppStateService.instance.isSaving = true;

        this.persistence.writeAndSync({
          tag: 'balance/asset/investments',
          data: AppStateService.instance.allInvestments,
          localStorageKey: 'investments',
          logEvent: 'update_investment',
          logMetadata: {
            title: this.titleTextField,
            deposit: this.depositTextField,
            amount: this.amountTextField
          },
          onSuccess: () => {
            AppStateService.instance.isSaving = false;
            this.toastService.show('Investment updated', 'update');
          },
          onError: (error) => {
            AppStateService.instance.isSaving = false;
            this.toastService.show(error.message || 'Database write failed', 'error');
          }
        });
      }
    }
  }

  deleteInvestment(index: number){
    this.confirmService.confirm(this.translate.instant('Confirm.deleteInvestment'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.allInvestments[index].tag;

      AppStateService.instance.allInvestments.splice(index, 1);
      InfoInvestmentComponent.isInfo = false;
      InfoInvestmentComponent.isError = false;
      AppStateService.instance.isSaving = true;

      this.persistence.writeAndSync({
        tag: 'balance/asset/investments',
        data: AppStateService.instance.allInvestments,
        localStorageKey: 'investments',
        logEvent: 'delete_investment',
        logMetadata: { title: deletedTitle, index: index },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          this.toastService.show('Investment deleted', 'delete');
          this.router.navigate(['/balance']);
        },
        onError: (error) => {
          AppStateService.instance.isSaving = false;
          this.toastService.show(error.message || 'Database write failed', 'error');
        }
      });
    });
  }
}
