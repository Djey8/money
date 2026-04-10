import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let IncomeComponent: any; setTimeout(() => import('../../../main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
@Component({
  selector: 'app-info-properties',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-properties.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-properties.component.css']
})
export class InfoPropertiesComponent extends BaseInfoComponent {
  static index = 1;

  static title = "Driver Licence";
  static amount = 0.0;

  static setInfoPropertiesComponent(id: number, title: string, amount: number) {
    InfoPropertiesComponent.index = id;
    InfoPropertiesComponent.title = title;
    InfoPropertiesComponent.amount = amount;
    InfoPropertiesComponent.isInfo = true;
  }

  //accountTextField = InfoComponent.account;
  titleTextField = InfoPropertiesComponent.title;
  amountTextField = InfoPropertiesComponent.amount;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoPropertiesComponent;
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    this.initStatic(InfoPropertiesComponent);
  }

  highlight() {
    InfoPropertiesComponent.zIndex = 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  editProperties() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoPropertiesComponent.isError = false;
    this.titleTextField = InfoPropertiesComponent.title;
    this.amountTextField = InfoPropertiesComponent.amount;
  }
  updateProperties() {
    //Validation (check if Amount is not empty)
    if (this.titleTextField == "") {
      this.showError("Please fill out all required fields.");
    } else {
      // update existing transaction (PATCH)
      //AppStateService.instance.allSmileProjects[InfoComponent.index].tit
      AppStateService.instance.allProperties[InfoPropertiesComponent.index].tag = this.titleTextField;
      AppStateService.instance.allProperties[InfoPropertiesComponent.index].amount = this.amountTextField;

      InfoPropertiesComponent.title = this.titleTextField;
      InfoPropertiesComponent.amount = this.amountTextField;

      this.persistence.writeAndSync({
        tag: 'income/revenue/properties',
        data: AppStateService.instance.allProperties,
        localStorageKey: 'properties',
        logEvent: 'update_property',
        logMetadata: { title: this.titleTextField, amount: this.amountTextField },
        onSuccess: () => {
          this.clearError();
          this.isEdit = false;
          this.toastService.show('Property updated', 'update');
          AppComponent.gotoTop();
        },
        onError: (error) => {
          this.showError(error.message || 'Database write failed');
        }
      });
    }
  }

  deleteProperties(index: number) {
    // Save title before deleting
    const deletedTitle = AppStateService.instance.allProperties[index].tag;
    
    AppStateService.instance.allProperties.splice(index, 1);
    InfoPropertiesComponent.isInfo = false;
    InfoPropertiesComponent.isError = false;

    this.persistence.writeAndSync({
      tag: 'income/revenue/properties',
      data: AppStateService.instance.allProperties,
      localStorageKey: 'properties',
      logEvent: 'delete_property',
      logMetadata: { title: deletedTitle, index: index },
      onSuccess: () => {
        this.toastService.show('Property deleted', 'delete');
        AppComponent.gotoTop();
      },
      onError: (error) => {
        this.showError(error.message || 'Database write failed');
      }
    });
  }
}
