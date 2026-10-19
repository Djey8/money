import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TablesApiService, type CreateTableInput } from './tables-api.service';
import { ProfileComponent } from '../panels/profile/profile.component';
import { tablesTexts, type TablesTexts } from './tables.texts';
import {
  APP_LANGUAGES,
  LanguageService,
  type AppLanguage,
} from '../shared/services/language.service';
import { problemText } from './problem.texts';
import { defaultInitials, saveInitials, savedInitials } from './token-initials';

/** The account's own name: the one name at every table (the server uses the account's nickname whatever is sent). */
function accountName(): string {
  const name = ProfileComponent.username;
  return name && name !== 'Username' ? name.slice(0, 24) : 'Player';
}

/**
 * The panel that opens a table (JFK, 2026-10-18): all the settings of a new table, opened with the plus button of the lobby's
 * toolbar - so the lobby itself stays a short list. Self-hosted game accounts only, like the lobby that hosts it.
 */
@Component({
  selector: 'app-add-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tables.css'],
  template: `
    <div class="at-backdrop" role="dialog" aria-modal="true" [attr.aria-label]="t.createTitle">
      <div class="at-panel" [attr.dir]="rtl ? 'rtl' : 'ltr'">
        <header class="at-head">
          <h2>{{ t.createTitle }}</h2>
          <button type="button" class="at-close" [attr.aria-label]="t.back" (click)="closed.emit()">
            ×
          </button>
        </header>
        <p class="at-error" *ngIf="error" role="alert">{{ error }}</p>
        <form (ngSubmit)="create()" class="tl-form">
          <label class="tl-field">
            <span>{{ t.tableName }}</span>
            <input type="text" name="name" maxlength="40" [(ngModel)]="form.name" required />
          </label>
          <label class="tl-field">
            <span>{{ t.initials }}</span>
            <input
              type="text"
              name="initials"
              maxlength="2"
              class="at-initials"
              [(ngModel)]="initials"
              [placeholder]="defaultLetters"
            />
            <small class="tl-meta">{{ t.initialsHint }}</small>
          </label>
          <div class="tl-field">
            <span>{{ t.tableLanguage }}</span>
            <div class="tl-flags" role="radiogroup" [attr.aria-label]="t.tableLanguage">
              <button
                *ngFor="let lang of languages"
                type="button"
                role="radio"
                class="tl-flag"
                [class.tl-flag--on]="form.language === lang.code"
                [attr.aria-checked]="form.language === lang.code"
                [title]="lang.name"
                (click)="chooseLanguage(lang.code)"
              >
                <img [src]="lang.flag" [alt]="lang.name" width="32" />
              </button>
            </div>
          </div>
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
          <label class="tl-field">
            <span>{{ t.pace }}</span>
            <select name="pace" [(ngModel)]="form.pace">
              <option value="fast">{{ t.paceFast }}</option>
              <option value="normal">{{ t.paceNormal }}</option>
              <option value="slow">{{ t.paceSlow }}</option>
            </select>
          </label>
          <label class="tl-check">
            <input type="checkbox" name="turnGate" [(ngModel)]="form.turnGate" />
            <span>{{ t.turnGate }}</span>
          </label>
          <label class="tl-field">
            <span>{{ t.offerRolls }}</span>
            <select name="offerRolls" [(ngModel)]="form.offerRolls">
              <option [ngValue]="1">1</option>
              <option [ngValue]="2">2</option>
              <option [ngValue]="3">3</option>
              <option [ngValue]="4">4</option>
              <option [ngValue]="6">6</option>
            </select>
          </label>
          <label class="tl-check">
            <input type="checkbox" name="ranked" [(ngModel)]="form.ranked" />
            <span>{{ t.ranked }}</span>
          </label>
          <label class="tl-check">
            <input type="checkbox" name="showProgress" [(ngModel)]="form.showProgress" />
            <span>{{ t.showProgress }}</span>
          </label>
          <label class="tl-check">
            <input type="checkbox" name="repayOffTurn" [(ngModel)]="form.repayOffTurn" />
            <span>{{ t.repayOffTurn }}</span>
          </label>
          <label class="tl-check">
            <input type="checkbox" name="allowUndo" [(ngModel)]="form.allowUndo" />
            <span>{{ t.allowUndo }}</span>
          </label>
          <button
            class="tx-btn tx-btn--primary"
            type="submit"
            [disabled]="busy || !form.name.trim()"
          >
            {{ t.create }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .at-backdrop {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow-y: auto;
        padding: 16px 16px calc(var(--page-bottom-spacer, 72px) + 28px);
        background: rgba(0, 0, 0, 0.45);
      }
      .at-panel {
        width: 100%;
        max-width: 560px;
        box-sizing: border-box;
        padding: 16px;
        border-radius: 12px;
        background: var(--color-surface, #fff);
        color: var(--color-text, #222);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }
      .at-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .at-head h2 {
        margin: 0;
      }
      .at-close {
        border: 0;
        background: transparent;
        color: inherit;
        font-size: 1.8rem;
        line-height: 1;
        padding: 0 8px;
        cursor: pointer;
      }
      .at-initials {
        width: 5rem !important;
        text-transform: uppercase;
        text-align: center;
      }
      .at-error {
        color: var(--color-danger, #c00);
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
      .tl-check {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .tl-meta {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
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
    `,
  ],
})
export class AddTableComponent implements OnInit {
  /** The id of the table that was opened. */
  @Output() created = new EventEmitter<string | undefined>();
  @Output() closed = new EventEmitter<void>();

