import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { TranslateService } from '@ngx-translate/core'
import { Revenue } from 'src/app/interfaces/revenue';
import { Expense } from 'src/app/interfaces/expense';
import { CrypticService } from 'src/app/shared/services/cryptic.service';
import { AuthCredential, EmailAuthProvider, getAuth, reauthenticateWithCredential } from "firebase/auth";
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/shared/services/auth.service';
import { SelfhostedService } from 'src/app/shared/services/selfhosted.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { IncomeStatementService } from 'src/app/shared/services/income-statement.service';
import { ErrorMapperService } from 'src/app/shared/services/error-mapper.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { migrateGrowArray } from 'src/app/shared/grow-migration.utils';
import { migrateSmileArray } from 'src/app/shared/smile-migration.utils';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let InfoComponent: any; setTimeout(() => import('src/app/panels/info/info.component').then(m => InfoComponent = m.InfoComponent));
let IncomeComponent: any; setTimeout(() => import('src/app/main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let BalanceComponent: any; setTimeout(() => import('src/app/main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let SmileProjectsComponent: any; setTimeout(() => import('src/app/main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('src/app/main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let AccountingComponent: any; setTimeout(() => import('src/app/main/accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let FireComponent: any; setTimeout(() => import('src/app/main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let BudgetComponent: any; setTimeout(() => import('src/app/main/budget/budget.component').then(m => BudgetComponent = m.BudgetComponent));
let GrowComponent: any; setTimeout(() => import('src/app/main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let SubscriptionComponent: any; setTimeout(() => import('src/app/main/subscription/subscription.component').then(m => SubscriptionComponent = m.SubscriptionComponent));
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  static get username() { return AppStateService.instance.username; }
  static set username(v: string) { AppStateService.instance.username = v; }
  static get email() { return AppStateService.instance.email; }
  static set email(v: string) { AppStateService.instance.email = v; }
  static get currency() { return AppStateService.instance.currency; }
  static set currency(v: string) { AppStateService.instance.currency = v; }

  appMode: 'firebase' | 'selfhosted' = environment.mode as 'firebase' | 'selfhosted';
  appVersion = environment.appVersion;

  static isSettings = true;
  static isLanguages = false;
  static isAllocation = false;
  static isEncryption = false;
  static isCurrency = false;
  static isNumberFormat = false;
  static isDateFormat = false;
  static isBackup = false;
  static isRestore = false;
  static isTheme = false;

  static get dateFormat() { return AppStateService.instance.dateFormat; }
  static set dateFormat(v: string) { AppStateService.instance.dateFormat = v; }

  static isEng = true;
  static isDe = false;
  static isEs = false;
  static isFr = false;
  static isCn = false;
  static isAr = false;

  static get daily() { return AppStateService.instance.daily; }
  static set daily(v: number) { AppStateService.instance.daily = v; }
  static get splurge() { return AppStateService.instance.splurge; }
  static set splurge(v: number) { AppStateService.instance.splurge = v; }
  static get smile() { return AppStateService.instance.smile; }
  static set smile(v: number) { AppStateService.instance.smile = v; }
  static get fire() { return AppStateService.instance.fire; }
  static set fire(v: number) { AppStateService.instance.fire = v; }

  static get key() { return AppStateService.instance.key; }
  static set key(v: string) { AppStateService.instance.key = v; }
  keyTextField = "default";
  static get isLocal() { return AppStateService.instance.isLocal; }
  static set isLocal(v: boolean) { AppStateService.instance.isLocal = v; }
  static get isDatabase() { return AppStateService.instance.isDatabase; }
  static set isDatabase(v: boolean) { AppStateService.instance.isDatabase = v; }
  static get isEuropeanFormat() { return AppStateService.instance.isEuropeanFormat; }
  static set isEuropeanFormat(v: boolean) { AppStateService.instance.isEuropeanFormat = v; }

  static setSettingsComponent(username: string, email: string) {
    AppStateService.instance.username = username;
    AppStateService.instance.email = email;
    SettingsComponent.isInfo = true;
    SettingsComponent.isSettings = true;
    SettingsComponent.isLanguages = false;
    SettingsComponent.isCurrency = false;
    SettingsComponent.isAllocation = false;
    SettingsComponent.isEncryption = false;
    SettingsComponent.isNumberFormat = false;
    SettingsComponent.isDateFormat = false;
    SettingsComponent.isBackup = false;
    SettingsComponent.isRestore = false;
    SettingsComponent.isTheme = false;
    SettingsComponent.isError = false;
  }

  dateFormats = [
    { value: 'dd.MM.yyyy', label: 'dd.MM.yyyy', example: '21.03.2026' },
    { value: 'dd.MM.yy', label: 'dd.MM.yy', example: '21.03.26' },
    { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy', example: '21/03/2026' },
    { value: 'dd/MM/yy', label: 'dd/MM/yy', example: '21/03/26' },
    { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd', example: '2026-03-21' },
    { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy', example: '03/21/2026' },
    { value: 'dd-MM-yyyy', label: 'dd-MM-yyyy', example: '21-03-2026' },
  ];

  isEdit = false;

  // Backup state
  importStatus: string = '';
  isImporting: boolean = false;

  @ViewChild('migrationFileInput') migrationFileInput!: ElementRef;

  usernameTextField = AppStateService.instance.username;
  emailTextField = AppStateService.instance.email;
  currencyTextField = AppStateService.instance.currency;

  dailyTextField = AppStateService.instance.daily;
  splurgeTextField = AppStateService.instance.splurge;
  smileTextField = AppStateService.instance.smile;
  fireTextField = AppStateService.instance.fire;

  errorTextLable = "";

  borderColor = "var(--color-border)";
  color = "black";

  isAuth = false;
  isError = false;
  passwordTextField = "";
  errorMessageLable = "Error: Password is not correct!";
  eyePic = "../../assets/symbols/eye.png";

  isDeleteAuth = false;
  isDeleteError = false;
  deletePasswordTextField = "";
  deleteErrorLabel = "";
  deleteEyePic = "../../assets/symbols/eye.png";


  static zIndex;
  static isInfo;
  static isError;
  static _pendingEdit = false;

  static openAllocationEditor(): void {
    SettingsComponent.isInfo = true;
    SettingsComponent.isSettings = false;
    SettingsComponent.isAllocation = true;
    SettingsComponent.isLanguages = false;
    SettingsComponent.isCurrency = false;
    SettingsComponent.isEncryption = false;
    SettingsComponent.isNumberFormat = false;
    SettingsComponent.isDateFormat = false;
    SettingsComponent.isBackup = false;
    SettingsComponent.isRestore = false;
    SettingsComponent.isTheme = false;
    SettingsComponent.isError = false;
    SettingsComponent._pendingEdit = true;
  }

  public classReference = SettingsComponent;
  public get profileReference() { return ProfileComponent; }
  constructor(private translate: TranslateService, private router: Router, private localStorage: LocalService, private database: DatabaseService, private afAuth: AngularFireAuth, private cryptic: CrypticService, private authService: AuthService, private selfhosted: SelfhostedService, private frontendLogger: FrontendLoggerService, private persistence: PersistenceService, private incomeStatement: IncomeStatementService, private errorMapper: ErrorMapperService) {
    this.translate.setDefaultLang('en');
    SettingsComponent.isInfo = false;
    SettingsComponent.isError = false;
    SettingsComponent.zIndex = 0;
    SettingsComponent.isEng = this.localStorage.getData("isEng") == "" ? true : this.localStorage.getData("isEng") == "true" ? true : false
    SettingsComponent.isDe = this.localStorage.getData("isDe") == "" ? false : this.localStorage.getData("isDe") == "true" ? true : false
    SettingsComponent.isEs = this.localStorage.getData("isEs") == "" ? false : this.localStorage.getData("isEs") == "true" ? true : false
    SettingsComponent.isFr = this.localStorage.getData("isFr") == "" ? false : this.localStorage.getData("isFr") == "true" ? true : false
    SettingsComponent.isCn = this.localStorage.getData("isCn") == "" ? false : this.localStorage.getData("isCn") == "true" ? true : false;
    SettingsComponent.isAr = this.localStorage.getData("isAr") == "" ? false : this.localStorage.getData("isAr") == "true" ? true : false;
    AppStateService.instance.isEuropeanFormat = window.localStorage.getItem("isEuropeanFormat") === "false" ? false : true;
    AppStateService.instance.dateFormat = window.localStorage.getItem("dateFormat") || 'dd.MM.yyyy';

    // Apply saved theme
    const savedTheme = window.localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.applyDateIconTheme(savedTheme);

    AppStateService.instance.daily = this.localStorage.getData("dailyR") == "" ? 60.0 : Number(this.localStorage.getData("dailyR"))
    AppStateService.instance.splurge = this.localStorage.getData("splurgeR") == "" ? 10.0 : Number(this.localStorage.getData("splurgeR"))
    AppStateService.instance.smile = this.localStorage.getData("smileR") == "" ? 10.0 : Number(this.localStorage.getData("smileR"))
    AppStateService.instance.fire = this.localStorage.getData("fireR") == "" ? 20.0 : Number(this.localStorage.getData("fireR"))
    AppStateService.instance.currency = this.localStorage.getData("currency") == "" ? "€" : this.localStorage.getData("currency")
    this.dailyTextField = AppStateService.instance.daily
    this.splurgeTextField = AppStateService.instance.splurge
    this.smileTextField = AppStateService.instance.smile
    this.fireTextField = AppStateService.instance.fire
    this.currencyTextField = AppStateService.instance.currency
    if (SettingsComponent.isEng) {
      this.translate.use("en");
    }
    if (SettingsComponent.isDe) {
      this.translate.use("de");
    }
    if (SettingsComponent.isEs) {
      this.translate.use("es");
    }
    if (SettingsComponent.isFr) {
      this.translate.use("fr");
    }
    if (SettingsComponent.isCn) {
      this.translate.use("cn");
    }
    if (SettingsComponent.isAr) {
      this.translate.use("ar");
      document.body.classList.add('rtl-text');
    } else {
      document.body.classList.remove('rtl-text');
    }
    AppStateService.instance.key = this.cryptic.getKey() === this.cryptic.getDefaultKey() ? "default" : this.cryptic.getKey();
    this.keyTextField = AppStateService.instance.key;
    AppStateService.instance.isLocal = this.cryptic.getEncryptionLocalEnabled();
    AppStateService.instance.isDatabase = this.cryptic.getEncryptionDatabaseEnabled();
  }

  ngDoCheck(): void {
    if (SettingsComponent._pendingEdit) {
      SettingsComponent._pendingEdit = false;
      this.isEdit = true;
      this.dailyTextField = AppStateService.instance.daily;
      this.splurgeTextField = AppStateService.instance.splurge;
      this.smileTextField = AppStateService.instance.smile;
      this.fireTextField = AppStateService.instance.fire;
    }
  }

  toggleEye(){
    if(this.eyePic == "../../assets/symbols/eye.png"){
      this.eyePic = "../../assets/symbols/eye-slash.png";
      document.getElementById("password").setAttribute("type", "text");
    } else {
      this.eyePic = "../../assets/symbols/eye.png";
      document.getElementById("password").setAttribute("type", "password");
    }
  }

  toggleIsLocal() {
    AppStateService.instance.isLocal = !AppStateService.instance.isLocal;
  }

  toggleIsDatabase() {
    AppStateService.instance.isDatabase = !AppStateService.instance.isDatabase;
  }

  async setDefault() {
    this.cryptic.updateConfig("default", true, false);
    AppStateService.instance.key = "default";
    this.keyTextField = "default";
    AppStateService.instance.isLocal = true;
    AppStateService.instance.isDatabase = false;
    await this.updateStorage();
    this.isEdit = false;
  }

  load() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const content = e.target.result;
        const data = JSON.parse(content);
        this.keyTextField = data.key;
        AppStateService.instance.key = data.key;
        AppStateService.instance.isLocal = data.local;
        AppStateService.instance.isDatabase = data.database;
        this.cryptic.updateConfig(data.key, data.local, data.database);
        await this.updateStorage();
      };
      reader.readAsText(file);
    };
    input.click();
    this.isEdit = false;
  }

  async save() {
    this.cryptic.updateConfig(this.keyTextField, AppStateService.instance.isLocal, AppStateService.instance.isDatabase);
    await this.updateStorage();
    const data = {
      key: this.keyTextField,
      local: AppStateService.instance.isLocal,
      database: AppStateService.instance.isDatabase
    };

    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    a.click();
    window.URL.revokeObjectURL(url);
    AppStateService.instance.key = this.keyTextField;
    this.isEdit = false;
  }

  async updateStorage() {
    // Check authentication using the centralized service
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      console.error("Authentication failed:", authResult.error);
      SettingsComponent.isError = true;
      return;
    }

    // Handle Firebase-specific user data
    if (this.authService.getMode() === 'firebase') {
      const user = await this.afAuth.currentUser;
      if (user) {
        this.localStorage.saveData("uid", user.uid);
        this.localStorage.saveData("email", user.email);
        this.database.getData("info/username")
          .then(snapshot => {
            let username = snapshot.val();  // Username is NOT encrypted
            ProfileComponent.username = username;
            this.localStorage.saveData("username", username);
          })
          .catch(err => {
            //handle error
          });
      }
    }

    try {
      //WRITE to Storage
      // Only write balance/grow data if it has been loaded (Tier 3 on-demand).
      // Writing before load would overwrite real DB data with empty arrays.
      const writes = [
        { tag: "income/revenue/interests", data: AppStateService.instance.allIntrests },
        { tag: "income/revenue/properties", data: AppStateService.instance.allProperties },
        { tag: "income/revenue/revenues", data: AppStateService.instance.allRevenues },
        { tag: "income/expenses/daily", data: AppStateService.instance.dailyExpenses },
        { tag: "income/expenses/splurge", data: AppStateService.instance.splurgeExpenses },
        // Only write tier2 data (smile/fire/mojo) if tier2 has been loaded.
        // Writing before load would overwrite real DB data with empty defaults.
        ...(AppStateService.instance.tier2Loaded ? [
          { tag: "income/expenses/smile", data: AppStateService.instance.smileExpenses },
          { tag: "income/expenses/fire", data: AppStateService.instance.fireExpenses },
          { tag: "income/expenses/mojo", data: AppStateService.instance.mojoExpenses },
          { tag: "smile", data: AppStateService.instance.allSmileProjects },
          { tag: "fire", data: AppStateService.instance.allFireEmergencies },
          { tag: "mojo", data: AppStateService.instance.mojo },
          { tag: "budget", data: AppStateService.instance.allBudgets }
        ] : []),
        { tag: "transactions", data: AppStateService.instance.allTransactions },
        { tag: "subscriptions", data: AppStateService.instance.allSubscriptions },
        ...(AppStateService.instance.tier3BalanceLoaded ? [
          { tag: "balance/liabilities", data: AppStateService.instance.liabilities },
          { tag: "balance/asset/shares", data: AppStateService.instance.allShares },
          { tag: "balance/asset/assets", data: AppStateService.instance.allAssets },
          { tag: "balance/asset/investments", data: AppStateService.instance.allInvestments }
        ] : []),
        ...(AppStateService.instance.tier3GrowLoaded ? [
          { tag: "grow", data: AppStateService.instance.allGrowProjects }
        ] : [])
      ];

      this.persistence.batchWriteAndSync({
        writes,
        localStorageSaves: [
          { key: "interests", data: JSON.stringify(AppStateService.instance.allIntrests) },
          { key: "properties", data: JSON.stringify(AppStateService.instance.allProperties) },
          { key: "revenues", data: JSON.stringify(AppStateService.instance.allRevenues) },
          { key: "dailyEx", data: JSON.stringify(AppStateService.instance.dailyExpenses) },
          { key: "splurgeEx", data: JSON.stringify(AppStateService.instance.splurgeExpenses) },
          ...(AppStateService.instance.tier2Loaded ? [
            { key: "smileEx", data: JSON.stringify(AppStateService.instance.smileExpenses) },
            { key: "fireEx", data: JSON.stringify(AppStateService.instance.fireExpenses) },
            { key: "mojoEx", data: JSON.stringify(AppStateService.instance.mojoExpenses) },
            { key: "smile", data: JSON.stringify(AppStateService.instance.allSmileProjects) },
            { key: "fire", data: JSON.stringify(AppStateService.instance.allFireEmergencies) },
            { key: "mojo", data: JSON.stringify(AppStateService.instance.mojo) },
            { key: "budget", data: JSON.stringify(AppStateService.instance.allBudgets) }
          ] : []),
          { key: "transactions", data: JSON.stringify(AppStateService.instance.allTransactions) },
          { key: "subscriptions", data: JSON.stringify(AppStateService.instance.allSubscriptions) },
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) },
            { key: "shares", data: JSON.stringify(AppStateService.instance.allShares) },
            { key: "assets", data: JSON.stringify(AppStateService.instance.allAssets) },
            { key: "investments", data: JSON.stringify(AppStateService.instance.allInvestments) }
          ] : []),
          ...(AppStateService.instance.tier3GrowLoaded ? [
            { key: "grow", data: JSON.stringify(AppStateService.instance.allGrowProjects) }
          ] : [])
        ],
        forceWrite: true,
        logEvent: 'change_encryption',
        logMetadata: {
          databaseEncryption: AppStateService.instance.isDatabase,
          localEncryption: AppStateService.instance.isLocal
        },
        onError: (error) => {
          console.error("Error writing to database:", error);
          SettingsComponent.isError = true;
        }
      });

    } catch (error) {
      console.error(error);
      SettingsComponent.isError = true;
    }
  }

  showConfirmation: boolean = false;

  switchLanguage(language: string) {
    this.translate.use(language);
  }

  toggleDeleteAuth() {
    this.isDeleteAuth = !this.isDeleteAuth;
    this.isDeleteError = false;
    this.deleteErrorLabel = "";
    this.deletePasswordTextField = "";
    this.deleteEyePic = "../../assets/symbols/eye.png";
    document.getElementById("deletePassword")?.setAttribute("type", "password");
  }

  toggleDeleteEye() {
    const el = document.getElementById("deletePassword");
    if (el?.getAttribute("type") === "password") {
      el.setAttribute("type", "text");
      this.deleteEyePic = "../../assets/symbols/eye-open.png";
    } else {
      el?.setAttribute("type", "password");
      this.deleteEyePic = "../../assets/symbols/eye.png";
    }
  }

  authenticateForDelete() {
    if (this.deletePasswordTextField === "") {
      this.isDeleteError = true;
      this.deleteErrorLabel = "Password is required.";
      return;
    }
    if (this.appMode === 'selfhosted') {
      this.selfhosted.verifyPassword(this.deletePasswordTextField).subscribe({
        next: (response) => {
          if (response.valid) {
            this.isDeleteAuth = false;
            this.isDeleteError = false;
            this.deletePasswordTextField = "";
            this.openConfirmation();
          } else {
            this.isDeleteError = true;
            this.deleteErrorLabel = "Invalid password";
          }
        },
        error: (error) => {
          this.isDeleteError = true;
          this.deleteErrorLabel = this.errorMapper.toUserMessage(error, 'Password verification failed');
        }
      });
    } else {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) {
        this.isDeleteError = true;
        this.deleteErrorLabel = "No authenticated user found.";
        return;
      }
      const credential = EmailAuthProvider.credential(user.email, this.deletePasswordTextField);
      reauthenticateWithCredential(user, credential).then(() => {
        this.isDeleteAuth = false;
        this.isDeleteError = false;
        this.deletePasswordTextField = "";
        this.openConfirmation();
      }).catch((error) => {
        this.isDeleteError = true;
        this.deleteErrorLabel = this.errorMapper.toUserMessage(error);
      });
    }
  }

  openConfirmation(): void {
    this.showConfirmation = true;
  }

  closeConfirmation(confirm: boolean): void {
    this.showConfirmation = false;

    if (confirm) {
      this.deleteAccount();
    }
  }

  zeroPadded(val) {
    if (val >= 10)
      return val;
    else
      return '0' + val;
  }

  async updateBasedOnTransaction() {
    // Check authentication using the centralized service
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      console.error("Authentication failed:", authResult.error);
      return;
    }

    // AppState is already up-to-date from the calling code.
    // Do NOT re-read from localStorage — it may be stale if a prior
    // batchWriteAndSync hasn't returned yet.
        
        // Recalculate all income statement values from transactions
        this.incomeStatement.recalculate();

      try {
        const writes = [
          ...this.incomeStatement.getWrites(),
          // Only write balance data if it has been loaded (Tier 3 on-demand).
          // Writing before load would overwrite real DB data with empty arrays.
          ...(AppStateService.instance.tier3BalanceLoaded ? [
            { tag: "balance/liabilities", data: AppStateService.instance.liabilities }
          ] : [])
        ];

        this.persistence.batchWriteAndSync({
          writes,
          localStorageSaves: [
            { key: "interests", data: JSON.stringify(AppStateService.instance.allIntrests) },
            { key: "properties", data: JSON.stringify(AppStateService.instance.allProperties) },
            { key: "revenues", data: JSON.stringify(AppStateService.instance.allRevenues) },
            { key: "dailyEx", data: JSON.stringify(AppStateService.instance.dailyExpenses) },
            { key: "splurgeEx", data: JSON.stringify(AppStateService.instance.splurgeExpenses) },
            ...(AppStateService.instance.tier2Loaded ? [
              { key: "smileEx", data: JSON.stringify(AppStateService.instance.smileExpenses) },
              { key: "fireEx", data: JSON.stringify(AppStateService.instance.fireExpenses) },
              { key: "mojoEx", data: JSON.stringify(AppStateService.instance.mojoExpenses) },
              { key: "smile", data: JSON.stringify(AppStateService.instance.allSmileProjects) },
              { key: "fire", data: JSON.stringify(AppStateService.instance.allFireEmergencies) },
              { key: "mojo", data: JSON.stringify(AppStateService.instance.mojo) }
            ] : []),
            ...(AppStateService.instance.tier3BalanceLoaded ? [
              { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) }
            ] : [])
          ],
          forceWrite: true,
          logEvent: 'recalculate_from_transactions'
        });

      } catch (error) {
      }
  }


  highlight() {
    SettingsComponent.zIndex = SettingsComponent.zIndex + 1;
    InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  chooseEng() {
    this.classReference.isEng = true;
    this.classReference.isDe = false;
    this.classReference.isFr = false;
    this.classReference.isEs = false;
    this.classReference.isCn = false;
    this.classReference.isAr = false;
    this.localStorage.saveData("isEs", "false")
    this.localStorage.saveData("isFr", "false") 
    this.localStorage.saveData("isEng", "true")
    this.localStorage.saveData("isDe", "false")
    this.localStorage.saveData("isCn", "false")
    this.localStorage.saveData("isAr", "false")
    this.switchLanguage("en");
    document.body.classList.remove('rtl-text');
  }

  chooseEs() {
    this.classReference.isEs = true;
    this.classReference.isEng = false;
    this.classReference.isDe = false;
    this.classReference.isFr = false;
    this.classReference.isCn = false;
    this.classReference.isAr = false;
    this.localStorage.saveData("isEs", "true")
    this.localStorage.saveData("isFr", "false") 
    this.localStorage.saveData("isEng", "false")
    this.localStorage.saveData("isDe", "false")
    this.localStorage.saveData("isCn", "false")
    this.localStorage.saveData("isAr", "false")
    this.switchLanguage("es");
    document.body.classList.remove('rtl-text');
  }

  chooseFr() {
    this.classReference.isEs = false;
    this.classReference.isEng = false;
    this.classReference.isDe = false;
    this.classReference.isFr = true;
    this.classReference.isCn = false;
    this.classReference.isAr = false;
    this.localStorage.saveData("isEs", "false")
    this.localStorage.saveData("isFr", "true") 
    this.localStorage.saveData("isEng", "false")
    this.localStorage.saveData("isDe", "false")
    this.localStorage.saveData("isCn", "false")
    this.localStorage.saveData("isAr", "false")
    this.switchLanguage("fr");
    document.body.classList.remove('rtl-text');
  }

  chooseDe() {
    this.classReference.isEng = false;
    this.classReference.isDe = true;
    this.classReference.isFr = false;
    this.classReference.isEs = false;
    this.classReference.isCn = false;
    this.classReference.isAr = false;
    this.localStorage.saveData("isEs", "false")
    this.localStorage.saveData("isFr", "false") 
    this.localStorage.saveData("isEng", "false")
    this.localStorage.saveData("isDe", "true")
    this.localStorage.saveData("isCn", "false")
    this.localStorage.saveData("isAr", "false")
    this.switchLanguage("de");
    document.body.classList.remove('rtl-text');
  }

  chooseCn() {
    this.classReference.isEng = false;
    this.classReference.isDe = false;
    this.classReference.isFr = false;
    this.classReference.isEs = false;
    this.classReference.isCn = true;
    this.classReference.isAr = false;
    this.localStorage.saveData("isEs", "false")
    this.localStorage.saveData("isFr", "false") 
    this.localStorage.saveData("isEng", "false")
    this.localStorage.saveData("isDe", "false")
    this.localStorage.saveData("isCn", "true")
    this.localStorage.saveData("isAr", "false")
    this.switchLanguage("cn");
    document.body.classList.remove('rtl-text');
  }

  chooseAr() {
    this.classReference.isEng = false;
    this.classReference.isDe = false;
    this.classReference.isFr = false;
    this.classReference.isEs = false;
    this.classReference.isCn = false;
    this.classReference.isAr = true;
    this.localStorage.saveData("isEs", "false")
    this.localStorage.saveData("isFr", "false")
    this.localStorage.saveData("isEng", "false")
    this.localStorage.saveData("isDe", "false")
    this.localStorage.saveData("isCn", "false")
    this.localStorage.saveData("isAr", "true")
    this.switchLanguage("ar");
    document.body.classList.add('rtl-text');
  }

  chooseEuropeanFormat() {
    AppStateService.instance.isEuropeanFormat = true;
    localStorage.setItem("isEuropeanFormat", "true");
  }

  chooseUSFormat() {
    AppStateService.instance.isEuropeanFormat = false;
    localStorage.setItem("isEuropeanFormat", "false");
  }

  changeTheme() {
    if (this.classReference.isTheme) {
      this.classReference.isSettings = true;
      this.classReference.isTheme = false;
    } else {
      this.classReference.isTheme = true;
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.isAuth = false;
    }
    AppComponent.gotoTop();
  }

  chooseLight() {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    this.applyDateIconTheme('light');
  }

  chooseDark() {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    this.applyDateIconTheme('dark');
  }

  applyDateIconTheme(theme: string) {
    let style = document.getElementById('date-icon-theme') as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = 'date-icon-theme';
      document.head.appendChild(style);
    }
    if (theme === 'dark') {
      style.textContent = `
        input[type="date"],
        input[type="time"],
        input[type="datetime-local"] {
          color-scheme: dark !important;
        }
      `;
    } else {
      style.textContent = '';
    }
  }

  getCurrentTheme(): string {
    return localStorage.getItem('theme') || 'light';
  }

  closeWindow() {
    SettingsComponent.isInfo = false;
    this.isEdit = false;
    SettingsComponent.isSettings = true;
    SettingsComponent.isLanguages = false;
    SettingsComponent.isCurrency = false;
    SettingsComponent.isAllocation = false;
    SettingsComponent.isEncryption = false;
    SettingsComponent.isNumberFormat = false;
    SettingsComponent.isDateFormat = false;
    SettingsComponent.isTheme = false;
    SettingsComponent.isError = false;
    this.errorTextLable = "";
    this.color = "black";
    this.borderColor = "var(--color-border)";
    this.isAuth = false;
  }

  editPersonalSettings() {
    this.isAuth = false;
    // Allocation can be edited without authentication
    if (this.classReference.isAllocation) {
      AppComponent.gotoTop();
      this.isEdit = true;
      SettingsComponent.isError = false;
      this.dailyTextField = AppStateService.instance.daily;
      this.splurgeTextField = AppStateService.instance.splurge;
      this.smileTextField = AppStateService.instance.smile;
      this.fireTextField = AppStateService.instance.fire;
      this.errorTextLable = "";
      this.color = "black";
      this.borderColor = "var(--color-border)";
      return;
    }
    if (ProfileComponent.username == "Username" && ProfileComponent.mail == "example@traiber.com") {
      SettingsComponent.isError = true;
      this.errorTextLable = "No authenticated user.";
      this.color = "red";
      this.borderColor = "red";
    } else {
      AppComponent.gotoTop();
      //Validation (check if Amount is not empty)
      this.isEdit = true;
      SettingsComponent.isError = false;
      this.usernameTextField = AppStateService.instance.username;
      this.emailTextField = AppStateService.instance.email;
      SettingsComponent.isError = false;
      this.errorTextLable = "";
      this.color = "black";
      this.borderColor = "var(--color-border)";
    }
  }

  cancel() {
    SettingsComponent.isError = false
    this.isEdit = false;
    this.errorTextLable = "";
    this.color = "black";
    this.borderColor = "var(--color-border)";
  }

  validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

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

  // Function to delete the user's account
  async deleteUser(): Promise<void> {
    try {
      if (this.authService.getMode() === 'selfhosted') {
        // Selfhosted: call backend to delete auth + user data from CouchDB
        await new Promise<void>((resolve, reject) => {
          this.selfhosted.deleteAccount().subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      } else {
        // Firebase: delete user data node, then delete auth account
        const user = await this.afAuth.currentUser;
        if (!user) {
          throw new Error('No authenticated user.');
        }
        const uid = this.localStorage.getData("uid");
        if (uid) {
          // Delete all user data from Firebase Realtime Database
          await this.database.deleteUserNode(uid);
        }
        await user.delete();
      }

      // Clear all local storage
      this.localStorage.removeData("uid");
      this.localStorage.removeData("email");
      this.localStorage.removeData("username");
      this.localStorage.removeData("transactions");
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

      ProfileComponent.isUser = false;
      ProfileComponent.username = "Username";
      ProfileComponent.mail = "example@traiber.com";
      
      if (this.authService.getMode() === 'firebase') {
        this.logoutFirebase();
      } else {
        await this.authService.signOut();
      }
      this.closeWindow();
      window.location.href = "/authentication";

    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.error(`Error deleting user: ${errorCode} - ${errorMessage}`);
      throw error;
    }
  }

  deleteAccount() {
    this.deleteUser();
  }
  // Update user's email
  async updateEmail(newEmail: string): Promise<void> {
    // Check authentication using the centralized service
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      throw new Error(authResult.error || 'No authenticated user.');
    }

    // Email update is Firebase-specific
    if (this.authService.getMode() === 'firebase') {
      const user = await this.afAuth.currentUser;
      if (user) {
        return user.updateEmail(newEmail);
      } else {
        throw new Error('No authenticated user.');
      }
    } else {
      // Selfhosted mode doesn't support email updates through this method
      throw new Error('Email update not supported in selfhosted mode.');
    }
  }

  sendPasswordResetEmail(email: string): void {
    this.afAuth.sendPasswordResetEmail(email)
      .then(() => {
        // Handle success, e.g., display a success message to the user
        this.errorTextLable = 'Password reset email sent successfully!';
        this.color = "green";
        this.borderColor = "green";
        SettingsComponent.isError = true
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error('Error sending password reset email:', errorCode, errorMessage);
        // Handle the error appropriately, e.g., display an error message to the user
        this.errorTextLable = this.errorMapper.toUserMessage(error, 'Failed to send password reset email. Please try again.');
        this.color = "red";
        this.borderColor = "red";
        SettingsComponent.isError = true
      });
  }

  // Helper method to update user profile in database and localStorage
  private updateUserProfile(): void {
    ProfileComponent.username = this.usernameTextField;
    ProfileComponent.mail = this.emailTextField;
    AppStateService.instance.username = this.usernameTextField;
    AppStateService.instance.email = this.emailTextField;
    AppStateService.instance.currency = this.currencyTextField;

    try {
      //update database
      const writeResult1 = this.database.writeObject("info/username", AppStateService.instance.username);
      const writeResult2 = this.database.writeObject("info/email", AppStateService.instance.email);
      this.localStorage.saveData("currency", AppStateService.instance.currency);

      if (environment.mode === 'selfhosted' && (writeResult1 || writeResult2)) {
        const observables = [];
        if (writeResult1) observables.push(writeResult1);
        if (writeResult2) observables.push(writeResult2);
        
        let completed = 0;
        const handleComplete = () => {
          completed++;
          if (completed === observables.length) {
            // Log profile update
            this.frontendLogger.logActivity('update_profile', 'info', {
              username: AppStateService.instance.username,
              email: AppStateService.instance.email
            });
            //write to local Storage
            this.localStorage.saveData("username", AppStateService.instance.username);
            this.localStorage.saveData("email", AppStateService.instance.email);
            // Clean Up close Window
            this.color = "black";
            this.borderColor = "var(--color-border)";
            this.isEdit = false;
            AppComponent.gotoTop();
          }
        };
        
        observables.forEach(obs => {
          obs.subscribe({
            next: handleComplete,
            error: (error) => {
              this.errorTextLable = this.errorMapper.toUserMessage(error, 'Database write failed');
              this.color = "red";
              this.borderColor = "red";
              SettingsComponent.isError = true;
            }
          });
        });
      } else {
        // Firebase mode
        // Log profile update
        this.frontendLogger.logActivity('update_profile', 'info', {
          username: AppStateService.instance.username,
          email: AppStateService.instance.email
        });
        //write to local Storage
        this.localStorage.saveData("username", AppStateService.instance.username);
        this.localStorage.saveData("email", AppStateService.instance.email);
        // Clean Up close Window
        this.color = "black";
        this.borderColor = "var(--color-border)";
        this.isEdit = false;
        AppComponent.gotoTop();
      }
    } catch (error) {
      this.errorTextLable = this.errorMapper.toUserMessage(error);
      this.color = "red";
      this.borderColor = "red";
      SettingsComponent.isError = true;
    }
  }

  changeFix() {
    this.updateBasedOnTransaction();
    this.isAuth = false;
  }

  resetAllocation() {
    this.dailyTextField = 60;
    this.splurgeTextField = 10;
    this.smileTextField = 10;
    this.fireTextField = 20;
  }

  changeAllocation() {
    if (this.classReference.isAllocation) {
      this.classReference.isSettings = true;
      this.classReference.isAllocation = false;
    } else {
      this.classReference.isAllocation = true;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
      this.isAuth = false;
    }
    AppComponent.gotoTop();

  }

  changeEncryption() {
    // Always require password authentication for encryption settings (sensitive)
    this.isAuth = !this.isAuth;
    this.isError = false;
    this.errorTextLable = "";
    this.passwordTextField = "";
    this.eyePic = "../../assets/symbols/eye.png";
    document.getElementById("password")?.setAttribute("type", "password");
  }
  
  authenticate() {
    // Validate password is provided
    if(this.passwordTextField == ""){
      this.isError = true;
      this.errorTextLable = "Password is required.";
      return;
    }

    // Handle based on mode (Firebase or Selfhosted)
    if (this.appMode === 'selfhosted') {
      // Selfhosted mode - verify password via backend API
      this.selfhosted.verifyPassword(this.passwordTextField).subscribe({
        next: (response) => {
          if (response.valid) {
            // Password verified successfully
            this.handleSuccessfulAuth();
          } else {
            this.isError = true;
            this.errorTextLable = "Invalid password";
          }
        },
        error: (error) => {
          this.isError = true;
          this.errorTextLable = this.errorMapper.toUserMessage(error, 'Password verification failed');
        }
      });
    } else {
      // Firebase mode - use Firebase reauthentication
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) {
        this.isError = true;
        this.errorTextLable = "No authenticated user or email.";
        return;
      }
      
      const credential = EmailAuthProvider.credential(user.email, this.passwordTextField);

      reauthenticateWithCredential(user, credential).then(() => {
        // User re-authenticated successfully
        this.handleSuccessfulAuth();
        AppComponent.gotoTop();
      }).catch((error) => {
        this.isError = true;
        this.errorTextLable = this.errorMapper.toUserMessage(error);
      });
    }
  }

  private handleSuccessfulAuth() {
    this.isAuth = false;
    this.isError = false;
    this.errorMessageLable = "";
    this.passwordTextField = "";
    
    if (this.classReference.isEncryption) {
      this.classReference.isSettings = true;
      this.classReference.isEncryption = false;
    } else {
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = true;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
    }
    AppComponent.gotoTop();
  }

  changeLanguage() {
    if (this.classReference.isLanguages) {
      this.classReference.isSettings = true;
      this.classReference.isLanguages = false;
    } else {
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = true;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
      this.isAuth = false;
    }
    AppComponent.gotoTop();
  }

  changeNumberFormat() {
    if (this.classReference.isNumberFormat) {
      this.classReference.isSettings = true;
      this.classReference.isNumberFormat = false;
    } else {
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = true;
      this.classReference.isDateFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
      this.isAuth = false;
    }
    AppComponent.gotoTop();
  }

  back() {
    this.classReference.isSettings = true;
    this.classReference.isAllocation = false;
    this.classReference.isLanguages = false;
    this.classReference.isCurrency = false;
    this.classReference.isEncryption = false;
    this.classReference.isNumberFormat = false;
    this.classReference.isDateFormat = false;
    this.classReference.isBackup = false;
    this.classReference.isRestore = false;
    this.classReference.isTheme = false;
    this.isAuth = false;
    this.importStatus = '';
    this.isImporting = false;
    AppComponent.gotoTop();
  }

  changeCurrency() {
    if (this.classReference.isCurrency) {
      this.classReference.isSettings = true;
      this.classReference.isCurrency = false;
    } else {
      this.classReference.isCurrency = true;
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
      this.isAuth = false;
      this.currencyTextField = AppStateService.instance.currency;
    }
    AppComponent.gotoTop();
  }

  chooseCurrency(symbol: string) {
    AppStateService.instance.currency = symbol;
    this.currencyTextField = symbol;
    this.localStorage.saveData("currency", symbol);
  }

  changeDateFormat() {
    if (this.classReference.isDateFormat) {
      this.classReference.isSettings = true;
      this.classReference.isDateFormat = false;
    } else {
      this.classReference.isDateFormat = true;
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isBackup = false;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
      this.isAuth = false;
    }
    AppComponent.gotoTop();
  }

  chooseDateFormat(format: string) {
    AppStateService.instance.dateFormat = format;
    localStorage.setItem("dateFormat", format);
  }

  changePassword() {
    this.sendPasswordResetEmail(ProfileComponent.mail)
    this.isAuth = false;
  }

  changeBackup() {
    if (this.classReference.isBackup) {
      this.classReference.isSettings = true;
      this.classReference.isBackup = false;
    } else {
      this.classReference.isBackup = true;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.isAuth = false;
    }
    this.importStatus = '';
    this.isImporting = false;
    AppComponent.gotoTop();
  }

  changeRestore() {
    if (this.classReference.isRestore) {
      this.classReference.isSettings = true;
      this.classReference.isRestore = false;
      this.classReference.isTheme = false;
    } else {
      this.classReference.isRestore = true;
      this.classReference.isBackup = false;
      this.classReference.isAllocation = false;
      this.classReference.isLanguages = false;
      this.classReference.isCurrency = false;
      this.classReference.isSettings = false;
      this.classReference.isEncryption = false;
      this.classReference.isNumberFormat = false;
      this.classReference.isDateFormat = false;
      this.classReference.isTheme = false;
      this.isAuth = false;
    }
    this.importStatus = '';
    this.isImporting = false;
    AppComponent.gotoTop();
  }

  exportTransactionsAsCSV() {
    const transactions = AppStateService.instance.allTransactions;
    if (!transactions || transactions.length === 0) {
      console.warn('No transactions to export.');
      return;
    }

    const headers = ['account', 'amount', 'date', 'time', 'category'];
    const csvRows = [
      headers.join(','),
      ...transactions.map((t: any) =>
      headers.map(h => {
        let val = t[h] !== undefined && t[h] !== null ? t[h] : '';
        val = String(val)
        .replace(/\r?\n/g, ' ')
        .replace(/"/g, '""');
        return /[",\n]/.test(val) ? `"${val}"` : val;
      }).join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportSubscriptionsAsCSV() {
    const subscriptions = AppStateService.instance.allSubscriptions;
    if (!subscriptions || subscriptions.length === 0) {
      console.warn('No subscriptions to export.');
      return;
    }

    const headers = Object.keys(subscriptions[0]);
    const csvRows = [
      headers.join(','),
      ...subscriptions.map((s: any) =>
        headers.map(h => {
          let val = s[h] !== undefined && s[h] !== null ? s[h] : '';
          val = String(val)
            .replace(/\r?\n/g, ' ')
            .replace(/"/g, '""');
          return /[",\n]/.test(val) ? `"${val}"` : val;
        }).join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscriptions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportMojoAsCSV() {
    const mojo = AppStateService.instance.mojo;
    if (!mojo) {
      console.warn('No mojo data to export.');
      return;
    }

    const headers = ['amount', 'target'];
    const csvRows = [
      headers.join(','),
      headers.map(h => {
        let val = mojo[h] !== undefined && mojo[h] !== null ? mojo[h] : '';
        val = String(val)
          .replace(/\r?\n/g, ' ')
          .replace(/"/g, '""');
        return /[",\n]/.test(val) ? `"${val}"` : val;
      }).join(',')
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'mojo.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportAllData() {
    this.exportTransactionsAsCSV();
    this.exportSubscriptionsAsCSV();
    this.exportMojoAsCSV();
  }

  clickedStatisticsExport() {
    this.exportAllData();
  }

  clickedMigrationExport() {
    this.exportMigrationData();
  }

  /**
   * Exports a full migration JSON file containing all app data collections
   * (transactions, subscriptions, budgets, projects, revenues, expenses, assets,
   * shares, investments, liabilities, and fund allocation settings).
   *
   * If database encryption is active, also exports a separate encryption-key JSON file.
   * Both files are downloaded via dynamically created anchor elements.
   */
  exportMigrationData() {
    // Determine active language
    let language = 'en';
    if (SettingsComponent.isDe) language = 'de';
    else if (SettingsComponent.isEs) language = 'es';
    else if (SettingsComponent.isFr) language = 'fr';
    else if (SettingsComponent.isCn) language = 'cn';
    else if (SettingsComponent.isAr) language = 'ar';

    // Gather encryption config
    const encryptKey = localStorage.getItem('encryptKey');
    const encryptLocal = localStorage.getItem('encryptLocal');
    const encryptDatabase = localStorage.getItem('encryptDatabase');

    const migrationData: any = {
      version: 2,
      exportDate: new Date().toISOString(),
      data: {
        transactions: AppStateService.instance.allTransactions || [],
        subscriptions: AppStateService.instance.allSubscriptions || [],
        budget: AppStateService.instance.allBudgets || [],
        smile: AppStateService.instance.allSmileProjects || [],
        fire: AppStateService.instance.allFireEmergencies || [],
        mojo: AppStateService.instance.mojo || { amount: 0, target: 0 },
        grow: AppStateService.instance.allGrowProjects || [],
        revenues: AppStateService.instance.allRevenues || [],
        interests: AppStateService.instance.allIntrests || [],
        properties: AppStateService.instance.allProperties || [],
        dailyExpenses: AppStateService.instance.dailyExpenses || [],
        splurgeExpenses: AppStateService.instance.splurgeExpenses || [],
        smileExpenses: AppStateService.instance.smileExpenses || [],
        fireExpenses: AppStateService.instance.fireExpenses || [],
        mojoExpenses: AppStateService.instance.mojoExpenses || [],
        assets: AppStateService.instance.allAssets || [],
        shares: AppStateService.instance.allShares || [],
        investments: AppStateService.instance.allInvestments || [],
        liabilities: AppStateService.instance.liabilities || [],
        settings: {
          currency: AppStateService.instance.currency || '€',
          dailyR: AppStateService.instance.daily,
          splurgeR: AppStateService.instance.splurge,
          smileR: AppStateService.instance.smile,
          fireR: AppStateService.instance.fire,
          language: language,
          dateFormat: AppStateService.instance.dateFormat || 'dd.MM.yyyy',
          isEuropeanFormat: AppStateService.instance.isEuropeanFormat,
          theme: localStorage.getItem('theme') || 'light',
          encryption: {
            encryptKey: encryptKey || 'default',
            encryptLocal: encryptLocal || 'false',
            encryptDatabase: encryptDatabase || 'false'
          }
        }
      }
    };

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `migration-data-${yyyy}-${mm}-${dd}.json`;

    const jsonContent = JSON.stringify(migrationData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  onImportMigration() {
    const migrationInput = this.migrationFileInput?.nativeElement as HTMLInputElement;

    if (!migrationInput?.files?.length) {
      this.importStatus = 'Please select a migration file.';
      return;
    }

    this.isImporting = true;
    this.importStatus = 'Reading file...';

    const migrationFile = migrationInput.files[0];

    const migrationReader = new FileReader();
    migrationReader.onload = (e) => {
      try {
        const migrationData = JSON.parse(e.target?.result as string);

        if (!migrationData.version || !migrationData.data) {
          this.importStatus = 'Invalid migration file format.';
          this.isImporting = false;
          return;
        }

        // Extract encryption from settings (v2) or from separate keyData (v1 compat)
        const keyData = migrationData.data.settings?.encryption || null;
        this.writeMigrationData(migrationData.data, keyData);
      } catch {
        this.importStatus = 'Failed to parse migration file.';
        this.isImporting = false;
      }
    };
    migrationReader.readAsText(migrationFile);
  }

  /**
   * Writes imported migration data to the database and updates in-memory state.
   *
   * Optionally applies encryption config from `keyData`, preserves the current
   * user identity (uid, email, username), then batch-writes all data collections
   * to the database and syncs AppStateService in-memory state on success.
   *
   * @param data - The migration payload containing transactions, subscriptions, etc.
   * @param keyData - Optional encryption key config; applied before writing if provided.
   */
  private writeMigrationData(data: any, keyData: any) {
    this.importStatus = 'Writing data...';

    const currentUid = this.localStorage.getData('uid');
    const currentEmail = this.localStorage.getData('email');
    const currentUsername = this.localStorage.getData('username');

    if (keyData) {
      this.cryptic.updateConfig(
        keyData.encryptKey || 'default',
        keyData.encryptLocal === 'true',
        keyData.encryptDatabase === 'true'
      );
    }

    if (currentUid) { this.localStorage.saveData('uid', currentUid); }
    if (currentEmail) { this.localStorage.saveData('email', currentEmail); }
    if (currentUsername) { this.localStorage.saveData('username', currentUsername); }

    const writes: { tag: string; data: any }[] = [];
    if (data.transactions) writes.push({ tag: 'transactions', data: data.transactions });
    if (data.subscriptions) writes.push({ tag: 'subscriptions', data: data.subscriptions });
    if (data.budget) writes.push({ tag: 'budget', data: data.budget });
    if (data.smile) writes.push({ tag: 'smile', data: data.smile });
    if (data.fire) writes.push({ tag: 'fire', data: data.fire });
    if (data.mojo) writes.push({ tag: 'mojo', data: data.mojo });
    if (data.grow) writes.push({ tag: 'grow', data: data.grow });
    if (data.revenues) writes.push({ tag: 'income/revenue/revenues', data: data.revenues });
    if (data.interests) writes.push({ tag: 'income/revenue/interests', data: data.interests });
    if (data.properties) writes.push({ tag: 'income/revenue/properties', data: data.properties });
    if (data.dailyExpenses) writes.push({ tag: 'income/expenses/daily', data: data.dailyExpenses });
    if (data.splurgeExpenses) writes.push({ tag: 'income/expenses/splurge', data: data.splurgeExpenses });
    if (data.smileExpenses) writes.push({ tag: 'income/expenses/smile', data: data.smileExpenses });
    if (data.fireExpenses) writes.push({ tag: 'income/expenses/fire', data: data.fireExpenses });
    if (data.mojoExpenses) writes.push({ tag: 'income/expenses/mojo', data: data.mojoExpenses });
    if (data.assets) writes.push({ tag: 'balance/asset/assets', data: data.assets });
    if (data.shares) writes.push({ tag: 'balance/asset/shares', data: data.shares });
    if (data.investments) writes.push({ tag: 'balance/asset/investments', data: data.investments });
    if (data.liabilities) writes.push({ tag: 'balance/liabilities', data: data.liabilities });

    this.database.batchWrite(writes, true).subscribe({
      next: () => {
        AppStateService.instance.allTransactions = data.transactions || [];
        AppStateService.instance.allSubscriptions = data.subscriptions || [];
        if (AccountingComponent) AccountingComponent.allTransactions = data.transactions || [];
        if (SubscriptionComponent) SubscriptionComponent.allSubscriptions = data.subscriptions || [];
        AppStateService.instance.allBudgets = data.budget || [];
        AppStateService.instance.allSmileProjects = data.smile ? migrateSmileArray(data.smile) : [];
        AppStateService.instance.allFireEmergencies = data.fire || [];
        AppStateService.instance.mojo = data.mojo || { amount: 0, target: 0 };
        AppStateService.instance.allGrowProjects = data.grow ? migrateGrowArray(data.grow) : [];
        AppStateService.instance.allRevenues = data.revenues || [];
        AppStateService.instance.allIntrests = data.interests || [];
        AppStateService.instance.allProperties = data.properties || [];
        AppStateService.instance.dailyExpenses = data.dailyExpenses || [];
        AppStateService.instance.splurgeExpenses = data.splurgeExpenses || [];
        AppStateService.instance.smileExpenses = data.smileExpenses || [];
        AppStateService.instance.fireExpenses = data.fireExpenses || [];
        AppStateService.instance.mojoExpenses = data.mojoExpenses || [];
        AppStateService.instance.allAssets = data.assets || [];
        AppStateService.instance.allShares = data.shares || [];
        AppStateService.instance.allInvestments = data.investments || [];
        AppStateService.instance.liabilities = data.liabilities || [];

        this.localStorage.saveData('transactions', JSON.stringify(data.transactions || []));
        this.localStorage.saveData('subscriptions', JSON.stringify(data.subscriptions || []));
        this.localStorage.saveData('budget', JSON.stringify(data.budget || []));
        this.localStorage.saveData('smile', JSON.stringify(data.smile || []));
        this.localStorage.saveData('fire', JSON.stringify(data.fire || []));
        this.localStorage.saveData('mojo', JSON.stringify(data.mojo || { amount: 0, target: 0 }));
        this.localStorage.saveData('grow', JSON.stringify(data.grow || []));
        this.localStorage.saveData('revenues', JSON.stringify(data.revenues || []));
        this.localStorage.saveData('interests', JSON.stringify(data.interests || []));
        this.localStorage.saveData('properties', JSON.stringify(data.properties || []));
        this.localStorage.saveData('dailyEx', JSON.stringify(data.dailyExpenses || []));
        this.localStorage.saveData('splurgeEx', JSON.stringify(data.splurgeExpenses || []));
        this.localStorage.saveData('smileEx', JSON.stringify(data.smileExpenses || []));
        this.localStorage.saveData('fireEx', JSON.stringify(data.fireExpenses || []));
        this.localStorage.saveData('mojoEx', JSON.stringify(data.mojoExpenses || []));
        this.localStorage.saveData('assets', JSON.stringify(data.assets || []));
        this.localStorage.saveData('shares', JSON.stringify(data.shares || []));
        this.localStorage.saveData('investments', JSON.stringify(data.investments || []));
        this.localStorage.saveData('liabilities', JSON.stringify(data.liabilities || []));

        if (data.settings) {
          if (data.settings.currency) {
            this.localStorage.saveData('currency', data.settings.currency);
            AppStateService.instance.currency = data.settings.currency;
          }
          if (data.settings.dailyR !== undefined) {
            this.localStorage.saveData('dailyR', data.settings.dailyR.toString());
            AppStateService.instance.daily = data.settings.dailyR;
          }
          if (data.settings.splurgeR !== undefined) {
            this.localStorage.saveData('splurgeR', data.settings.splurgeR.toString());
            AppStateService.instance.splurge = data.settings.splurgeR;
          }
          if (data.settings.smileR !== undefined) {
            this.localStorage.saveData('smileR', data.settings.smileR.toString());
            AppStateService.instance.smile = data.settings.smileR;
          }
          if (data.settings.fireR !== undefined) {
            this.localStorage.saveData('fireR', data.settings.fireR.toString());
            AppStateService.instance.fire = data.settings.fireR;
          }
          if (data.settings.language) {
            const lang = data.settings.language;
            const langFlags = { isEng: 'false', isDe: 'false', isEs: 'false', isFr: 'false', isCn: 'false', isAr: 'false' };
            if (lang === 'en') langFlags.isEng = 'true';
            else if (lang === 'de') langFlags.isDe = 'true';
            else if (lang === 'es') langFlags.isEs = 'true';
            else if (lang === 'fr') langFlags.isFr = 'true';
            else if (lang === 'cn') langFlags.isCn = 'true';
            else if (lang === 'ar') langFlags.isAr = 'true';
            for (const [key, val] of Object.entries(langFlags)) {
              this.localStorage.saveData(key, val);
            }
          }
          if (data.settings.dateFormat) {
            localStorage.setItem('dateFormat', data.settings.dateFormat);
            AppStateService.instance.dateFormat = data.settings.dateFormat;
          }
          if (data.settings.isEuropeanFormat !== undefined) {
            localStorage.setItem('isEuropeanFormat', String(data.settings.isEuropeanFormat));
            AppStateService.instance.isEuropeanFormat = data.settings.isEuropeanFormat;
          }
          if (data.settings.theme) {
            localStorage.setItem('theme', data.settings.theme);
            document.documentElement.setAttribute('data-theme', data.settings.theme);
            this.applyDateIconTheme(data.settings.theme);
          }
        }

        this.importStatus = 'Migration import successful! Reloading...';
        this.isImporting = false;
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      },
      error: (err) => {
        console.error('Migration import failed:', err);
        this.importStatus = 'Migration import failed. Please try again.';
        this.isImporting = false;
      }
    });
  }

  updatePersonalSettings() {
    SettingsComponent.isError = false;
    this.errorTextLable = "";
    this.color = "black";
    this.borderColor = "var(--color-border)";
    //Validation (check if Amount is not empty)
    if (SettingsComponent.isSettings) {
      if (this.usernameTextField == "") {
        this.errorTextLable = "Please fill out all required fields.";
        this.color = "red";
        this.borderColor = "red";
        SettingsComponent.isError = true;
      } else {
        if (!this.validateEmail(this.emailTextField)) {
          // 3. Error: check email is valid
          SettingsComponent.isError = true;
          this.errorTextLable = "Invalid email format"
          this.color = "red";
          this.borderColor = "red";
        } else {
          if (ProfileComponent.mail != this.emailTextField) {
            // Email has changed - need to update authentication
            if (this.authService.getMode() === 'firebase') {
              // Firebase mode: update Firebase authentication email
              this.updateEmail(this.emailTextField)
                .then(() => {
                  // After Firebase auth update, update database and local storage
                  this.updateUserProfile();
                })
                .catch((error) => {
                  console.error('Error updating Firebase email:', error.message);
                  // Handle the error appropriately
                  this.errorTextLable = this.errorMapper.toUserMessage(error, 'Failed to update email');
                  this.color = "red";
                  this.borderColor = "red";
                  SettingsComponent.isError = true;
                });
            } else {
              // Selfhosted mode: update email in auth database
              this.selfhosted.updateEmail(this.emailTextField).subscribe({
                next: (response) => {
                  // After selfhosted auth update, update database and local storage
                  this.updateUserProfile();
                },
                error: (error) => {
                  console.error('Error updating selfhosted email:', error);
                  this.errorTextLable = this.errorMapper.toUserMessage(error, 'Failed to update email');
                  this.color = "red";
                  this.borderColor = "red";
                  SettingsComponent.isError = true;
                }
              });
            }
          } else {
            // No email change - just update username and other profile data
            if (!SettingsComponent.isError) {
              this.updateUserProfile();
            }
          }
        }
      }
    }
    if (SettingsComponent.isAllocation) {
      //Validate input (= 100%)
      if (this.dailyTextField != AppStateService.instance.daily || this.splurgeTextField != AppStateService.instance.splurge || this.smileTextField != AppStateService.instance.smile || this.fireTextField != AppStateService.instance.fire) {
        if (Number(this.dailyTextField) + Number(this.splurgeTextField) + Number(this.smileTextField) + Number(this.fireTextField) == 100) {
          SettingsComponent.isError = false;
          this.errorTextLable = "";
          this.color = "black";
          this.borderColor = "var(--color-border)";
          this.localStorage.saveData("dailyR", String(this.dailyTextField))
          AppStateService.instance.daily = this.dailyTextField
          this.localStorage.saveData("splurgeR", String(this.splurgeTextField))
          AppStateService.instance.splurge = this.splurgeTextField
          this.localStorage.saveData("smileR", String(this.smileTextField))
          AppStateService.instance.smile = this.smileTextField
          this.localStorage.saveData("fireR", String(this.fireTextField))
          AppStateService.instance.fire = this.fireTextField
          this.isEdit = false;
          // Reload the current page
          window.location.reload();
        } else {
          this.errorTextLable = "Error: Invalid input! The values for Daily, Splurge, Smile, and Fire must add up to 100%. Please ensure that the allocation percentages are correct and try again.";
          this.color = "red";
          this.borderColor = "red";
          SettingsComponent.isError = true;
        }
      } else {
      }
    }
  }
}