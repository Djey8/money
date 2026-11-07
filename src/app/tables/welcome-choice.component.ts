import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TourService } from '../shared/services/tour.service';

const TEXTS = {
  en: {
    title: 'Welcome! How do you want to start?',
    hint: 'You can do the other one any time later: the tour from the help page, the demo from the Dreamer lobby (Learn the game).',
    tour: 'The normal welcome tour',
    tourText: 'A short tour of the app: the accounts, the pages and where to find things.',
    demo: 'The guided Dreamer demo',
    demoText:
      'Play the first rounds of the Dreamer against a friendly bot, with a coach that shows every place of the screen. About fifteen minutes; you can stop any time.',
    skip: 'Neither, let me look around',
  },
  de: {
    title: 'Willkommen! Wie möchtest du starten?',
    hint: 'Das andere kannst du später jederzeit machen: die Tour über die Hilfe, die Demo in der Träumer-Lobby (Das Spiel lernen).',
    tour: 'Die normale Willkommens-Tour',
    tourText: 'Eine kurze Tour durch die App: die Konten, die Seiten und wo man was findet.',
    demo: 'Die geführte Träumer-Demo',
    demoText:
      'Spiele die ersten Runden Träumer gegen einen freundlichen Bot, mit einem Coach, der jede Stelle des Bildschirms zeigt. Etwa fünfzehn Minuten; du kannst jederzeit aufhören.',
    skip: 'Keins von beiden, ich schaue mich um',
  },
};

/**
 * The first screen of a new game account (JFK, 2026-11-06): the normal welcome tour, or the guided Dreamer demo. Registration marks the
 * account as new; the app sends a game account here instead of straight into the tour. A route of the self-hosted edition only
 * (app.routes.selfhosted.ts), so the Firebase build carries none of it (docs/adr/0004).
 */
@Component({
  selector: 'app-welcome-choice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wc">
      <h1>{{ t.title }}</h1>
      <div class="wc-cards">
        <button type="button" class="wc-card" (click)="tour()">
          <span class="wc-icon">🧭</span>
          <strong>{{ t.tour }}</strong>
          <small>{{ t.tourText }}</small>
        </button>
        <button type="button" class="wc-card wc-card--demo" (click)="demo()">
          <span class="wc-icon">🎲</span>
          <strong>{{ t.demo }}</strong>
          <small>{{ t.demoText }}</small>
        </button>
      </div>
      <p class="wc-hint">{{ t.hint }}</p>
      <button type="button" class="wc-skip" (click)="skip()">{{ t.skip }}</button>
    </main>
  `,
  styles: [
    `
      .wc {
        max-width: 720px;
        margin: 0 auto;
        padding: 32px 16px;
        text-align: center;
      }
      .wc-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin: 24px 0;
      }
      .wc-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
        padding: 22px 18px;
        border: 2px solid var(--color-border, #d9dde3);
        border-radius: 16px;
        background: var(--color-surface, #fff);
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .wc-card:hover,
      .wc-card:focus-visible {
        border-color: #1976d2;
      }
      .wc-card--demo {
        border-color: #ffb300;
      }
      .wc-icon {
        font-size: 34px;
      }
      .wc-card small {
        color: #6b7785;
        line-height: 1.4;
      }
      .wc-hint {
        color: #6b7785;
        font-size: 13px;
      }
      .wc-skip {
        background: none;
        border: 0;
        text-decoration: underline;
        color: #6b7785;
        cursor: pointer;
      }
    `,
  ],
})
export class WelcomeChoiceComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly tourService = inject(TourService);

  get t() {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return lang.toLowerCase().startsWith('de') ? TEXTS.de : TEXTS.en;
  }

  tour(): void {
    void this.router
      .navigate(['/home'])
      .then(() => setTimeout(() => this.tourService.startTour(), 400));
  }

  demo(): void {
    void this.router.navigate(['/tables'], { queryParams: { game: 'dreamfund', demo: 'start' } });
  }

  skip(): void {
    void this.router.navigate(['/home']);
  }
}
