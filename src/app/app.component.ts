import { Component } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { TranslateModule } from '@ngx-translate/core';
import { LocalService } from './shared/services/local.service';
import { DatabaseService } from './shared/services/database.service';
import { CrypticService } from './shared/services/cryptic.service';
import { environment } from '../environments/environment';
import { AuthService } from './shared/services/auth.service';
import { FrontendLoggerService } from './shared/services/frontend-logger.service';
import { DemoService } from './shared/services/demo.service';
import { PersistenceService } from './shared/services/persistence.service';
import { IncomeStatementService } from './shared/services/income-statement.service';
import { AppStateService } from './shared/services/app-state.service';
import { AppDataService } from './shared/services/app-data.service';
import { GameModeService } from './shared/services/game-mode.service';
import { SubscriptionProcessingService } from './shared/services/subscription-processing.service';
import { ToastService } from './shared/services/toast.service';
import { migrateGrowArray } from './shared/grow-migration.utils';
import { migrateSmileArray } from './shared/smile-migration.utils';
import { migrateFireArray } from './shared/fire-migration.utils';
import { migrateSubscriptionArray } from './shared/migrations/subscription-migration.utils';
import { OnboardingService } from './shared/services/onboarding.service';
import { gotoTop as scrollToTop, gotoTopAuto as scrollToTopAuto } from './shared/scroll.utils';

// Standalone component imports used in template
import { AddComponent as AddComp } from './panels/add/add.component';
import { AddSmileComponent as AddSmileComp } from './panels/add/add-smile/add-smile.component';
import { AddFireComponent as AddFireComp } from './panels/add/add-fire/add-fire.component';
import { AddAssetComponent as AddAssetComp } from './panels/add/add-asset/add-asset.component';
import { AddShareComponent as AddShareComp } from './panels/add/add-share/add-share.component';
import { AddInvestmentComponent as AddInvestmentComp } from './panels/add/add-investment/add-investment.component';
import { AddLiabilitieComponent as AddLiabilitieComp } from './panels/add/add-liabilitie/add-liabilitie.component';
import { AddSubscriptionComponent as AddSubscriptionComp } from './panels/add/add-subscription/add-subscription.component';
import { AddGrowComponent as AddGrowComp } from './panels/add/add-grow/add-grow.component';
import { AddBudgetComponent as AddBudgetComp } from './panels/add/add-budget/add-budget.component';
import { MenuComponent as MenuComp } from './panels/menu/menu.component';
import { ChooseComponent as ChooseComp } from './panels/menu/choose/choose.component';
import { ProfileComponent as ProfileComp } from './panels/profile/profile.component';
import { SettingsComponent as SettingsComp } from './panels/settings/settings.component';
import { ImpressumComponent as ImpressumComp } from './panels/impressum/impressum.component';
import { PolicyComponent as PolicyComp } from './panels/policy/policy.component';
import { InstructionsComponent as InstructionsComp } from './panels/instructions/instructions.component';
import { InfoComponent as InfoComp } from './panels/info/info.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { OnboardingComponent } from './shared/components/onboarding/onboarding.component';
import { PullToRefreshComponent } from './shared/components/pull-to-refresh/pull-to-refresh.component';
import { SwUpdateComponent } from './shared/components/sw-update/sw-update.component';

