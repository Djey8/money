import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Represents the ChooseComponent class.
 */

// Deferred imports — resolved after module init to break circular chains
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('../menu.component').then(m => MenuComponent = m.MenuComponent));
let AddAssetComponent: any; setTimeout(() => import('src/app/panels/add/add-asset/add-asset.component').then(m => AddAssetComponent = m.AddAssetComponent));
let AddShareComponent: any; setTimeout(() => import('src/app/panels/add/add-share/add-share.component').then(m => AddShareComponent = m.AddShareComponent));
let AddInvestmentComponent: any; setTimeout(() => import('src/app/panels/add/add-investment/add-investment.component').then(m => AddInvestmentComponent = m.AddInvestmentComponent));
let AddLiabilitieComponent: any; setTimeout(() => import('src/app/panels/add/add-liabilitie/add-liabilitie.component').then(m => AddLiabilitieComponent = m.AddLiabilitieComponent));
@Component({
  selector: 'app-choose',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, TranslateModule],
  templateUrl: './choose.component.html',
  styleUrls: ['./choose.component.css']
})
export class ChooseComponent {
  static zIndex;
  static isChoose;
  public classReference = ChooseComponent;

  /**
   * Creates an instance of ChooseComponent.
   * @param {Router} router - The router service.
   */
  constructor(private router: Router) {
    ChooseComponent.isChoose = false;
    ChooseComponent.zIndex = 1;
  }

  /**
   * Highlights the ChooseComponent.
   */
  highlight() {
    ChooseComponent.zIndex = 1;
    AddComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
  }

  /**
   * Closes the ChooseComponent window.
   */
  closeWindow() {
    ChooseComponent.isChoose = false;
    ChooseComponent.zIndex = 0;
  }

  /**
   * Handles the click event for the Asset button.
   */
  clickedAsset() {
    AddAssetComponent.isAddAsset = !AddAssetComponent.isAddAsset;
    ChooseComponent.isChoose = false;
  }

  /**
   * Handles the click event for the Share button.
   */
  clickedShare() {
    AddShareComponent.isAddShare = !AddShareComponent.isAddShare;
    ChooseComponent.isChoose = false;
  }

  /**
   * Handles the click event for the Investment button.
   */
  clickedInvestment() {
    AddInvestmentComponent.isAddInvestment = !AddInvestmentComponent.isAddInvestment;
    ChooseComponent.isChoose = false;
  }

  /**
   * Handles the click event for the Liability button.
   */
  clickedLiabilitie() {
    AddLiabilitieComponent.isAdd = !AddLiabilitieComponent.isAdd;
    ChooseComponent.isChoose = false;
  }
}
