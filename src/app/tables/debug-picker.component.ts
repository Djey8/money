import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { dreamTexts, type DreamTexts } from '../dreamfund-tables/dream-texts';

interface PickCard {
  id: string;
  title: string;
  hint: string;
}

/**
 * A debug game (JFK, 2026-11-03): the host stands on a tile and chooses which card it deals - any card of the pile - or lets chance
 * do it, as in every other game. Everybody else plays as usual.
 */
@Component({
  selector: 'app-debug-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dp">
      <h4>🛠 {{ t.debugTitle }}: {{ tileName }}</h4>
      <p>{{ t.debugHint }}</p>
      <button type="button" class="btn btn--primary" [disabled]="busy" (click)="pick.emit(null)">
        🎲 {{ t.debugRandom }}
      </button>
      <input
        type="search"
        class="dp-search"
        [(ngModel)]="query"
        [placeholder]="t.debugSearch"
        [attr.aria-label]="t.debugSearch"
      />
      <ul class="dp-list">
        <li *ngFor="let card of shown; trackBy: trackId">
          <button type="button" class="dp-card" [disabled]="busy" (click)="pick.emit(card.id)">
            <strong>{{ card.id }}</strong> {{ card.title }}
            <small *ngIf="card.hint">{{ card.hint }}</small>
          </button>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .dp {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border: 1px dashed var(--color-warning, #ff9800);
        border-radius: 10px;
        background: var(--color-surface);
        color: var(--color-text);
      }
      .dp h4,
      .dp p {
        margin: 0;
      }
      .dp p {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .dp-search {
        padding: 8px;
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        background: var(--color-input-bg, var(--color-surface));
        color: inherit;
      }
      .dp-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 260px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .dp-card {
        width: 100%;
        text-align: left;
        padding: 6px 10px;
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        background: var(--color-surface-alt, var(--color-surface));
        color: inherit;
        cursor: pointer;
      }
      .dp-card small {
        display: block;
        opacity: 0.7;
      }
    `,
  ],
})
export class DebugPickerComponent {
  /** The tile the host stands on: emergency, life, dream, opportunity or harvest. */
  @Input({ required: true }) tile = 'emergency';
  @Input() lang = 'en';
  @Input() busy = false;
  /** The card chosen, or null for chance. */
  @Output() pick = new EventEmitter<string | null>();
  query = '';

  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }

  get tileName(): string {
    return this.tile;
  }

  private get cards(): PickCard[] {
    const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');
    const deck = ((set?.decks as unknown as Record<string, unknown[]> | undefined)?.[this.tile] ??
      []) as {
      id: string;
      title?: { en: string; de: string } | string;
      tier?: string;
      pile?: string;
      type?: string;
      category?: string;
    }[];
    const l = this.lang === 'de' ? 'de' : 'en';
    return deck.map((card) => ({
      id: card.id,
      title: typeof card.title === 'string' ? card.title : (card.title?.[l] ?? card.id),
      hint: [card.tier ?? card.pile, card.type, card.category].filter(Boolean).join(' · '),
    }));
  }

  get shown(): PickCard[] {
    const needle = this.query.trim().toLowerCase();
    const all = this.cards;
    return needle
      ? all.filter((card) => `${card.id} ${card.title} ${card.hint}`.toLowerCase().includes(needle))
      : all;
  }

  trackId = (_: number, card: PickCard): string => card.id;
}
