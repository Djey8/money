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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { INSURANCE_CATALOG, insuranceCoverage, type InsuranceInfo } from '@money/domain';
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

interface Step {
  /** The insurances of the step: one, or the two car insurances of which only one can be held. */
  rows: (InsuranceRow & { info: InsuranceInfo | undefined; cards: number })[];
  priority: number;
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
            class="btn btn--sm"
            *ngIf="mode === 'later'"
            (click)="dismiss.emit()"
            [attr.aria-label]="t.close"
          >
            ✕
          </button>
        </header>

        <!-- the introduction: what an insurance is here, and all of them at a glance -->
        <ng-container *ngIf="index() === 0">
          <p>{{ t.intro1 }}</p>
          <p>{{ t.intro2 }}</p>
          <p class="id-note">{{ mode === 'start' ? t.introStart : t.introLater }}</p>
          <h3>{{ t.overview }}</h3>
          <ol class="id-overview">
            <li *ngFor="let step of steps(); let i = index">
              <button type="button" class="id-link" (click)="index.set(i + 1)">
                <span class="id-prio">{{ i + 1 }}</span>
                <span class="id-name">{{ names(step) }}</span>
                <span class="id-state" [class.id-state--on]="stepHeld(step)">{{
                  stepHeld(step) ? '✓' : '–'
                }}</span>
              </button>
            </li>
          </ol>
        </ng-container>

        <!-- one insurance (or the two car insurances) -->
        <ng-container *ngIf="current() as step">
          <div
            class="id-progress"
            role="progressbar"
            [attr.aria-valuenow]="index()"
            [attr.aria-valuemax]="steps().length"
          >
            <span [style.width.%]="(index() / steps().length) * 100"></span>
          </div>
          <p class="id-count">
            {{ t.stepOf.replace('{n}', '' + index()).replace('{total}', '' + steps().length) }}
          </p>

          <p class="id-note" *ngIf="step.rows.length > 1">{{ t.chooseOne }}</p>
          <article class="id-card" *ngFor="let row of step.rows; trackBy: trackKind">
            <header>
              <h3>{{ 'CashflowGame.insurance.kind.' + row.kind | translate }}</h3>
              <span class="id-value" *ngIf="row.info" [attr.data-value]="row.info.value">{{
                t.value[row.info.value]
              }}</span>
            </header>
            <p class="id-cost">
              {{ t.cost }} <strong>{{ money(row.premium) }} {{ currency }}</strong> {{ t.perMonth }}
            </p>
            <ng-container *ngIf="row.info as info">
              <h4>{{ t.covers }}</h4>
              <p>{{ say(info.covers) }}</p>
              <h4>{{ t.effect }}</h4>
              <p>{{ say(info.effect) }}</p>
              <p class="id-cards" [class.id-cards--none]="row.cards === 0">
                {{ cardsLine(row.cards) }}
              </p>
              <h4>{{ t.advice }}</h4>
              <p>{{ say(info.advice) }}</p>
              <p class="id-note" *ngIf="info.needs === 'car'">{{ t.needsCar }}</p>
              <p class="id-note" *ngIf="info.needs === 'pet'">{{ t.needsPet }}</p>
            </ng-container>
            <label class="id-hop">
              <span class="sw">
                <input
                  type="checkbox"
                  [checked]="row.heldNext"
                  [disabled]="busy"
                  (change)="insuranceChange.emit({ kind: row.kind, on: !row.heldNext })"
                />
                <span></span>
              </span>
              <span>
                {{ row.heldNext ? t.held : t.notHeld }}
                <small *ngIf="row.held !== row.heldNext"
                  >· {{ row.heldNext ? t.startsNext : t.endsNext }}</small
                >
              </span>
            </label>
          </article>
        </ng-container>

        <!-- the bill of the next month -->
        <ng-container *ngIf="index() === steps().length + 1">
          <h3>{{ t.summary }}</h3>
          <ul class="id-bill" *ngIf="bill().length; else noBill">
            <li *ngFor="let row of bill(); trackBy: trackKind">
              <span>{{ 'CashflowGame.insurance.kind.' + row.kind | translate }}</span>
              <span>{{ money(row.premium) }} {{ currency }}</span>
            </li>
            <li class="id-total">
              <strong>{{ t.total }}</strong>
              <strong>{{ money(total()) }} {{ currency }}</strong>
            </li>
          </ul>
          <ng-template #noBill
            ><p class="id-note">{{ t.nothing }}</p></ng-template
          >
          <p class="id-note">{{ t.billHint }}</p>
        </ng-container>

