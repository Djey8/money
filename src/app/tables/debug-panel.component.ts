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
import { FormsModule } from '@angular/forms';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';

type Pile = 'harvest' | 'life' | 'opportunity' | 'emergency' | 'dream';

interface DebugCard {
  id: string;
  title: string;
  group: string;
  hint: string;
}

interface Words {
  title: string;
  close: string;
  back: string;
  intro: string;
  piles: Record<Pile, string>;
  career: string;
  all: string;
  search: string;
  cards: string;
  payday: string;
  paydayHint: string;
  careerHint: string;
  stage: string;
  noLadder: string;
  hostOnly: string;
}

const EN: Words = {
  title: 'Debug',
  close: 'Close',
  back: 'Back',
  intro:
    'Load any card as if it had just been dealt - you do not need to stand on its tile. It replaces the card that is open; what an earlier card already did stays.',
  piles: {
    harvest: '🌾 Harvest',
    life: '🎭 Life',
    opportunity: '💡 Opportunity',
    emergency: '🔥 Fire (Emergency)',
    dream: '🌟 Smile (Dream)',
  },
  career: '💼 Payday & career',
  all: 'All',
  search: 'Search a card',
  cards: 'cards',
  payday: 'Mock a Payday',
  paydayHint:
    'Posts the month at once, as if the token had passed the Payday (a job search is thrown for as well).',
  careerHint:
    'You stand one stage before the one you choose, due for the promotion; the Career tile is played: throw the die and see what it asks.',
  stage: 'Stage',
  noLadder: 'This character has no career ladder yet.',
  hostOnly: 'Only on your own turn.',
};

const DE: Partial<Words> = {
  title: 'Debug',
  close: 'Schließen',
  back: 'Zurück',
  intro:
    'Lade eine beliebige Karte, als wäre sie gerade gezogen worden - du musst nicht auf ihrem Feld stehen. Sie ersetzt die offene Karte; was eine frühere Karte schon getan hat, bleibt.',
  piles: {
    harvest: '🌾 Ernte',
    life: '🎭 Leben',
    opportunity: '💡 Chance',
    emergency: '🔥 Fire (Notfall)',
    dream: '🌟 Smile (Traum)',
  },
  career: '💼 Zahltag & Karriere',
  all: 'Alle',
  search: 'Karte suchen',
  cards: 'Karten',
  payday: 'Zahltag simulieren',
  paydayHint:
    'Bucht den Monat sofort, als wäre die Figur über den Zahltag gegangen (die Jobsuche wird mitgewürfelt).',
  careerHint:
    'Du stehst eine Stufe vor der gewählten, bereit für die Beförderung; das Karrierefeld wird gespielt: würfle und sieh, was es verlangt.',
  stage: 'Stufe',
  noLadder: 'Diese Figur hat noch keine Karriereleiter.',
  hostOnly: 'Nur in deinem eigenen Zug.',
};

/**
 * The debug panel of a debug game (JFK, 2026-11-03): the host loads any card of any pile as if it had just been dealt - from the button
 * of a card (that pile) or from the debug button of the screen (all piles, a Payday, a career step) - and plays it as usual.
 */
