import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

/**
 * Represents the MenuComponent class.
 */

// Deferred imports — resolved after module init to break circular chains
let AddComponent: any; setTimeout(() => import('../add/add.component').then(m => AddComponent = m.AddComponent));
let ProfileComponent: any; setTimeout(() => import('../profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let InfoComponent: any; setTimeout(() => import('../info/info.component').then(m => InfoComponent = m.InfoComponent));
let AddSmileComponent: any; setTimeout(() => import('../add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let AddFireComponent: any; setTimeout(() => import('../add/add-fire/add-fire.component').then(m => AddFireComponent = m.AddFireComponent));
let StatsComponent: any; setTimeout(() => import('src/app/stats/stats.component').then(m => StatsComponent = m.StatsComponent));
let AccountingComponent: any; setTimeout(() => import('src/app/main/accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let GrowComponent: any; setTimeout(() => import('src/app/main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, TranslateModule],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent {
  /**
   * The z-index value for the menu component.
   */
  static zIndex;

  /**
   * Indicates whether the menu is open or not.
   */
  static isMenu;

  /**
   * Indicates whether the stats are open or not.
   */
  static isStats;

  /**
   * Indicates whether the stats are open or not.
   */
  static openStats;

  /**
   * A reference to the MenuComponent class.
   */
  public classReference = MenuComponent;

  constructor(public router: Router) {
    MenuComponent.isMenu = false;
    MenuComponent.openStats = false;
    MenuComponent.isStats = false;
    MenuComponent.zIndex = 0;
  }

  get isStatsPage(): boolean {
    return this.router.url === '/stats';
  }

  /**
   * Highlights the menu component.
   */
  highlight() {
    MenuComponent.zIndex = MenuComponent.zIndex + 1;
    AddComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
  }

  /**
   * Closes the menu window.
   */
  closeWindow() {
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    MenuComponent.zIndex = 0;
  }

  /**
   * Handles the click event on an account.
   * @param account - The account name.
   */
  clickedAccount(account) {
    this.router.navigate([`/${account.toLocaleLowerCase()}`]);
    MenuComponent.isMenu = false;
  }

  /**
   * Handles the click event on the menu stats.
   * @param account - The account name.
   */
  clickedMenuStats(account) {
    StatsComponent.resetBIStateIfNeeded(account);
    StatsComponent.modus = account;
    StatsComponent.isKPI = false;
    StatsComponent.refreshCharts();
    StatsComponent.createChart(account);
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isStatment = false;
    StatsComponent.isStatistic = false;
    StatsComponent.isSwitch = true;
  }

  clickedMenuStatements() {
    StatsComponent.isStatment = true;
    StatsComponent.isKPI = false;
    StatsComponent.isStatistic = false;
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
  }

  clickedMenuStatistic() {
    StatsComponent.isStatistic = true;
    StatsComponent.isKPI = false;
    StatsComponent.isStatment = false;
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
  }
  

  /**
   * Handles the click event on the menu stats.
   */
  clickedPiechart() {
    StatsComponent.resetBIStateIfNeeded("home");
    StatsComponent.modus = "home";
    StatsComponent.isKPI = false;
    StatsComponent.createPieChart();
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;
  }

  clickedCashflowStats() {
    StatsComponent.resetBIStateIfNeeded("cashflow");
    StatsComponent.modus = "cashflow";
    StatsComponent.isKPI = false;
    StatsComponent.createCashflowBarChart("month");
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;
  }

  clickedHistogram() {
    StatsComponent.resetBIStateIfNeeded("histogram");
    StatsComponent.modus = "histogram";
    StatsComponent.isKPI = false;
    StatsComponent.createHistogramChart();
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;
  }
  clickedKPI() {
    StatsComponent.resetBIStateIfNeeded("kpi");
    StatsComponent.modus = "kpi";
    StatsComponent.isKPI = true;
    StatsComponent.createKPI(StatsComponent.activeKPI);
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;
  }
  
  clickedBusinessIntelligence() {
    StatsComponent.modus = "bi";
    StatsComponent.isKPI = false;
    StatsComponent.isBIDashboard = true;
    StatsComponent.activeBIDashboard = 1;
    // Restore the saved analytics level
    StatsComponent.activeAnalyticsLevel = StatsComponent.savedBIAnalyticsLevel;
    StatsComponent.createBIDashboard(1);
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    AppComponent.gotoTop();
  }
  clickedCategory() {
    StatsComponent.resetBIStateIfNeeded("category");
    StatsComponent.modus = "category";
    StatsComponent.isKPI = false;
    StatsComponent.createCategoryBubbleChart();
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;
  }

  clickedZoomable() {
    StatsComponent.resetBIStateIfNeeded("statement");
    StatsComponent.modus = "statement";
    StatsComponent.isKPI = false;
    StatsComponent.createZoomableChart();
    MenuComponent.isMenu = false;
    MenuComponent.isStats = false;
    StatsComponent.isSwitch = false;
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;
  }


  /**
   * Handles the click event on the back button.
   */
  clickedBack() {
    MenuComponent.isStats = false;
    MenuComponent.openStats = false;
    this.router.navigate([`/home`]);
  }

  /**
   * Handles the click event on the home button.
   */
  clickedHome() {
    this.clickedAccount("Home");
  }

  /**
   * Handles the click event on the transactions button.
   */
  clickedTransactions() {
    this.clickedAccount("Transactions");
  }

  /**
   * Handles the click event on the daily button.
   */
  clickedDaily() {
    this.clickedAccount("Daily");
  }

  /**
   * Handles the click event on the splurge button.
   */
  clickedSplurge() {
    this.clickedAccount("Splurge");
  }

  /**
   * Handles the click event on the smile button.
   */
  clickedSmile() {
    this.clickedAccount("Smile");
  }

  /**
   * Handles the click event on the fire button.
   */
  clickedFire() {
    this.clickedAccount("Fire");
  }

  /**
   * Handles the click event on the add transaction button.
   */
  clickedAddTransaction() {
    AddComponent.categoryTextField = "@";
    AddComponent.selectedOption = "Daily";
    AddComponent.url = "/transactions";
    AppComponent.gotoTop();
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    AddSmileComponent.isAddSmile = false;
  }

  /**
   * Handles the click event on the add fire emergency button.
   */
  clickedAddFireEmergency() {
    AppComponent.gotoTop();
    AddFireComponent.isAddFire = true;
    AddSmileComponent.isAddSmile = false;
    AddComponent.isAdd = false;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  /**
   * Handles the click event on the add smile project button.
   */
  clickedAddSmileProject() {
    AppComponent.gotoTop();
    AddSmileComponent.isAddSmile = true;
    AddComponent.isAdd = false;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  /**
   * Handles the click event on the cashflow button.
   */
  clickedCashflow() {
    this.router.navigate([`/cashflow`]);
    MenuComponent.isMenu = false;
  }

  /**
   * Handles the click event on the grow button.
   */
  clickedGrow() {
    AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
    AccountingComponent.dataSource = new MatTableDataSource<any>(AccountingComponent.allTransactions);
    AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
      return { ...transaction, id: index };
    });
    this.router.navigate([`/grow`]);
    MenuComponent.isMenu = false;
  }

  /**
   * Handles the click event on the income statement button.
   */
  clickedIncomeStatement() {
    this.router.navigate([`/income`]);
    MenuComponent.isMenu = false;
  }

  /**
   * Handles the click event on the balance sheet button.
   */
  clickedBalanceSheet() {
    this.router.navigate([`/balance`]);
    MenuComponent.isMenu = false;
  }

  /**
   * Handles the click event on the subscriptions button.
   */
  clickedSubscriptions() {
    this.router.navigate([`/subscription`]);
    MenuComponent.isMenu = false;
  }

  clickedBudget() {
    this.router.navigate([`/budget`]);
    MenuComponent.isMenu = false;
  }
}
