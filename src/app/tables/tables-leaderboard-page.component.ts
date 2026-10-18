import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AppComponent } from '../app.component';
import { leaderboardTexts, type LeaderboardTexts } from './leaderboard.texts';
import { TablesLeaderboardComponent } from './tables-leaderboard.component';

/**
 * The leaderboard as a page of its own (todo/cashflow-leaderboard.md §10), with the app's toolbar like every page. Reached from the
 * menu of a game account and from the multiplayer lobby. Self-hosted game accounts only (the lazy tables chunk).
 */
@Component({
  selector: 'app-tables-leaderboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TablesLeaderboardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tables.css', '../app.component.css'],
  template: `
    <div class="toolbar" role="banner">
      <img
        id="profile-pic"
        width="40"
        alt="Profile Logo"
        src="../assets/profile-blank.jpg"
        role="button"
        tabindex="0"
        aria-label="Open profile"
        (keydown.enter)="app.clickProfile()"
        (click)="app.clickProfile()"
      />
      <div
        id="heading"
        role="button"
        tabindex="0"
        (click)="app.openNavBar()"
        (keydown.enter)="app.openNavBar()"
      >
        {{ t.title }}
      </div>
    </div>
    <div class="tl-page" [attr.dir]="rtl ? 'rtl' : 'ltr'">
      <header class="tl-head">
        <h2>{{ t.title }}</h2>
        <a class="tx-btn" routerLink="/tables">{{ t.multiplayer }}</a>
      </header>
      <app-tables-leaderboard></app-tables-leaderboard>
    </div>
  `,
  styles: [
    `
      .tl-page {
        max-width: 720px;
        margin: 0 auto;
        padding: 16px 16px calc(var(--page-bottom-spacer, 72px) + 28px);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .tl-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class TablesLeaderboardPageComponent {
  readonly app = AppComponent;
  t: LeaderboardTexts;
  rtl: boolean;

  constructor(translate: TranslateService) {
    const lang = translate.currentLang || translate.defaultLang || 'en';
    this.t = leaderboardTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
  }
}
