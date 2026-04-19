import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { AddSmileComponent } from '../add-smile/add-smile.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { BalanceComponent } from 'src/app/main/cashflow/balance/balance.component';
import { Share } from 'src/app/interfaces/share';
import { Interest } from 'src/app/interfaces/interest';
import { IncomeComponent } from 'src/app/main/cashflow/income/income.component';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';

import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
/**
 * Represents the AddShareComponent class.
 */
@Component({
  selector: 'app-add-share',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-share.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-share.component.css']
})
export class AddShareComponent extends BaseAddComponent {

  titleTextField = "";
  quantityTextField = "";
  priceTextField = "";

  static zIndex;
  static isAddShare;
  static isError;

  public classReference = AddShareComponent;

  /**
   * Initializes a new instance of the AddShareComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private localStorage: LocalService, private persistence: PersistenceService) {
    super(router);
    AddShareComponent.isAddShare = false;
    this.initStatic(AddShareComponent);
  }

  highlight() {
    AddShareComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  /**
   * Closes the window.
   */
  override closeWindow() {
    AddShareComponent.isAddShare = false;
    this.titleTextField = "";
    this.quantityTextField = "";
    this.priceTextField = "";
    super.closeWindow();
  }

  /**
   * Checks if the given title is invalid.
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
      this.showError("This share already exists.");
    } else {
      // ready to write to Database new Transaction
      let newShare: Share = {tag:this.titleTextField.replace(" ", ""), quantity: this.quantityTextField == "" ? 0.0 : parseFloat(this.quantityTextField), price: this.priceTextField == "" ? 0.0 : parseFloat(this.priceTextField)};
      AppStateService.instance.allShares.push(newShare);

      // Clean Up close Window
      this.titleTextField = "";
      this.quantityTextField = "";
      this.priceTextField = "";
      this.clearError();
      this.closeWindow();
      AppStateService.instance.isSaving = true;
      this.persistence.writeAndSync({
        tag: 'balance/asset/shares',
        data: AppStateService.instance.allShares,
        localStorageKey: 'shares',
        logEvent: 'add_share',
        logMetadata: { title: this.titleTextField, quantity: this.quantityTextField, price: this.priceTextField },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests));
          this.toastService.show('Share added', 'success');
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