  t: TablesTexts = tablesTexts('en');
  rtl = false;
  busy = false;
  error: string | null = null;
  readonly languages = APP_LANGUAGES;
  readonly nickname = accountName();
  initials = savedInitials();
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
    allowUndo: true,
    repayOffTurn: true,
    turnGate: true,
    showProgress: true,
    ranked: true,
    language: 'en',
    offerRolls: 3,
    pace: 'normal' as 'fast' | 'normal' | 'slow',
  };

  constructor(
    private api: TablesApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private languageService: LanguageService,
  ) {}

  get defaultLetters(): string {
    return defaultInitials(this.nickname);
  }

  ngOnInit(): void {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.t = tablesTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
    this.form.language = lang.slice(0, 2) === 'zh' ? 'cn' : lang.slice(0, 2);
  }

  /** The table's language is chosen with its flag - and the app speaks it from that moment. */
  chooseLanguage(code: string): void {
    this.form.language = code;
    void this.languageService.use(code as AppLanguage['code']).then(() => {
      this.t = tablesTexts(code);
      this.rtl = code === 'ar';
      this.cdr.markForCheck();
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
    const letters = saveInitials(this.initials);
    const input: CreateTableInput = {
      nickname: this.nickname.trim(),
      ...(letters ? { initials: letters } : {}),
      language: this.form.language,
      settings: {
        name: f.name.trim(),
        visibility: f.visibility,
        maxSeats: f.maxSeats,
        professions: f.professions,
        clock,
        endCondition: f.endCondition,
        ...(f.endCondition === 'round-limit' ? { roundLimit: f.roundLimit } : {}),
        spectators: f.spectators,
        allowRewind: f.allowUndo,
        repayOffTurn: f.repayOffTurn,
        turnGate: f.turnGate,
        pace: f.pace,
        showProgress: f.showProgress,
        ranked: f.ranked,
        rules: { sellOfferRolls: f.offerRolls },
      },
    };
    this.busy = true;
    this.error = null;
    this.api.create(input).subscribe({
      next: (room) => {
        this.busy = false;
        this.created.emit(room.id);
      },
      error: (e) => {
        this.busy = false;
        const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
        this.error =
          e?.status === 403
            ? this.t.notGame
            : (problemText(lang, e?.error?.code, e?.error?.detail) ?? e?.message ?? this.t.failed);
        this.cdr.markForCheck();
      },
    });
  }
}
