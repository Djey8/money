import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTableDataSource } from '@angular/material/table';
import { AppStateService } from 'src/app/shared/services/app-state.service';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let StatsComponent: any; setTimeout(() => import('src/app/stats/stats.component').then(m => StatsComponent = m.StatsComponent));
let AccountingComponent: any; setTimeout(() => import('src/app/main/accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let AddFireComponent: any; setTimeout(() => import('src/app/panels/add/add-fire/add-fire.component').then(m => AddFireComponent = m.AddFireComponent));
let AddSubscriptionComponent: any; setTimeout(() => import('src/app/panels/add/add-subscription/add-subscription.component').then(m => AddSubscriptionComponent = m.AddSubscriptionComponent));
let AddBudgetComponent: any; setTimeout(() => import('src/app/panels/add/add-budget/add-budget.component').then(m => AddBudgetComponent = m.AddBudgetComponent));
let AddGrowComponent: any; setTimeout(() => import('src/app/panels/add/add-grow/add-grow.component').then(m => AddGrowComponent = m.AddGrowComponent));
let ChooseComponent: any; setTimeout(() => import('src/app/panels/menu/choose/choose.component').then(m => ChooseComponent = m.ChooseComponent));
let AddLiabilitieComponent: any; setTimeout(() => import('src/app/panels/add/add-liabilitie/add-liabilitie.component').then(m => AddLiabilitieComponent = m.AddLiabilitieComponent));

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.css']
})
export class BottomNavComponent {

  get statsMode(): boolean {
    return this.router.url === '/stats';
  }

  constructor(public router: Router) {}

  get isAuthPage(): boolean {
    return this.router.url === '/authentication' || this.router.url === '/';
  }

  get isStatsPage(): boolean {
    return this.router.url === '/stats';
  }

  isActive(route: string): boolean {
    if (route === '/home') {
      return this.router.url === '/home';
    }
    if (route === '/transactions') {
      return this.router.url === '/transactions';
    }
    if (route === '/stats') {
      return this.router.url === '/stats';
    }
    return this.router.url === route;
  }

  goHome() {
    this.router.navigate(['/home']);
  }

  goTransactions() {
    this.router.navigate(['/transactions']);
  }

  /** Context-aware stats: opens the chart mode matching the current page */
  smartStats() {
    if (this.isStatsPage) {
      return;
    }
    const url = this.router.url;
    const modusMap: Record<string, string> = {
      '/daily': 'daily',
      '/splurge': 'splurge',
      '/smile': 'smile',
      '/fire': 'fire',
      '/cashflow': 'cashflow',
      '/income': 'cashflow',
      '/budget': 'home',
      '/subscription': 'home',
      '/grow': 'home',
      '/balance': 'home',
      '/transactions': 'home',
      '/home': 'home',
      '/smileprojects': 'smile',
      '/fireemergencies': 'fire',
    };
    const modus = modusMap[url] || 'home';

    MenuComponent.openStats = true;
    StatsComponent.resetBIStateIfNeeded(modus);
    StatsComponent.modus = modus;
    StatsComponent.isKPI = false;
    StatsComponent.isSwitch = modus !== 'home';
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;

    if (modus === 'home') {
      StatsComponent.createPieChart();
    } else if (modus === 'cashflow') {
      StatsComponent.createCashflowBarChart('month');
    } else {
      StatsComponent.createChart(modus);
    }

    this.router.navigate(['/stats']);
  }

  /** Context-aware add: opens the right add panel for the current page */
  smartAdd() {
    const url = this.router.url;
    switch (url) {
      case '/home':
      case '/transactions':
      case '/daily':
        AppComponent.addTransaction('Daily', '@', 'transactions');
        break;
      case '/splurge':
        AppComponent.addTransaction('Splurge', '@', 'splurge');
        break;
      case '/smile':
        AppComponent.addTransaction('Smile', '@', 'smile');
        break;
      case '/fire':
        AppComponent.addTransaction('Fire', '@', 'fire');
        break;
      case '/smileprojects':
        AddSmileComponent.isAddSmile = true;
        AddSmileComponent.zIndex = 1;
        break;
      case '/fireemergencies':
        AddFireComponent.isAddFire = true;
        AddFireComponent.zIndex = 1;
        break;
      case '/subscription':
        AddSubscriptionComponent.titleTextField = '';
        AddSubscriptionComponent.categoryTextField = '@';
        AddSubscriptionComponent.selectedOption = 'Daily';
        AddSubscriptionComponent.url = '/subscription';
        AddSubscriptionComponent.isAdd = true;
        break;
      case '/budget':
      case '/plan':
        AddBudgetComponent.populateCategoryOptions();
        AddBudgetComponent.categoryTextField = '@';
        AddBudgetComponent.amountTextField = '';
        AddBudgetComponent.dateTextField = '';
        AddBudgetComponent.isAdd = true;
        break;
      case '/grow':
        AddGrowComponent.isAddSmile = true;
        AddGrowComponent.zIndex = 1;
        break;
      case '/balance':
        AppComponent.gotoTop();
        ChooseComponent.isChoose = true;
        ChooseComponent.zIndex = 1;
        break;
      default:
        AppComponent.addTransaction('Daily', '@', 'transactions');
        break;
    }
  }

  goTo(route: string) {
    if (route === '/grow') {
      AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
      AccountingComponent.dataSource = new MatTableDataSource<any>(AccountingComponent.allTransactions);
      AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
        return { ...transaction, id: index };
      });
    }
    this.router.navigate([route]);
  }

  openMenu() {
    AppComponent.openNavBar();
  }

  toggleStatsMode() {
    this.router.navigate(['/home']);
  }

  /** Navigate to a specific chart in stats */
  goChart(modus: string) {
    MenuComponent.openStats = true;
    StatsComponent.resetBIStateIfNeeded(modus);
    StatsComponent.modus = modus;
    StatsComponent.isKPI = modus === 'kpi';
    StatsComponent.isSwitch = modus !== 'home' && modus !== 'kpi' && modus !== 'cashflow';
    StatsComponent.isStatment = false;
    StatsComponent.isBIDashboard = false;

    if (modus === 'home') {
      StatsComponent.createPieChart();
    } else if (modus === 'cashflow') {
      StatsComponent.createCashflowBarChart('month');
    } else if (modus === 'kpi') {
      StatsComponent.createKPI(StatsComponent.activeKPI || 'net-worth-trend');
    } else {
      StatsComponent.createChart(modus);
    }

    if (!this.isStatsPage) {
      this.router.navigate(['/stats']);
    }
  }

  isChartActive(modus: string): boolean {
    return this.isStatsPage && StatsComponent.modus === modus;
  }
}
