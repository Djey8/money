import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { AppComponent } from 'src/app/app.component';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AddTransferComponent } from 'src/app/panels/add/add-transfer/add-transfer.component';
import { InfoTransferComponent } from 'src/app/panels/info/info-transfer/info-transfer.component';
import {
  BaseListPageComponent,
  dateMatchesTerm,
} from 'src/app/shared/base/base-list-page.component';
import { locationLabel } from 'src/app/shared/location.utils';
import { LOCATIONS_PAGE_ICON, RECURRING_TRANSFER_ICON } from 'src/app/shared/location-icons';

/** One row of the table: a transfer with the names resolved and its position in the full list. */
export interface TransferRow {
  /** Position in `AppStateService.allTransfers` (0-based). */
  id: number;
  date: string;
  time: string;
  from: string;
  to: string;
  amount: number;
  comment: string;
}

/**
 * All transfers between locations, listed like the Transactions page: search, sortable columns, paginators above and
 * below. A transfer is not a transaction - nothing here touches the Cashflow.
 */
@Component({
  selector: 'app-transfers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    AppDatePipe,
    AppNumberPipe,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    InfoTransferComponent,
  ],
  templateUrl: './transfers.component.html',
  styleUrls: [
    '../accounting/accounting.component.css',
    '../../app.component.css',
    '../../shared/styles/table.css',
    './transfers.component.css',
  ],
})
export class TransfersComponent extends BaseListPageComponent<TransferRow> implements OnInit {
  readonly displayedColumns = ['id', 'date', 'from', 'to', 'amount', 'comment'];
  readonly settingsReference = SettingsComponent;
  readonly locationsIcon = LOCATIONS_PAGE_ICON;
  readonly recurringIcon = RECURRING_TRANSFER_ICON;
  readonly appState = AppStateService.instance;
  protected readonly defaultSort = { active: 'date', direction: 'desc' as const };

  constructor(private router: Router) {
    super();
  }

  get appReference() {
    return AppComponent;
  }

  get hasTransfers(): boolean {
    return AppStateService.instance.allTransfers.length > 0;
  }

  ngOnInit(): void {
    this.initList();
  }

  protected buildRows(): TransferRow[] {
    const locations = AppStateService.instance.allLocations;
    const name = (id: string | undefined) => {
      const location = locations.find((l) => l.id === id);
      return location ? locationLabel(location) : '';
    };
    return AppStateService.instance.allTransfers.map((t, index) => ({
      id: index,
      date: t.date,
      time: t.time || '',
      from: name(t.fromLocationId),
      to: name(t.toLocationId),
      amount: t.amount,
      comment: t.comment || '',
    }));
  }

  protected matchesSearch(row: TransferRow, term: string): boolean {
    return (
      row.from.toLowerCase().includes(term) ||
      row.to.toLowerCase().includes(term) ||
      row.comment.toLowerCase().includes(term) ||
      String(row.amount).includes(term) ||
      row.time.includes(term) ||
      dateMatchesTerm(row.date, term)
    );
  }

  protected sortValue(row: TransferRow, column: string): string | number {
    switch (column) {
      case 'id':
        return row.id;
      case 'date':
        return `${row.date} ${row.time}`;
      case 'from':
        return row.from.toLowerCase();
      case 'to':
        return row.to.toLowerCase();
      case 'amount':
        return row.amount;
      default:
        return row.comment.toLowerCase();
    }
  }

  addTransfer(): void {
    AddTransferComponent.open();
  }

  clickRow(row: TransferRow): void {
    AppComponent.gotoTop();
    InfoTransferComponent.setInfoTransferComponent(row.id);
  }

  goToRecurringTransfers(): void {
    this.router.navigate(['/recurring-transfers']);
    AppComponent.gotoTop();
  }

  goToLocations(): void {
    this.router.navigate(['/locations']);
    AppComponent.gotoTop();
  }
}
