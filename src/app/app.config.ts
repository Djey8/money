import { ApplicationConfig, importProvidersFrom, LOCALE_ID, isDevMode } from '@angular/core';
import { provideRouter, withHashLocation, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './shared/interceptors/auth.interceptor';

// Firebase compat providers (until modular migration)
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import { environment } from '../environments/environment';

// Translate
import { TranslateModule, TranslateLoader, MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeDe);
registerLocaleData(localeEn);

export class FallbackMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams) {
    return params.key;
  }
}

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

export const appConfig: ApplicationConfig = {
  providers: [
    // PreloadAllModules: every lazy route chunk is fetched in the background once the app
    // is bootstrapped. This keeps initial load fast (only the first route's chunk is needed
    // synchronously) but guarantees the rest of the app is in cache before the user goes
    // offline — even pages they haven't visited yet.
    provideRouter(routes, withHashLocation(), withPreloading(PreloadAllModules)),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Firebase (compat only — app uses AngularFireAuth + AngularFireDatabase)
    importProvidersFrom(
      AngularFireModule.initializeApp(environment.firebase),
      AngularFireAuthModule,
      AngularFireDatabaseModule,
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
    ),

    // Locale
    {
      provide: LOCALE_ID,
      useFactory: () => {
        const isEuropeanFormat = localStorage.getItem('isEuropeanFormat');
        return isEuropeanFormat === 'false' ? 'en-US' : 'de-DE';
      }
    }, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })
  ]
};
