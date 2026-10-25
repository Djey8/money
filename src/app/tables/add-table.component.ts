import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import type { TableView } from '@money/domain';
import { TablesApiService, type CreateTableInput } from './tables-api.service';
import { ProfileComponent } from '../panels/profile/profile.component';
import { tablesTexts, type TablesTexts } from './tables.texts';
import { addTableTexts, type AddTableTexts } from './add-table.texts';
import { hallTexts, type HallTexts } from './hall.texts';
import { WheelPickerComponent } from './wheel-picker.component';
import {
  APP_LANGUAGES,
  GAME_LANGUAGES,
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
  imports: [CommonModule, FormsModule, WheelPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tables.css'],
  template: `
    <div
      class="at-backdrop"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="existing ? h.settingsEdit : a.title"
    >
      <div class="at-panel" [attr.dir]="rtl ? 'rtl' : 'ltr'">
        <header class="at-head">
          <h2>{{ existing ? h.settingsEdit : a.title }}</h2>
          <button type="button" class="at-close" [attr.aria-label]="t.back" (click)="closed.emit()">
            ×
          </button>
        </header>
        <p class="at-error" *ngIf="error || problem" role="alert">{{ error || problem }}</p>
        <p class="at-note" *ngIf="existing">{{ h.settingsResetNote }}</p>
        <form (ngSubmit)="create()" class="at-form">
          <!-- the table -->
          <section class="at-group">
            <h3>{{ a.groupTable }}</h3>
            <div class="at-row">
              <div class="at-label">
                <strong>{{ a.name }}</strong>
                <small>{{ a.nameHint }}</small>
              </div>
              <div class="at-name">
                <input
                  type="text"
                  name="name"
                  maxlength="40"
                  [(ngModel)]="form.name"
                  [placeholder]="suggestion"
                  [attr.aria-label]="a.name"
                />
                <button
                  type="button"
                  class="at-dice"
                  [title]="a.nameAgain"
                  [attr.aria-label]="a.nameAgain"
                  (click)="nextSuggestion()"
                >
                  🎲
                </button>
              </div>
            </div>
            <div class="at-row" *ngIf="!existing">
              <div class="at-label">
                <strong>{{ a.language }}</strong>
                <small>{{ a.languageHint }}</small>
              </div>
              <div class="tl-flags" role="radiogroup" [attr.aria-label]="a.language">
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
            <div class="at-row" *ngIf="!existing">
              <div class="at-label">
                <strong>{{ a.initials }}</strong>
                <small>{{ a.initialsHint }}</small>
              </div>
              <input
                type="text"
                name="initials"
                maxlength="2"
                class="at-initials"
                [(ngModel)]="initials"
                [placeholder]="defaultLetters"
                [attr.aria-label]="a.initials"
              />
            </div>
            <div class="at-row">
              <div class="at-label">
                <strong>{{ a.seats }}</strong>
                <small>{{ a.seatsHint }}</small>
              </div>
              <app-wheel-picker
                [options]="seatOptions"
                [(value)]="form.maxSeats"
                [min]="2"
                [max]="24"
                [label]="a.seats"
                [otherLabel]="a.otherNumber"
                [ownLabel]="a.ownNumber"
              ></app-wheel-picker>
            </div>
            <div class="at-row at-row--stack">
              <div class="at-label">
                <strong>{{ a.visibility }}</strong>
                <small>{{ a.visibilityHint }}</small>
              </div>
              <div class="at-seg" role="radiogroup" [attr.aria-label]="a.visibility">
                <button
                  *ngFor="let option of visibilityOptions(); trackBy: trackValue"
                  type="button"
                  role="radio"
                  [class.at-seg--on]="form.visibility === option.value"
                  [attr.aria-checked]="form.visibility === option.value"
                  (click)="form.visibility = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </section>

          <!-- the game -->
          <section class="at-group">
            <h3>{{ a.groupGame }}</h3>
            <div class="at-row">
              <div class="at-label">
                <strong>{{ a.ranked }}</strong>
                <small>{{ a.rankedHint }}</small>
              </div>
              <label class="at-switch">
                <input
                  type="checkbox"
                  name="ranked"
                  [(ngModel)]="form.ranked"
                  [attr.aria-label]="a.ranked"
                />
                <span class="at-switch-track"></span>
              </label>
            </div>
            <div class="at-row at-row--stack">
              <div class="at-label">
                <strong>{{ a.endCondition }}</strong>
                <small>{{ endHint() }}</small>
              </div>
              <div class="at-seg" role="radiogroup" [attr.aria-label]="a.endCondition">
                <button
                  *ngFor="let option of endOptions(); trackBy: trackValue"
                  type="button"
                  role="radio"
                  [class.at-seg--on]="form.endCondition === option.value"
                  [attr.aria-checked]="form.endCondition === option.value"
                  (click)="form.endCondition = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div class="at-row" *ngIf="form.endCondition === 'round-limit'">
              <div class="at-label">
                <strong>{{ a.rounds }}</strong>
              </div>
              <app-wheel-picker
                [options]="roundOptions"
                [(value)]="form.roundLimit"
                [min]="1"
                [max]="1000"
                [label]="a.rounds"
                [otherLabel]="a.otherNumber"
                [ownLabel]="a.ownNumber"
              ></app-wheel-picker>
            </div>
            <div class="at-row at-row--stack">
              <div class="at-label">
                <strong>{{ a.professions }}</strong>
                <small>{{ professionHint() }}</small>
              </div>
              <div class="at-seg" role="radiogroup" [attr.aria-label]="a.professions">
                <button
                  *ngFor="let option of professionOptions(); trackBy: trackValue"
                  type="button"
                  role="radio"
                  [class.at-seg--on]="form.professions === option.value"
                  [attr.aria-checked]="form.professions === option.value"
                  (click)="form.professions = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </section>

          <!-- time -->
          <section class="at-group">
            <h3>{{ a.groupTime }}</h3>
            <div class="at-row at-row--stack">
              <div class="at-label">
                <strong>{{ a.clock }}</strong>
                <small>{{ clockHint() }}</small>
              </div>
              <div class="at-seg" role="radiogroup" [attr.aria-label]="a.clock">
                <button
                  *ngFor="let option of clockOptions(); trackBy: trackValue"
                  type="button"
                  role="radio"
                  [class.at-seg--on]="form.clock === option.value"
                  [attr.aria-checked]="form.clock === option.value"
                  (click)="form.clock = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div class="at-row" *ngIf="form.clock === 'per-move'">
              <div class="at-label">
                <strong>{{ a.seconds }}</strong>
              </div>
              <app-wheel-picker
                [options]="moveSecondOptions"
                [(value)]="form.seconds"
                [min]="10"
                [max]="3600"
                [unit]="a.unitSeconds"
                [label]="a.seconds"
                [otherLabel]="a.otherNumber"
                [ownLabel]="a.ownNumber"
              ></app-wheel-picker>
            </div>
            <div class="at-row" *ngIf="form.clock === 'bank'">
              <div class="at-label">
                <strong>{{ a.seconds }}</strong>
              </div>
              <app-wheel-picker
                [options]="bankSecondOptions"
                [(value)]="form.bankSeconds"
                [min]="60"
                [max]="14400"
                [unit]="a.unitSeconds"
                [label]="a.seconds"
                [otherLabel]="a.otherNumber"
                [ownLabel]="a.ownNumber"
              ></app-wheel-picker>
            </div>
            <div class="at-row at-row--stack">
              <div class="at-label">
                <strong>{{ a.pace }}</strong>
                <small>{{ a.paceHint }}</small>
              </div>
              <div class="at-seg" role="radiogroup" [attr.aria-label]="a.pace">
                <button
                  *ngFor="let option of paceOptions(); trackBy: trackValue"
                  type="button"
                  role="radio"
                  [class.at-seg--on]="form.pace === option.value"
                  [attr.aria-checked]="form.pace === option.value"
                  (click)="form.pace = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </section>

          <!-- the rules of play: only on demand, so the panel stays short -->
          <button
            type="button"
            class="at-advanced"
            [attr.aria-expanded]="showAdvanced"
            (click)="showAdvanced = !showAdvanced"
          >
            <span>{{ showAdvanced ? '▾' : '▸' }} {{ a.advanced }}</span>
            <small>{{ a.advancedHint }}</small>
          </button>
          <section class="at-group" *ngIf="showAdvanced">
            <h3>{{ a.groupRules }}</h3>
            <div class="at-row" *ngFor="let rule of switches(); trackBy: trackRule">
              <div class="at-label">
                <strong>{{ rule.title }}</strong>
                <small>{{ rule.hint }}</small>
              </div>
              <label class="at-switch">
                <input
                  type="checkbox"
                  [name]="rule.key"
                  [checked]="rule.on"
                  (change)="toggle(rule.key)"
                  [attr.aria-label]="rule.title"
                />
                <span class="at-switch-track"></span>
              </label>
            </div>
            <div class="at-row" *ngIf="form.ranked">
              <div class="at-label">
                <strong>{{ a.leaveFree }}</strong>
                <small>{{ a.leaveFreeHint }}</small>
              </div>
              <app-wheel-picker
                [options]="leaveOptions"
                [(value)]="form.leaveFreeRounds"
                [min]="0"
                [max]="3"
                [label]="a.leaveFree"
                [otherLabel]="a.otherNumber"
                [ownLabel]="a.ownNumber"
              ></app-wheel-picker>
            </div>
            <div class="at-row">
              <div class="at-label">
                <strong>{{ a.offerRolls }}</strong>
                <small>{{ a.offerRollsHint }}</small>
              </div>
              <app-wheel-picker
                [options]="offerOptions"
                [(value)]="form.offerRolls"
                [min]="1"
                [max]="12"
                [label]="a.offerRolls"
                [otherLabel]="a.otherNumber"
                [ownLabel]="a.ownNumber"
              ></app-wheel-picker>
            </div>
          </section>

          <button class="tx-btn tx-btn--primary at-open" type="submit" [disabled]="busy">
            {{ existing ? h.settingsSave : a.open }}
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
        padding: 16px 12px calc(var(--page-bottom-spacer, 72px) + 28px);
        background: rgba(0, 0, 0, 0.5);
      }
      .at-panel {
        width: 100%;
        max-width: 580px;
        box-sizing: border-box;
        padding: 14px 14px 18px;
        border-radius: 14px;
        background: var(--color-surface, #fff);
        color: var(--color-text, #222);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }
      .at-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
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
      .at-error {
        color: var(--color-danger, #c00);
      }
      .at-note {
        margin: 0 0 8px;
        font-size: 0.85rem;
        opacity: 0.75;
      }
      .at-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .at-group {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-background, #f6f7f9);
        overflow: hidden;
      }
      .at-group h3 {
        margin: 0;
        padding: 8px 12px;
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      /* one setting: what it is and what it does on the left, how to set it on the right */
      .at-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-top: 1px solid var(--color-border, #e3e6ea);
      }
      .at-row--stack {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .at-label {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        flex: 1 1 10rem;
      }
      .at-row--stack .at-label {
        flex: 0 0 auto;
      }
      .at-label small {
        opacity: 0.7;
        font-size: 0.82rem;
        line-height: 1.25;
      }
      .at-name {
        display: flex;
        gap: 6px;
        flex: 1 1 12rem;
        max-width: 20rem;
      }
      .at-name input {
        flex: 1 1 auto;
        min-width: 0;
      }
      .at-dice {
        border: 1px solid var(--color-border, #ccc);
        background: var(--color-surface, #fff);
        border-radius: 8px;
        padding: 0 10px;
        font-size: 1.2rem;
        cursor: pointer;
      }
      .at-initials {
        width: 5rem;
        text-transform: uppercase;
        text-align: center;
      }
      .at-seg {
        display: flex;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-surface, #fff);
      }
      .at-seg button {
        flex: 1 1 0;
        min-width: 0;
        padding: 9px 6px;
        border: 0;
        border-inline-start: 1px solid var(--color-border, #ddd);
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .at-seg button:first-child {
        border-inline-start: 0;
      }
      .at-seg .at-seg--on {
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-weight: 600;
      }
      /* an on/off switch */
      .at-switch {
        position: relative;
        display: inline-block;
        width: 46px;
        height: 26px;
        flex: none;
      }
      .at-switch input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        margin: 0;
      }
      .at-switch-track {
        position: absolute;
        inset: 0;
        border-radius: 13px;
        background: #b8bec7;
        transition: background 0.15s;
        pointer-events: none;
      }
      .at-switch-track::after {
        content: '';
        position: absolute;
        top: 3px;
        inset-inline-start: 3px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.15s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      .at-switch input:checked + .at-switch-track {
        background: var(--color-primary, #2a7de1);
      }
      .at-switch input:checked + .at-switch-track::after {
        transform: translateX(20px);
      }
      .at-advanced {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        width: 100%;
        padding: 10px 12px;
        border: 1px dashed var(--color-border, #bbb);
        border-radius: 12px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .at-advanced span {
        font-weight: 600;
      }
      .at-advanced small {
        opacity: 0.7;
      }
      .at-open {
        padding: 12px;
        font-size: 1.05rem;
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
      }
      .tl-flag--on {
        border-color: var(--color-primary, #1976d2);
        opacity: 1;
      }
      @media (max-width: 480px) {
        .at-row {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class AddTableComponent implements OnInit {
  /** The id of the table that was opened. */
  @Output() created = new EventEmitter<string | undefined>();
  @Output() closed = new EventEmitter<void>();
  /** The settings of a table that is still in its lobby: the host changes them with this same panel. */
  @Input() existing: TableView['settings'] | null = null;
  /** The changed settings (existing tables only); the caller sends them to the table. */
  @Output() saved = new EventEmitter<Record<string, unknown>>();
  /** Why the table refused the changed settings (shown in the panel, which stays open). */
  @Input() problem: string | null = null;

  t: TablesTexts = tablesTexts('en');
  a: AddTableTexts = addTableTexts('en');
  h: HallTexts = hallTexts('en');
  /** The rules of play are only shown on demand. */
  showAdvanced = false;
  /** The table name that is used when none is typed - a fresh one with the dice. */
  suggestion = '';
  private suggestionIndex = 0;
  readonly seatOptions = [2, 3, 4, 5, 6, 7, 8, 10, 12];
  readonly roundOptions = [5, 8, 10, 15, 20, 30, 50];
  readonly moveSecondOptions = [15, 30, 45, 60, 90, 120, 180];
  readonly bankSecondOptions = [300, 600, 900, 1200, 1800, 3600];
  readonly leaveOptions = [0, 1, 2, 3];
  readonly offerOptions = [1, 2, 3, 4, 6];
  rtl = false;
  busy = false;
  error: string | null = null;
  readonly languages = GAME_LANGUAGES;
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
    leaveFreeRounds: 0,
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
    this.a = addTableTexts(lang);
    this.h = hallTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
    if (this.existing) this.fillFrom(this.existing);
    const own = lang.slice(0, 2) === 'zh' ? 'cn' : lang.slice(0, 2);
    // only the languages the game is offered in; anything else starts as English
    this.form.language = GAME_LANGUAGES.some((game) => game.code === own) ? own : 'en';
    this.suggestionIndex = Math.floor(Math.random() * this.a.suggestions.length);
    this.suggestion = this.a.suggestions[this.suggestionIndex];
  }

  /** Another name for the table, from a short list. */
  nextSuggestion(): void {
    this.suggestionIndex = (this.suggestionIndex + 1) % this.a.suggestions.length;
    this.suggestion = this.a.suggestions[this.suggestionIndex];
    this.form.name = '';
  }

  /** The options are made again on every check: told apart by what they are, or the buttons are drawn again under the press. */
  trackValue = (_index: number, option: { value: string }): string => option.value;
  trackRule = (_index: number, rule: { key: string }): string => rule.key;

  visibilityOptions() {
    return [
      { value: 'public' as const, label: this.a.public },
      { value: 'private' as const, label: this.a.private },
    ];
  }
  endOptions() {
    return [
      { value: 'first-escape' as const, label: this.a.endFirst },
      { value: 'all-done' as const, label: this.a.endAll },
      { value: 'round-limit' as const, label: this.a.endRounds },
    ];
  }
  endHint(): string {
    return this.form.endCondition === 'first-escape'
      ? this.a.endFirstHint
      : this.form.endCondition === 'all-done'
        ? this.a.endAllHint
        : this.a.endRoundsHint;
  }
  professionOptions() {
    return [
      { value: 'duplicates' as const, label: this.a.profFree },
      { value: 'unique' as const, label: this.a.profUnique },
      { value: 'random' as const, label: this.a.profRandom },
    ];
  }
  professionHint(): string {
    return this.form.professions === 'duplicates'
      ? this.a.profFreeHint
      : this.form.professions === 'unique'
        ? this.a.profUniqueHint
        : this.a.profRandomHint;
  }
  clockOptions() {
    return [
      { value: 'none' as const, label: this.a.clockNone },
      { value: 'per-move' as const, label: this.a.clockMove },
      { value: 'bank' as const, label: this.a.clockBank },
    ];
  }
  clockHint(): string {
    return this.form.clock === 'none'
      ? this.a.clockNoneHint
      : this.form.clock === 'per-move'
        ? this.a.clockMoveHint
        : this.a.clockBankHint;
  }
  paceOptions() {
    return [
      { value: 'fast' as const, label: this.a.paceFast },
      { value: 'normal' as const, label: this.a.paceNormal },
      { value: 'slow' as const, label: this.a.paceSlow },
    ];
  }

  /** The on/off rules, each with what it does in one line. */
  switches() {
    const f = this.form;
    return [
      {
        key: 'turnGate' as const,
        on: f.turnGate,
        title: this.a.turnGate,
        hint: this.a.turnGateHint,
      },
      {
        key: 'spectators' as const,
        on: f.spectators,
        title: this.a.spectators,
        hint: this.a.spectatorsHint,
      },
      {
        key: 'showProgress' as const,
        on: f.showProgress,
        title: this.a.showProgress,
        hint: this.a.showProgressHint,
      },
      {
        key: 'allowUndo' as const,
        on: f.allowUndo,
        title: this.a.allowUndo,
        hint: this.a.allowUndoHint,
      },
      {
        key: 'repayOffTurn' as const,
        on: f.repayOffTurn,
        title: this.a.repayOffTurn,
        hint: this.a.repayOffTurnHint,
      },
    ];
  }
  toggle(key: 'turnGate' | 'spectators' | 'showProgress' | 'allowUndo' | 'repayOffTurn'): void {
    this.form[key] = !this.form[key];
  }

  /** The table's language is chosen with its flag - and the app speaks it from that moment. */
  chooseLanguage(code: string): void {
    this.form.language = code;
    void this.languageService.use(code as AppLanguage['code']).then(() => {
      this.t = tablesTexts(code);
      this.a = addTableTexts(code);
      this.suggestion = this.a.suggestions[this.suggestionIndex % this.a.suggestions.length];
      this.rtl = code === 'ar';
      this.cdr.markForCheck();
    });
  }

  /** The form as the settings a table takes (opening a table, or changing one in its lobby). */
  private settings(): CreateTableInput['settings'] {
    const f = this.form;
    const clock: CreateTableInput['settings']['clock'] =
      f.clock === 'per-move'
        ? { mode: 'per-move', secondsPerMove: f.seconds }
        : f.clock === 'bank'
          ? { mode: 'bank', bankSeconds: f.bankSeconds, incrementSeconds: 0 }
          : { mode: 'none' };
    return {
      name: (f.name.trim() || this.suggestion).slice(0, 40),
      visibility: f.visibility,
      maxSeats: f.maxSeats,
      professions: f.professions,
      clock,
      endCondition: f.endCondition,
      ...(f.endCondition === 'round-limit' ? { roundLimit: f.roundLimit } : {}),
      spectators: f.spectators,
      allowRewind: f.allowUndo,
      repayOffTurn: f.repayOffTurn,
      leaveFreeRounds: f.leaveFreeRounds,
      turnGate: f.turnGate,
      pace: f.pace,
      showProgress: f.showProgress,
      ranked: f.ranked,
      rules: { sellOfferRolls: f.offerRolls },
    };
  }

  /** The panel shows the settings the table has now. */
  private fillFrom(current: TableView['settings']): void {
    const f = this.form;
    f.name = current.name;
    f.maxSeats = current.maxSeats;
    f.visibility = current.visibility;
    f.professions = current.professions;
    f.endCondition = current.endCondition;
    if (current.roundLimit) f.roundLimit = current.roundLimit;
    f.spectators = current.spectators;
    f.allowUndo = current.allowRewind;
    f.repayOffTurn = current.repayOffTurn;
    f.leaveFreeRounds = current.leaveFreeRounds;
    f.turnGate = current.turnGate;
    f.showProgress = current.showProgress;
    f.ranked = current.ranked;
    f.pace = current.pace;
    f.offerRolls = current.rules.sellOfferRolls;
    if (current.clock.mode === 'per-move') {
      f.clock = 'per-move';
      f.seconds = current.clock.secondsPerMove;
    } else if (current.clock.mode === 'bank') {
      f.clock = 'bank';
      f.bankSeconds = current.clock.bankSeconds;
    }
  }

  create(): void {
    if (this.existing) {
      this.saved.emit(this.settings() as unknown as Record<string, unknown>);
      return;
    }
    const letters = saveInitials(this.initials);
    const input: CreateTableInput = {
      nickname: this.nickname.trim(),
      ...(letters ? { initials: letters } : {}),
      language: this.form.language,
      settings: this.settings(),
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
