import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';


// Deferred imports — resolved after module init to break circular chains
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let InfoComponent: any; setTimeout(() => import('../info/info.component').then(m => InfoComponent = m.InfoComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, TranslateModule],
  templateUrl: './policy.component.html',
  styleUrls: ['./policy.component.css']
})
export class PolicyComponent {
  static zIndex: number;
  static isInfo: boolean;
  public classReference = PolicyComponent;

  constructor() {
    PolicyComponent.isInfo = false;
    PolicyComponent.zIndex = 0;
  }

  highlight() {
    PolicyComponent.zIndex = PolicyComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  closeWindow() {
    PolicyComponent.isInfo = false;
  }
}
