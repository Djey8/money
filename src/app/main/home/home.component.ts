import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CountUpDirective } from 'src/app/shared/directives/count-up.directive';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';


/**
 * Represents the HomeComponent class.
 */

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let StatsComponent: any; setTimeout(() => import('src/app/stats/stats.component').then(m => StatsComponent = m.StatsComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TranslateModule, CountUpDirective],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css', '../../app.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  
  // Value variables 
  static dailyValue = 0;
  static splurgeValue = 0;
  static smileValue = 0;
  static fireValue = 0;
  static totalAmount = 0;

  triggered = false;
  static allTransactions;

  public get appReference() { return AppComponent; }
  public classReference = HomeComponent;
  public settingsReference = SettingsComponent;
  public appState = AppStateService.instance;

  private txSub?: Subscription;

  /**
   * Constructs a new HomeComponent.
   * @param router - The router service.
   */
  constructor(private router:Router, private cdr: ChangeDetectorRef){
    HomeComponent.allTransactions = AppStateService.instance.allTransactions;
    HomeComponent.getAmounts();

  }

  ngOnInit(): void {
    // Refresh displayed amounts whenever transactions change
    // (e.g. subscription auto-generated transactions after login,
    // manual refresh from subscriptions page, or cashflow game edits).
    this.txSub = AppStateService.instance.transactionsUpdated$.subscribe(() => {
      HomeComponent.allTransactions = AppStateService.instance.allTransactions;
      HomeComponent.getAmounts();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.txSub?.unsubscribe();
  }

  static getAmounts(){
    HomeComponent.dailyValue = AppStateService.instance.getAmount("Daily", AppStateService.instance.daily/100);
    HomeComponent.splurgeValue = AppStateService.instance.getAmount("Splurge", AppStateService.instance.splurge/100);
    HomeComponent.smileValue = AppStateService.instance.getAmount("Smile", AppStateService.instance.smile/100);
    HomeComponent.fireValue = AppStateService.instance.getAmount("Fire", AppStateService.instance.fire/100);
    HomeComponent.totalAmount = Math.round((HomeComponent.dailyValue+HomeComponent.splurgeValue+HomeComponent.smileValue+HomeComponent.fireValue) * 100) / 100;
  }

  /**
   * Gets the amount for the specified account.
   * @param account - The account name.
   * @param p - The percentage value.
   * @returns The calculated amount.
   */
  static getAmount(account:string, p:number){
    if (AppStateService.instance.allTransactions){
      let result = 0.0;
      for (let i = 0; i < AppStateService.instance.allTransactions.length; i++) {
        if (AppStateService.instance.allTransactions[i].account == account){
          result += AppStateService.instance.allTransactions[i].amount;
        } else if (AppStateService.instance.allTransactions[i].account == "Income"){
          result += Math.round((((AppStateService.instance.allTransactions[i].amount)*p) + Number.EPSILON) * 100) / 100 
        }
      }
      return result;
    } else {
      return 0.0;
    } 
  }

  /**
   * Handles the click event on the Daily box.
   */
  clickDaily() {
    this.router.navigate([`/daily`]);
    AppComponent.gotoTop();
  }

  /**
   * Handles the click event on the Splurge box.
   */
  clickSplurge() {
    this.router.navigate([`/splurge`]);
    AppComponent.gotoTop();
  }

  /**
   * Handles the click event on the Smile box.
   */
  clickSmile() {
    this.router.navigate([`/smile`]);
    AppComponent.gotoTop();
  }

  /**
   * Handles the click event on the Fire box.
   */
  clickFire() {
    this.router.navigate([`/fire`]);
    AppComponent.gotoTop();
  }

  /**
   * Handles the click event on the Balance box.
   */
  clickBalance() {
    this.router.navigate([`/transactions`])
    AppComponent.gotoTop();
  }

  /**
   * Navigates to the cashflow page.
   */
  goToCashflow(){
    this.router.navigate(['/cashflow']);
    AppComponent.gotoTop();
  }

  /**
   * Navigates to the stats page.
   */
  goToStats(){
    StatsComponent.resetBIStateIfNeeded("home");
    this.router.navigate(['/stats']);
    StatsComponent.modus = "home";
    StatsComponent.isKPI = false;
    MenuComponent.openStats = true;
    AppComponent.gotoTop();
  }

  /**
   * Navigates to the Business Intelligence dashboard.
   */
  goToBIDashboard(){
    this.router.navigate(['/stats']);
    StatsComponent.modus = "bi";
    StatsComponent.activeBIDashboard = 1;
    StatsComponent.isBIDashboard = true;
    StatsComponent.isKPI = false;
    // Restore the saved analytics level
    StatsComponent.activeAnalyticsLevel = StatsComponent.savedBIAnalyticsLevel;
    MenuComponent.openStats = true;
    AppComponent.gotoTop();
  }

  goToBudget(){
    this.router.navigate(['/budget']);
    AppComponent.gotoTop();
  }
}

