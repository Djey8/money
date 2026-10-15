import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TablesApiService, type CreateTableInput, type TableSummary } from './tables-api.service';
import { tablesTexts, type TablesTexts } from './tables.texts';

const NICKNAME_KEY = 'mm.tables.nickname';

function savedNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberNickname(name: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, name);
  } catch {
    // a convenience only
  }
}

/**
 * The lobby of the multiplayer Cashflow tables (todo/cashflow-multiplayer.md phase U1): the open tables to sit at, the ones
 * you are in, a form to open your own, and joining by invite code. Self-hosted game accounts only - reachable only through
 * the route in app.routes.selfhosted.ts; the backend refuses any other account (403 not_a_game_account).
 */
@Component({
  selector: 'app-tables-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tl-page" [attr.dir]="rtl ? 'rtl' : 'ltr'">
      <header class="tl-head">
        <h2>🎲 {{ t.title }}</h2>
        <span class="tl-head-actions">
          <a class="btn" routerLink="/docs/cashflow" [title]="t.howItWorks">ⓘ {{ t.howItWorks }}</a>
          <button class="btn" type="button" (click)="reload()">{{ t.refresh }}</button>
        </span>
      </header>

      <p class="tl-error" *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="loading">{{ t.loading }}</p>

      <section class="tl-card" *ngIf="mine.length">
        <h3>{{ t.myTables }}</h3>
        <ul class="tl-list">
          <li *ngFor="let table of mine" class="tl-row">
            <div class="tl-row-main">
              <strong>{{ table.name }}</strong>
              <span class="tl-meta">{{ describe(table) }}</span>
            </div>
            <a class="btn btn--primary" [routerLink]="['/tables', table.id]">{{ t.open }}</a>
          </li>
        </ul>
      </section>

      <section class="tl-card">
        <h3>{{ t.openTables }}</h3>
        <p *ngIf="!loading && !open.length" class="tl-empty">{{ t.noOpen }}</p>
        <ul class="tl-list">
          <li *ngFor="let table of open" class="tl-row">
            <div class="tl-row-main">
              <strong>{{ table.name }}</strong>
              <span class="tl-meta"
                >{{ t.host }}: {{ table.hostName }} · {{ describe(table) }}</span
              >
            </div>
            <button
              class="btn btn--primary"
              type="button"
              [disabled]="busy || !nickname.trim()"
              (click)="join({ roomId: table.id })"
            >
              {{ t.join }}
            </button>
          </li>
        </ul>
      </section>

      <section class="tl-card">
        <label class="tl-field">
          <span>{{ t.nickname }}</span>
          <input type="text" maxlength="24" [(ngModel)]="nickname" (ngModelChange)="remember()" />
        </label>
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
            class="btn"
            type="button"
            [disabled]="busy || !code.trim() || !nickname.trim()"
            (click)="join({ code: code.trim().toUpperCase() })"
          >
            {{ t.join }}
          </button>
        </div>
      </section>

      <section class="tl-card">
        <h3>{{ t.createTitle }}</h3>
        <form (ngSubmit)="create()" class="tl-form">
          <label class="tl-field">
            <span>{{ t.tableName }}</span>
            <input type="text" name="name" maxlength="40" [(ngModel)]="form.name" required />
          </label>
          <label class="tl-field">
            <span>{{ t.seats }}</span>
            <input type="number" name="seats" min="2" max="12" [(ngModel)]="form.maxSeats" />
          </label>
          <label class="tl-field">
            <span>{{ t.visibility }}</span>
            <select name="visibility" [(ngModel)]="form.visibility">
              <option value="public">{{ t.public }}</option>
              <option value="private">{{ t.private }}</option>
            </select>
          </label>
          <label class="tl-field">
            <span>{{ t.clock }}</span>
            <select name="clock" [(ngModel)]="form.clock">
              <option value="none">{{ t.clockNone }}</option>
              <option value="per-move">{{ t.clockMove }}</option>
              <option value="bank">{{ t.clockBank }}</option>
            </select>
          </label>
          <label class="tl-field" *ngIf="form.clock === 'per-move'">
            <span>{{ t.clockMove }}</span>
            <input type="number" name="secs" min="10" max="3600" [(ngModel)]="form.seconds" />
          </label>
          <label class="tl-field" *ngIf="form.clock === 'bank'">
            <span>{{ t.clockBank }}</span>
            <input type="number" name="bank" min="60" max="14400" [(ngModel)]="form.bankSeconds" />
          </label>
          <label class="tl-field">
            <span>{{ t.endCondition }}</span>
            <select name="end" [(ngModel)]="form.endCondition">
              <option value="first-escape">{{ t.endFirst }}</option>
              <option value="all-done">{{ t.endAll }}</option>
              <option value="round-limit">{{ t.endRounds }}</option>
            </select>
          </label>
          <label class="tl-field" *ngIf="form.endCondition === 'round-limit'">
            <span>{{ t.roundLimit }}</span>
            <input type="number" name="rounds" min="1" max="1000" [(ngModel)]="form.roundLimit" />
          </label>
          <label class="tl-field">
            <span>{{ t.professions }}</span>
            <select name="professions" [(ngModel)]="form.professions">
              <option value="duplicates">{{ t.profDup }}</option>
              <option value="unique">{{ t.profUnique }}</option>
              <option value="random">{{ t.profRandom }}</option>
            </select>
          </label>
          <label class="tl-check">
            <input type="checkbox" name="spectators" [(ngModel)]="form.spectators" />
            <span>{{ t.spectators }}</span>
          </label>
          <button
            class="btn btn--primary"
            type="submit"
            [disabled]="busy || !form.name.trim() || !nickname.trim()"
          >
            {{ t.create }}
          </button>
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .tl-page {
        max-width: 720px;
        margin: 0 auto;
        padding: 16px;
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
      .tl-head-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
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
      .tl-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
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
  t: TablesTexts = tablesTexts('en');
  rtl = false;
  loading = true;
  busy = false;
  error: string | null = null;
  open: TableSummary[] = [];
  mine: TableSummary[] = [];
  nickname = savedNickname();
  code = '';
  form = {
    name: '',
    maxSeats: 6,
    visibility: 'public' as 'public' | 'private',
    clock: 'none' as 'none' | 'per-move' | 'bank',
    seconds: 60,
    bankSeconds: 600,
    endCondition: 'first-escape' as 'first-escape' | 'all-done' | 'round-limit',
    roundLimit: 10,
    professions: 'duplicates' as 'duplicates' | 'unique' | 'random',
    spectators: false,
  };

  constructor(
    private api: TablesApiService,
    private router: Router,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.t = tablesTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
    this.reload();
  }

  remember(): void {
    rememberNickname(this.nickname.trim());
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
        this.open = r.items.filter((table) => !table.joined);
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
  }

  describe(table: TableSummary): string {
    const parts = [`${table.seatsTaken}/${table.maxSeats} ${this.t.seatsOf}`];
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
    this.api.join(target, this.nickname.trim()).subscribe({
      next: (room) => this.enter(room.id ?? target.roomId),
      error: (e) => {
        this.busy = false;
        this.fail(e);
        this.cdr.markForCheck();
      },
    });
  }

  create(): void {
    const f = this.form;
    const clock: CreateTableInput['settings']['clock'] =
      f.clock === 'per-move'
        ? { mode: 'per-move', secondsPerMove: f.seconds }
        : f.clock === 'bank'
          ? { mode: 'bank', bankSeconds: f.bankSeconds, incrementSeconds: 0 }
          : { mode: 'none' };
    const input: CreateTableInput = {
      nickname: this.nickname.trim(),
      language: (this.translate.currentLang || 'en').slice(0, 2),
      settings: {
        name: f.name.trim(),
        visibility: f.visibility,
        maxSeats: f.maxSeats,
        professions: f.professions,
        clock,
        endCondition: f.endCondition,
        ...(f.endCondition === 'round-limit' ? { roundLimit: f.roundLimit } : {}),
        spectators: f.spectators,
      },
    };
    this.busy = true;
    this.error = null;
    this.api.create(input).subscribe({
      next: (room) => this.enter(room.id),
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

  private fail(e: { status?: number; error?: { detail?: string }; message?: string }): void {
    this.error =
      e?.status === 403 ? this.t.notGame : (e?.error?.detail ?? e?.message ?? this.t.failed);
    this.cdr.markForCheck();
  }
}
