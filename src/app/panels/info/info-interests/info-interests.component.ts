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
  selector: 'app-info-interests',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-interests.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-interests.component.css']
})
export class InfoInterestsComponent extends BaseInfoComponent {
  static index = 1;

  static title = "Driver Licence";
  static amount = 0.0;

  static setInfoInterestsComponent(id: number, title: string, amount: number) {
    InfoInterestsComponent.index = id;
    InfoInterestsComponent.title = title;
    InfoInterestsComponent.amount = amount;
    InfoInterestsComponent.isInfo = true;
  }

  titleTextField = InfoInterestsComponent.title;
  amountTextField = InfoInterestsComponent.amount;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoInterestsComponent;
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    this.initStatic(InfoInterestsComponent);
  }

  highlight() {
    InfoInterestsComponent.zIndex = 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  override closeWindow() {
    super.closeWindow();
  }

  editInterests() {
    AppComponent.gotoTop();
    //Validation (check if Amount is not empty)
    this.isEdit = true;
    InfoInterestsComponent.isError = false;
    this.titleTextField = InfoInterestsComponent.title;
    this.amountTextField = InfoInterestsComponent.amount;
  }
  updateInterests() {
    //Validation (check if Amount is not empty)
    if (this.titleTextField == "") {
      this.showError("Please fill out all required fields.");
    } else {
      // update existing transaction (PATCH)
      //AppStateService.instance.allSmileProjects[InfoComponent.index].tit
      AppStateService.instance.allIntrests[InfoInterestsComponent.index].tag = this.titleTextField;
      AppStateService.instance.allIntrests[InfoInterestsComponent.index].amount = this.amountTextField;

      InfoInterestsComponent.title = this.titleTextField;
      InfoInterestsComponent.amount = this.amountTextField;

      this.persistence.writeAndSync({
        tag: 'income/revenue/interests',
        data: AppStateService.instance.allIntrests,
        localStorageKey: 'interests',
        logEvent: 'update_interest',
        logMetadata: { title: this.titleTextField, amount: this.amountTextField },
        onSuccess: () => {
          this.clearError();
          this.isEdit = false;
          this.toastService.show('Interest updated', 'update');
          AppComponent.gotoTop();
        },
        onError: (error) => {
          this.showError(error.message || 'Database write failed');
        }
      });
    }
  }

  deleteInterests(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteInterests'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.allIntrests[index].tag;

      AppStateService.instance.allIntrests.splice(index, 1);
      InfoInterestsComponent.isInfo = false;
      InfoInterestsComponent.isError = false;

      this.persistence.writeAndSync({
        tag: 'income/revenue/interests',
        data: AppStateService.instance.allIntrests,
        localStorageKey: 'interests',
        logEvent: 'delete_interest',
        logMetadata: { title: deletedTitle, index: index },
        onSuccess: () => {
          this.toastService.show('Interest deleted', 'delete');
          AppComponent.gotoTop();
        },
        onError: (error) => {
          this.showError(error.message || 'Database write failed');
        }
      });
    });
  }
}
