import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CharacterPreviewComponent } from './character-preview.component';
import { dreamTexts, type DreamTexts } from '../dreamfund-tables/dream-texts';

export interface BriefingInsurance {
  kind: string;
  premiumMinor: number;
  held: boolean;
}

/**
 * Before the first roll of a Dreamfund game (JFK, 2026-11-03): every player reads who they are - the story, what matters, the goals, the
 * income, the expenses and the debts - and chooses their insurances. The game is begun in the background; it starts for everybody when
 * everybody has said they are ready. Until then a player can go back to the choice of the character.
 */
@Component({
  selector: 'app-table-briefing',
  standalone: true,
  imports: [CommonModule, TranslateModule, CharacterPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-overlay" role="dialog" [attr.aria-label]="t.briefingTitle">
      <div class="tb-sheet">
        <h2>{{ t.briefingTitle }}</h2>
        <p class="tb-intro">{{ t.briefingIntro }}</p>

        <app-character-preview
          [professionId]="professionId"
          [difficulty]="difficulty"
          [lang]="lang"
        ></app-character-preview>

        <section class="tb-insurance" *ngIf="insurances.length">
          <h3>🛡️ {{ t.briefingInsurance }}</h3>
          <p>{{ t.briefingInsuranceHint }}</p>
          <ul>
            <li *ngFor="let row of insurances; trackBy: trackKind">
              <span>
                <strong>{{ 'CashflowGame.insurance.kind.' + row.kind | translate }}</strong>
                <small>{{ money(row.premiumMinor) }} {{ t.perMonth }}</small>
              </span>
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [class.tx-btn--primary]="row.held"
                [disabled]="busy || confirmed"
                (click)="insuranceChange.emit({ kind: row.kind, on: !row.held })"
              >
                {{ row.held ? t.briefingHeld : t.briefingNotHeld }}
              </button>
            </li>
          </ul>
        </section>

        <div class="tb-actions">
          <button
            type="button"
            class="tx-btn tx-btn--primary tx-btn--wide"
            [disabled]="busy || confirmed"
            (click)="confirm.emit()"
          >
            {{ confirmed ? t.briefingWaiting : t.briefingStart }}
          </button>
          <button
            type="button"
            class="tx-btn tx-btn--wide"
            *ngIf="canGoBack"
            [disabled]="busy"
            (click)="back.emit()"
          >
            {{ t.briefingBack }}
          </button>
        </div>
        <p class="tb-waiting" *ngIf="waitingFor.length">
          {{ t.briefingWaitingFor }} {{ waitingFor.join(', ') }}
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .tb-overlay {
        position: fixed;
        inset: 0;
        z-index: 3000;
        overflow-y: auto;
        background: var(--color-background);
        color: var(--color-text);
      }
      .tb-sheet {
        max-width: 640px;
        margin: 0 auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      h2,
      h3,
      p {
        margin: 0;
      }
      .tb-intro {
        opacity: 0.8;
        font-size: 0.9rem;
      }
      .tb-insurance ul {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tb-insurance li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        background: var(--color-surface);
      }
      .tb-insurance small {
        display: block;
        opacity: 0.75;
      }
      .tb-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: sticky;
        bottom: 0;
        padding: 8px 0;
        background: var(--color-background);
      }
      .tb-waiting {
        font-size: 0.85rem;
        opacity: 0.8;
      }
    `,
  ],
})
export class TableBriefingComponent {
  @Input({ required: true }) professionId = '';
  @Input() difficulty: 'easy' | 'medium' | 'hard' | undefined;
  @Input() lang = 'en';
  @Input() insurances: BriefingInsurance[] = [];
  @Input() confirmed = false;
  @Input() canGoBack = true;
  @Input() busy = false;
  /** The names of the players who have not said they are ready. */
  @Input() waitingFor: string[] = [];
  @Output() confirm = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() insuranceChange = new EventEmitter<{ kind: string; on: boolean }>();

  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }

  money(minor: number): string {
    return (minor / 100).toLocaleString(this.lang === 'de' ? 'de-DE' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  trackKind = (_: number, row: BriefingInsurance): string => row.kind;
}
