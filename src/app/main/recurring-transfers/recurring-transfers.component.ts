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
import { AddRecurringTransferComponent } from 'src/app/panels/add/add-recurring-transfer/add-recurring-transfer.component';
import { InfoRecurringTransferComponent } from 'src/app/panels/info/info-recurring-transfer/info-recurring-transfer.component';
import {
  BaseListPageComponent,
  dateMatchesTerm,
} from 'src/app/shared/base/base-list-page.component';
import { locationLabel } from 'src/app/shared/location.utils';
import { LOCATIONS_PAGE_ICON } from 'src/app/shared/location-icons';

/** One row of the table: a rule with the location names resolved and its position in the full list. */
export interface RecurringRow {
  /** Position in `AppStateService.allRecurringTransfers` (0-based). */
  id: number;
  title: string;
  from: string;
  to: string;
  amount: number;
  frequency: string;
  startDate: string;
  endDate: string;
}

/**
 * All recurring transfers, listed like the Subscriptions page: search, sortable columns, paginators above and below.
 * A recurring transfer is not a subscription and only ever makes transfers - nothing here touches the Cashflow.
 */
@Component({
  selector: 'app-recurring-transfers',
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
    InfoRecurringTransferComponent,
  ],
  templateUrl: './recurring-transfers.component.html',
  styleUrls: [
    '../accounting/accounting.component.css',
    '../../app.component.css',
    '../../shared/styles/table.css',
    '../transfers/transfers.component.css',
  ],
})
export class RecurringTransfersComponent
  extends BaseListPageComponent<RecurringRow>
  implements OnInit
{
  readonly displayedColumns = ['id', 'title', 'from', 'to', 'amount', 'frequency', 'startDate'];
  readonly settingsReference = SettingsComponent;
  readonly locationsIcon = LOCATIONS_PAGE_ICON;
  readonly appState = AppStateService.instance;
  protected readonly defaultSort = { active: 'title', direction: 'asc' as const };

  constructor(private router: Router) {
    super();
  }

  get appReference() {
    return AppComponent;
  }

  get hasRules(): boolean {
    return AppStateService.instance.allRecurringTransfers.length > 0;
  }

  ngOnInit(): void {
    this.initList();
  }

  protected buildRows(): RecurringRow[] {
    const locations = AppStateService.instance.allLocations;
    const name = (id: string | undefined) => {
      const location = locations.find((l) => l.id === id);
      return location ? locationLabel(location) : '';
    };
    return AppStateService.instance.allRecurringTransfers.map((rule, index) => ({
      id: index,
      title: rule.title,
      from: name(rule.fromLocationId),
      to: name(rule.toLocationId),
      amount: rule.amount,
      frequency: rule.frequency,
      startDate: rule.startDate,
      endDate: rule.endDate || '',
    }));
  }

  protected matchesSearch(row: RecurringRow, term: string): boolean {
    return (
      row.title.toLowerCase().includes(term) ||
      row.from.toLowerCase().includes(term) ||
      row.to.toLowerCase().includes(term) ||
      row.frequency.includes(term) ||
      String(row.amount).includes(term) ||
      dateMatchesTerm(row.startDate, term) ||
      dateMatchesTerm(row.endDate, term)
    );
  }

  protected sortValue(row: RecurringRow, column: string): string | number {
    switch (column) {
      case 'id':
        return row.id;
      case 'title':
        return row.title.toLowerCase();
      case 'from':
        return row.from.toLowerCase();
      case 'to':
        return row.to.toLowerCase();
      case 'amount':
        return row.amount;
      case 'frequency':
        return row.frequency;
      default:
        return row.startDate;
    }
  }

  addRecurringTransfer(): void {
    AddRecurringTransferComponent.open();
  }

  clickRow(row: RecurringRow): void {
    AppComponent.gotoTop();
    InfoRecurringTransferComponent.setInfoRecurringTransferComponent(row.id);
  }

  goToTransfers(): void {
    this.router.navigate(['/transfers']);
    AppComponent.gotoTop();
  }

  goToLocations(): void {
    this.router.navigate(['/locations']);
    AppComponent.gotoTop();
  }
}
