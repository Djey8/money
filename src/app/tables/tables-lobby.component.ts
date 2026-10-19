import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablesApiService, type CreateTableInput, type TableSummary } from './tables-api.service';
import { AppComponent } from '../app.component';
import { CashflowGameComponent } from '../main/cashflow-game/cashflow-game.component';
import { ProfileComponent } from '../panels/profile/profile.component';
import { tablesTexts, type TablesTexts } from './tables.texts';
import { AddTableComponent } from './add-table.component';
import { defaultInitials, saveInitials, savedInitials } from './token-initials';
import {
  APP_LANGUAGES,
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

/**
 * The lobby of the multiplayer Cashflow tables (todo/cashflow-multiplayer.md phase U1): the open tables to sit at, the ones
 * you are in, a form to open your own, and joining by invite code. Self-hosted game accounts only - reachable only through
 * the route in app.routes.selfhosted.ts; the backend refuses any other account (403 not_a_game_account).
 */
@Component({
  selector: 'app-tables-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, AddTableComponent],
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
      <header class="tl-head">
        <span class="tl-head-actions">
          <a class="tx-btn" routerLink="/docs/cashflow" [title]="t.howItWorks"
            >ⓘ {{ t.howItWorks }}</a
          >
          <a class="tx-btn" routerLink="/leaderboard">{{ lb.title }}</a>
          <button class="tx-btn" type="button" (click)="openMyGames()">
            {{ 'CashflowGame.myGames' | translate }}
          </button>
          <button class="tx-btn" type="button" (click)="reload()">{{ t.refresh }}</button>
        </span>
      </header>

      <p class="tl-error" *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="loading">{{ t.loading }}</p>

      <section class="tl-card" *ngIf="mine.length">
        <h3>{{ t.myTables }}</h3>
        <ul class="tl-list">
          <li *ngFor="let table of mine" class="tl-row">
            <div class="tl-row-main">
              <strong
                ><img
                  class="tl-flag-small"
                  [src]="flagOf(table.language)"
                  [alt]="table.language"
                  width="20"
                />
                {{ table.name }}</strong
              >
              <span class="tl-meta"
                ><span class="tl-private" *ngIf="table.visibility === 'private'"
                  >{{ t.privateTag }} · </span
                >{{ describe(table) }}</span
              >
              <span class="tl-meta" *ngIf="openedAt(table) as when"
                >{{ t.openedAt }} {{ when }}</span
              >
            </div>
            <div class="tl-row-actions">
              <a class="tx-btn tx-btn--primary" [routerLink]="['/tables', table.id]">{{
                t.open
              }}</a>
              <button
                type="button"
                class="tx-btn tx-btn--small"
                *ngIf="table.hosting && (table.humans ?? 1) <= 1"
                [title]="t.removeTable"
                (click)="remove(table)"
              >
                {{ t.removeShort }}
              </button>
              <button
                type="button"
                class="tx-btn tx-btn--small"
                *ngIf="!table.hosting || (table.humans ?? 1) > 1"
                [title]="t.leaveTable"
                (click)="leave(table)"
              >
                {{ t.leaveTable }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="tl-card">
        <h3>{{ t.openTables }}</h3>
        <label class="tl-initials">
          <span>{{ t.initials }}</span>
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
        <p *ngIf="!loading && !open.length" class="tl-empty">{{ t.noOpen }}</p>
        <!-- the first five are in view, the rest scrolls; the newest table first -->
        <ul class="tl-list tl-list--scroll" #openList [style.max-height.px]="openListMax">
          <li *ngFor="let table of open" class="tl-row">
            <div class="tl-row-main">
              <strong
                ><img
                  class="tl-flag-small"
                  [src]="flagOf(table.language)"
                  [alt]="table.language"
                  width="20"
                />
                {{ table.name }}</strong
              >
              <span class="tl-meta"
                >{{ t.host }}: {{ table.hostName }} · {{ describe(table) }}
                <ng-container *ngIf="openedAt(table) as when">
                  · {{ t.openedAt }} {{ when }}</ng-container
                ></span
              >
            </div>
            <div class="tl-row-actions">
              <button
                class="tx-btn tx-btn--primary"
                type="button"
                [disabled]="busy"
                (click)="join({ roomId: table.id })"
              >
                {{ t.join }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="tl-card" *ngIf="recent.length">
        <details class="tl-collapse">
          <summary>
            <h3>{{ t.recentTables }} ({{ recent.length }})</h3>
          </summary>
          <ul class="tl-list">
            <li *ngFor="let table of recent" class="tl-row">
              <div class="tl-row-main">
                <strong>{{ table.name }}</strong>
                <span class="tl-meta">{{ describe(table) }}</span>
                <span class="tl-meta" *ngIf="openedAt(table) as when"
                  >{{ t.openedAt }} {{ when }}</span
                >
              </div>
              <div class="tl-row-actions">
                <a class="tx-btn tx-btn--primary" [routerLink]="['/tables', table.id]">{{
                  t.open
                }}</a>
                <button
                  type="button"
                  class="tx-btn tx-btn--small"
                  [title]="t.forgetTable"
                  (click)="forget(table)"
                >
                  {{ t.removeShort }}
                </button>
              </div>
            </li>
          </ul>
        </details>
      </section>

      <section class="tl-card">
        <h3>{{ t.joinByCode }}</h3>
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
      .tl-flags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tl-flag {
        padding: 4px;
        border: 2px solid transparent;
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        opacity: 0.6;
      }
      .tl-flag--on {
        border-color: var(--color-primary, #1976d2);
        opacity: 1;
      }
      .tl-flag-small {
        vertical-align: -3px;
        border-radius: 2px;
      }
      .tl-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .tl-head-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .tl-head-actions .tx-btn {
        /* a link and a button are the same height whatever the width of the screen */
        align-self: auto;
        min-height: 2.4rem;
      }
      .tl-card {
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #ddd);
        border-radius: 12px;
        padding: 16px;
      }
      .tl-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      /* a table is a row: its name and what it is on the left, its buttons on the right, always in the same place */
      .tl-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--color-border-light, #eee);
      }
      .tl-row:last-child {
        border-bottom: 0;
      }
      .tl-row-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
      .tl-row-actions .tx-btn {
        min-width: 4.6rem;
        min-height: 2.4rem;
        justify-content: center;
        text-align: center;
        white-space: nowrap;
      }
      .tl-row-actions .tx-btn--small {
        min-width: 2.6rem;
      }
      /* five rows are in view; the rest of the open tables scrolls */
      .tl-list--scroll {
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .tl-initials {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0 8px;
        font-size: 0.9em;
      }
      .tl-initials input {
        width: 4rem;
        text-align: center;
        text-transform: uppercase;
      }
      .tl-collapse > summary {
        cursor: pointer;
        list-style: none;
      }
      .tl-collapse > summary::-webkit-details-marker {
        display: none;
      }
      .tl-collapse > summary h3 {
        display: inline;
        margin: 0;
      }
      .tl-collapse > summary::before {
        content: '▸';
        margin-inline-end: 6px;
      }
      .tl-collapse[open] > summary::before {
        content: '▾';
      }
      .tl-collapse .tl-list {
        margin-top: 10px;
      }
      .tl-row-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .tl-meta,
      .tl-empty {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
      }
      .tl-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tl-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tl-field input,
      .tl-field select {
        width: 100%;
        box-sizing: border-box;
      }
      .tl-inline {
        display: flex;
        gap: 8px;
      }
      .tl-inline input {
        flex: 1;
        min-width: 0;
      }
      .tl-check {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .tl-error {
        color: var(--color-danger, #c00);
      }
    `,
  ],
})
export class TablesLobbyComponent implements OnInit {
  readonly app = AppComponent;
  t: TablesTexts = tablesTexts('en');
  lb: LeaderboardTexts = leaderboardTexts('en');
  rtl = false;
  loading = true;
  busy = false;
  error: string | null = null;
  open: TableSummary[] = [];
  mine: TableSummary[] = [];
  recent: TableSummary[] = [];
  nickname = accountName();
  code = '';
  /** The open tables list is as high as its first five rows; the rest scrolls (null: five or fewer, no limit). */
  openListMax: number | null = null;
  @ViewChild('openList') private openList?: ElementRef<HTMLElement>;

  @HostListener('window:resize')
  fitOpenList(): void {
    // measured, because a row is two to four lines high depending on the width of the screen
    setTimeout(() => {
      const list = this.openList?.nativeElement;
      const rows = list ? Array.from(list.querySelectorAll<HTMLElement>(':scope > .tl-row')) : [];
      const before = this.openListMax;
      this.openListMax =
        list && rows.length > 5
          ? Math.ceil(rows[4].getBoundingClientRect().bottom - list.getBoundingClientRect().top)
          : null;
      if (before !== this.openListMax) this.cdr.markForCheck();
    });
  }

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
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.t = tablesTexts(lang);
    this.lb = leaderboardTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
    // the add-table panel can change the app's language (the table's flag): the lobby follows
    this.translate.onLangChange.subscribe((event) => {
      this.t = tablesTexts(event.lang);
      this.lb = leaderboardTexts(event.lang);
      this.rtl = event.lang === 'ar';
      this.cdr.markForCheck();
    });
    this.reload();
  }

  /** The flag of a table's language, for the lists. */
  flagOf(code: string | undefined): string {
    return (APP_LANGUAGES.find((lang) => lang.code === code) ?? APP_LANGUAGES[0]).flag;
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

  /** Takes a table off my list. */
  forget(table: TableSummary): void {
    this.api.forget(table.id).subscribe({
      next: () => this.reload(),
      error: (e) => this.fail(e),
    });
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
    let pending = 3;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        this.loading = false;
        this.cdr.markForCheck();
        // the rows are drawn after this: then the first five are measured
        setTimeout(() => this.fitOpenList());
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
    this.api.list('recent').subscribe({
      next: (r) => {
        this.recent = r.items;
        done();
      },
      error: () => done(),
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
  }

  describe(table: TableSummary): string {
    const parts = [`${table.seatsTaken}/${table.maxSeats} ${this.t.seatsOf}`];
    if (table.ranked) parts.push(this.t.rankedBadge);
    switch (table.clock.mode) {
      case 'per-move':
        parts.push(`${table.clock['secondsPerMove']}${this.t.perMove}`);
        break;
      case 'bank':
        parts.push(`${table.clock['bankSeconds']}${this.t.bank}`);
        break;
      case 'daily':
        parts.push(`${table.clock['hoursPerMove']}${this.t.daily}`);
        break;
      default:
        parts.push(this.t.noClock);
    }
    const phase: Record<string, string> = {
      lobby: this.t.waiting,
      picking: this.t.waiting,
      playing: this.t.playing,
      paused: this.t.playing,
      finished: this.t.finished,
      closed: this.t.closed,
    };
    parts.push(phase[table.phase] ?? table.phase);
    return parts.join(' · ');
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
