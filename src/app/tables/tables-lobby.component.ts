import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  TablesApiService,
  type GamePlayer,
  type TableSeat,
  type TableSummary,
} from './tables-api.service';
import { AppComponent } from '../app.component';
import { CashflowGameComponent } from '../main/cashflow-game/cashflow-game.component';
import { ProfileComponent } from '../panels/profile/profile.component';
import { tablesTexts, type TablesTexts } from './tables.texts';
import { addTableTexts, type AddTableTexts } from './add-table.texts';
import { hallTexts, type HallTexts } from './hall.texts';
import { AddTableComponent } from './add-table.component';
import { SeatAvatarComponent } from './seat-avatar.component';
import { TablePlayerInfoComponent } from './table-player-info.component';
import { seatToPlayer } from './seat-stats';
import { defaultInitials, saveInitials, savedInitials } from './token-initials';
import {
  APP_LANGUAGES,
  GAME_LANGUAGES,
  LanguageService,
  type AppLanguage,
} from '../shared/services/language.service';
import { ConfirmService } from '../shared/services/confirm.service';
import { problemText } from './problem.texts';
import { leaderboardTexts, type LeaderboardTexts } from './leaderboard.texts';

/** The account's own name: the one name at every table (the server uses the account's nickname whatever is sent). */
function accountName(): string {
  const name = ProfileComponent.username;
  return name && name !== 'Username' ? name.slice(0, 24) : 'Player';
}

/** What the open tables are filtered by (kept on this device). */
export interface TableFilters {
  language: string;
  game: 'any' | 'ranked' | 'friendly';
  clock: 'any' | 'untimed' | 'timed';
  professions: 'any' | 'duplicates' | 'unique' | 'random';
  end: 'any' | 'first-escape' | 'all-done' | 'round-limit';
}

const NO_FILTERS: TableFilters = {
  language: '',
  game: 'any',
  clock: 'any',
  professions: 'any',
  end: 'any',
};
const FILTERS_KEY = 'mm.tables.filters';

function savedFilters(): TableFilters {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? 'null') as Partial<TableFilters>;
    return raw && typeof raw === 'object' ? { ...NO_FILTERS, ...raw } : { ...NO_FILTERS };
  } catch {
    return { ...NO_FILTERS };
  }
}

/**
 * The match-making page of the multiplayer Cashflow tables (JFK, 2026-10-25): find a table to sit at. Every open table is a card that
 * shows who is already there (picture and rating - a tap opens their leaderboard stats) and what the game is, with filters for what
 * you want to play; below your own tables and the invite code. Self-hosted game accounts only - reachable only through the route in
 * app.routes.selfhosted.ts; the backend refuses any other account (403 not_a_game_account).
 */
