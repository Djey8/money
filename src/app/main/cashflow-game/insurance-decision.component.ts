import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { INSURANCE_CATALOG } from '@money/domain';
import { insuranceTexts, type InsuranceTexts } from './insurance-decision.texts';

/** One insurance of the character as the screen knows it. */
export interface InsuranceRow {
  kind: string;
  /** Held now. */
  held: boolean;
  /** Held after the next Payday (what the bill of the next month is made from). */
  heldNext: boolean;
  /** The premium a month, in the game's money. */
  premium: number;
  fresh?: boolean;
}

/**
 * The decision about the insurances (JFK, 2026-11-03): a short explanation, then every insurance one after the other - the most important
 * first - with what it costs, what it protects against and what it does to the cards, then the bill of the next month. At the start of
 * a game it is the second decision after "who you are"; during the game it opens again from the Insurances button, and every hop in or
 * out is written down at once (and is a subscription of the next bill).
 */
@Component({
  selector: 'app-insurance-decision',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="id-overlay"
      role="dialog"
      [attr.aria-label]="t.title"
      [attr.dir]="rtl ? 'rtl' : 'ltr'"
    >
      <div class="id-sheet">
        <header class="id-head">
          <h2>🛡️ {{ t.title }}</h2>
          <button
            type="button"
            class="id-close"
            *ngIf="mode === 'later'"
            (click)="dismiss.emit()"
            [attr.aria-label]="t.close"
          >
            ✕
          </button>
        </header>
        <p>{{ t.intro }}</p>
        <p class="id-note">{{ mode === 'start' ? t.introStart : t.introLater }}</p>

        <ul class="id-list">
          <li
            *ngFor="let row of sorted(); trackBy: trackKind"
            class="id-item"
            [class.id-item--open]="open() === row.kind"
          >
            <div class="id-row">
              <button
                type="button"
                class="id-name"
                [attr.aria-expanded]="open() === row.kind"
                (click)="toggle(row.kind)"
              >
                <span class="id-caret">{{ open() === row.kind ? '▾' : '▸' }}</span>
                {{ 'CashflowGame.insurance.kind.' + row.kind | translate }}
              </button>
              <span class="id-price">{{ money(row.premium) }} {{ currency }}</span>
              <label class="sw" [attr.aria-label]="row.heldNext ? t.held : t.notHeld">
                <input
                  type="checkbox"
                  [checked]="row.heldNext"
                  [disabled]="busy"
                  (change)="insuranceChange.emit({ kind: row.kind, on: !row.heldNext })"
                />
                <span></span>
              </label>
            </div>
            <div class="id-detail" *ngIf="open() === row.kind">
              <p *ngIf="row.info as info">
                <strong>{{ t.covers }}</strong
                ><br />{{ say(info.covers) }}
              </p>
              <p class="id-note" *ngIf="row.held !== row.heldNext">
                {{ row.heldNext ? t.startsNext : t.endsNext }}
              </p>
            </div>
          </li>
        </ul>

        <div class="id-total">
          <strong>{{ t.total }}</strong>
          <strong>{{ money(total()) }} {{ currency }}</strong>
        </div>

        <div class="id-actions">
          <button
            type="button"
            class="btn btn--primary id-wide"
            [disabled]="busy"
            (click)="finish.emit()"
          >
            {{ t.done }}
          </button>
          <button
            type="button"
            class="btn btn--action id-wide"
            *ngIf="mode === 'start'"
            (click)="goBack.emit()"
          >
            {{ t.back }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .id-overlay {
        position: fixed;
        inset: 0;
        z-index: 3100;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow-y: auto;
        padding: 56px 12px 24px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.55);
        color: var(--color-text);
      }
      .id-sheet {
        width: 100%;
        max-width: 560px;
        box-sizing: border-box;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-radius: 14px;
        border: 1px solid var(--color-border-light);
        background: var(--color-background);
      }
      .id-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .id-close {
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid var(--color-border-light);
        border-radius: 50%;
        background: transparent;
        color: inherit;
        font-size: 0.75rem;
        cursor: pointer;
      }
      h2,
      p {
        margin: 0;
      }
      .id-note {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .id-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .id-item {
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        background: var(--color-surface);
      }
      .id-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
      }
      .id-name {
        flex: 1;
        min-width: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .id-caret {
        opacity: 0.6;
        margin-inline-end: 4px;
      }
      .id-price {
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .id-detail {
        padding: 0 12px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 0.9rem;
      }
      .id-total {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        border-top: 1px solid var(--color-border-light);
      }
      .id-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .id-wide {
        width: 100%;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
      }
      .sw {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
        flex: none;
      }
      .sw input {
        position: absolute;
        opacity: 0;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        cursor: pointer;
      }
      .sw span {
        position: absolute;
        inset: 0;
        border-radius: 22px;
        background: var(--color-toggle-track, #ccc);
        transition: background 0.15s;
        pointer-events: none;
      }
      .sw span::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.15s;
      }
      .sw input:checked + span {
        background: var(--color-primary, #1976d2);
      }
      .sw input:checked + span::after {
        transform: translateX(18px);
      }
      .sw input:focus-visible + span {
        outline: 2px solid var(--color-focus, #ffd600);
      }
    `,
  ],
})
export class InsuranceDecisionComponent {
  private readonly rowsSig = signal<InsuranceRow[]>([]);
  @Input({ required: true }) set rows(value: InsuranceRow[]) {
    this.rowsSig.set(value ?? []);
  }
  /** At the start of a game it ends with "Done" and a way back to the character; later it is closed. */
  @Input() mode: 'start' | 'later' = 'later';
  @Input() lang = 'en';
  @Input() currency = '€';
  @Input() busy = false;
  @Output() insuranceChange = new EventEmitter<{ kind: string; on: boolean }>();
  @Output() finish = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();
  @Output() goBack = new EventEmitter<void>();

  /** The insurance whose details are open (one at a time). */
  readonly open = signal<string | null>(null);

  readonly sorted = computed(() =>
    this.rowsSig()
      .map((row) => ({ ...row, info: INSURANCE_CATALOG.find((entry) => entry.kind === row.kind) }))
      .sort((a, b) => (a.info?.priority ?? 99) - (b.info?.priority ?? 99)),
  );

  readonly total = computed(() =>
    this.rowsSig()
      .filter((row) => row.heldNext)
      .reduce((sum, row) => sum + row.premium, 0),
  );

  get t(): InsuranceTexts {
    return insuranceTexts(this.lang);
  }

  get rtl(): boolean {
    return this.lang.toLowerCase().startsWith('ar');
  }

  toggle(kind: string): void {
    this.open.set(this.open() === kind ? null : kind);
  }

  say(words: { en: string; de: string }): string {
    return this.lang.slice(0, 2) === 'de' ? words.de : words.en;
  }

  money(value: number): string {
    return value.toLocaleString(this.lang === 'de' ? 'de-DE' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  trackKind = (_: number, row: { kind: string }): string => row.kind;
}
