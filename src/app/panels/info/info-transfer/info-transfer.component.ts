import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { locationsByRecentUse, reconcileTransfer } from 'src/app/shared/location-balance';
import { locationLabel } from 'src/app/shared/location.utils';
import { transferProblem } from 'src/app/shared/transfer.utils';

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
 * Info panel of one transfer: view, edit, delete. Editing or deleting reverses the old effect on the two location
 * balances and applies the new one. A transfer is not a transaction, so none of this touches Cashflow.
 */
@Component({
  selector: 'app-info-transfer',
  standalone: true,
  imports: [
    TrapFocusDirective,
    CommonModule,
    FormsModule,
    TranslateModule,
    AppNumberPipe,
    AppDatePipe,
  ],
  templateUrl: './info-transfer.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-transfer.component.css'],
})
export class InfoTransferComponent extends BaseInfoComponent {
  /** Index into `AppStateService.allTransfers`. */
  static index = 0;

  static setInfoTransferComponent(index: number) {
    InfoTransferComponent.index = index;
    InfoTransferComponent.isInfo = true;
  }

  fromLocationId: string | null = null;
  toLocationId: string | null = null;
  amountTextField: number | string = '';
  dateTextField = '';
  timeTextField = '';
  commentTextField = '';
  readonly label = locationLabel;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoTransferComponent;

  constructor(
    router: Router,
    private persistence: PersistenceService,
  ) {
    super(router);
    this.initStatic(InfoTransferComponent);
  }

  get transfer() {
    return AppStateService.instance.allTransfers[InfoTransferComponent.index];
  }

  /** Most recently used first, then the rest in their normal order. */
  get locations() {
    return locationsByRecentUse(
      AppStateService.instance.allTransactions,
      AppStateService.instance.allLocations,
    );
  }

  /** A location's name, or null when the transfer's end was deleted afterwards. */
  nameOf(id: string | undefined): string | null {
    const location = AppStateService.instance.allLocations.find((l) => l.id === id);
    return location ? locationLabel(location) : null;
  }

  highlight() {
    InfoTransferComponent.zIndex = InfoTransferComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  editTransfer() {
    AppComponent.gotoTop();
    const t = this.transfer;
    this.isEdit = true;
    InfoTransferComponent.isError = false;
    this.fromLocationId = t.fromLocationId ?? null;
    this.toLocationId = t.toLocationId ?? null;
    this.amountTextField = t.amount;
    this.dateTextField = t.date;
    this.timeTextField = t.time;
    this.commentTextField = t.comment;
  }

  private persist(logEvent: string, toast: string, toastType: 'update' | 'delete') {
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
      logEvent,
      onSuccess: () => {
        AppStateService.instance.isSaving = false;
        this.toastService.show(toast, toastType);
      },
      onError: (error: any) => {
        AppStateService.instance.isSaving = false;
        this.toastService.show(error.message || 'Database write failed', 'error');
      },
    });
  }

  updateTransfer() {
    const amount = parseFloat(String(this.amountTextField));
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
    const t = this.transfer;
    // Reverse what the old transfer did to the balances and apply the new one.
    const before = {
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      amount: t.amount,
    };
    t.fromLocationId = this.fromLocationId as string;
    t.toLocationId = this.toLocationId as string;
    t.amount = Math.round(amount * 100) / 100;
    t.date = this.dateTextField;
    t.time = this.timeTextField || '';
    t.comment = this.commentTextField.trim();
    reconcileTransfer(AppStateService.instance.allLocations, before, t);
    AppStateService.instance.transfersUpdated$.next();
    this.clearError();
    InfoTransferComponent.isInfo = false;
    this.isEdit = false;
    this.persist('update_transfer', 'Transfer updated', 'update');
  }

  deleteTransfer() {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteTransfer'), () => {
      const index = InfoTransferComponent.index;
      const removed = AppStateService.instance.allTransfers[index];
      reconcileTransfer(AppStateService.instance.allLocations, removed, null);
      AppStateService.instance.allTransfers.splice(index, 1);
      AppStateService.instance.transfersUpdated$.next();
      InfoTransferComponent.isInfo = false;
      this.isEdit = false;
      this.persist('delete_transfer', 'Transfer deleted', 'delete');
    });
  }
}
