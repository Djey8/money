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
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let BalanceComponent: any; setTimeout(() => import('../../../main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let IncomeComponent: any; setTimeout(() => import('../../../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let GrowComponent: any; setTimeout(() => import('../../../main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
@Component({
  selector: 'app-info-share',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-share.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-share.component.css']
})
export class InfoShareComponent extends BaseInfoComponent {
  static index = 1;

  static title = "Driver Licence";
  static quantity = 0.0;
  static price = 0.0;

  static setInfoShareComponent(id: number, title: string, quantity: number, price: number) {
    InfoShareComponent.index = id;
    InfoShareComponent.title = title;
    InfoShareComponent.quantity = quantity;
    InfoShareComponent.price = price;
    InfoShareComponent.isInfo = true;
  }

  //accountTextField = InfoComponent.account;
  titleTextField = InfoShareComponent.title;
  quantityTextField = InfoShareComponent.quantity;
  priceTextField = InfoShareComponent.price;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoShareComponent;
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    this.initStatic(InfoShareComponent);
  }

  buyShare(){
    AddComponent.categoryTextField = `@${InfoShareComponent.title}`;
    AddComponent.url = "/balance";
    AddComponent.amountTextField = "-1";
    AddComponent.commentTextField = `Buy Share ${InfoShareComponent.title} ${InfoShareComponent.quantity} x ${InfoShareComponent.price};`;
    AddComponent.isLiabilitie = false;
    AddComponent.creditTextField = "";
    InfoShareComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }
  sellShare(){
    AddComponent.categoryTextField = `@${InfoShareComponent.title}`;
    AddComponent.selectedOption = "Income";
    AddComponent.amountTextField = "1";
    AddComponent.commentTextField = `Sell Share ${InfoShareComponent.title} ${InfoShareComponent.quantity} x ${InfoShareComponent.price};`;
    AddComponent.isLiabilitie = false;
    AddComponent.creditTextField = "";
    AddComponent.url = "/balance";
    InfoShareComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  dividende(){
    AddComponent.categoryTextField = `@${InfoShareComponent.title}`;
    AddComponent.selectedOption = "Income";
    AddComponent.amountTextField = "1";
    AddComponent.commentTextField = `Dividende Share ${InfoShareComponent.title} ${InfoShareComponent.quantity} x ${InfoShareComponent.price}`;
    AddComponent.isLiabilitie = false;
    AddComponent.creditTextField = "";
    AddComponent.url = "/balance";
    InfoShareComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  highlight() {
    InfoShareComponent.zIndex = InfoShareComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  editShare() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoShareComponent.isError = false;
    this.titleTextField = InfoShareComponent.title;
    this.quantityTextField = AppStateService.instance.allShares[InfoShareComponent.index].quantity;
    this.priceTextField = InfoShareComponent.price;
  }

  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allAssets, AppStateService.instance.allShares, AppStateService.instance.allInvestments], 'tag');
  }

  updateShare() {
    //Validation (check if Amount is not empty)
    if (this.titleTextField == "") {
      this.showError("Please fill out all required fields.");
    } else {
      if (AppStateService.instance.allShares[InfoShareComponent.index].tag != this.titleTextField) {
        if (this.invalidTitle(this.titleTextField)) {
          this.showError("This share already exists.");
        }
      }
      if (!InfoShareComponent.isError) {
        //Check if tag is different
        if (AppStateService.instance.allShares[InfoShareComponent.index].tag != this.titleTextField) {
          //update Income properties
          for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
            if (AppStateService.instance.allIntrests[i].tag == AppStateService.instance.allShares[InfoShareComponent.index].tag) {
              //update allProperties
              AppStateService.instance.allIntrests[i].tag = this.titleTextField;
              this.persistence.writeAndSync({
                tag: 'income/revenue/interests',
                data: AppStateService.instance.allIntrests,
                localStorageKey: 'interests',
                logEvent: 'update_share_interests',
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
        AppStateService.instance.allShares[InfoShareComponent.index].tag = this.titleTextField;
        AppStateService.instance.allShares[InfoShareComponent.index].quantity = this.quantityTextField;
        AppStateService.instance.allShares[InfoShareComponent.index].price = this.priceTextField;
        
        // update Grow Projects
        for(let i=0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(this.titleTextField == AppStateService.instance.allGrowProjects[i].title){
            AppStateService.instance.allGrowProjects[i].share.quantity = this.quantityTextField;
            AppStateService.instance.allGrowProjects[i].share.price = this.priceTextField;
          } 
        }

        InfoShareComponent.title = this.titleTextField;
        InfoShareComponent.quantity = this.quantityTextField;
        InfoShareComponent.price = this.priceTextField;
        try {
          //update database
          const writes = [
            { tag: "balance/asset/shares", data: AppStateService.instance.allShares },
            { tag: "grow", data: AppStateService.instance.allGrowProjects }
          ];

          this.persistence.batchWriteAndSync({
            writes,
            localStorageSaves: [
              { key: 'shares', data: AppStateService.instance.allShares },
              { key: 'grow', data: AppStateService.instance.allGrowProjects }
            ],
            logEvent: 'update_share',
            logMetadata: {
              title: this.titleTextField,
              quantity: this.quantityTextField,
              price: this.priceTextField
            },
            onSuccess: () => {
              this.clearError();
              this.isEdit = false;
              this.toastService.show('Share updated', 'update');
              AppComponent.gotoTop();
            },
            onError: (error) => {
              this.showError(error.message || 'Database write failed');
            }
          });
        } catch (error) {
          this.showError(error.message || 'Error occurred');
        }
      }
    }
  }

  deleteShare(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteShare'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.allShares[index].tag;

      AppStateService.instance.allShares.splice(index, 1);
      InfoShareComponent.isInfo = false;
      InfoShareComponent.isError = false;

      this.persistence.writeAndSync({
        tag: 'balance/asset/shares',
        data: AppStateService.instance.allShares,
        localStorageKey: 'shares',
        logEvent: 'delete_share',
        logMetadata: { title: deletedTitle, index: index },
        onSuccess: () => {
          this.toastService.show('Share deleted', 'delete');
          AppComponent.gotoTop();
          this.router.navigate(['/balance']);
        },
        onError: (error) => {
          this.showError(error.message || 'Database write failed');
        }
      });
    });
  }
}
