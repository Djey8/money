import { Component, ViewEncapsulation } from '@angular/core';
import { NgIf, NgClass, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoService } from '../shared/services/demo.service';
import { AppStateService } from '../shared/services/app-state.service';

// Deferred import to break circular chain
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, NgIf, NgClass, NgFor, TranslateModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css', '../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class LandingPageComponent {
  flippedBuckets = new Set<string>();
  selectedPromptType = 'smile-create';
  aiPreviewStep: 'options' | 'prompt' = 'options';

  // Smile info panel tab tracking
  smileTab: { [key: string]: string } = {
    'sp-japan': 'overview',
    'sp-office': 'overview'
  };

  // Login prompt
  showLoginPrompt = false;
  private loginPromptTimer: any;

  // Language & currency
  currentLang = 'en';
  currencySymbol = AppStateService.instance.currency || '€';
  languages = [
    { code: 'en', label: 'EN', flag: 'assets/flags/eng.png' },
    { code: 'de', label: 'DE', flag: 'assets/flags/de.png' },
    { code: 'es', label: 'ES', flag: 'assets/flags/es.png' },
    { code: 'fr', label: 'FR', flag: 'assets/flags/fr.png' },
    { code: 'cn', label: 'ZH', flag: 'assets/flags/cn.png' },
    { code: 'ar', label: 'AR', flag: 'assets/flags/tu.png' }
  ];

  constructor(private demoService: DemoService, private translate: TranslateService) {
    const saved = localStorage.getItem('landingLang');
    if (saved) {
      this.currentLang = saved;
      this.translate.use(saved);
    }
  }

  get appReference() { return AppComponent; }

  toggleBucket(bucket: string): void {
    if (this.flippedBuckets.has(bucket)) {
      this.flippedBuckets.delete(bucket);
      // Reset tab when closing
      if (this.smileTab[bucket]) {
        this.smileTab[bucket] = 'overview';
      }
    } else {
      // For smile project cards, only allow one open at a time
      if (bucket.startsWith('sp-')) {
        for (const key of Array.from(this.flippedBuckets)) {
          if (key.startsWith('sp-')) {
            this.flippedBuckets.delete(key);
            if (this.smileTab[key]) {
              this.smileTab[key] = 'overview';
            }
          }
        }
      }
      this.flippedBuckets.add(bucket);
      if (bucket.startsWith('sp-')) {
        setTimeout(() => {
          const el = document.getElementById('panel-' + bucket);
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }, 50);
      }
    }
  }

  setSmileTab(card: string, tab: string): void {
    this.smileTab[card] = tab;
  }

  requireLogin(): void {
    this.showLoginPrompt = true;
    clearTimeout(this.loginPromptTimer);
    this.loginPromptTimer = setTimeout(() => this.showLoginPrompt = false, 3000);
  }

  selectPromptType(type: string): void {
    this.selectedPromptType = type;
    this.aiPreviewStep = 'options';
  }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) { toggle.checked = false; }
  }

  switchLang(code: string): void {
    this.currentLang = code;
    this.translate.use(code);
    localStorage.setItem('landingLang', code);
    if (code === 'ar') {
      document.body.classList.add('rtl-text');
    } else {
      document.body.classList.remove('rtl-text');
    }
  }

  launchDemo(): void {
    this.demoService.startDemo();
  }
}
