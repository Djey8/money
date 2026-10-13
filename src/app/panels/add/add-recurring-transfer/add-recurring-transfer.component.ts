import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { RecurringTransferService } from 'src/app/shared/services/recurring-transfer.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { RecurringTransfer } from 'src/app/interfaces/recurring-transfer';
import { SubscriptionFrequency } from 'src/app/interfaces/subscription';
import { lastUsedLocationId, locationsByRecentUse } from 'src/app/shared/location-balance';
import { locationLabel } from 'src/app/shared/location.utils';
import { newRecurringTransferId, recurringProblem } from 'src/app/shared/transfer.utils';

/**
 * Global "recurring transfer" dialog (rendered once in the app shell): move money between two of your own
 * locations on a schedule. It is not a subscription and only ever makes transfers, so Cashflow cannot change.
 */
@Component({
  selector: 'app-add-recurring-transfer',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-recurring-transfer.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-recurring-transfer.component.css'],
})
export class AddRecurringTransferComponent extends BaseAddComponent {
  titleTextField = '';
  fromLocationId: string | null = null;
  toLocationId: string | null = null;
  amountTextField = '';
  startDateTextField = '';
  endDateTextField = '';
  frequencyField: SubscriptionFrequency = 'monthly';
  commentTextField = '';

  static zIndex;
  static isAddRecurring;
  static isError;
  private static pendingDefaults = false;

  public classReference = AddRecurringTransferComponent;
  readonly label = locationLabel;

  constructor(
    router: Router,
    private recurring: RecurringTransferService,
  ) {
    super(router);
    AddRecurringTransferComponent.isAddRecurring = false;
    this.initStatic(AddRecurringTransferComponent);
  }

  private static today(): string {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  static open() {
    AddRecurringTransferComponent.zIndex = 1;
    AddRecurringTransferComponent.isAddRecurring = true;
    AddRecurringTransferComponent.pendingDefaults = true;
  }

  /** Most recently used first, then the rest in their normal order. */
  get locations() {
    return locationsByRecentUse(
      AppStateService.instance.allTransactions,
      AppStateService.instance.allLocations,
    );
  }

  /** Applies the defaults once per opening (the source is the location you booked at last; start today). */
  get isOpen(): boolean {
    if (
      AddRecurringTransferComponent.isAddRecurring &&
      AddRecurringTransferComponent.pendingDefaults
    ) {
      AddRecurringTransferComponent.pendingDefaults = false;
      this.fromLocationId = lastUsedLocationId(
        AppStateService.instance.allTransactions,
        AppStateService.instance.allLocations,
      );
      this.toLocationId = null;
      this.startDateTextField = AddRecurringTransferComponent.today();
      this.endDateTextField = '';
      this.frequencyField = 'monthly';
    }
    return !!AddRecurringTransferComponent.isAddRecurring;
  }

  highlight() {
    AddRecurringTransferComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  override closeWindow() {
    AddRecurringTransferComponent.isAddRecurring = false;
    this.titleTextField = '';
    this.amountTextField = '';
    this.commentTextField = '';
    this.toLocationId = null;
    super.closeWindow();
  }

  addRecurringTransfer() {
    const amount = parseFloat(this.amountTextField);
    const problem = recurringProblem({
      fromLocationId: this.fromLocationId,
      toLocationId: this.toLocationId,
      amount,
      date: this.startDateTextField,
      startDate: this.startDateTextField,
      endDate: this.endDateTextField,
    });
    if (problem) {
      this.showError(problem);
      return;
    }
    const rule: RecurringTransfer = {
      id: newRecurringTransferId(),
      title: this.titleTextField.trim() || 'Recurring transfer',
      fromLocationId: this.fromLocationId as string,
      toLocationId: this.toLocationId as string,
      amount: Math.round(amount * 100) / 100,
      startDate: this.startDateTextField,
      endDate: this.endDateTextField || '',
      frequency: this.frequencyField,
      comment: this.commentTextField.trim(),
    };
    AppStateService.instance.allRecurringTransfers.push(rule);
    // Everything already due since the start date is created now (a start date of today only affects the future).
    const created = this.recurring.generateDue();
    this.clearError();
    this.closeWindow();
    this.recurring.save('add_recurring_transfer', (ok) => {
      if (ok) {
        this.toastService.show(
          created > 0
            ? `Recurring transfer saved, ${created} transfer(s) created`
            : 'Recurring transfer saved',
          'success',
        );
      } else {
        this.toastService.show('Database write failed', 'error');
      }
    });
  }
}
