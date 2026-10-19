import { isGameBankLocation } from '@money/domain';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { locationColor, locationIcon } from 'src/app/shared/location-icons';
import { isDuplicateLocationName } from 'src/app/shared/location.utils';
import {
  bookingLegs,
  clearLocationFromRecurring,
  clearLocationFromSplits,
  clearLocationFromTransfers,
  clearLocationReferences,
} from 'src/app/shared/location-balance';
import { LOCATION_KINDS, LocationKind } from 'src/app/interfaces/location';
import { Transaction } from 'src/app/interfaces/transaction';
import { Transfer } from 'src/app/interfaces/transfer';
import { InfoTransferComponent } from 'src/app/panels/info/info-transfer/info-transfer.component';
import { locationLabel } from 'src/app/shared/location.utils';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
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
let AddComponent: any;
setTimeout(() =>
  import('src/app/panels/add/add.component').then((m) => (AddComponent = m.AddComponent)),
);
let AddSmileComponent: any;
setTimeout(() =>
  import('src/app/panels/add/add-smile/add-smile.component').then(
    (m) => (AddSmileComponent = m.AddSmileComponent),
  ),
);

@Component({
  selector: 'app-info-location',
  standalone: true,
  imports: [
    TrapFocusDirective,
    CommonModule,
    FormsModule,
    TranslateModule,
    AppNumberPipe,
    AppDatePipe,
  ],
  templateUrl: './info-location.component.html',
  styleUrls: [
    '../../../shared/styles/info-panel.css',
    '../../../shared/styles/related-tx.css',
    './info-location.component.css',
  ],
})
export class InfoLocationComponent extends BaseInfoComponent {
  static index = 0;

  static locationName = '';
  static subName = '';
  /** The two lists are folded away until the heading is clicked; they close again for the next location. */
  static showTransactions = false;
  static showTransfers = false;
  static sortColumn = 'id'; // 'id' | 'account' | 'amount' | 'date'
  static sortDirection: 'asc' | 'desc' = 'desc'; // newest booking first, like the project lists
  static amount = 0.0;
  static kind: LocationKind = 'other';

  static setInfoLocationComponent(
    index: number,
    name: string,
    subName: string | undefined,
    amount: number,
    kind: LocationKind | undefined,
  ) {
    InfoLocationComponent.index = index;
    InfoLocationComponent.locationName = name;
    InfoLocationComponent.subName = subName ?? '';
    InfoLocationComponent.amount = amount;
    InfoLocationComponent.kind = kind ?? 'other';
    InfoLocationComponent.showTransactions = false;
    InfoLocationComponent.showTransfers = false;
    InfoLocationComponent.isInfo = true;
  }

  nameTextField = InfoLocationComponent.locationName;
  subNameTextField = InfoLocationComponent.subName;
  amountTextField: number | string = InfoLocationComponent.amount;
  kindField: LocationKind = InfoLocationComponent.kind;
  readonly kinds = LOCATION_KINDS;
  readonly icon = locationIcon;
  readonly kindColor = locationColor;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoLocationComponent;
  constructor(
    router: Router,
    private persistence: PersistenceService,
  ) {
    super(router);
    this.initStatic(InfoLocationComponent);
  }

