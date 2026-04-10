import { NgModule, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { environment } from '../environments/environment';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule, TranslateLoader, MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

export class FallbackMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams) {
    return params.key;
  }
}
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';

import { AddComponent } from './panels/add/add.component';
import { AddSmileComponent } from './panels/add/add-smile/add-smile.component';
import { AddFireComponent } from './panels/add/add-fire/add-fire.component';
import { AddAssetComponent } from './panels/add/add-asset/add-asset.component';
import { AddShareComponent } from './panels/add/add-share/add-share.component';
import { AddInvestmentComponent } from './panels/add/add-investment/add-investment.component';
import { AddLiabilitieComponent } from './panels/add/add-liabilitie/add-liabilitie.component';
import { AddSubscriptionComponent } from './panels/add/add-subscription/add-subscription.component';
import { AddGrowComponent } from './panels/add/add-grow/add-grow.component';
import { AddBudgetComponent } from './panels/add/add-budget/add-budget.component';
import { MenuComponent } from './panels/menu/menu.component';
import { ChooseComponent } from './panels/menu/choose/choose.component';
import { ProfileComponent } from './panels/profile/profile.component';
import { SettingsComponent } from './panels/settings/settings.component';
import { ImpressumComponent } from './panels/impressum/impressum.component';
import { PolicyComponent } from './panels/policy/policy.component';
import { InstructionsComponent } from './panels/instructions/instructions.component';
import { InfoComponent } from './panels/info/info.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { OnboardingComponent } from './shared/components/onboarding/onboarding.component';

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';

registerLocaleData(localeDe);
registerLocaleData(localeEn);

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    HttpClientModule,
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: FallbackMissingTranslationHandler
      }
    }),
    BrowserAnimationsModule,
    AddComponent,
    AddSmileComponent,
    AddFireComponent,
    AddAssetComponent,
    AddShareComponent,
    AddInvestmentComponent,
    AddLiabilitieComponent,
    AddSubscriptionComponent,
    AddGrowComponent,
    AddBudgetComponent,
    MenuComponent,
    ChooseComponent,
    ProfileComponent,
    SettingsComponent,
    ImpressumComponent,
    PolicyComponent,
    InstructionsComponent,
    InfoComponent,
    ToastComponent,
    ConfirmDialogComponent,
    BottomNavComponent,
    OnboardingComponent
  ],
  providers: [{
    provide: LOCALE_ID,
    useFactory: () => {
      const isEuropeanFormat = localStorage.getItem('isEuropeanFormat');
      return isEuropeanFormat === 'false' ? 'en-US' : 'de-DE';
    }
  }],
  bootstrap: [AppComponent]
})
export class AppModule { }
