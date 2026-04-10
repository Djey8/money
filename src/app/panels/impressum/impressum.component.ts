import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { AddComponent } from 'src/app/panels/add/add.component';
import { AddSmileComponent } from 'src/app/panels/add/add-smile/add-smile.component';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { InfoComponent } from '../info/info.component';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Represents the Impressum component.
 */
@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, TranslateModule],
  templateUrl: './impressum.component.html',
  styleUrls: ['./impressum.component.css']
})
export class ImpressumComponent {

  /**
   * The z-index value for the Impressum component.
   */
  static zIndex;

  /**
   * Indicates whether the component is in the info state.
   */
  static isInfo;

  /**
   * The reference to the ImpressumComponent class.
   */
  public classReference = ImpressumComponent;

  constructor(private router: Router, private localStorage: LocalService, private database: DatabaseService, private afAuth: AngularFireAuth) {
    ImpressumComponent.isInfo = false;
    ImpressumComponent.zIndex = 0;
  }

  /**
   * Highlights the Impressum component and resets the z-index values of other components.
   */
  highlight() {
    ImpressumComponent.zIndex = ImpressumComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  /**
   * Closes the Impressum component window.
   */
  closeWindow() {
    ImpressumComponent.isInfo = false;
  }
}
