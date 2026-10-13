import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { Transfer } from 'src/app/interfaces/transfer';
import {
  lastUsedLocationId,
  locationsByRecentUse,
  reconcileTransfer,
} from 'src/app/shared/location-balance';
import { locationLabel } from 'src/app/shared/location.utils';
import { newTransferId, transferProblem } from 'src/app/shared/transfer.utils';

/**
 * Global "move money between locations" dialog (rendered once in the app shell). A transfer is not a transaction:
 * it never touches the income statement, Cashflow or any fund; it only moves a balance from one location to another.
 */
@Component({
  selector: 'app-add-transfer',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-transfer.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-transfer.component.css'],
})
export class AddTransferComponent extends BaseAddComponent {
  fromLocationId: string | null = null;
  toLocationId: string | null = null;
  amountTextField = '';
  dateTextField = AddTransferComponent.today();
  timeTextField = '';
  commentTextField = '';

  static zIndex;
  static isAddTransfer;
  static isError;

  public classReference = AddTransferComponent;
  readonly label = locationLabel;

  constructor(
    router: Router,
    private persistence: PersistenceService,
  ) {
    super(router);
    AddTransferComponent.isAddTransfer = false;
    this.initStatic(AddTransferComponent);
  }

  private static today(): string {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Opens the dialog; the source defaults to the location you booked at last. */
  static open() {
    AddTransferComponent.zIndex = 1;
    AddTransferComponent.isAddTransfer = true;
    AddTransferComponent.pendingDefaults = true;
  }

  private static pendingDefaults = false;

  /** Most recently used first, then the rest in their normal order. */
  get locations() {
    return locationsByRecentUse(
      AppStateService.instance.allTransactions,
      AppStateService.instance.allLocations,
    );
  }

  /** Applies the "last used" default once per opening (a getter would fight the user's own choice). */
  get isOpen(): boolean {
    if (AddTransferComponent.isAddTransfer && AddTransferComponent.pendingDefaults) {
      AddTransferComponent.pendingDefaults = false;
      this.fromLocationId = lastUsedLocationId(
        AppStateService.instance.allTransactions,
        AppStateService.instance.allLocations,
      );
      this.toLocationId = null;
      this.dateTextField = AddTransferComponent.today();
    }
    return !!AddTransferComponent.isAddTransfer;
  }

  highlight() {
    AddTransferComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  override closeWindow() {
    AddTransferComponent.isAddTransfer = false;
    this.amountTextField = '';
    this.commentTextField = '';
    this.timeTextField = '';
    this.toLocationId = null;
    super.closeWindow();
  }

  addTransfer() {
    const amount = parseFloat(this.amountTextField);
    const problem = transferProblem({
      fromLocationId: this.fromLocationId,
      toLocationId: this.toLocationId,
      amount,
      date: this.dateTextField,
    });
    if (problem) {
      this.showError(problem);
      return;
    }
    const transfer: Transfer = {
      id: newTransferId(),
      fromLocationId: this.fromLocationId as string,
      toLocationId: this.toLocationId as string,
      amount: Math.round(amount * 100) / 100,
      date: this.dateTextField,
      time: this.timeTextField || '',
      comment: this.commentTextField.trim(),
    };
    AppStateService.instance.allTransfers.push(transfer);
    reconcileTransfer(AppStateService.instance.allLocations, null, transfer);
    AppStateService.instance.transfersUpdated$.next();
    this.clearError();
    this.closeWindow();
    AppStateService.instance.isSaving = true;
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: 'transfers', data: AppStateService.instance.allTransfers },
        { tag: 'locations', data: AppStateService.instance.allLocations },
      ],
      localStorageSaves: [
        { key: 'transfers', data: JSON.stringify(AppStateService.instance.allTransfers) },
        { key: 'locations', data: JSON.stringify(AppStateService.instance.allLocations) },
      ],
      logEvent: 'add_transfer',
      logMetadata: { amount: transfer.amount },
      onSuccess: () => {
        AppStateService.instance.isSaving = false;
        this.toastService.show('Transfer saved', 'success');
        gotoTop();
      },
      onError: (error: any) => {
        AppStateService.instance.isSaving = false;
        this.toastService.show(error.message || 'Database write failed', 'error');
      },
    });
  }
}
