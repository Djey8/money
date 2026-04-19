import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { AddSmileComponent } from '../add-smile/add-smile.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { BalanceComponent } from 'src/app/main/cashflow/balance/balance.component';
import { Liability } from 'src/app/interfaces/liability';
import { Expense } from 'src/app/interfaces/expense';
import { IncomeComponent } from 'src/app/main/cashflow/income/income.component';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';

import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Represents the component for adding a liability.
 */
@Component({
  selector: 'app-add-liabilitie',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-liabilitie.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-liabilitie.component.css']
})
export class AddLiabilitieComponent extends BaseAddComponent {

  titleTextField = "";
  amountTextField = "";
  isInvestment = false;
  creditTextField = "";

  AddToFire = false;

  static zIndex;
  static isAdd;
  static isError;
  static presetInvestment = false;

  public classReference = AddLiabilitieComponent;

  /**
   * Initializes a new instance of the AddLiabilitieComponent class.
   * @param router - The router.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    AddLiabilitieComponent.isAdd = false;
    this.initStatic(AddLiabilitieComponent);
  }

  private wasOpen = false;

  ngDoCheck() {
    if (AddLiabilitieComponent.isAdd && !this.wasOpen) {
      if (AddLiabilitieComponent.presetInvestment) {
        this.isInvestment = true;
        AddLiabilitieComponent.presetInvestment = false;
      }
    }
    this.wasOpen = AddLiabilitieComponent.isAdd;
  }

  highlight() {
    AddLiabilitieComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  override closeWindow() {
    AddLiabilitieComponent.isAdd = false;
    this.amountTextField = "";
    this.titleTextField = "";
    this.isInvestment = false;
    this.AddToFire = false;
    super.closeWindow();
  }

  /**
   * Checks if the title is invalid.
   * @param title - The title to check.
   * @returns True if the title is invalid, false otherwise.
   */
  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.liabilities], 'tag');
  }

  /**
   * Adds a liability.
   */
  addLiabilitie() {
    // First trim string
    this.titleTextField = this.titleTextField.trim();
    // Validation (check if Amount is not empty)
    if (!this.validateRequired([
      { name: 'title', value: this.titleTextField, label: 'Title' },
      { name: 'amount', value: this.amountTextField, label: 'Amount' }
    ])) {
      // field errors shown inline
    } else if (this.invalidTitle(this.titleTextField)) {
      this.showError("This liabilitie already exists.");
    } else {
      // ready to write to Database new Transaction
      let newLiabilitie: Liability = { tag: this.titleTextField, amount: this.amountTextField == "" ? 0.0 : parseFloat(this.amountTextField), investment: this.isInvestment, credit: this.creditTextField == "" ? 0.0 : parseFloat(this.creditTextField) };
      AppStateService.instance.liabilities.push(newLiabilitie);

      this.closeWindow();
      AppStateService.instance.isSaving = true;
      this.persistence.writeAndSync({
        tag: 'balance/liabilities',
        data: AppStateService.instance.liabilities,
        localStorageKey: 'liabilities',
        logEvent: 'add_liability',
        logMetadata: { title: this.titleTextField, amount: this.amountTextField, credit: this.creditTextField, isInvestment: this.isInvestment },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          if (this.AddToFire) {
            gotoTop();
            import('src/app/app.component').then(m => m.AppComponent.copyTransaction("Fire", parseFloat(this.amountTextField), `@${this.titleTextField}`, "funding", "balance"));
            ProfileComponent.isProfile = false;
          }
          this.toastService.show('Liability added', 'success');
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
