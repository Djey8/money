import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let InfoFireComponent: any; setTimeout(() => import('../info-fire/info-fire.component').then(m => InfoFireComponent = m.InfoFireComponent));

@Component({
  selector: 'app-info-mojo',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './info-mojo.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-mojo.component.css']
})
export class InfoMojoComponent extends BaseInfoComponent {

  static isInfo = false;
  static isError = false;
  static zIndex = 0;

  classReference = InfoMojoComponent;
  settingsReference = SettingsComponent;

  targetTextField: number = 0;

  constructor(
    router: Router,
    private localStorage: LocalService,
    private persistence: PersistenceService
  ) {
    super(router);
    this.initStatic(InfoMojoComponent);
  }

  get mojo() {
    return AppStateService.instance.mojo;
  }

  static openMojo() {
    InfoMojoComponent.isInfo = true;
  }

  highlight() {
    InfoMojoComponent.zIndex = InfoMojoComponent.zIndex + 1;
    if (InfoFireComponent) InfoFireComponent.zIndex = 0;
    if (ProfileComponent) ProfileComponent.zIndex = 0;
    if (MenuComponent) MenuComponent.zIndex = 0;
  }

  edit() {
    this.targetTextField = AppStateService.instance.mojo.target;
    this.isEdit = true;
  }

  save() {
    if (!this.targetTextField || this.targetTextField <= 0) {
      this.showError('Target must be greater than 0');
      return;
    }

    AppStateService.instance.mojo.target = this.targetTextField;

    this.persistence.writeAndSync({
      tag: 'mojo',
      data: AppStateService.instance.mojo,
      localStorageKey: 'mojo',
      logEvent: 'update_mojo_target',
      logMetadata: { target: this.targetTextField },
      onSuccess: () => {
        this.clearError();
        this.isEdit = false;
        this.toastService.show('Mojo target updated', 'update');
      },
      onError: (error) => {
        this.showError(error.message || 'Save failed');
      }
    });
  }
}
