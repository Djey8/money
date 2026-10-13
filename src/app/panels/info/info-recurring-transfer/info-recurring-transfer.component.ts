import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { RecurringTransferService } from 'src/app/shared/services/recurring-transfer.service';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { SubscriptionFrequency } from 'src/app/interfaces/subscription';
import { locationsByRecentUse } from 'src/app/shared/location-balance';
import { locationLabel } from 'src/app/shared/location.utils';
import { recurringProblem } from 'src/app/shared/transfer.utils';

// Deferred imports - resolved after module init to break circular chains
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));
let InfoComponent: any;
setTimeout(() => import('../info.component').then((m) => (InfoComponent = m.InfoComponent)));
let ProfileComponent: any;
setTimeout(() =>
  import('src/app/panels/profile/profile.component').then(
    (m) => (ProfileComponent = m.ProfileComponent),
  ),
);
let MenuComponent: any;
setTimeout(() =>
  import('src/app/panels/menu/menu.component').then((m) => (MenuComponent = m.MenuComponent)),
);

/**
 * Info panel of one recurring transfer: view, edit, delete. Editing moves the transfers the rule already generated
 * (in place, balances follow) and creates what is newly due; deleting keeps them unless asked to remove them too.
 * Never touches a transaction, so Cashflow cannot change.
 */
@Component({
  selector: 'app-info-recurring-transfer',
  standalone: true,
  imports: [
    TrapFocusDirective,
    CommonModule,
    FormsModule,
    TranslateModule,
    AppNumberPipe,
    AppDatePipe,
  ],
  templateUrl: './info-recurring-transfer.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-recurring-transfer.component.css'],
})
export class InfoRecurringTransferComponent extends BaseInfoComponent {
  /** Index into `AppStateService.allRecurringTransfers`. */
  static index = 0;

  static setInfoRecurringTransferComponent(index: number) {
    InfoRecurringTransferComponent.index = index;
    InfoRecurringTransferComponent.isInfo = true;
  }

  titleTextField = '';
  fromLocationId: string | null = null;
  toLocationId: string | null = null;
  amountTextField: number | string = '';
  frequencyField: SubscriptionFrequency = 'monthly';
  startDateTextField = '';
  endDateTextField = '';
  commentTextField = '';
  /** Also remove the transfers the rule created when deleting it. */
  deleteTransfersChecked = false;
  readonly label = locationLabel;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoRecurringTransferComponent;

  constructor(
    router: Router,
    private recurring: RecurringTransferService,
  ) {
    super(router);
    this.initStatic(InfoRecurringTransferComponent);
  }

  get rule() {
    return AppStateService.instance.allRecurringTransfers[InfoRecurringTransferComponent.index];
  }

  /** Most recently used first, then the rest in their normal order. */
  get locations() {
    return locationsByRecentUse(
      AppStateService.instance.allTransactions,
      AppStateService.instance.allLocations,
    );
  }

  nameOf(id: string | undefined): string | null {
    const location = AppStateService.instance.allLocations.find((l) => l.id === id);
    return location ? locationLabel(location) : null;
  }

  highlight() {
    InfoRecurringTransferComponent.zIndex = InfoRecurringTransferComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  editRule() {
    AppComponent.gotoTop();
    const r = this.rule;
    this.isEdit = true;
    InfoRecurringTransferComponent.isError = false;
    this.titleTextField = r.title;
    this.fromLocationId = r.fromLocationId;
    this.toLocationId = r.toLocationId;
    this.amountTextField = r.amount;
    this.frequencyField = r.frequency;
    this.startDateTextField = r.startDate;
    this.endDateTextField = r.endDate;
    this.commentTextField = r.comment;
  }

  updateRule() {
    const amount = parseFloat(String(this.amountTextField));
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
    const r = this.rule;
    const before = { ...r };
    r.title = this.titleTextField.trim() || 'Recurring transfer';
    r.fromLocationId = this.fromLocationId as string;
    r.toLocationId = this.toLocationId as string;
    r.amount = Math.round(amount * 100) / 100;
    r.frequency = this.frequencyField;
    r.startDate = this.startDateTextField;
    r.endDate = this.endDateTextField || '';
    r.comment = this.commentTextField.trim();

    // What the old rule generated follows the new one, then whatever is due and missing is created.
    this.recurring.reconcile(before, { ...r });
    this.recurring.generateDue();
    this.clearError();
    InfoRecurringTransferComponent.isInfo = false;
    this.isEdit = false;
    this.recurring.save('update_recurring_transfer', (ok) =>
      this.toastService.show(
        ok ? 'Recurring transfer updated' : 'Database write failed',
        ok ? 'update' : 'error',
      ),
    );
  }

  deleteRule() {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteRecurring'), () => {
      const index = InfoRecurringTransferComponent.index;
      const rule = AppStateService.instance.allRecurringTransfers[index];
      if (this.deleteTransfersChecked) this.recurring.reconcile(rule, null);
      AppStateService.instance.allRecurringTransfers.splice(index, 1);
      this.deleteTransfersChecked = false;
      InfoRecurringTransferComponent.isInfo = false;
      this.isEdit = false;
      this.recurring.save('delete_recurring_transfer', (ok) =>
        this.toastService.show(
          ok ? 'Recurring transfer deleted' : 'Database write failed',
          ok ? 'delete' : 'error',
        ),
      );
    });
  }
}
