import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { HttpClient } from "@angular/common/http";
import { CrypticService } from 'src/app/shared/services/cryptic.service';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsComponent } from '../settings/settings.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';


// Deferred imports — resolved after module init to break circular chains
let AddComponent: any; setTimeout(() => import('../add/add.component').then(m => AddComponent = m.AddComponent));
let MenuComponent: any; setTimeout(() => import('../menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let InfoComponent: any; setTimeout(() => import('../info/info.component').then(m => InfoComponent = m.InfoComponent));
let InfoSmileComponent: any; setTimeout(() => import('../info/info-smile/info-smile.component').then(m => InfoSmileComponent = m.InfoSmileComponent));
let AddSmileComponent: any; setTimeout(() => import('../add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let SmileProjectsComponent: any; setTimeout(() => import('src/app/main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let ImpressumComponent: any; setTimeout(() => import('../impressum/impressum.component').then(m => ImpressumComponent = m.ImpressumComponent));
let PolicyComponent: any; setTimeout(() => import('../policy/policy.component').then(m => PolicyComponent = m.PolicyComponent));
let InstructionsComponent: any; setTimeout(() => import('../instructions/instructions.component').then(m => InstructionsComponent = m.InstructionsComponent));
let IncomeComponent: any; setTimeout(() => import('src/app/main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let BalanceComponent: any; setTimeout(() => import('src/app/main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let GrowComponent: any; setTimeout(() => import('src/app/main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('src/app/main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let FireComponent: any; setTimeout(() => import('src/app/main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, TranslateModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})

export class ProfileComponent {
  static zIndex: number;
  static isProfile: boolean;
  static isUser: boolean;
  static username: string;
  static mail: string;
  static isImport: boolean;

  public classReference = ProfileComponent;
  constructor(private router: Router, private localStorage: LocalService, private database: DatabaseService, private afAuth: AngularFireAuth, private http: HttpClient, private cryptic: CrypticService) {
    ProfileComponent.isProfile = false;
    ProfileComponent.isImport = false;
    ProfileComponent.zIndex = 0;
    ProfileComponent.username = this.localStorage.getData("username") == "" ? "Username" : this.localStorage.getData("username");
    ProfileComponent.mail = this.localStorage.getData("email") == "" ? "example@traiber.com" : this.localStorage.getData("email");
    ProfileComponent.isUser = this.localStorage.getData("username") == "" ? true : false;  // true = not logged in
  }

  ngOnInit(): void {
    this.database.getData("info/username")
      .then(snapshot => {
        let username: string = snapshot.val();  // Username is NOT encrypted
        ProfileComponent.username = username;
        this.localStorage.saveData("username", username);
        ProfileComponent.isUser = false;  // false = logged in (show sign out button)
      })
      .catch((err: any) => {
        //handle error
      })

    this.database.getData("info/email")
      .then(snapshot => {
        let email: string = snapshot.val();  // Email is NOT encrypted in DB
        if (email) {
          ProfileComponent.mail = email;
          this.localStorage.saveData("email", email);
        }
      })
      .catch((err: any) => {
        //handle error
      })
  }

  @ViewChild('confirmationDialog') confirmationDialog!: ElementRef;
  showConfirmation: boolean = false;

  openConfirmation(): void {
    this.showConfirmation = true;
  }

  closeConfirmation(confirm: boolean): void {
    this.showConfirmation = false;

    if (confirm) {
      this.logOut();
    }
  }

  public goToSettings() {
    AppComponent.gotoTop();
    ImpressumComponent.isInfo = false;
    PolicyComponent.isInfo = false;
    InstructionsComponent.isInfo = false;
    SettingsComponent.isError = false;
    SettingsComponent.isInfo = true;
    SettingsComponent.zIndex = 100;
    PolicyComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    ImpressumComponent.zIndex = 0;
    InstructionsComponent.zIndex = 0;
    SettingsComponent.setSettingsComponent(ProfileComponent.username, ProfileComponent.mail)
    SettingsComponent.isSettings = true;
    SettingsComponent.isAllocation = false;
    SettingsComponent.isLanguages = false;
    SettingsComponent.isCurrency = false;
    SettingsComponent.isEncryption = false;
    SettingsComponent.isNumberFormat = false;
    SettingsComponent.isDateFormat = false;
    SettingsComponent.isBackup = false;
    SettingsComponent.isRestore = false;
  }

  public goToImpressum() {
    AppComponent.gotoTop();
    SettingsComponent.isInfo = false;
    PolicyComponent.isInfo = false;
    InstructionsComponent.isInfo = false;
    ImpressumComponent.isInfo = true;
    ImpressumComponent.zIndex = 100;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    PolicyComponent.zIndex = 0;
    InstructionsComponent.zIndex = 0;
  }
  public goToHelp() {
    AppComponent.gotoTop();
    SettingsComponent.isInfo = false;
    ImpressumComponent.isInfo = false;
    PolicyComponent.isInfo = false;
    InstructionsComponent.isInfo = true;
    InstructionsComponent.zIndex = 100;
    ImpressumComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    PolicyComponent.zIndex = 0;
  }
  public goToPolicy() {
    AppComponent.gotoTop();
    SettingsComponent.isInfo = false;
    ImpressumComponent.isInfo = false;
    InstructionsComponent.isInfo = false;
    PolicyComponent.isInfo = true;
    PolicyComponent.zIndex = 100;
    ImpressumComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InstructionsComponent.zIndex = 0;
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
    AppStateService.instance.mojo = { amount: 0, target: 0 };

    
    const savedTheme = localStorage.getItem('theme');
    const savedLang = ['isEng', 'isDe', 'isEs', 'isFr', 'isCn', 'isAr'].find(k => localStorage.getItem(k) === 'true');
    const savedCurrency = localStorage.getItem('currency');
    const savedDateFormat = localStorage.getItem('dateFormat');
    const savedEuropean = localStorage.getItem('isEuropeanFormat');
    localStorage.clear();
    sessionStorage.clear();
    if (savedTheme) localStorage.setItem('theme', savedTheme);
    if (savedLang) localStorage.setItem(savedLang, 'true');
    if (savedCurrency) localStorage.setItem('currency', savedCurrency);
    if (savedDateFormat) localStorage.setItem('dateFormat', savedDateFormat);
    if (savedEuropean) localStorage.setItem('isEuropeanFormat', savedEuropean);
    
    this.cryptic.updateConfig("default", true, false)    

    ProfileComponent.isUser = true;
    ProfileComponent.username = "Username";
    ProfileComponent.mail = "example@traiber.com";
    this.logoutFirebase();
    this.closeWindow();
    this.router.navigate(['/authentication']);
  }
  closeWindow() {
    ProfileComponent.isProfile = !ProfileComponent.isProfile;
    ProfileComponent.zIndex = 0;
  }

  openAbout() {
    this.closeWindow();
    this.router.navigate(['/about']);
  }

  goToAuthetication() {
    this.router.navigate(['/authentication']);
    ProfileComponent.isProfile = false;
  }

  clearStorage() {
    this.localStorage.removeData("transactions");
    this.localStorage.removeData("smile");
    this.localStorage.removeData("fire");
    this.localStorage.removeData("mojo");
    this.localStorage.removeData("username");
    this.localStorage.removeData("uid");
    this.localStorage.removeData("email");
    this.localStorage.removeData("revenues");
    this.localStorage.removeData("interests");
    this.localStorage.removeData("properties");

    this.localStorage.removeData("dailyEx");
    this.localStorage.removeData("splurgeEx");
    this.localStorage.removeData("smileEx");
    this.localStorage.removeData("fireEx");
    this.localStorage.removeData("mojoEx");
    this.localStorage.removeData("liabilitiesEx");
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allSmileProjects = [];
    this.router.navigate(['/home']);
  }

  highlight() {
    ProfileComponent.zIndex = ProfileComponent.zIndex + 1;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
    InfoSmileComponent.zIndex = 0;
  }

}
