import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { AddComponent } from 'src/app/panels/add/add.component';
import { AddSmileComponent } from 'src/app/panels/add/add-smile/add-smile.component';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { InfoComponent } from '../info/info.component';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { OnboardingService } from 'src/app/shared/services/onboarding.service';
import { TourService } from 'src/app/shared/services/tour.service';

/**
 * Represents the InstructionsComponent class.
 */
@Component({
  selector: 'app-instructions',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, TranslateModule],
  templateUrl: './instructions.component.html',
  styleUrls: ['./instructions.component.css']
})
export class InstructionsComponent {
  static zIndex;
  static isInfo;
  static activeCategory: string | null = null;
  public classReference = InstructionsComponent;

  /**
   * Constructs a new instance of the InstructionsComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param afAuth - The AngularFireAuth service.
   */
  constructor(private router: Router, private localStorage: LocalService, private database: DatabaseService, private afAuth: AngularFireAuth, private onboardingService: OnboardingService, private tourService: TourService) {
    InstructionsComponent.isInfo = false;
    InstructionsComponent.zIndex = 0;
  }

  /**
   * Highlights the InstructionsComponent and resets the zIndex of other components.
   */
  highlight() {
    InstructionsComponent.zIndex = InstructionsComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  openCategory(category: string) {
    InstructionsComponent.activeCategory = category;
    gotoTop();
  }

  backToCategories() {
    InstructionsComponent.activeCategory = null;
    gotoTop();
  }

  launchTour() {
    this.closeWindow();
    setTimeout(() => this.tourService.startTour(), 300);
  }

  /**
   * Closes the window and sets the isInfo flag to false.
   */
  closeWindow() {
    InstructionsComponent.isInfo = false;
    InstructionsComponent.activeCategory = null;
  }
}
