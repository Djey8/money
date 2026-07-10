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
  selector: 'app-info-asset',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-asset.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-asset.component.css']
})
export class InfoAssetComponent extends BaseInfoComponent {
  static index = 1;

  static title = "Driver Licence";
  static amount = 0.0;

  static setInfoAssetComponent(id: number, title: string, amount: number) {
    InfoAssetComponent.index = id;
    InfoAssetComponent.title = title;
    InfoAssetComponent.amount = amount;
    InfoAssetComponent.isInfo = true;
  }

  //accountTextField = InfoComponent.account;
  titleTextField = InfoAssetComponent.title;
  amountTextField = InfoAssetComponent.amount;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoAssetComponent;
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    this.initStatic(InfoAssetComponent);
  }

  buyAsset(){
    AddComponent.categoryTextField = `@${InfoAssetComponent.title}`;
    AddComponent.url = "/balance";
    AddComponent.amountTextField = "-1";
    AddComponent.commentTextField = `Buy Asset ${InfoAssetComponent.title} 1 x ${InfoAssetComponent.amount};`;
    AddComponent.isLiabilitie = false;
    AddComponent.creditTextField = "";
    InfoAssetComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }
  sellAsset(){
    AddComponent.categoryTextField = `@${InfoAssetComponent.title}`;
    AddComponent.selectedOption = "Income";
    AddComponent.amountTextField = "1";
    AddComponent.commentTextField = `Sell Asset ${InfoAssetComponent.title} 1 x ${InfoAssetComponent.amount};`;
    AddComponent.isLiabilitie = false;
    AddComponent.creditTextField = "";
    AddComponent.url = "/balance";
    InfoAssetComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  highlight() {
    InfoAssetComponent.zIndex = InfoAssetComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  override closeWindow() {
    super.closeWindow();
  }

  editAsset() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoAssetComponent.isError = false;
    this.titleTextField = InfoAssetComponent.title;
    this.amountTextField = InfoAssetComponent.amount;
  }

  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allAssets, AppStateService.instance.allShares, AppStateService.instance.allInvestments], 'tag');
  }

  updateAsset() {
    //Validation (check if Amount is not empty)
    if (this.titleTextField == "") {
      this.showError("Please fill out all required fields.");
    } else {
      if (AppStateService.instance.allAssets[InfoAssetComponent.index].tag != this.titleTextField) {
        if (this.invalidTitle(this.titleTextField)) {
          this.showError("This fire asset already exists.");
        }
      }
      if (!InfoAssetComponent.isError) {
        // update existing transaction (PATCH)
        //AppStateService.instance.allSmileProjects[InfoComponent.index].tit
        AppStateService.instance.allAssets[InfoAssetComponent.index].tag = this.titleTextField;
        AppStateService.instance.allAssets[InfoAssetComponent.index].amount = this.amountTextField;

        InfoAssetComponent.title = this.titleTextField;
        InfoAssetComponent.amount = this.amountTextField;

        InfoAssetComponent.isInfo = false;
        InfoAssetComponent.isError = false;
        AppStateService.instance.isSaving = true;

        this.persistence.writeAndSync({
          tag: 'balance/asset/assets',
          data: AppStateService.instance.allAssets,
          localStorageKey: 'assets',
          logEvent: 'update_asset',
          logMetadata: { title: this.titleTextField, amount: this.amountTextField },
          onSuccess: () => {
            AppStateService.instance.isSaving = false;
            this.toastService.show('Asset updated', 'update');
          },
          onError: (error) => {
            AppStateService.instance.isSaving = false;
            this.toastService.show(error.message || 'Database write failed', 'error');
          }
        });
      }
    }
  }

  deleteAsset(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteAsset'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.allAssets[index].tag;

      try {
        //now delete asset project
        AppStateService.instance.allAssets.splice(index, 1);

        InfoAssetComponent.isInfo = false;
        InfoAssetComponent.isError = false;
        AppStateService.instance.isSaving = true;

        this.persistence.writeAndSync({
          tag: 'balance/asset/assets',
          data: AppStateService.instance.allAssets,
          localStorageKey: 'assets',
          logEvent: 'delete_asset',
          logMetadata: { title: deletedTitle, index: index },
          onSuccess: () => {
            AppStateService.instance.isSaving = false;
            this.toastService.show('Asset deleted', 'delete');
          },
          onError: (error) => {
            AppStateService.instance.isSaving = false;
            this.toastService.show(error.message || 'Database write failed', 'error');
          }
        });
      } catch (error) {
        this.showError(error.message || 'Error occurred');
      }
    });
  }
}
