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
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
@Component({
  selector: 'app-info-liabilitie',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-liabilitie.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-liabilitie.component.css']
})
export class InfoLiabilitieComponent extends BaseInfoComponent {
  static index = 1;
  
  static title = "Driver Licence";
  static amount = 0.0;
  static credit = 0.0;
  static isInvestment = false;

  static setInfoLiabilitieComponent(id:number, title: string, amount: number, credit: number,isInvestment: boolean){
    InfoLiabilitieComponent.index = id;
    InfoLiabilitieComponent.title = title;
    InfoLiabilitieComponent.amount = amount;
    InfoLiabilitieComponent.credit = credit;
    InfoLiabilitieComponent.isInvestment = isInvestment;
    InfoLiabilitieComponent.isInfo = true;
  }

  //accountTextField = InfoComponent.account;
  titleTextField = InfoLiabilitieComponent.title;
  amountTextField = InfoLiabilitieComponent.amount;
  creditTextField = InfoLiabilitieComponent.credit;
  isInvestment = InfoLiabilitieComponent.isInvestment;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoLiabilitieComponent;
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    this.initStatic(InfoLiabilitieComponent);
  }

  highlight() {
    InfoLiabilitieComponent.zIndex = 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  override closeWindow() {
    super.closeWindow();
  }

  editLiabilitie(){
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoLiabilitieComponent.isError = false;
    this.titleTextField = InfoLiabilitieComponent.title;
    this.amountTextField = InfoLiabilitieComponent.amount;
    this.creditTextField = InfoLiabilitieComponent.credit;
    this.isInvestment = InfoLiabilitieComponent.isInvestment
  }

  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.liabilities], 'tag');
  }

  payback(){
    AddComponent.categoryTextField = `@${InfoLiabilitieComponent.title}`;
    AddComponent.url = "/balance";
    AddComponent.commentTextField = "Payback Liabilitie " + InfoLiabilitieComponent.amount + " " + InfoLiabilitieComponent.credit + ";";
    AddComponent.amountTextField = "-1";
    AddComponent.isLiabilitie = false;
    InfoLiabilitieComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }


  updateLiabilitie(){
    //Validation (check if Amount is not empty)
    if (this.titleTextField =="") {
      this.showError("Please fill out all required fields.");
    } else {
      if(AppStateService.instance.liabilities[InfoLiabilitieComponent.index].tag != this.titleTextField){
        if (this.invalidTitle(this.titleTextField)) {
          this.showError("This liabilitie already exists.");
        }
      }
      if(!InfoLiabilitieComponent.isError){

        // update existing transaction (PATCH)
        //AppStateService.instance.allSmileProjects[InfoComponent.index].tit
        AppStateService.instance.liabilities[InfoLiabilitieComponent.index].tag = this.titleTextField;
        AppStateService.instance.liabilities[InfoLiabilitieComponent.index].amount = this.amountTextField;
        AppStateService.instance.liabilities[InfoLiabilitieComponent.index].credit = this.creditTextField;
        AppStateService.instance.liabilities[InfoLiabilitieComponent.index].investment = this.isInvestment;

        InfoLiabilitieComponent.title = this.titleTextField;
        InfoLiabilitieComponent.amount = this.amountTextField;
        InfoLiabilitieComponent.credit = this.creditTextField;
        InfoLiabilitieComponent.isInvestment = this.isInvestment;
        
        InfoLiabilitieComponent.isInfo = false;
        InfoLiabilitieComponent.isError = false;
        AppStateService.instance.isSaving = true;

        this.persistence.writeAndSync({
          tag: 'balance/liabilities',
          data: AppStateService.instance.liabilities,
          localStorageKey: 'liabilities',
          logEvent: 'update_liability',
          logMetadata: {
            title: this.titleTextField,
            amount: this.amountTextField,
            credit: this.creditTextField,
            isInvestment: this.isInvestment
          },
          onSuccess: () => {
            AppStateService.instance.isSaving = false;
            this.toastService.show('Liability updated', 'update');
          },
          onError: (error) => {
            AppStateService.instance.isSaving = false;
            this.toastService.show(error.message || 'Database write failed', 'error');
          }
        });
      }
    }
  }

  deleteLiabilitie(index: number){
    this.confirmService.confirm(this.translate.instant('Confirm.deleteLiability'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.liabilities[index].tag;

      AppStateService.instance.liabilities.splice(index, 1);
      InfoLiabilitieComponent.isInfo = false;
      InfoLiabilitieComponent.isError = false;
      AppStateService.instance.isSaving = true;

      this.persistence.writeAndSync({
        tag: 'balance/liabilities',
        data: AppStateService.instance.liabilities,
        localStorageKey: 'liabilities',
        logEvent: 'delete_liability',
        logMetadata: { title: deletedTitle, index: index },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          this.toastService.show('Liability deleted', 'delete');
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
