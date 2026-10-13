import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppComponent } from 'src/app/app.component';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AddLocationComponent } from 'src/app/panels/add/add-location/add-location.component';
import { InfoLocationComponent } from 'src/app/panels/info/info-location/info-location.component';
import { InfoTransferComponent } from 'src/app/panels/info/info-transfer/info-transfer.component';
import { IncomeComponent } from 'src/app/main/cashflow/income/income.component';
import { MoneyLocation } from 'src/app/interfaces/location';
import { locationLabel } from 'src/app/shared/location.utils';
import {
  RECURRING_TRANSFER_ICON,
  cashflowMismatch,
  locationColor,
  locationIcon,
  locationShares,
} from 'src/app/shared/location-icons';

/**
 * Locations dashboard: where the money physically sits (bank accounts, cash, PayPal, ...).
 * A distribution bar and one card per location show how much you have where; the total is the
 * app's Cashflow, and a warning appears when the two disagree.
 */
@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    AppNumberPipe,
    InfoLocationComponent,
    InfoTransferComponent,
  ],
  templateUrl: './locations.component.html',
  styleUrls: [
    '../cashflow/balance/balance.component.css',
    '../../shared/styles/related-tx.css',
    './locations.component.css',
    '../../app.component.css',
  ],
})
export class LocationsComponent {
  constructor(private router: Router) {}

  public classReference = LocationsComponent;
  public settingsReference = SettingsComponent;
  public appState = AppStateService.instance;
  public label = locationLabel;
  public recurringIcon = RECURRING_TRANSFER_ICON;
  public icon = locationIcon;
  public color = locationColor;
  public get appReference() {
    return AppComponent;
  }

  static get allLocations(): MoneyLocation[] {
    return AppStateService.instance.allLocations;
  }
  static set allLocations(v: MoneyLocation[]) {
    AppStateService.instance.allLocations = v;
  }

  static getTotalAmount(): number {
    return AppStateService.instance.allLocations.reduce((sum, l) => sum + l.amount, 0);
  }

  /** The app's own Cashflow figure (what the Balance sheet shows), which the locations should add up to. */
  get cashflow(): number {
    return IncomeComponent.getTotalAmount();
  }

  get difference(): number {
    return LocationsComponent.getTotalAmount() - this.cashflow;
  }

  get hasMismatch(): boolean {
    return (
      LocationsComponent.allLocations.length > 0 &&
      cashflowMismatch(LocationsComponent.getTotalAmount(), this.cashflow)
    );
  }

  get shares(): number[] {
    return locationShares(LocationsComponent.allLocations.map((l) => l.amount));
  }

  goToTransfers() {
    this.router.navigate(['/transfers']);
    AppComponent.gotoTop();
  }

  goToRecurringTransfers() {
    this.router.navigate(['/recurring-transfers']);
    AppComponent.gotoTop();
  }

  addLocation() {
    AddLocationComponent.zIndex = 1;
    AddLocationComponent.isAddLocation = true;
  }

  clickRowLocation(index: number) {
    AppComponent.gotoTop();
    const l = AppStateService.instance.allLocations[index];
    InfoLocationComponent.setInfoLocationComponent(index, l.name, l.subName, l.amount, l.kind);
  }
}