        <div class="id-actions">
          <button
            type="button"
            class="btn btn--primary id-wide"
            *ngIf="index() === 0"
            (click)="index.set(1)"
          >
            {{ t.begin }}
          </button>
          <ng-container *ngIf="index() > 0 && index() <= steps().length">
            <button type="button" class="btn btn--primary id-wide" (click)="index.set(index() + 1)">
              {{ index() === steps().length ? t.skip : t.next }}
            </button>
            <button
              type="button"
              class="btn btn--action id-wide"
              *ngIf="index() < steps().length"
              (click)="index.set(steps().length + 1)"
            >
              {{ t.skip }}
            </button>
          </ng-container>
          <button
            type="button"
            class="btn btn--primary id-wide"
            *ngIf="index() === steps().length + 1"
            [disabled]="busy"
            (click)="finish.emit()"
          >
            {{ t.done }}
          </button>
          <button
            type="button"
            class="btn btn--action id-wide"
            *ngIf="index() > 0 || mode === 'start'"
            (click)="index() > 0 ? index.set(index() - 1) : goBack.emit()"
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
        overflow-y: auto;
        background: var(--color-background);
        color: var(--color-text);
      }
      .id-sheet {
        max-width: 640px;
        margin: 0 auto;
        padding: 16px 16px 96px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .id-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      h2,
      h3,
      h4,
      p {
        margin: 0;
      }
      h4 {
        margin-top: 6px;
        font-size: 0.85rem;
        opacity: 0.75;
      }
      .id-note {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .id-count {
        font-size: 0.8rem;
        opacity: 0.7;
      }
      .id-progress {
        height: 6px;
        border-radius: 6px;
        background: var(--color-border-light);
        overflow: hidden;
      }
      .id-progress span {
        display: block;
        height: 100%;
        background: var(--color-primary, #1976d2);
        transition: width 0.2s;
      }
      .id-overview {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .id-link {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        background: var(--color-surface);
        color: inherit;
        cursor: pointer;
        text-align: start;
      }
      .id-prio {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        background: var(--color-border-light);
        flex: none;
      }
      .id-name {
        flex: 1;
      }
      .id-state {
        opacity: 0.5;
      }
      .id-state--on {
        opacity: 1;
        color: var(--color-success, #2e7d32);
        font-weight: 700;
      }
      .id-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--color-border-light);
        border-radius: 12px;
        background: var(--color-surface);
      }
      .id-card header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .id-value {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 10px;
        border: 1px solid var(--color-border-light);
      }
      .id-value[data-value='essential'] {
        border-color: var(--color-success, #2e7d32);
        color: var(--color-success, #2e7d32);
      }
      .id-value[data-value='rarely'] {
        opacity: 0.7;
      }
      .id-cost {
        font-size: 1rem;
      }
      .id-cards {
        font-size: 0.85rem;
      }
      .id-cards--none {
        color: var(--color-warning, #ef6c00);
      }
      .id-hop {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
        cursor: pointer;
      }
      .id-hop small {
        opacity: 0.75;
      }
      .id-bill {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .id-bill li {
        display: flex;
        justify-content: space-between;
        padding: 6px 10px;
        border-bottom: 1px solid var(--color-border-light);
      }
      .id-total {
        border-bottom: 0 !important;
      }
      .id-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: sticky;
        bottom: 0;
        padding: 8px 0;
        background: var(--color-background);
      }
      .id-wide {
        width: 100%;
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

  /** 0 is the introduction, 1..N the insurances, N+1 the bill. */
  readonly index = signal(0);

  readonly steps = computed<Step[]>(() => {
    const cards = new Map<string, number>();
    const rows = this.rowsSig().map((row) => {
      const info = INSURANCE_CATALOG.find((entry) => entry.kind === row.kind);
      if (!cards.has(row.kind)) cards.set(row.kind, insuranceCoverage(row.kind).length);
      return { ...row, info, cards: cards.get(row.kind) ?? 0 };
    });
    const out: Step[] = [];
    for (const row of rows.sort((a, b) => (a.info?.priority ?? 99) - (b.info?.priority ?? 99))) {
      const group = row.info?.exclusiveGroup;
      const same = group
        ? out.find((step) => step.rows.some((other) => other.info?.exclusiveGroup === group))
        : undefined;
      if (same) same.rows.push(row);
      else out.push({ rows: [row], priority: row.info?.priority ?? 99 });
    }
    return out;
  });

  readonly current = computed<Step | null>(() => this.steps()[this.index() - 1] ?? null);

  readonly bill = computed(() => this.rowsSig().filter((row) => row.heldNext));
  readonly total = computed(() => this.bill().reduce((sum, row) => sum + row.premium, 0));

  get t(): InsuranceTexts {
    return insuranceTexts(this.lang);
  }

  get rtl(): boolean {
    return this.lang.toLowerCase().startsWith('ar');
  }

  say(words: { en: string; de: string }): string {
    return this.lang.slice(0, 2) === 'de' ? words.de : words.en;
  }

  names(step: Step): string {
    const translate = this.translateService;
    return step.rows
      .map((row) => {
        const key = `CashflowGame.insurance.kind.${row.kind}`;
        const text = translate?.instant(key);
        return text && text !== key ? text : row.kind;
      })
      .join(' / ');
  }

  stepHeld(step: Step): boolean {
    return step.rows.some((row) => row.heldNext);
  }

  cardsLine(count: number): string {
    return count === 0
      ? this.t.noCards
      : count === 1
        ? this.t.cardsOne
        : this.t.cardsN.replace('{n}', `${count}`);
  }

  money(value: number): string {
    return value.toLocaleString(this.lang === 'de' ? 'de-DE' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  trackKind = (_: number, row: { kind: string }): string => row.kind;

  constructor(private readonly translateService: TranslateService) {}
}