@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dp-overlay" role="dialog" [attr.aria-label]="w.title">
      <div class="dp-sheet">
        <header class="dp-head">
          <h2>🛠 {{ w.title }}</h2>
          <button
            type="button"
            class="btn btn--sm"
            (click)="dismiss.emit()"
            [attr.aria-label]="w.close"
          >
            ✕
          </button>
        </header>

        <!-- 1: what to load -->
        <ng-container *ngIf="!pile() && !careerOpen()">
          <p class="dp-note">{{ w.intro }}</p>
          <div class="dp-grid">
            <button
              type="button"
              class="btn btn--primary dp-big"
              *ngFor="let entry of pileList; trackBy: trackKey"
              [disabled]="busy"
              (click)="choose(entry)"
            >
              {{ w.piles[entry] }} <small>{{ cardsOf(entry).length }}</small>
            </button>
            <button type="button" class="btn btn--primary dp-big" (click)="careerOpen.set(true)">
              {{ w.career }}
            </button>
          </div>
        </ng-container>

        <!-- 2: the cards of a pile, in groups -->
        <ng-container *ngIf="pile() as current">
          <h3>{{ w.piles[current] }}</h3>
          <div class="dp-groups" *ngIf="groups().length > 1">
            <button
              type="button"
              class="btn btn--sm"
              [class.btn--primary]="group() === ''"
              (click)="group.set('')"
            >
              {{ w.all }}
            </button>
            <button
              type="button"
              class="btn btn--sm"
              *ngFor="let g of groups(); trackBy: trackKey"
              [class.btn--primary]="group() === g"
              (click)="group.set(g)"
            >
              {{ g }}
            </button>
          </div>
          <input
            type="search"
            class="dp-search"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            [placeholder]="w.search"
            [attr.aria-label]="w.search"
          />
          <ul class="dp-list">
            <li *ngFor="let card of shown(); trackBy: trackId">
              <button
                type="button"
                class="dp-card"
                [disabled]="busy"
                (click)="cardLoad.emit({ tile: current, cardId: card.id })"
              >
                <strong>{{ card.id }}</strong> {{ card.title }}
                <small *ngIf="card.hint">{{ card.hint }}</small>
              </button>
            </li>
          </ul>
        </ng-container>

        <!-- Payday and career -->
        <ng-container *ngIf="careerOpen()">
          <h3>{{ w.career }}</h3>
          <button
            type="button"
            class="btn btn--primary dp-wide"
            [disabled]="busy"
            (click)="payday.emit()"
          >
            {{ w.payday }}
          </button>
          <p class="dp-note">{{ w.paydayHint }}</p>
          <h4>{{ w.stage }}</h4>
          <p class="dp-note" *ngIf="stages().length === 0">{{ w.noLadder }}</p>
          <p class="dp-note" *ngIf="stages().length">{{ w.careerHint }}</p>
          <ul class="dp-list">
            <li *ngFor="let stage of stages(); trackBy: trackId">
              <button
                type="button"
                class="dp-card"
                [disabled]="busy"
                (click)="career.emit(stage.id)"
              >
                <strong>{{ stage.id }}</strong> {{ stage.title }}
                <small *ngIf="stage.hint">{{ stage.hint }}</small>
              </button>
            </li>
          </ul>
        </ng-container>

        <button
          type="button"
          class="btn btn--action dp-wide"
          *ngIf="pile() || careerOpen()"
          (click)="up()"
        >
          {{ w.back }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dp-overlay {
        position: fixed;
        inset: 0;
        z-index: 3200;
        overflow-y: auto;
        background: var(--color-background);
        color: var(--color-text);
      }
      .dp-sheet {
        max-width: 640px;
        margin: 0 auto;
        padding: 16px 16px 48px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dp-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h2,
      h3,
      h4,
      p {
        margin: 0;
      }
      .dp-note {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .dp-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .dp-big,
      .dp-wide {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        box-sizing: border-box;
      }
      .dp-big {
        min-height: 64px;
      }
      .dp-wide {
        width: 100%;
      }
      .dp-groups {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
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
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .dp-card {
        width: 100%;
        text-align: start;
        padding: 8px 10px;
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        background: var(--color-surface);
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
export class DebugPanelComponent {
  private readonly startSig = signal<{ tile?: string; pile?: string } | null>(null);
  /** Where the panel starts: a pile (the button of a card), or nothing (the debug button of the screen). */
  @Input() set start(value: { tile?: string; pile?: string } | null) {
    this.startSig.set(value);
    this.pile.set(this.isPile(value?.tile) ? (value!.tile as Pile) : null);
    this.group.set(value?.pile ?? '');
    this.careerOpen.set(false);
    this.query.set('');
  }
  @Input() lang = 'en';
  @Input() busy = false;
  /** The profession of the host: its career ladder is listed. */
  @Input() professionId: string | null = null;
  @Output() cardLoad = new EventEmitter<{ tile: string; cardId: string }>();
  @Output() payday = new EventEmitter<void>();
  @Output() career = new EventEmitter<string>();
  @Output() dismiss = new EventEmitter<void>();

  readonly pileList: Pile[] = ['harvest', 'life', 'opportunity', 'emergency', 'dream'];
  readonly pile = signal<Pile | null>(null);
  readonly group = signal('');
  readonly query = signal('');
  readonly careerOpen = signal(false);

  get w(): Words {
    return this.lang.slice(0, 2) === 'de' ? { ...EN, ...DE } : EN;
  }

  private isPile(value: string | undefined): boolean {
    return !!value && (this.pileList as string[]).includes(value);
  }

  private get set() {
    return CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');
  }

  private l(value: { en?: string; de?: string } | string | undefined, fallback: string): string {
    if (typeof value === 'string') return value;
    return (this.lang.slice(0, 2) === 'de' ? value?.de : value?.en) ?? value?.en ?? fallback;
  }

  cardsOf(pile: Pile): DebugCard[] {
    const deck = ((this.set?.decks as unknown as Record<string, unknown[]> | undefined)?.[pile] ??
      []) as {
      id: string;
      title?: { en?: string; de?: string } | string;
      tier?: string;
      pile?: string;
      type?: string;
      category?: string;
      group?: string;
      growType?: string;
    }[];
    return deck.map((card) => {
      const group =
        (pile === 'harvest'
          ? card.group
          : pile === 'life'
            ? card.type
            : pile === 'opportunity'
              ? card.pile
              : pile === 'emergency'
                ? card.tier
                : card.category) ?? '';
      const hint = [card.type, card.category, card.growType]
        .filter((part) => part && part !== group)
        .join(' · ');
      return { id: card.id, title: this.l(card.title, card.id), group: String(group), hint };
    });
  }

  readonly groups = computed(() => {
    const current = this.pile();
    if (!current) return [];
    return [
      ...new Set(
        this.cardsOf(current)
          .map((card) => card.group)
          .filter(Boolean),
      ),
    ];
  });

  readonly shown = computed(() => {
    const current = this.pile();
    if (!current) return [];
    const needle = this.query().trim().toLowerCase();
    const group = this.group();
    return this.cardsOf(current).filter(
      (card) =>
        (!group || card.group === group) &&
        (!needle ||
          `${card.id} ${card.title} ${card.group} ${card.hint}`.toLowerCase().includes(needle)),
    );
  });

  readonly stages = computed(() => {
    const profession = this.set?.professions.find(
      (candidate) => candidate.id === this.professionId,
    );
    const track = (
      profession as unknown as {
        career?: {
          start: string;
          stages: {
            id: string;
            stage: number;
            title: { en?: string; de?: string };
            branch?: string;
          }[];
        };
      }
    )?.career;
    if (!track) return [];
    return track.stages
      .filter((stage) => stage.id !== track.start)
      .map((stage) => ({
        id: stage.id,
        title: this.l(stage.title, stage.id),
        hint: stage.branch ?? '',
      }));
  });

  choose(entry: Pile): void {
    this.pile.set(entry);
    this.group.set('');
    this.query.set('');
  }

  /** One step back: from a pile or the career to the choice of what to load. */
  up(): void {
    this.pile.set(null);
    this.careerOpen.set(false);
    this.group.set('');
    this.query.set('');
  }

  trackKey = (_: number, key: string): string => key;
  trackId = (_: number, card: { id: string }): string => card.id;
}
