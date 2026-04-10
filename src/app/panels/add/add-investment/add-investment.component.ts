import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { AddSmileComponent } from '../add-smile/add-smile.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { BalanceComponent } from 'src/app/main/cashflow/balance/balance.component';
import { Investment } from 'src/app/interfaces/investment';
import { Property } from 'src/app/interfaces/property';
import { IncomeComponent } from 'src/app/main/cashflow/income/income.component';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';

import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Represents the AddInvestmentComponent class.
 */
@Component({
  selector: 'app-add-investment',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-investment.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-investment.component.css']
})
export class AddInvestmentComponent extends BaseAddComponent {

  titleTextField = "";
  depositTextField = "";
  amountTextField = "";

  static zIndex;
  static isAddInvestment;
  static isError;

  public classReference = AddInvestmentComponent;

  /**
   * Initializes a new instance of the AddInvestmentComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    AddInvestmentComponent.isAddInvestment = false;
    this.initStatic(AddInvestmentComponent);
  }

  highlight() {
    AddInvestmentComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  override closeWindow() {
    AddInvestmentComponent.isAddInvestment = false;
    this.titleTextField = "";
    this.depositTextField = "";
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
      this.showError("This investment already exists.");
    } else {
      // ready to write to Database new Transaction
      let newInvestment: Investment = {tag:this.titleTextField, deposit: this.depositTextField == "" ? 0.0 : parseFloat(this.depositTextField), amount: this.amountTextField == "" ? 0.0 : parseFloat(this.amountTextField)};
      AppStateService.instance.allInvestments.push(newInvestment);

      // Clean Up close Window
      this.titleTextField = "";
      this.depositTextField = "";
      this.amountTextField = "";
      this.clearError();
      this.persistence.writeAndSync({
        tag: 'balance/asset/investments',
        data: AppStateService.instance.allInvestments,
        localStorageKey: 'investments',
        logEvent: 'add_investment',
        logMetadata: { title: this.titleTextField, deposit: this.depositTextField, amount: this.amountTextField },
        onSuccess: () => {
          this.closeWindow();
          this.toastService.show('Investment added', 'success');
          gotoTop();
          this.router.navigate([`/balance`]);
        },
        onError: (error) => {
          this.showError(error.message || 'Database write failed');
        }
      });
    }
  }
}
