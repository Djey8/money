import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { AddSmileComponent } from '../add-smile/add-smile.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { BalanceComponent } from 'src/app/main/cashflow/balance/balance.component';
import { Asset } from 'src/app/interfaces/asset';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';

import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Represents the AddAssetComponent class.
 */
@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-asset.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-asset.component.css']
})
export class AddAssetComponent extends BaseAddComponent {

  titleTextField = "";
  amountTextField = "";

  static zIndex;
  static isAddAsset;
  static isError;

  public classReference = AddAssetComponent;

  /**
   * Initializes a new instance of the AddAssetComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    AddAssetComponent.isAddAsset = false;
    this.initStatic(AddAssetComponent);
  }

  highlight() {
    AddAssetComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  override closeWindow() {
    AddAssetComponent.isAddAsset = false;
    this.amountTextField = "";
    super.closeWindow();
  }

  /**
   * Checks if the title is invalid.
   * @param title - The title to be checked.
   * @returns True if the title is invalid, false otherwise.
   */
  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allAssets, AppStateService.instance.allShares, AppStateService.instance.allInvestments], 'tag');
  }

  /**
   * Adds an asset.
   */
  addAsset(){
    //First trim string
    this.titleTextField = this.titleTextField.trim();
    //Validation (check if Amount is not empty)
    if (!this.validateRequired([
      { name: 'title', value: this.titleTextField, label: 'Title' }
    ])) {
      // field errors shown inline
    } else if (this.invalidTitle(this.titleTextField)) {
      this.showError("This fire asset already exists.");
    } else {
      // ready to write to Database new Transaction
      let newAsset: Asset = {tag:this.titleTextField, amount: this.amountTextField == "" ? 0.0 : parseFloat(this.amountTextField)};
      AppStateService.instance.allAssets.push(newAsset);
      // Clean Up close Window
      this.titleTextField = "";
      this.amountTextField = "";
      this.clearError();
      this.closeWindow();
      AppStateService.instance.isSaving = true;

      this.persistence.writeAndSync({
        tag: 'balance/asset/assets',
        data: AppStateService.instance.allAssets,
        localStorageKey: 'assets',
        logEvent: 'add_asset',
        logMetadata: { title: this.titleTextField, amount: this.amountTextField },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          this.toastService.show('Asset added', 'success');
          gotoTop();
          this.router.navigate([`/balance`]);
        },
        onError: (error) => {
          AppStateService.instance.isSaving = false;
          this.toastService.show(error.message || 'Database write failed', 'error');
        }
      });
    }
  }
}