  highlight() {
    InfoLocationComponent.zIndex = InfoLocationComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  editLocation() {
    AppComponent.gotoTop();
    this.isEdit = true;
    InfoLocationComponent.isError = false;
    this.nameTextField = InfoLocationComponent.locationName;
    this.subNameTextField = InfoLocationComponent.subName;
    this.amountTextField = InfoLocationComponent.amount;
    this.kindField = InfoLocationComponent.kind;
  }

  private persist(
    logEvent: string,
    logMetadata: Record<string, unknown>,
    toast: string,
    toastType: 'update' | 'delete',
    alsoTransactions = false,
  ) {
    AppStateService.instance.isSaving = true;
    const callbacks = {
      logEvent,
      logMetadata,
      onSuccess: () => {
        AppStateService.instance.isSaving = false;
        this.toastService.show(toast, toastType);
      },
      onError: (error: any) => {
        AppStateService.instance.isSaving = false;
        this.toastService.show(error.message || 'Database write failed', 'error');
      },
    };
    if (!alsoTransactions) {
      this.persistence.writeAndSync({
        tag: 'locations',
        data: AppStateService.instance.allLocations,
        localStorageKey: 'locations',
        ...callbacks,
      });
      return;
    }
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: 'locations', data: AppStateService.instance.allLocations },
        { tag: 'transactions', data: AppStateService.instance.allTransactions },
        { tag: 'subscriptions', data: AppStateService.instance.allSubscriptions },
        { tag: 'transfers', data: AppStateService.instance.allTransfers },
        { tag: 'recurringTransfers', data: AppStateService.instance.allRecurringTransfers },
      ],
      localStorageSaves: [
        { key: 'locations', data: JSON.stringify(AppStateService.instance.allLocations) },
        { key: 'transactions', data: JSON.stringify(AppStateService.instance.allTransactions) },
        { key: 'subscriptions', data: JSON.stringify(AppStateService.instance.allSubscriptions) },
        { key: 'transfers', data: JSON.stringify(AppStateService.instance.allTransfers) },
        {
          key: 'recurringTransfers',
          data: JSON.stringify(AppStateService.instance.allRecurringTransfers),
        },
      ],
      ...callbacks,
    });
  }

  /** Bookings made at the location currently shown, sorted like the Smile / Fire / Grow lists. */
  get linkedTransactions(): Transaction[] {
    const id = AppStateService.instance.allLocations[InfoLocationComponent.index]?.id;
    if (!id) return [];
    return this.sortTransactions(
      AppStateService.instance.allTransactions.filter((t) =>
        bookingLegs({
          locationId: t.locationId,
          amount: t.amount,
          locationSplits: t.locationSplits,
        }).some((leg) => leg.locationId === id),
      ),
    );
  }

  toggleTransactions() {
    InfoLocationComponent.showTransactions = !InfoLocationComponent.showTransactions;
  }

  toggleTransfers() {
    InfoLocationComponent.showTransfers = !InfoLocationComponent.showTransfers;
  }

  /** Transfers into or out of the location currently shown, newest first. */
  get linkedTransfers(): { transfer: Transfer; direction: 'in' | 'out'; other: string | null }[] {
    const id = AppStateService.instance.allLocations[InfoLocationComponent.index]?.id;
    if (!id) return [];
    return AppStateService.instance.allTransfers
      .filter((t) => t.fromLocationId === id || t.toLocationId === id)
      .map((transfer) => {
        const direction: 'in' | 'out' = transfer.toLocationId === id ? 'in' : 'out';
        const otherId = direction === 'in' ? transfer.fromLocationId : transfer.toLocationId;
        const other = AppStateService.instance.allLocations.find((l) => l.id === otherId);
        return { transfer, direction, other: other ? locationLabel(other) : null };
      })
      .sort((a, b) =>
        `${b.transfer.date} ${b.transfer.time}`.localeCompare(
          `${a.transfer.date} ${a.transfer.time}`,
        ),
      );
  }

  /** Opens the transfer's own panel in place of this one. */
  openTransfer(transfer: Transfer) {
    const index = AppStateService.instance.allTransfers.indexOf(transfer);
    if (index === -1) return;
    this.closeWindow();
    AppComponent.gotoTop();
    InfoTransferComponent.setInfoTransferComponent(index);
  }

  /** What the booking put at THIS location (a split booking's share, not its full amount). */
  legAmount(tx: Transaction): number {
    const id = AppStateService.instance.allLocations[InfoLocationComponent.index]?.id;
    const leg = bookingLegs({
      locationId: tx.locationId,
      amount: tx.amount,
      locationSplits: tx.locationSplits,
    }).find((candidate) => candidate.locationId === id);
    return leg ? leg.amount : tx.amount;
  }

  /** 1-based position in the full transaction list (the same ID the project lists show). */
  getTransactionId(tx: Transaction): number {
    return AppStateService.instance.allTransactions.indexOf(tx) + 1;
  }

  toggleSort(column: string) {
    if (InfoLocationComponent.sortColumn === column) {
      InfoLocationComponent.sortDirection =
        InfoLocationComponent.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      InfoLocationComponent.sortColumn = column;
      InfoLocationComponent.sortDirection = 'desc';
    }
  }

  getSortIcon(column: string): string {
    if (InfoLocationComponent.sortColumn !== column) return '';
    return InfoLocationComponent.sortDirection === 'asc' ? '▲' : '▼';
  }

  private sortTransactions(transactions: Transaction[]): Transaction[] {
    const direction = InfoLocationComponent.sortDirection === 'asc' ? 1 : -1;
    const key = (tx: Transaction): number | string => {
      switch (InfoLocationComponent.sortColumn) {
        case 'account':
          return tx.account.toLowerCase();
        case 'amount':
          return this.legAmount(tx);
        case 'date':
          return tx.date + (tx.time || '00:00:00');
        default:
          return this.getTransactionId(tx);
      }
    };
    return [...transactions].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return ka < kb ? -direction : ka > kb ? direction : 0;
    });
  }

  /** Opens the booking's own info panel on top of this one. */
  openTransactionInfo(tx: Transaction) {
    const index = AppStateService.instance.allTransactions.indexOf(tx);
    if (index === -1) return;
    // The booking's panel replaces this one (it used to open behind it).
    this.closeWindow();
    AppComponent.gotoTop();
    InfoComponent.setInfoComponent(
      index,
      tx.account,
      tx.amount,
      tx.date,
      tx.time,
      tx.category,
      tx.comment,
    );
  }

  updateLocation() {
    const name = (this.nameTextField ?? '').trim();
    if (name == '') {
      this.showError('Please fill out all required fields.');
      return;
    }
    const current = AppStateService.instance.allLocations[InfoLocationComponent.index];
    if (
      isDuplicateLocationName(
        name,
        this.subNameTextField,
        AppStateService.instance.allLocations,
        current.id,
      )
    ) {
      this.showError('This location already exists.');
      return;
    }
    const amount = parseFloat(String(this.amountTextField));
    // A direct edit is the user's manual correction: a plain overwrite, nothing is reconciled.
    current.name = name;
    const subName = (this.subNameTextField ?? '').trim();
    if (subName) current.subName = subName;
    else delete current.subName;
    current.amount = Number.isFinite(amount) ? amount : 0;
    current.kind = this.kindField;

    InfoLocationComponent.locationName = current.name;
    InfoLocationComponent.subName = current.subName ?? '';
    InfoLocationComponent.amount = current.amount;
    InfoLocationComponent.kind = this.kindField;
    InfoLocationComponent.isInfo = false;
    InfoLocationComponent.isError = false;
    this.persist(
      'update_location',
      { name: current.name, amount: current.amount },
      'Location updated',
      'update',
    );
  }

  /** The game's default location can be renamed, never deleted. */
  get isDefaultLocation(): boolean {
    return isGameBankLocation(AppStateService.instance.allLocations[this.classReference.index]?.id);
  }

  deleteLocation(index: number) {
    if (isGameBankLocation(AppStateService.instance.allLocations[index]?.id)) return;
    this.confirmService.confirm(this.translate.instant('Confirm.deleteLocation'), () => {
      const deleted = AppStateService.instance.allLocations[index];
      try {
        AppStateService.instance.allLocations.splice(index, 1);
        // History is kept; it just loses the "where" (orphaned to none).
        clearLocationReferences(AppStateService.instance.allTransactions, deleted.id);
        clearLocationFromSplits(
          AppStateService.instance.allTransactions,
          AppStateService.instance.allSubscriptions,
          deleted.id,
        );
        clearLocationFromTransfers(AppStateService.instance.allTransfers, deleted.id);
        clearLocationFromRecurring(AppStateService.instance.allRecurringTransfers, deleted.id);
        AppStateService.instance.transfersUpdated$.next();
        InfoLocationComponent.isInfo = false;
        InfoLocationComponent.isError = false;
        this.persist(
          'delete_location',
          { name: deleted.name, index },
          'Location deleted',
          'delete',
          true,
        );
      } catch (error) {
        this.showError(error.message || 'Error occurred');
      }
    });
  }
}
