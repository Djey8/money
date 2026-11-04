import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
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
      <!-- the characters to choose from, as in the game on its own: the name, who they are, what is left of a month -->
      <div class="tb-sheet" *ngIf="step() === 'choose' && canChange && !confirmed">
        <h2>{{ t.characterChoose }}</h2>
        <div class="tb-grid">
          <button
            *ngFor="let entry of characters; trackBy: trackId"
            type="button"
            class="tb-person"
            [class.tb-person--on]="entry.id === professionId"
            [disabled]="busy || entry.held"
            (click)="choose(entry.id)"
          >
            <span class="tb-avatar" aria-hidden="true">{{ entry.name.charAt(0) }}</span>
            <span class="tb-person-text">
              <strong>{{ entry.name }}</strong>
              <small *ngIf="entry.tagline">{{ entry.tagline }}</small>
              <small>{{ t.characterCashflow }}: {{ entry.cashflowText }}</small>
              <small *ngIf="entry.held">{{ t.characterHeld }}</small>
            </span>
          </button>
          <button type="button" class="tb-person" [disabled]="busy" (click)="choose('random')">
            <span class="tb-avatar" aria-hidden="true">🎲</span>
            <span class="tb-person-text">
              <strong>{{ t.characterRandom }}</strong>
            </span>
          </button>
        </div>
        <button type="button" class="btn btn--action tb-wide" (click)="step.set('who')">
          {{ t.characterKeep }}
        </button>
      </div>

      <!-- the details of the character -->
      <div class="tb-sheet" *ngIf="step() !== 'choose' || !canChange || confirmed">
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
            *ngIf="canChange && !confirmed"
            [disabled]="busy"
            (click)="step.set('choose')"
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

      .tb-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 4px;
      }
      .tb-person {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border: 2px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-lg, 12px);
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .tb-person--on {
        border-color: var(--color-primary, #2a7de1);
      }
      .tb-person:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .tb-avatar {
        display: grid;
        place-items: center;
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-weight: 700;
      }
      .tb-person-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .tb-person-text small {
        opacity: 0.75;
      }
      @media (max-width: 480px) {
        .tb-grid {
          grid-template-columns: 1fr;
        }
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
export class TableBriefingComponent implements OnInit {
  @Input({ required: true }) professionId = '';
  @Input() difficulty: 'easy' | 'medium' | 'hard' | undefined;
  @Input() lang = 'en';
  @Input() insurances: BriefingInsurance[] = [];
  @Input() currency = '€';
  /** The first decision is who you are; the second the insurances; then the player is ready. */
  readonly step = signal<'choose' | 'who' | 'insurance'>('who');
  @Input() confirmed = false;
  /** The characters may be changed at this table (not where they are drawn). */
  @Input() canChange = true;
  /** The characters to choose from; `held` is one another player has at a table of unique characters. */
  @Input() characters: {
    id: string;
    name: string;
    tagline: string;
    cashflowText: string;
    held: boolean;
  }[] = [];
  @Input() busy = false;
  /** The names of the players who have not said they are ready. */
  @Input() waitingFor: string[] = [];
  @Output() dreamOpen = new EventEmitter<void>();
  @Output() reserveOpen = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() pickCharacter = new EventEmitter<string>();
  @Output() insuranceChange = new EventEmitter<{ kind: string; on: boolean }>();

  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }

  /** Where the characters may be chosen, the list is the first decision; a character that is dealt and kept is read at once. */
  ngOnInit(): void {
    if (this.canChange && !this.confirmed) this.step.set('choose');
  }

  /** A character was chosen: its details are shown (a new life is dealt by the table, unless it is the one already shown). */
  choose(id: string): void {
    this.step.set('who');
    if (id !== this.professionId) this.pickCharacter.emit(id);
  }

  trackId = (_: number, entry: { id: string }): string => entry.id;

  /** "I know who I am - start": on to the insurances (nobody is ready before they are chosen). */
  start(): void {
    if (this.insurances.length === 0) {
      this.confirm.emit();
      return;
    }
    this.step.set('insurance');
  }
}
