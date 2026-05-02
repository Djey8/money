import { Component } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
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
import { TourService } from './shared/services/tour.service';
import { SelfhostedService } from './shared/services/selfhosted.service';
import { ConnectivityService } from './shared/services/connectivity.service';
import { SyncService } from './shared/services/sync.service';
import { OutboxService } from './shared/services/outbox.service';
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
import { TourOverlayComponent } from './shared/components/tour-overlay/tour-overlay.component';
import { PullToRefreshComponent } from './shared/components/pull-to-refresh/pull-to-refresh.component';
import { SwUpdateComponent } from './shared/components/sw-update/sw-update.component';
import { OfflineIndicatorComponent } from './shared/components/offline-indicator/offline-indicator.component';

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
let HomeComponent: any; setTimeout(() => import('src/app/main/home/home.component').then(m => HomeComponent = m.HomeComponent));
let AiAssistantComponent: any; setTimeout(() => import('src/app/panels/ai-assistant/ai-assistant.component').then(m => AiAssistantComponent = m.AiAssistantComponent));
let AddGrowComponent: any; setTimeout(() => import('src/app/panels/add/add-grow/add-grow.component').then(m => AddGrowComponent = m.AddGrowComponent));


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
    TourOverlayComponent,
    PullToRefreshComponent,
    SwUpdateComponent,
    OfflineIndicatorComponent,
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
  constructor(public router: Router, private localStorage: LocalService, private database: DatabaseService, public afAuth: AngularFireAuth, private cryptic: CrypticService, private authService: AuthService, private frontendLogger: FrontendLoggerService, private persistence: PersistenceService, private incomeStatement: IncomeStatementService, public appState: AppStateService, private appData: AppDataService, private gameMode: GameModeService, private subscriptionProcessing: SubscriptionProcessingService, private onboardingService: OnboardingService, private toastService: ToastService, private tourService: TourService, private selfhosted: SelfhostedService, private connectivity: ConnectivityService, private syncService: SyncService, private outbox: OutboxService) {
    AppComponent.instance = this;

    // Subscribe to tour actions for panel management
    this.tourService.action$.subscribe(action => this.handleTourAction(action));

    // Start draining the outbox whenever connectivity returns.
    this.syncService.init();

    // Log offline-readiness milestones to the console so the developer (and curious users)
    // can see when the app is fully cached and safe to use offline. These are intentionally
    // console-only — no UI noise.
    this.logOfflineReadiness();

    // Surface connectivity transitions as toasts so the user understands why the app is
    // accepting writes locally instead of round-tripping to the server. The toast wording
    // depends on whether there's anything queued to sync — we shouldn't promise "syncing
    // your changes" when there's nothing pending.
    let firstConnectivityEvent = true;
    this.connectivity.online$.subscribe(online => {
      if (firstConnectivityEvent) {
        firstConnectivityEvent = false;
        return; // skip initial replay so we don't show a toast on every page load
      }
      if (online) {
        const pending = this.outbox.pendingCount();
        if (pending > 0) {
          this.toastService.show(
            `Back online — syncing ${pending} ${pending === 1 ? 'change' : 'changes'}…`,
            'info'
          );
        } else {
          this.toastService.show('Back online', 'success');
        }
      } else {
        this.toastService.show("You're offline — changes will sync when reconnected", 'info');
      }
    });

    // Parse each localStorage key individually so one corrupt entry
    // doesn't wipe all data via a single catch block
    const safeParse = (key: string, fallback: any = []): any => {
      try {
        const raw = this.localStorage.getData(key);
        if (raw == null || raw === "") return fallback;
        return JSON.parse(raw);
      } catch (e) {
        console.error(`[App Init] Corrupt localStorage key "${key}", using fallback:`, e);
        this.localStorage.removeData(key);
        return fallback;
      }
    };

    AppStateService.instance.allTransactions = safeParse("transactions");
    AppStateService.instance.allSubscriptions = migrateSubscriptionArray(safeParse("subscriptions"));
    //Income Statement
    AppStateService.instance.allRevenues = safeParse("revenues");
    AppStateService.instance.allIntrests = safeParse("interests");
    AppStateService.instance.allProperties = safeParse("properties");

    AppStateService.instance.dailyExpenses = safeParse("dailyEx");
    AppStateService.instance.splurgeExpenses = safeParse("splurgeEx");
    AppStateService.instance.smileExpenses = safeParse("smileEx");
    AppStateService.instance.fireExpenses = safeParse("fireEx");
    AppStateService.instance.mojoExpenses = safeParse("mojoEx");

    AppStateService.instance.allAssets = safeParse("assets");
    AppStateService.instance.allShares = safeParse("shares");
    AppStateService.instance.allInvestments = safeParse("investments");
    AppStateService.instance.liabilities = safeParse("liabilities");
    
    const growParsed = safeParse("grow");
    AppStateService.instance.allGrowProjects = migrateGrowArray(growParsed);

    AppStateService.instance.allSmileProjects = migrateSmileArray(safeParse("smile"));
    AppStateService.instance.allFireEmergencies = migrateFireArray(safeParse("fire"));
    AppStateService.instance.mojo = safeParse("mojo", { amount: 0, target: 0 });
    AppStateService.instance.allBudgets = safeParse("budget");

    // Cache-first / PWA pattern: localStorage is now hydrated into AppState. Release the
    // global loading spinner UNCONDITIONALLY \u2014 the UI has data to render, so there is no
    // reason to block on network at this point. Per-page loaders / refresh-in-place still
    // run in the background to refresh stale data; they don't drive the global spinner.
    AppStateService.instance.isLoading = false;

    // Optimistic early navigate: if we have evidence of a prior session,
    // go to /home immediately so the landing page never flashes
    const hash = window.location.hash;
    if (hash === '' || hash === '#/') {
      const hasSession = DemoService.isDemoMode()
        || window.localStorage.getItem('selfhosted_userId')
        || this.localStorage.getData('uid');
      if (hasSession) {
        this.router.navigate(['/home']);
      }
    }

    // Global safety net: no matter what happens during init (hung Firebase auth, blocked
    // network, thrown errors deep in tier loaders), force the loading spinner off after a
    // short timeout. The user always has the localStorage snapshot loaded at boot, so the
    // UI has something to render even if the server pipeline is wedged.
    const LOADING_HARD_TIMEOUT_MS = 3_000;
    setTimeout(() => {
      if (AppStateService.instance.isLoading) {
        console.warn('[App Init] Loading state stuck — releasing spinner from local cache');
        AppStateService.instance.isLoading = false;
      }
    }, LOADING_HARD_TIMEOUT_MS);

    // Check authentication before loading data
    AppDataService.instance.checkAuthentication().then(async isAuthenticated => {
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
        // Navigate to /home immediately so the user sees the loading skeleton
        // instead of the landing page flashing briefly during data load
        if (hash === '' || hash === '#/') {
          this.router.navigate(['/home']);
        }
        // Selfhosted: fetch encryption config from server
        // If the key is cached in sessionStorage, don't block on the HTTP call
        if (this.appMode === 'selfhosted') {
          const hasCachedKey = !!this.cryptic.getKey();
          const hasPendingMigration = !!this.cryptic._pendingMigrationKey;
          if (hasCachedKey && !hasPendingMigration) {
            // Key already loaded from sessionStorage — fetch in background to keep in sync
            firstValueFrom(this.selfhosted.fetchEncryptionConfig()).catch(
              err => console.error('Background encryption config fetch failed:', err)
            );
          } else {
            // No cached key or migration pending — must wait for server
            await firstValueFrom(this.selfhosted.fetchEncryptionConfig());
            // Migrate: if a key was found in localStorage but the server had 'default',
            // push the old key + flags to the server so it persists across reloads.
            if (this.cryptic._pendingMigrationKey) {
              const migratedKey = this.cryptic._pendingMigrationKey;
              const migratedEncryptLocal = this.cryptic._pendingMigrationEncryptLocal ?? this.cryptic.getEncryptionLocalEnabled();
              const migratedEncryptDatabase = this.cryptic._pendingMigrationEncryptDatabase ?? this.cryptic.getEncryptionDatabaseEnabled();
              this.cryptic._pendingMigrationKey = null;
              this.cryptic._pendingMigrationEncryptLocal = null;
              this.cryptic._pendingMigrationEncryptDatabase = null;
              await firstValueFrom(
                this.selfhosted.saveEncryptionConfig(migratedKey, migratedEncryptLocal, migratedEncryptDatabase)
              ).catch(err => console.error('Failed to migrate encryption key to server:', err));
            }
          }
        }
        // PWA-style boot: localStorage was already hydrated above synchronously, so AppState
        // already has the user's data ready to render. Release the spinner immediately so the
        // user sees their data — the network loads run in the background and refresh state
        // when the server replies. This is the cache-first / stale-while-revalidate pattern.
        const hasLocalData =
          (AppStateService.instance.allTransactions?.length ?? 0) > 0 ||
          (AppStateService.instance.allAssets?.length ?? 0) > 0 ||
          (AppStateService.instance.allRevenues?.length ?? 0) > 0 ||
          (AppStateService.instance.liabilities?.length ?? 0) > 0;
        if (hasLocalData) {
          AppStateService.instance.isLoading = false;
        }

        // Determine current connectivity for the right boot-time toast. waitForReady
        // resolves after Firebase's first round-trip verification completes (or .info/connected
        // fires false), so onlineAtBoot reflects reality \u2014 not the optimistic navigator.onLine.
        await this.connectivity.waitForReady();
        const onlineAtBoot = this.connectivity.isOnline;

        // If we have NO local data and we're offline, there's nothing to load and nothing
        // to wait for \u2014 release the spinner so the user sees the empty state instead of
        // staring at a spinner for 8 seconds until the hard-timeout fires.
        if (!onlineAtBoot) {
          AppStateService.instance.isLoading = false;
        }

        if (hasLocalData) {
          if (onlineAtBoot) {
            this.toastService.show('Refreshing your data\u2026', 'info');
          } else {
            this.toastService.show('Offline \u2014 showing your last saved data', 'info');
          }
        } else if (!onlineAtBoot) {
          this.toastService.show("You're offline \u2014 connect to load your data", 'info');
        }

        // Offline at boot: don't even try to talk to the server. Local data is already in
        // AppState, the spinner is already off, and the outbox drain + tier loads will run
        // automatically the moment connectivity returns (via the connectivity.online$
        // subscription handler in initOfflineSync). Returning here avoids the 10s-per-tier
        // hang while the Firebase SDK times out blocked requests.
        if (!onlineAtBoot) {
          AppStateService.instance.tier2Loaded = true;
          AppStateService.instance.tier3GrowLoaded = true;
          AppStateService.instance.tier3BalanceLoaded = true;
          return;
        }

        // Drain the outbox BEFORE any server reads. If the user made writes offline and is now
        // online again, we must push those snapshots to the server first - otherwise the upcoming
        // loadTier1/loadBalanceData reads would overwrite local state with stale server data and
        // the offline edits would silently disappear.
        try {
          await this.syncService.drain();
        } catch (err) {
          console.error('[App Init] Outbox drain failed (will retry on next reconnect):', err);
        }
        // Tier 1: Load critical data. We already released the spinner above when local data
        // was present, so this load is non-blocking from the user's perspective — it just
        // refreshes the in-memory state with the latest server data when it arrives.
        AppDataService.instance.loadTier1().then(() => {
          if (AppDataService.instance.decryptionFailed) {
            this.toastService.show('Login failed: wrong encryption settings. Please check your encryption key.', 'error');
            this.logOut();
            return;
          }
          AppStateService.instance.isLoading = false;
          // Confirm to the user that the refresh actually completed when we were online at
          // boot. Skip if we were offline (the offline toast already explained the state).
          if (hasLocalData && onlineAtBoot) {
            this.toastService.show('Up to date', 'success');
          }
          // Recalculate home amounts now that data is loaded
          if (HomeComponent) HomeComponent.getAmounts();
          if(!GameModeService.isCashflowGame()){
            // Auto-generate subscription transactions on load
            this.autoGenerateSubscriptionTransactions();
          }
          // Auto-start interactive tour for new users
          if (window.localStorage.getItem('onboarding_pending') === 'true') {
            window.localStorage.removeItem('onboarding_pending');
            setTimeout(() => this.tourService.startTour(), 600);
          }
          // Tier 2: Load deferred data in background (non-blocking)
          const t0 = performance.now();
          AppDataService.instance.loadTier2()
            .catch(err => console.error('Tier 2 load error:', err))
            .then(() => {
              console.log(`[Offline] Tier 2 ready (${Math.round(performance.now() - t0)}ms) — smile/fire/mojo/budget cached`);
              // Tier 3: Prefetch the rest in the background so the offline cache is fully
              // hydrated even for pages the user hasn't opened yet. These are best-effort —
              // failures are logged but don't surface to the UI.
              const tier3 = Promise.all([
                AppDataService.instance.loadGrowData()
                  .catch(err => console.error('Tier 3 grow prefetch error:', err)),
                AppDataService.instance.loadBalanceData()
                  .catch(err => console.error('Tier 3 balance prefetch error:', err))
              ]);
              tier3.then(() => {
                console.log(`[Offline] Tier 3 ready (${Math.round(performance.now() - t0)}ms) — grow + balance cached. App data fully loaded.`);
              });
            });
        }).catch(err => {
          // Last-resort safety net: any unhandled rejection from loadTier1 must NOT leave the
          // user staring at a forever-spinner. The localStorage snapshot loaded at boot is
          // already in AppState, so the UI has data to render — we just need to release the
          // spinner.
          console.error('[App Init] loadTier1 failed (rendering from local cache):', err);
          AppStateService.instance.isLoading = false;
        });
      } else {
        AppStateService.instance.isLoading = false;
        // Session expired or not authenticated — clean up encrypted data and redirect
        const hash = window.location.hash;
        if (hash === '' || hash === '#/' || hash === '#/about') {
          // Stay on landing / about page — no redirect
        } else {
          this.logOut();
        }
      }
    });
    
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        // Skip auth checks for demo mode and landing page
        if (DemoService.isDemoMode()) return;
        const hash = window.location.hash;
        if (hash === '' || hash === '#/' || hash === '#/about') return;

        const authResult = await this.authService.checkAuthentication();
        if (!authResult.authenticated) {
          console.error('Authentication failed:', authResult.error);
          this.logOut();
        } else {
          // Smart reload: check if data changed before reloading
          const hasChanged = await AppDataService.instance.checkUpdatedAt();
          if (hasChanged) {
            AppStateService.instance.isLoading = true;
            // Reset tier 3 flags so on-demand data is re-fetched from server
            // when user next navigates to those pages
            AppStateService.instance.tier3BalanceLoaded = false;
            AppStateService.instance.tier3GrowLoaded = false;
            try {
              await AppDataService.instance.loadTier1();
              if (AppDataService.instance.decryptionFailed) {
                this.toastService.show('Login failed: wrong encryption settings. Please check your encryption key.', 'error');
                this.logOut();
                return;
              }
              // Auto-generate subscription transactions after reload
              this.autoGenerateSubscriptionTransactions();
            } finally {
              // Always clear the spinner — otherwise a hung Firebase read or thrown error
              // leaves the UI stuck on a loading state that only a hard refresh can fix.
              AppStateService.instance.isLoading = false;
            }
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

  /**
   * Logs milestones describing when the app becomes fully usable offline:
   *   - service worker activated (shell + assets cached)
   *   - all lazy route chunks preloaded
   * Tier-1/2/3 data readiness is logged from the auth-success path where it actually runs.
   */
  private logOfflineReadiness(): void {
    const startedAt = performance.now();

    // 1. Service worker activation (means shell + assetGroups are in cache).
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          console.log(
            `[Offline] Service worker active (${Math.round(performance.now() - startedAt)}ms) — app shell + page images cached`
          );
        })
        .catch(err => console.warn('[Offline] Service worker not ready:', err));
    } else {
      console.log('[Offline] Service worker unavailable — only in-memory + localStorage cache');
    }

    // 2. Lazy-route preloading. PreloadAllModules walks the route table after bootstrap;
    //    once the browser is idle, every chunk has been requested. Falls back to a timer
    //    in environments without requestIdleCallback (Safari < 16, jsdom).
    const announcePreloaded = () => {
      console.log(
        `[Offline] All route chunks preloaded (${Math.round(performance.now() - startedAt)}ms) — every page reachable offline`
      );
    };
    if (typeof window !== 'undefined') {
      const ric = (window as any).requestIdleCallback;
      if (typeof ric === 'function') {
        ric(announcePreloaded, { timeout: 5_000 });
      } else {
        setTimeout(announcePreloaded, 3_000);
      }
    }
  }

  /** Handles tour panel actions (open/close panels during the walkthrough) */
  private handleTourAction(action: string): void {
    switch (action) {
      case 'closeAllPanels':
        if (AddComponent) AddComponent.isAdd = false;
        if (AddSmileComponent) { AddSmileComponent.isAddSmile = false; AddSmileComponent.expandAllSections = false; }
        if (MenuComponent) MenuComponent.isMenu = false;
        if (ProfileComponent) ProfileComponent.isProfile = false;
        if (SettingsComponent) SettingsComponent.zIndex = 0;
        if (InstructionsComponent) InstructionsComponent.zIndex = 0;
        if (ImpressumComponent) ImpressumComponent.zIndex = 0;
        if (PolicyComponent) PolicyComponent.zIndex = 0;
        if (InfoComponent) InfoComponent.isInfo = false;
        if (AiAssistantComponent) AiAssistantComponent.isOpen = false;
        break;
      case 'openAddTransaction':
        if (AddComponent) {
          AddComponent.isAdd = true;
          AddComponent.selectedOption = 'Daily';
          AddComponent.amountTextField = '';
          AddComponent.categoryTextField = '@';
          AddComponent.commentTextField = '';
          AddComponent.url = '/transactions';
          AddComponent.zIndex = 100;
        }
        break;
      case 'closeAddPanel':
        if (AddComponent) AddComponent.isAdd = false;
        break;
      case 'openAddSmile':
        if (AddSmileComponent) {
          AddSmileComponent.isAddSmile = true;
          AddSmileComponent.zIndex = 100;
          AddSmileComponent.expandAllSections = true;
        }
        break;
      case 'closeAddSmile':
        if (AddSmileComponent) AddSmileComponent.isAddSmile = false;
        break;
      case 'openAiAssistant':
        if (AiAssistantComponent) {
          AiAssistantComponent.isOpen = true;
          AiAssistantComponent.zIndex = 100;
        }
        break;
      case 'closeAiAssistant':
        if (AiAssistantComponent) AiAssistantComponent.isOpen = false;
        break;
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

    // Reset settings to defaults
    AppStateService.instance.currency = '€';
    AppStateService.instance.daily = 60;
    AppStateService.instance.splurge = 10;
    AppStateService.instance.smile = 10;
    AppStateService.instance.fire = 20;
    AppStateService.instance.key = 'default';
    AppStateService.instance.dateFormat = 'dd.MM.yyyy';
    AppStateService.instance.isEuropeanFormat = true;
    AppStateService.instance.isLocal = true;
    AppStateService.instance.isDatabase = false;

    // Wipe encryption key + toggles from memory and storage
    this.cryptic.clearConfig();

    ProfileComponent.isUser = true;
    ProfileComponent.username = "Username";
    ProfileComponent.mail = "example@traiber.com";
    
    // Clear all in-memory caches (read cache, ETags, dirty-tracker)
    this.database.clearAllCaches();

    // Clear authentication based on mode
    if (this.appMode === 'firebase') {
      this.logoutFirebase();
    } else {
      // Selfhosted mode - clear userId and call backend to clear cookies
      localStorage.removeItem('selfhosted_userId');
      this.selfhosted.logout().subscribe({ error: () => {} });
    }
    
    this.router.navigate(['/']);
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