// Deferred imports — resolved after module init to break circular chains
let ProfileComponent: any; setTimeout(() => import('./panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('./panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let InfoComponent: any; setTimeout(() => import('src/app/panels/info/info.component').then(m => InfoComponent = m.InfoComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let ImpressumComponent: any; setTimeout(() => import('src/app/panels/impressum/impressum.component').then(m => ImpressumComponent = m.ImpressumComponent));
let PolicyComponent: any; setTimeout(() => import('src/app/panels/policy/policy.component').then(m => PolicyComponent = m.PolicyComponent));
let SettingsComponent: any; setTimeout(() => import('src/app/panels/settings/settings.component').then(m => SettingsComponent = m.SettingsComponent));
let InstructionsComponent: any; setTimeout(() => import('src/app/panels/instructions/instructions.component').then(m => InstructionsComponent = m.InstructionsComponent));
let InfoSubscriptionComponent: any; setTimeout(() => import('src/app/panels/info/info-subscription/info-subscription.component').then(m => InfoSubscriptionComponent = m.InfoSubscriptionComponent));
let AddSubscriptionComponent: any; setTimeout(() => import('src/app/panels/add/add-subscription/add-subscription.component').then(m => AddSubscriptionComponent = m.AddSubscriptionComponent));
let AddBudgetComponent: any; setTimeout(() => import('src/app/panels/add/add-budget/add-budget.component').then(m => AddBudgetComponent = m.AddBudgetComponent));
let InfoBudgetComponent: any; setTimeout(() => import('src/app/panels/info/info-budget/info-budget.component').then(m => InfoBudgetComponent = m.InfoBudgetComponent));


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    NgIf,
    TranslateModule,
    AddComp,
    AddSmileComp,
    AddFireComp,
    AddAssetComp,
    AddShareComp,
    AddInvestmentComp,
    AddLiabilitieComp,
    AddSubscriptionComp,
    AddGrowComp,
    AddBudgetComp,
    MenuComp,
    ChooseComp,
    ProfileComp,
    SettingsComp,
    ImpressumComp,
    PolicyComp,
    InstructionsComp,
    InfoComp,
    ToastComponent,
    ConfirmDialogComponent,
    BottomNavComponent,
    OnboardingComponent,
    PullToRefreshComponent,
    SwUpdateComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  
  static instance: AppComponent;
  appMode: 'firebase' | 'selfhosted' = environment.mode as 'firebase' | 'selfhosted';

  public classReference = AppComponent;

  get isDemoMode(): boolean {
    return DemoService.isDemoMode();
  }

  exitDemo(): void {
    sessionStorage.removeItem('demo_mode');
  }

  /**
   * Constructs a new instance of the AppComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   */
  constructor(public router: Router, private localStorage: LocalService, private database: DatabaseService, public afAuth: AngularFireAuth, private cryptic: CrypticService, private authService: AuthService, private frontendLogger: FrontendLoggerService, private persistence: PersistenceService, private incomeStatement: IncomeStatementService, private appState: AppStateService, private appData: AppDataService, private gameMode: GameModeService, private subscriptionProcessing: SubscriptionProcessingService, private onboardingService: OnboardingService, private toastService: ToastService) {
    AppComponent.instance = this;

    try {
      AppStateService.instance.allTransactions = this.localStorage.getData("transactions") == "" ? [] : JSON.parse(this.localStorage.getData("transactions"));
      AppStateService.instance.allSubscriptions = this.localStorage.getData("subscriptions") == "" ? [] : migrateSubscriptionArray(JSON.parse(this.localStorage.getData("subscriptions")));
      //Income Statement
      AppStateService.instance.allRevenues = this.localStorage.getData("revenues") == "" ? [] : JSON.parse(this.localStorage.getData("revenues"));
      AppStateService.instance.allIntrests = this.localStorage.getData("interests") == "" ? [] : JSON.parse(this.localStorage.getData("interests"));
      AppStateService.instance.allProperties = this.localStorage.getData("properties") == "" ? [] : JSON.parse(this.localStorage.getData("properties"));

      AppStateService.instance.dailyExpenses = this.localStorage.getData("dailyEx") == "" ? [] : JSON.parse(this.localStorage.getData("dailyEx"));
      AppStateService.instance.splurgeExpenses = this.localStorage.getData("splurgeEx") == "" ? [] : JSON.parse(this.localStorage.getData("splurgeEx"));
      AppStateService.instance.smileExpenses = this.localStorage.getData("smileEx") == "" ? [] : JSON.parse(this.localStorage.getData("smileEx"));
      AppStateService.instance.fireExpenses = this.localStorage.getData("fireEx") == "" ? [] : JSON.parse(this.localStorage.getData("fireEx"));
      AppStateService.instance.mojoExpenses = this.localStorage.getData("mojoEx") == "" ? [] : JSON.parse(this.localStorage.getData("mojoEx"));

      AppStateService.instance.allAssets = this.localStorage.getData("assets") == "" ? [] : JSON.parse(this.localStorage.getData("assets"));
      AppStateService.instance.allShares = this.localStorage.getData("shares") == "" ? [] : JSON.parse(this.localStorage.getData("shares"));
      AppStateService.instance.allInvestments = this.localStorage.getData("investments") == "" ? [] : JSON.parse(this.localStorage.getData("investments"));
      AppStateService.instance.liabilities = this.localStorage.getData("liabilities") == "" ? [] : JSON.parse(this.localStorage.getData("liabilities"));
      
      const growRaw = this.localStorage.getData("grow");
      if (growRaw && growRaw !== "") {
        const parsed = JSON.parse(growRaw);
        console.log('[App Init] Loaded from localStorage, sample types:', parsed.slice(-2).map((g: any) => ({ title: g.title, type: g.type })));
        AppStateService.instance.allGrowProjects = migrateGrowArray(parsed);
      } else {
        AppStateService.instance.allGrowProjects = [];
      }

      AppStateService.instance.allSmileProjects = this.localStorage.getData("smile") == "" ? [] : migrateSmileArray(JSON.parse(this.localStorage.getData("smile")));
      AppStateService.instance.allFireEmergencies = this.localStorage.getData("fire") == "" ? [] : migrateFireArray(JSON.parse(this.localStorage.getData("fire")));
      AppStateService.instance.mojo = this.localStorage.getData("mojo") == "" ? { amount: 0, target: 0 } : JSON.parse(this.localStorage.getData("mojo"));
      AppStateService.instance.allBudgets = this.localStorage.getData("budget") == "" ? [] : JSON.parse(this.localStorage.getData("budget"));
    } 
    catch (e: any) {
      alert(e);
      // Reset local Storage
      this.localStorage.removeData("transactions");
      this.localStorage.removeData("subscriptions");
      this.localStorage.removeData("smile");
      this.localStorage.removeData("fire");
      this.localStorage.removeData("mojo");
      this.localStorage.removeData("revenues");
      this.localStorage.removeData("interests");
      this.localStorage.removeData("properties");
      this.localStorage.removeData("dailyEx");
      this.localStorage.removeData("splurgeEx");
      this.localStorage.removeData("smileEx");
      this.localStorage.removeData("fireEx");
      this.localStorage.removeData("mojoEx");
      this.localStorage.removeData("assets");
      this.localStorage.removeData("shares");
      this.localStorage.removeData("investments");
      this.localStorage.removeData("liabilitiesEx");
      this.localStorage.removeData("username");
      this.localStorage.removeData("uid");
      this.localStorage.removeData("email");
      this.localStorage.removeData("grow");
      this.localStorage.removeData("budget");
      AppStateService.instance.allTransactions = [];
      AppStateService.instance.allSubscriptions = [];
      AppStateService.instance.allBudgets = [];
      AppStateService.instance.allGrowProjects = [];
      AppStateService.instance.allSmileProjects = [];
      AppStateService.instance.allFireEmergencies = [];
    }

    // Check authentication before loading data
    AppDataService.instance.checkAuthentication().then(isAuthenticated => {
      if (isAuthenticated) {
        const hash = window.location.hash;

        // In demo mode, skip DB loads — data is already seeded in localStorage/AppState
        if (DemoService.isDemoMode()) {
          AppStateService.instance.isLoading = false;
          AppStateService.instance.tier2Loaded = true;
          AppStateService.instance.tier3GrowLoaded = true;
          AppStateService.instance.tier3BalanceLoaded = true;
          if (hash === '' || hash === '#/') {
            this.router.navigate(['/home']);
          }
          return;
        }
        // Tier 1: Load critical data, block UI until ready
        AppDataService.instance.loadTier1().then(() => {
          AppStateService.instance.isLoading = false;
          // Navigate to /home AFTER data is loaded so the home component
          // constructs with populated state (avoids empty-data flash after login)
          if (hash === '' || hash === '#/') {
            this.router.navigate(['/home']);
          }
          if(!GameModeService.isCashflowGame()){
            // Auto-generate subscription transactions on load
            this.autoGenerateSubscriptionTransactions();
          }
          // Auto-start onboarding tour for new users
          if (window.localStorage.getItem('onboarding_pending') === 'true') {
            window.localStorage.removeItem('onboarding_pending');
            setTimeout(() => this.onboardingService.startTour(), 600);
          }
          // Tier 2: Load deferred data in background (non-blocking)
          AppDataService.instance.loadTier2().catch(err => console.error('Tier 2 load error:', err));
        });
      } else {
        AppStateService.instance.isLoading = false;
        // If on landing page, stay there; otherwise redirect to auth
        const hash = window.location.hash;
        if (hash === '' || hash === '#/') {
          // Stay on landing page — no redirect
        } else {
          this.router.navigate(['/']);
        }
      }
    });
    
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        // Skip auth checks for demo mode and landing page
        if (DemoService.isDemoMode()) return;
        const hash = window.location.hash;
        if (hash === '' || hash === '#/') return;

        const authResult = await this.authService.checkAuthentication();
        if (!authResult.authenticated) {
          console.error('Authentication failed:', authResult.error);
          this.router.navigate(['/']);
        } else {
          // Smart reload: check if data changed before reloading
          const hasChanged = await AppDataService.instance.checkUpdatedAt();
          if (hasChanged) {
            AppStateService.instance.isLoading = true;
            await AppDataService.instance.loadTier1();
            AppStateService.instance.isLoading = false;
            // Auto-generate subscription transactions after reload
            this.autoGenerateSubscriptionTransactions();
          }
        }
      }
    });
  }

  /**
   * Auto-generates subscription transactions on app load.
   * Shows toast notification with count of generated transactions.
   * Handles errors gracefully without blocking app load.
   */
  private async autoGenerateSubscriptionTransactions(): Promise<void> {
    try {
      const result = await SubscriptionProcessingService.instance.setTransactionsForSubscriptions();
      
      if (result.transactionsCreated > 0) {
        this.toastService.show(
          `${result.transactionsCreated} subscription transaction${result.transactionsCreated === 1 ? '' : 's'} loaded`,
          'info'
        );
      }
    } catch (error) {
      // Log error but don't block app load
      console.error('Failed to auto-generate subscription transactions:', error);
      // Don't show error toast on initial load to avoid alarming users
    }
  }

  logoutFirebase() {
    this.afAuth.signOut()
      .then(() => {
        // User successfully logged out
      })
      .catch(error => {
        // An error occurred while logging out
        console.error(error);
      });
  }

  logOut() {
    this.localStorage.removeData("uid");
    this.localStorage.removeData("email");
    this.localStorage.removeData("username");
    this.localStorage.removeData("transactions");
    this.localStorage.removeData("subscriptions");
    this.localStorage.removeData("smile");
    this.localStorage.removeData("fire");
    this.localStorage.removeData("mojo");
    this.localStorage.removeData("revenues");
    this.localStorage.removeData("interests");
    this.localStorage.removeData("properties");

    this.localStorage.removeData("dailyEx");
    this.localStorage.removeData("splurgeEx");
    this.localStorage.removeData("smileEx");
    this.localStorage.removeData("fireEx");
    this.localStorage.removeData("mojoEx");
    this.localStorage.removeData("liabilitiesEx");

    this.localStorage.removeData("assets");
    this.localStorage.removeData("shares");
    this.localStorage.removeData("investments");
    this.localStorage.removeData("liabilities");
    this.localStorage.removeData("grow");
    this.localStorage.removeData("budget");

    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allSubscriptions = [];
    AppStateService.instance.allRevenues = [];
    AppStateService.instance.allIntrests = [];
    AppStateService.instance.allProperties = [];
    AppStateService.instance.dailyExpenses = [];
    AppStateService.instance.splurgeExpenses = [];
    AppStateService.instance.smileExpenses = [];
    AppStateService.instance.fireExpenses = [];
    AppStateService.instance.mojoExpenses = [];
    AppStateService.instance.allAssets = [];
    AppStateService.instance.allShares = [];
    AppStateService.instance.allInvestments = [];
    AppStateService.instance.liabilities = [];
    AppStateService.instance.allGrowProjects = [];
    AppStateService.instance.allSmileProjects = [];
    AppStateService.instance.allFireEmergencies = [];
    AppStateService.instance.allBudgets = [];
    AppStateService.instance.mojo = { amount: 0, target: 0 };

    this.cryptic.updateConfig("default", true, false);
    ProfileComponent.isUser = true;
    ProfileComponent.username = "Username";
    ProfileComponent.mail = "example@traiber.com";
    
    // Clear all in-memory caches (read cache, ETags, dirty-tracker)
    this.database.clearAllCaches();

    // Clear authentication based on mode
    if (this.appMode === 'firebase') {
      this.logoutFirebase();
    } else {
      // Selfhosted mode - clear tokens
      localStorage.removeItem('selfhosted_token');
      localStorage.removeItem('selfhosted_userId');
    }
    
    this.router.navigate(['/authentication']);
  }


  isMenu = true;
  title = "Welcome";
  public goToRegistration() {
    this.router.navigate(['/authentication'])
    this.title = "Authentication";
  }
  public goToAccounting() {
    this.router.navigate(['/transactions'])
  }
  public goToMain() {
    this.router.navigate(['/home'])
  }

  static openNavBar() {
    AppComponent.gotoTop();
    MenuComponent.isMenu = !MenuComponent.isMenu;
    MenuComponent.isStats = false;

    InfoComponent.isInfo = false;
    AddComponent.isAdd = false;
    AddSmileComponent.isAddSmile = false;
    MenuComponent.zIndex = 1;
    ProfileComponent.zIndex = 0;
    ImpressumComponent.zIndex = 0;
    PolicyComponent.zIndex = 0;
    SettingsComponent.zIndex = 0;
    InstructionsComponent.zIndex = 0;
  }

  static gotoTop() {
    scrollToTop();
  }
  static gotoTopAuto() {
    scrollToTopAuto();
  }

  static clickProfile() {
    ProfileComponent.isProfile = !ProfileComponent.isProfile;
    ProfileComponent.zIndex = 100;
  }

  static addTransaction(account: string, category: string, url: string) {
    AddComponent.populateCategoryOptions();
    AddComponent.categoryTextField = category;
    AddComponent.selectedOption = account;
    AddComponent.isShare = false;
    AddComponent.isTaxExpense = false;
    AddComponent.isLiabilitie = false;
    AddComponent.url = "/" + url;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    AddComponent.creditTextField = "";
    AddComponent.loanTextField = "";
  }

  static addSubscription(account: string, category: string, url: string) {
    AddSubscriptionComponent.titleTextField = "";
    AddSubscriptionComponent.categoryTextField = category;
    AddSubscriptionComponent.selectedOption = account;
    AddSubscriptionComponent.url = "/" + url;
    AddSubscriptionComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  static copyTransaction(account: string, amount: number, category: string, comment: string, url: string) {
    AddComponent.categoryTextField = category;
    AddComponent.selectedOption = account;
    AddComponent.amountTextField = String(amount);
    AddComponent.commentTextField = comment;
    AddComponent.isLiabilitie = false;
    AddComponent.url = "/" + url;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  static copyBudget(date: string, tag: string, amount: number) {
    AddBudgetComponent.populateCategoryOptions();
    AddBudgetComponent.dateTextField = date;
    AddBudgetComponent.categoryTextField = tag;
    AddBudgetComponent.amountTextField = String(amount);
    AddBudgetComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    InfoBudgetComponent.isInfo = false;
  }

  static copySubcription(title: string, account: string, amount: number, category: string, comment: string, url: string) {
    AddSubscriptionComponent.titleTextField = title;
    AddSubscriptionComponent.selectedOption = account;
    AddSubscriptionComponent.amountTextField = String(amount);
    AddSubscriptionComponent.categoryTextField = category;
    AddSubscriptionComponent.commentTextField = comment;
    AddSubscriptionComponent.url = "/" + url;
    AddSubscriptionComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoSubscriptionComponent.isInfo = false;
  }

  clickCount = 0;
  clickCollapse() {
    this.clickCount++;
    setTimeout(() => {
      if (this.clickCount === 1) {
        // single click - no action
      } else if (this.clickCount === 2) {
        // double click - collapse open menus
        ProfileComponent.isProfile = false;
        MenuComponent.isMenu = false;
      }
      this.clickCount = 0;
    }, 250)
  }

  static getPageSizeOptions(): number[] {
    const totalTransactions = AppStateService.instance.allTransactions.length;
    
    if (totalTransactions <= 50) {
      return [5, 10, 25, totalTransactions];
    } else if (totalTransactions <= 200) {
      return [10, 25, 50, totalTransactions];
    } else {
      return [25, 50, 100, 250, 500, totalTransactions];
    }
  }

}
