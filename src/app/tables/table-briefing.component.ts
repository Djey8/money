import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CharacterPreviewComponent } from './character-preview.component';
import {
  InsuranceDecisionComponent,
  type InsuranceRow,
} from '../main/cashflow-game/insurance-decision.component';
import { dreamTexts, type DreamTexts } from '../dreamfund-tables/dream-texts';

export type BriefingInsurance = InsuranceRow;

/**
 * Before the first roll of a Dreamfund game (JFK, 2026-11-03): every player reads who they are - the story, what matters, the goals, the
 * income, the expenses and the debts - and chooses their insurances. The game is begun in the background; it starts for everybody when
 * everybody has said they are ready. Until then a player can go back to the choice of the character.
 */
@Component({
  selector: 'app-table-briefing',
  standalone: true,
  imports: [CommonModule, TranslateModule, CharacterPreviewComponent, InsuranceDecisionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-insurance-decision
      *ngIf="step() === 'insurance' && !confirmed"
      mode="start"
      [rows]="insurances"
      [lang]="lang"
      [currency]="currency"
      [busy]="busy"
      (insuranceChange)="insuranceChange.emit($event)"
      (goBack)="step.set('who')"
      (finish)="confirm.emit(); step.set('who')"
    ></app-insurance-decision>
    <div class="tb-overlay" role="dialog" [attr.aria-label]="t.briefingTitle">
      <div class="tb-sheet">
        <h2>{{ t.briefingTitle }}</h2>
        <p class="tb-intro">{{ t.briefingIntro }}</p>

        <app-character-preview
          [professionId]="professionId"
          [difficulty]="difficulty"
          [lang]="lang"
          (dreamOpen)="dreamOpen.emit()"
          (reserveOpen)="reserveOpen.emit()"
        ></app-character-preview>

        <div class="tb-actions">
          <button
            type="button"
            class="btn btn--primary tb-wide"
            [disabled]="busy || confirmed"
            (click)="start()"
          >
            {{ confirmed ? t.briefingWaiting : t.briefingStart }}
          </button>
          <button
            type="button"
            class="btn btn--action tb-wide"
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
      .tb-actions .btn {
        margin: 0;
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

      .tb-wide {
        width: 100%;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
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
  @Input() currency = '€';
  /** The first decision is who you are; the second the insurances; then the player is ready. */
  readonly step = signal<'who' | 'insurance'>('who');
  @Input() confirmed = false;
  @Input() canGoBack = true;
  @Input() busy = false;
  /** The names of the players who have not said they are ready. */
  @Input() waitingFor: string[] = [];
  @Output() dreamOpen = new EventEmitter<void>();
  @Output() reserveOpen = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() insuranceChange = new EventEmitter<{ kind: string; on: boolean }>();

  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }

  /** "I know who I am - start": on to the insurances (nobody is ready before they are chosen). */
  start(): void {
    if (this.insurances.length === 0) {
      this.confirm.emit();
      return;
    }
    this.step.set('insurance');
  }
}
