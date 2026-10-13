import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { AddSmileComponent } from '../add-smile/add-smile.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { LOCATION_KINDS, LocationKind, MoneyLocation } from 'src/app/interfaces/location';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { locationColor, locationIcon } from 'src/app/shared/location-icons';
import { isDuplicateLocationName } from 'src/app/shared/location.utils';
import { newLocationId } from 'src/app/shared/location-ids';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Global "add location" modal (rendered once in the app shell).
 */
@Component({
  selector: 'app-add-location',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-location.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-location.component.css'],
})
export class AddLocationComponent extends BaseAddComponent {
  nameTextField = '';
  subNameTextField = '';
  amountTextField = '';
  kindField: LocationKind = 'bank';
  readonly kinds = LOCATION_KINDS;
  readonly icon = locationIcon;
  readonly kindColor = locationColor;

  static zIndex;
  static isAddLocation;
  static isError;

  public classReference = AddLocationComponent;

  constructor(
    router: Router,
    private persistence: PersistenceService,
  ) {
    super(router);
    AddLocationComponent.isAddLocation = false;
    this.initStatic(AddLocationComponent);
  }

  highlight() {
    AddLocationComponent.zIndex = 1;
    ChooseComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  override closeWindow() {
    AddLocationComponent.isAddLocation = false;
    this.amountTextField = '';
    super.closeWindow();
  }

  addLocation() {
    this.nameTextField = this.nameTextField.trim();
    if (!this.validateRequired([{ name: 'title', value: this.nameTextField, label: 'Name' }])) {
      // field errors shown inline
    } else if (
      isDuplicateLocationName(
        this.nameTextField,
        this.subNameTextField,
        AppStateService.instance.allLocations,
      )
    ) {
      this.showError('This location already exists.');
    } else {
      const amount = parseFloat(this.amountTextField);
      const newLocation: MoneyLocation = {
        id: newLocationId(),
        name: this.nameTextField,
        amount: Number.isFinite(amount) ? amount : 0,
        kind: this.kindField,
      };
      const subName = this.subNameTextField.trim();
      if (subName) newLocation.subName = subName;
      AppStateService.instance.allLocations.push(newLocation);
      this.nameTextField = '';
      this.subNameTextField = '';
      this.amountTextField = '';
      this.clearError();
      this.closeWindow();
      AppStateService.instance.isSaving = true;

      this.persistence.writeAndSync({
        tag: 'locations',
        data: AppStateService.instance.allLocations,
        localStorageKey: 'locations',
        logEvent: 'add_location',
        logMetadata: { name: newLocation.name, amount: newLocation.amount },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          this.toastService.show('Location added', 'success');
          gotoTop();
          this.router.navigate([`/locations`]);
        },
        onError: (error) => {
          AppStateService.instance.isSaving = false;
          this.toastService.show(error.message || 'Database write failed', 'error');
        },
      });
    }
  }
}
