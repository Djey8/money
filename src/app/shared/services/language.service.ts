import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LocalService } from './local.service';

export interface AppLanguage {
  code: 'en' | 'de' | 'es' | 'fr' | 'cn' | 'ar';
  flag: string;
  /** Short code on the button. */
  label: string;
  /** The language's own name. */
  name: string;
}

/** The six languages the app speaks, in the order the beginner tour offers them. */
export const APP_LANGUAGES: AppLanguage[] = [
  { code: 'en', flag: 'assets/flags/eng.png', label: 'EN', name: 'English' },
  { code: 'de', flag: 'assets/flags/de.png', label: 'DE', name: 'Deutsch' },
  { code: 'es', flag: 'assets/flags/es.png', label: 'ES', name: 'Español' },
  { code: 'fr', flag: 'assets/flags/fr.png', label: 'FR', name: 'Français' },
  { code: 'cn', flag: 'assets/flags/cn.png', label: 'CN', name: '中文' },
  { code: 'ar', flag: 'assets/flags/tu.png', label: 'AR', name: 'العربية' },
];

/** Where Settings keeps the choice: one true/false flag per language. */
const STORAGE_KEYS: Record<AppLanguage['code'], string> = {
  en: 'isEng',
  de: 'isDe',
  es: 'isEs',
  fr: 'isFr',
  cn: 'isCn',
  ar: 'isAr',
};

/**
 * Switches the language of the whole app the same way Settings and the beginner tour do - the
 * translation service, the per-language flags in local storage that Settings reads back at start-up,
 * Settings' own on-screen toggles, and right-to-left text for Arabic. Used when a new Cashflow game
 * asks which language to play in: the names the game gives things (labels, Grow projects, card
 * texts) follow the language chosen then (JFK, 2026-10-03).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  constructor(
    private translate: TranslateService,
    private localStorage: LocalService,
  ) {}

  readonly languages = APP_LANGUAGES;

  get current(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  /** Resolves once the language's texts have loaded, so whatever runs next already speaks it. */
  async use(code: AppLanguage['code']): Promise<void> {
    await firstValueFrom(this.translate.use(code));
    for (const [language, key] of Object.entries(STORAGE_KEYS)) {
      this.localStorage.saveData(key, language === code ? 'true' : 'false');
    }
    document.body.classList.toggle('rtl-text', code === 'ar');
    // Settings' language toggles read these; imported late to keep the services free of a cycle.
    const { SettingsComponent } = await import('../../panels/settings/settings.component');
    SettingsComponent.isEng = code === 'en';
    SettingsComponent.isDe = code === 'de';
    SettingsComponent.isEs = code === 'es';
    SettingsComponent.isFr = code === 'fr';
    SettingsComponent.isCn = code === 'cn';
    SettingsComponent.isAr = code === 'ar';
  }
}