@Component({
  selector: 'app-tables-lobby',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    AddTableComponent,
    SeatAvatarComponent,
    TablePlayerInfoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tables.css', '../app.component.css'],
  template: `
    <!-- the app's own toolbar, as every page has it -->
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
      <div class="spacer"></div>
      <button
        id="addbtn"
        class="add-circle-btn"
        [attr.aria-label]="t.addTable"
        [title]="t.addTable"
        (click)="showAdd = true"
      >
        +
      </button>
    </div>
    <app-add-table *ngIf="showAdd" (created)="onCreated($event)" (closed)="showAdd = false" />
    <div class="tl-page" [attr.dir]="rtl ? 'rtl' : 'ltr'">
      <!-- where else to go: the same three places, always in the same row -->
      <nav class="tl-nav" aria-label="Multiplayer">
        <a class="tl-nav-item" routerLink="/leaderboard">🏆 {{ lb.title }}</a>
        <button class="tl-nav-item" type="button" (click)="openMyGames()">
          📒 {{ 'CashflowGame.myGames' | translate }}
        </button>
        <a class="tl-nav-item" routerLink="/docs/cashflow">ⓘ {{ t.howItWorks }}</a>
      </nav>

      <!-- who you are at a table -->
      <section class="tl-me">
        <app-seat-avatar
          [name]="nickname"
          [src]="myPicture"
          [size]="44"
          [color]="'#1976d2'"
        ></app-seat-avatar>
        <div class="tl-me-text">
          <small>{{ h.playAs }}</small>
          <strong>{{ nickname }}</strong>
          <small *ngIf="me as mine"
            >{{ mine.rating }}<ng-container *ngIf="mine.provisional"> ~</ng-container></small
          >
        </div>
        <label class="tl-initials">
          <span>{{ h.tokenLetters }}</span>
          <input
            type="text"
            maxlength="2"
            [(ngModel)]="initials"
            (ngModelChange)="initialsChanged()"
            [placeholder]="defaultLetters"
            [attr.aria-label]="t.initials"
            [title]="t.initialsHint"
          />
        </label>
      </section>

      <p class="tl-error" *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="loading">{{ t.loading }}</p>

      <!-- the tables you are at -->
      <section class="tl-group" *ngIf="mine.length">
        <header class="tl-group-head">
          <h3>{{ h.mineHeading }}</h3>
        </header>
        <ul class="tl-cards">
          <li *ngFor="let table of mine">
            <ng-container
              *ngTemplateOutlet="card; context: { $implicit: table, own: true }"
            ></ng-container>
          </li>
        </ul>
      </section>

      <!-- the tables to join -->
      <section class="tl-group">
        <header class="tl-group-head">
          <h3>
            {{ t.openTables }} <span class="tl-count">{{ shown().length }}</span>
          </h3>
          <span class="tl-head-buttons">
            <button type="button" class="tx-btn tx-btn--small" (click)="reload()">
              ⟳ {{ t.refresh }}
            </button>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              [class.tx-btn--primary]="activeFilters() > 0"
              [attr.aria-expanded]="showFilters"
              (click)="showFilters = !showFilters"
            >
              ⚙ {{ h.filters
              }}<ng-container *ngIf="activeFilters() > 0"> ({{ activeFilters() }})</ng-container>
            </button>
          </span>
        </header>

        <div class="tl-filters" *ngIf="showFilters">
          <div class="tl-filter">
            <span class="tl-filter-label">{{ h.filterLanguage }}</span>
            <div class="tl-flags" role="radiogroup" [attr.aria-label]="h.filterLanguage">
              <button
                type="button"
                role="radio"
                class="tl-flag tl-flag--text"
                [class.tl-flag--on]="!filters.language"
                [attr.aria-checked]="!filters.language"
                (click)="setFilter('language', '')"
              >
                {{ h.filterAnyLanguage }}
              </button>
              <button
                *ngFor="let lang of languages"
                type="button"
                role="radio"
                class="tl-flag"
                [class.tl-flag--on]="filters.language === lang.code"
                [attr.aria-checked]="filters.language === lang.code"
                [title]="lang.name"
                (click)="setFilter('language', lang.code)"
              >
                <img [src]="lang.flag" [alt]="lang.name" width="28" />
              </button>
            </div>
          </div>
          <div class="tl-filter" *ngFor="let group of filterGroups()">
            <span class="tl-filter-label">{{ group.label }}</span>
            <div class="tl-seg" role="radiogroup" [attr.aria-label]="group.label">
              <button
                *ngFor="let option of group.options"
                type="button"
                role="radio"
                [class.tl-seg--on]="filters[group.key] === option.value"
                [attr.aria-checked]="filters[group.key] === option.value"
                (click)="setFilter(group.key, option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="tl-reset"
            *ngIf="activeFilters() > 0"
            (click)="resetFilters()"
          >
            {{ h.filtersReset }}
          </button>
        </div>

        <div class="tl-empty-box" *ngIf="!loading && !shown().length">
          <p>
            <strong>{{ open.length ? h.noMatch : t.noOpen }}</strong>
          </p>
          <p class="tl-meta">{{ open.length ? h.noMatchHint : h.noOpenHint }}</p>
          <button type="button" class="tx-btn tx-btn--primary" (click)="showAdd = true">
            + {{ h.openOne }}
          </button>
        </div>
        <ul class="tl-cards">
          <li *ngFor="let table of shown()">
            <ng-container
              *ngTemplateOutlet="card; context: { $implicit: table, own: false }"
            ></ng-container>
          </li>
        </ul>
      </section>

      <section class="tl-group">
        <header class="tl-group-head">
          <h3>{{ h.codeHeading }}</h3>
        </header>
        <p class="tl-meta tl-code-hint">{{ h.codeHint }}</p>
        <div class="tl-inline">
          <input
            type="text"
            maxlength="12"
            [(ngModel)]="code"
            [attr.aria-label]="t.code"
            [placeholder]="t.code"
          />
          <button
            class="tx-btn"
            type="button"
            [disabled]="busy || !code.trim()"
            (click)="join({ code: code.trim().toUpperCase() })"
          >
            {{ t.join }}
          </button>
        </div>
      </section>
    </div>

    <!-- one table: what it is, who sits at it -->
    <ng-template #card let-table let-own="own">
      <article class="tl-card" [class.tl-card--own]="own">
        <header class="tl-card-head">
          <img
            class="tl-flag-small"
            [src]="flagOf(table.language)"
            [alt]="table.language"
            width="22"
          />
          <h4>{{ table.name }}</h4>
          <span class="tl-free" *ngIf="!own && table.maxSeats > table.seatsTaken"
            >{{ table.maxSeats - table.seatsTaken }} {{ h.freeSeats }}</span
          >
          <span class="tl-free" *ngIf="own">{{ phaseText(table) }}</span>
        </header>
        <p class="tl-meta">
          {{ t.host }}: {{ table.hostName
          }}<ng-container *ngIf="openedAt(table) as when">
            · {{ t.openedAt }} {{ when }}</ng-container
          >
        </p>
        <div class="tl-chips">
          <span class="tl-chip" [class.tl-chip--accent]="table.ranked">{{
            table.ranked ? '🏆 ' + h.rankedTag : h.friendlyTag
          }}</span>
          <span class="tl-chip" *ngIf="table.visibility === 'private'">🔒 {{ t.privateTag }}</span>
          <span class="tl-chip">{{ clockText(table) }}</span>
          <span class="tl-chip">{{ professionText(table) }}</span>
          <span class="tl-chip">{{ endText(table) }}</span>
        </div>
        <ul
          class="tl-seats"
          [attr.aria-label]="table.seatsTaken + '/' + table.maxSeats + ' ' + t.seatsOf"
        >
          <li *ngFor="let seat of seatsOf(table)">
            <button
              type="button"
              class="tl-seat"
              [disabled]="!statsOf(seat)"
              [title]="seat.name + ' · ' + seat.rating"
              (click)="selected = statsOf(seat)"
            >
              <app-seat-avatar
                [name]="seat.name"
                [bot]="seat.bot"
                [src]="pictureOf(seat, table)"
                [size]="40"
              ></app-seat-avatar>
              <span class="tl-seat-name">{{ seat.name }}</span>
              <span class="tl-seat-rating">{{ seat.rating }}</span>
            </button>
          </li>
          <li *ngFor="let free of freeSlots(table)" class="tl-seat tl-seat--free">
            <app-seat-avatar [empty]="true" [size]="40"></app-seat-avatar>
            <span class="tl-seat-name">&nbsp;</span>
          </li>
        </ul>
        <div class="tl-card-actions">
          <ng-container *ngIf="!own">
            <button
              class="tx-btn tx-btn--primary"
              type="button"
              [disabled]="busy"
              (click)="join({ roomId: table.id })"
            >
              {{ t.join }}
            </button>
          </ng-container>
          <ng-container *ngIf="own">
            <a class="tx-btn tx-btn--primary" [routerLink]="['/tables', table.id]">{{ t.open }}</a>
            <button
              type="button"
              class="tx-btn"
              *ngIf="table.hosting && (table.humans ?? 1) <= 1"
              (click)="remove(table)"
            >
              {{ t.removeTable }}
            </button>
            <button
              type="button"
              class="tx-btn"
              *ngIf="!table.hosting || (table.humans ?? 1) > 1"
              (click)="leave(table)"
            >
              {{ t.leaveTable }}
            </button>
          </ng-container>
        </div>
      </article>
    </ng-template>

    <app-table-player-info
      *ngIf="selected as chosen"
      [player]="chosen"
      (closed)="selected = null"
    ></app-table-player-info>
  `,
  styles: [
    `
      .tl-page {
        max-width: 720px;
        margin: 0 auto;
        padding: 16px 16px calc(var(--page-bottom-spacer, 72px) + 28px);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* the places to go: three equal buttons in one row */
      .tl-nav {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .tl-nav-item {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 2.6rem;
        padding: 6px 8px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 10px;
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
      }
      .tl-nav-item:hover {
        border-color: var(--color-primary, #2a7de1);
      }
      /* you, as the others will see you */
      .tl-me {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
        padding: 10px 12px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-surface, #fff);
      }
      .tl-me-text {
        display: flex;
        flex-direction: column;
        flex: 1 1 8rem;
        min-width: 0;
        line-height: 1.2;
      }
      .tl-me-text strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tl-me-text small {
        opacity: 0.7;
      }
      .tl-initials {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
      }
      .tl-initials input {
        width: 3.6rem;
        text-align: center;
        text-transform: uppercase;
      }
      .tl-group {
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-background, #f6f7f9);
        padding: 12px;
      }
      .tl-group-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
      }
      .tl-group-head h3 {
        margin: 0;
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.8;
      }
      .tl-count {
        margin-inline-start: 4px;
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-size: 0.75rem;
        letter-spacing: 0;
      }
      .tl-head-buttons {
        display: flex;
        gap: 6px;
      }
      /* the filters */
      .tl-filters {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 12px;
        padding: 10px;
        border: 1px solid var(--color-border, #e3e6ea);
        border-radius: 10px;
        background: var(--color-surface, #fff);
      }
      .tl-filter {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tl-filter-label {
        font-size: 0.8rem;
        font-weight: 600;
        opacity: 0.8;
      }
      .tl-flags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .tl-flag {
        padding: 3px;
        border: 2px solid transparent;
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        opacity: 0.55;
        color: inherit;
        font: inherit;
      }
      .tl-flag--text {
        padding: 5px 10px;
        font-size: 0.85rem;
      }
      .tl-flag--on {
        border-color: var(--color-primary, #1976d2);
        opacity: 1;
      }
      .tl-flag-small {
        border-radius: 2px;
        flex: none;
      }
      .tl-seg {
        display: flex;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-surface, #fff);
      }
      .tl-seg button {
        flex: 1 1 0;
        min-width: 0;
        padding: 8px 4px;
        border: 0;
        border-inline-start: 1px solid var(--color-border, #ddd);
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .tl-seg button:first-child {
        border-inline-start: 0;
      }
      .tl-seg .tl-seg--on {
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-weight: 600;
      }
      .tl-reset {
        align-self: flex-start;
        border: 0;
        background: transparent;
        color: var(--color-primary, #2a7de1);
        font: inherit;
        font-size: 0.9rem;
        cursor: pointer;
        padding: 2px 0;
      }
      .tl-empty-box {
        padding: 16px;
        text-align: center;
        border: 1px dashed var(--color-border, #bbb);
        border-radius: 12px;
      }
      .tl-empty-box p {
        margin: 0 0 8px;
      }
      /* a table */
      .tl-cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .tl-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-surface, #fff);
      }
      .tl-card--own {
        border-color: var(--color-primary, #2a7de1);
      }
      .tl-card-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tl-card-head h4 {
        margin: 0;
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 1.05rem;
      }
      .tl-free {
        flex: none;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--color-primary-light, #e3f0fd);
        color: var(--color-primary, #2a7de1);
        font-size: 0.8rem;
        font-weight: 600;
      }
      .tl-meta {
        margin: 0;
        color: var(--color-text-secondary, #666);
        font-size: 0.85rem;
      }
      .tl-code-hint {
        margin-bottom: 8px;
      }
      .tl-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .tl-chip {
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid var(--color-border, #d9dde3);
        background: var(--color-background, #f6f7f9);
        font-size: 0.8rem;
      }
      .tl-chip--accent {
        border-color: var(--color-primary, #2a7de1);
        color: var(--color-primary, #2a7de1);
        font-weight: 600;
      }
      /* who sits there */
      .tl-seats {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px 4px;
      }
      .tl-seat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 64px;
        padding: 4px 2px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      button.tl-seat:hover:not(:disabled) {
        background: var(--color-primary-light, #e3f0fd);
      }
      button.tl-seat:disabled {
        cursor: default;
      }
      .tl-seat--free {
        opacity: 0.6;
        cursor: default;
      }
      .tl-seat-name {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.75rem;
      }
      .tl-seat-rating {
        font-size: 0.8rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .tl-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tl-card-actions .tx-btn {
        flex: 1 1 8rem;
        min-height: 2.6rem;
      }
      .tl-inline {
        display: flex;
        gap: 8px;
      }
      .tl-inline input {
        flex: 1;
        min-width: 0;
      }
      .tl-error {
        color: var(--color-danger, #c00);
      }
      @media (min-width: 640px) {
        .tl-cards {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class TablesLobbyComponent implements OnInit {
  readonly app = AppComponent;
  t: TablesTexts = tablesTexts('en');
  a: AddTableTexts = addTableTexts('en');
  h: HallTexts = hallTexts('en');
  lb: LeaderboardTexts = leaderboardTexts('en');
  rtl = false;
  loading = true;
  busy = false;
  error: string | null = null;
  open: TableSummary[] = [];
  mine: TableSummary[] = [];
  nickname = accountName();
  /** My own place on the leaderboard (rating, picture), once known. */
  me: GamePlayer | null = null;
  code = '';
  readonly languages = GAME_LANGUAGES;
  filters: TableFilters = savedFilters();
  showFilters = false;
  /** The player whose leaderboard stats are open. */
  selected: GamePlayer | null = null;

  /** The add-table panel (the plus button of the toolbar) is open. */
  showAdd = false;
  /** The letters on my token: kept on this device, sent with every join; empty is the default (the name's first two letters). */
  initials = savedInitials();
  private route = inject(ActivatedRoute, { optional: true });

  constructor(
    private api: TablesApiService,
    private router: Router,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private languageService: LanguageService,
    private confirmService: ConfirmService,
  ) {}

  get defaultLetters(): string {
    return defaultInitials(this.nickname);
  }

  get myPicture(): string | null {
    return this.me ? this.api.pictureUrl(this.me) : null;
  }

  initialsChanged(): void {
    this.initials = saveInitials(this.initials);
  }

  /** When the table was opened, in the viewer's own format ('' if the server did not say). */
  openedAt(table: TableSummary): string {
    if (!table.createdAt) return '';
    const at = new Date(table.createdAt);
    return Number.isNaN(at.getTime())
      ? ''
      : at.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }

  /** The panel opened a table: sit down at it. */
  onCreated(roomId: string | undefined): void {
    this.showAdd = false;
    this.cdr.markForCheck();
    this.enter(roomId);
  }

  ngOnInit(): void {
    this.speak(this.translate.currentLang || this.translate.defaultLang || 'en');
    // the add-table panel can change the app's language (the table's flag): the lobby follows
    this.translate.onLangChange.subscribe((event) => {
      this.speak(event.lang);
      this.cdr.markForCheck();
    });
    this.reload();
  }

  private speak(lang: string): void {
    this.t = tablesTexts(lang);
    this.a = addTableTexts(lang);
    this.h = hallTexts(lang);
    this.lb = leaderboardTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
  }

  /** The flag of a table's language, for the lists. */
  flagOf(code: string | undefined): string {
    return (APP_LANGUAGES.find((lang) => lang.code === code) ?? APP_LANGUAGES[0]).flag;
  }

  // ── the filters ──

  /** The open tables that fit the filters (the newest first). */
  shown(): TableSummary[] {
    const f = this.filters;
    return this.open.filter(
      (table) =>
        (!f.language || table.language === f.language) &&
        (f.game === 'any' || (f.game === 'ranked') === !!table.ranked) &&
        (f.clock === 'any' || (f.clock === 'timed') === (table.clock.mode !== 'none')) &&
        (f.professions === 'any' || table.professions === f.professions) &&
        (f.end === 'any' || table.endCondition === f.end),
    );
  }

  activeFilters(): number {
    const f = this.filters;
    return (
      (f.language ? 1 : 0) +
      (f.game !== 'any' ? 1 : 0) +
      (f.clock !== 'any' ? 1 : 0) +
      (f.professions !== 'any' ? 1 : 0) +
      (f.end !== 'any' ? 1 : 0)
    );
  }

  setFilter<K extends keyof TableFilters>(key: K, value: string): void {
    this.filters = { ...this.filters, [key]: value } as TableFilters;
    this.keepFilters();
  }

  resetFilters(): void {
    this.filters = { ...NO_FILTERS };
    this.keepFilters();
  }

  private keepFilters(): void {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(this.filters));
    } catch {
      // no storage here: the filters last as long as the page
    }
  }

  /** The choices of each filter, in words. */
  filterGroups(): {
    key: 'game' | 'clock' | 'professions' | 'end';
    label: string;
    options: { value: string; label: string }[];
  }[] {
    const any = { value: 'any', label: this.h.filterAny };
    return [
      {
        key: 'game',
        label: this.h.filterGame,
        options: [
          any,
          { value: 'ranked', label: this.h.filterRanked },
          { value: 'friendly', label: this.h.filterFriendly },
        ],
      },
      {
        key: 'clock',
        label: this.h.filterClock,
        options: [
          any,
          { value: 'untimed', label: this.h.filterUntimed },
          { value: 'timed', label: this.h.filterTimed },
        ],
      },
      {
        key: 'professions',
        label: this.h.filterProfessions,
        options: [
          any,
          { value: 'duplicates', label: this.a.profFree },
          { value: 'unique', label: this.a.profUnique },
          { value: 'random', label: this.a.profRandom },
        ],
      },
      {
        key: 'end',
        label: this.h.filterEnd,
        options: [
          any,
          { value: 'first-escape', label: this.a.endFirst },
          { value: 'all-done', label: this.a.endAll },
          { value: 'round-limit', label: this.a.endRounds },
        ],
      },
    ];
  }

  // ── a table card ──

  clockText(table: TableSummary): string {
    switch (table.clock.mode) {
      case 'per-move':
        return `⏱ ${table.clock['secondsPerMove']}${this.t.perMove}`;
      case 'bank':
        return `⏱ ${table.clock['bankSeconds']}${this.t.bank}`;
      case 'daily':
        return `⏱ ${table.clock['hoursPerMove']}${this.t.daily}`;
      default:
        return this.t.noClock;
    }
  }

  professionText(table: TableSummary): string {
    return table.professions === 'duplicates'
      ? this.a.profFree
      : table.professions === 'unique'
        ? this.a.profUnique
        : this.a.profRandom;
  }

  endText(table: TableSummary): string {
    return table.endCondition === 'first-escape'
      ? this.a.endFirst
      : table.endCondition === 'all-done'
        ? this.a.endAll
        : this.a.endRounds;
  }

  phaseText(table: TableSummary): string {
    const phase: Record<string, string> = {
      lobby: this.t.waiting,
      picking: this.t.waiting,
      playing: this.t.playing,
      paused: this.t.playing,
      finished: this.t.finished,
      closed: this.t.closed,
    };
    return phase[table.phase] ?? table.phase;
  }

  /** Who sits there; a table whose list did not carry them shows the number of seats taken only. */
  seatsOf(table: TableSummary): TableSeat[] {
    return table.seats ?? [];
  }

  /** The empty seats shown as dashed circles (a big table shows only the first ones). */
  freeSlots(table: TableSummary): number[] {
    const taken = Math.max(this.seatsOf(table).length, table.seatsTaken);
    return Array.from({ length: Math.min(12, Math.max(0, table.maxSeats - taken)) }, (_, i) => i);
  }

  statsOf(seat: TableSeat): GamePlayer | null {
    return seatToPlayer(seat);
  }

  pictureOf(seat: TableSeat, table: TableSummary): string | null {
    return this.api.pictureUrl(seat, table.id);
  }

  /** Leaves the game: the seat goes (a resign in a running game), the others play on. */
  leave(table: TableSummary): void {
    // asked in the app's own dialog, not the browser's
    this.confirmService.confirm(
      this.t.leaveConfirm,
      () =>
        this.api.leave(table.id).subscribe({
          next: () => this.reload(),
          error: (e) => this.fail(e),
        }),
      this.t.leaveTable,
      'delete',
    );
  }

  /** The host takes a table away again (closed for everybody, then deleted). */
  remove(table: TableSummary): void {
    this.confirmService.confirm(
      this.t.removeConfirm,
      () =>
        this.api.remove(table.id).subscribe({
          next: () => this.reload(),
          error: (e) => this.fail(e),
        }),
      this.t.removeTable,
      'delete',
    );
  }

  /** The saved games, the same list as in the solo game. */
  openMyGames(): void {
    CashflowGameComponent.openGamesList();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    };
    this.api.list('open').subscribe({
      next: (r) => {
        // the newest table first
        this.open = r.items
          .filter((table) => !table.joined)
          .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
        done();
      },
      error: (e) => {
        this.fail(e);
        done();
      },
    });
    this.api.list('mine').subscribe({
      next: (r) => {
        this.mine = r.items;
        done();
      },
      error: (e) => {
        this.fail(e);
        done();
      },
    });
    // my rating and picture: nice to show, never in the way
    this.api.me().subscribe({
      next: (me) => {
        this.me = me;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  join(target: { roomId?: string; code?: string }): void {
    this.busy = true;
    this.error = null;
    this.api.join(target, this.nickname.trim(), saveInitials(this.initials)).subscribe({
      next: (room) => {
        // the app speaks the language of the table from the moment the player sits at it
        const code = (room.language ?? '') as AppLanguage['code'];
        if (
          APP_LANGUAGES.some((lang) => lang.code === code) &&
          code !== this.languageService.current
        ) {
          void this.languageService.use(code);
        }
        this.enter(room.id ?? target.roomId);
      },
      error: (e) => {
        this.busy = false;
        this.fail(e);
        this.cdr.markForCheck();
      },
    });
  }

  private enter(roomId: string | undefined): void {
    this.busy = false;
    if (roomId) void this.router.navigate(['/tables', roomId]);
    else this.reload();
  }

  private fail(e: {
    status?: number;
    error?: { detail?: string; code?: string };
    message?: string;
  }): void {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.error =
      e?.status === 403
        ? this.t.notGame
        : (problemText(lang, e?.error?.code, e?.error?.detail) ?? e?.message ?? this.t.failed);
    this.cdr.markForCheck();
  }
}
