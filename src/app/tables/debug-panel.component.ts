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
import { SPROUT_PATH, TILE_ICONS } from '../main/cashflow-game/dream-board.component';

type Pile = 'harvest' | 'life' | 'opportunity' | 'emergency' | 'dream';
type Place = Pile | 'payday' | 'career';

interface DebugCard {
  id: string;
  title: string;
  /** The first and the second filter of the pile. */
  a: string;
  b: string;
  /** The stack of an Opportunity card. */
  pile: string;
  /** The key facts shown on the card of the grid. */
  facts: string[];
}

interface Words {
  title: string;
  close: string;
  back: string;
  intro: string;
  places: Record<Place, string>;
  search: string;
  paydayHint: string;
  paydayButton: string;
  careerHint: string;
  noLadder: string;
  seed: string;
  sapling: string;
  tree: string;
  cost: string;
  dice: string;
  risk: string;
  total: string;
  points: string;
  free: string;
  fixed: string;
  noCards: string;
}

const EN: Words = {
  title: 'Debug',
  close: 'Close',
  back: 'Back',
  intro:
    'Load any card as if you had just landed on its tile and drawn it. Everything of the card before is cancelled; what it already paid stays.',
  places: {
    harvest: 'Harvest',
    life: 'Life',
    opportunity: 'Opportunity',
    emergency: 'Fire',
    dream: 'Smile',
    payday: 'Payday',
    career: 'Career',
  },
  search: 'Search a card',
  paydayHint:
    'Posts the month at once, as if the token had passed the Payday (a job search is thrown for as well).',
  paydayButton: 'Mock a Payday',
  careerHint:
    'You stand one stage before the one you choose, due for the promotion; the Career tile is played: see what the die asks.',
  noLadder: 'This character has no career ladder yet.',
  seed: 'Seed',
  sapling: 'Sapling',
  tree: 'Tree',
  cost: 'Cost',
  dice: 'Dice',
  risk: 'Risk',
  total: 'Total',
  points: 'points',
  free: 'free',
  fixed: 'Fixed',
  noCards: 'No card matches.',
};

const DE: Partial<Words> = {
  close: 'Schließen',
  back: 'Zurück',
  intro:
    'Lade eine beliebige Karte, als wärst du gerade auf ihr Feld gekommen und hättest sie gezogen. Alles von der Karte davor wird abgebrochen; was sie schon bezahlt hat, bleibt.',
  places: {
    harvest: 'Ernte',
    life: 'Leben',
    opportunity: 'Chance',
    emergency: 'Fire',
    dream: 'Smile',
    payday: 'Zahltag',
    career: 'Karriere',
  },
  search: 'Karte suchen',
  paydayHint:
    'Bucht den Monat sofort, als wäre die Figur über den Zahltag gegangen (die Jobsuche wird mitgewürfelt).',
  paydayButton: 'Zahltag simulieren',
  careerHint:
    'Du stehst eine Stufe vor der gewählten, bereit für die Beförderung; das Karrierefeld wird gespielt: sieh, was der Würfel verlangt.',
  noLadder: 'Diese Figur hat noch keine Karriereleiter.',
  seed: 'Samen',
  sapling: 'Setzling',
  tree: 'Baum',
  cost: 'Kosten',
  dice: 'Würfel',
  risk: 'Risiko',
  total: 'Summe',
  points: 'Punkte',
  free: 'frei',
  fixed: 'Fest',
  noCards: 'Keine Karte passt.',
};

const PILES: Pile[] = ['harvest', 'life', 'opportunity', 'emergency', 'dream'];
const PLACES: Place[] = [...PILES, 'payday', 'career'];

interface RawCard {
  id: string;
  title?: { en?: string; de?: string } | string;
  tier?: string;
  pile?: string;
  type?: string;
  category?: string;
  group?: string;
  growType?: string;
  costMinor?: number;
  totalMinor?: number;
  points?: number;
  riskScore?: number;
  copies?: number;
  dice?: unknown[];
  buckets?: { amountMinor: number }[];
}

/**
 * The debug panel of a debug game (JFK, 2026-11-03): the host loads any card of any pile as if they had just landed on its tile and
 * drawn it - from the symbol on a card (that pile) or from the debug symbol of the screen (all piles, a Payday, a career step) - and
 * plays it as usual. The cards are a grid with their key facts and quick filters.
 */
@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dp-overlay" role="dialog" [attr.aria-label]="w.title" (click)="dismiss.emit()">
      <div class="dp-sheet" (click)="$event.stopPropagation()">
        <header class="dp-head">
          <h2>
            🛠 {{ w.title }}<ng-container *ngIf="place() as p"> · {{ w.places[p] }}</ng-container>
          </h2>
          <button
            type="button"
            class="dp-close"
            (click)="dismiss.emit()"
            [attr.aria-label]="w.close"
          >
            ✕
          </button>
        </header>

        <!-- what to load: the tiles of the map -->
        <ng-container *ngIf="!place()">
          <p class="dp-note">{{ w.intro }}</p>
          <div class="dp-tiles">
            <button
              type="button"
              class="dp-tile"
              *ngFor="let entry of placeList; trackBy: trackKey"
              [disabled]="busy"
              (click)="choose(entry)"
            >
              <ng-container *ngTemplateOutlet="icon; context: { $implicit: entry }"></ng-container>
              <span>{{ w.places[entry] }}</span>
              <small *ngIf="count(entry) as n">{{ n }}</small>
            </button>
          </div>
        </ng-container>

        <!-- the cards of a pile -->
        <ng-container *ngIf="pileOf(place()) as current">
          <div class="dp-chips" *ngIf="current === 'opportunity'" role="tablist">
            <button
              type="button"
              class="dp-chip dp-chip--pile"
              *ngFor="let name of piles; trackBy: trackKey"
              [class.dp-chip--on]="stack() === name"
              (click)="stack.set(name)"
            >
              {{ pileIcon(name) }} {{ w[name] }}
            </button>
          </div>
          <div class="dp-chips" *ngIf="filtersA().length > 1">
            <button
              type="button"
              class="dp-chip"
              *ngFor="let g of filtersA(); trackBy: trackKey"
              [class.dp-chip--on]="filterA() === g"
              (click)="filterA.set(filterA() === g ? '' : g)"
            >
              {{ g }}
            </button>
          </div>
          <div class="dp-chips" *ngIf="filtersB().length > 1">
            <button
              type="button"
              class="dp-chip"
              *ngFor="let g of filtersB(); trackBy: trackKey"
              [class.dp-chip--on]="filterB() === g"
              (click)="filterB.set(filterB() === g ? '' : g)"
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
          <p class="dp-note" *ngIf="shown().length === 0">{{ w.noCards }}</p>
          <div class="dp-grid">
            <button
              type="button"
              class="dp-card"
              *ngFor="let card of shown(); trackBy: trackId"
              [disabled]="busy"
              (click)="cardLoad.emit({ tile: current, cardId: card.id })"
            >
              <strong>{{ card.id }}</strong>
              <span class="dp-card-title">{{ card.title }}</span>
              <span class="dp-facts">
                <small *ngFor="let fact of card.facts">{{ fact }}</small>
              </span>
            </button>
          </div>
        </ng-container>

        <!-- Payday -->
        <ng-container *ngIf="place() === 'payday'">
          <p class="dp-note">{{ w.paydayHint }}</p>
          <button
            type="button"
            class="btn btn--primary dp-wide"
            [disabled]="busy"
            (click)="payday.emit()"
          >
            {{ w.paydayButton }}
          </button>
        </ng-container>

        <!-- Career -->
        <ng-container *ngIf="place() === 'career'">
          <p class="dp-note" *ngIf="stages().length === 0">{{ w.noLadder }}</p>
          <p class="dp-note" *ngIf="stages().length">{{ w.careerHint }}</p>
          <div class="dp-grid">
            <button
              type="button"
              class="dp-card"
              *ngFor="let stage of stages(); trackBy: trackId"
              [disabled]="busy"
              (click)="career.emit(stage.id)"
            >
              <strong>{{ stage.id }}</strong>
              <span class="dp-card-title">{{ stage.title }}</span>
              <span class="dp-facts"
                ><small *ngIf="stage.hint">{{ stage.hint }}</small></span
              >
            </button>
          </div>
        </ng-container>

        <button type="button" class="btn btn--action dp-wide" *ngIf="place()" (click)="up()">
          {{ w.back }}
        </button>
      </div>
    </div>

    <!-- the symbol of a tile, as the map shows it -->
    <ng-template #icon let-entry>
      <span class="dp-icon" aria-hidden="true">
        <img *ngIf="image(entry) as src" [src]="src" alt="" />
        <svg *ngIf="entry === 'opportunity'" viewBox="0 0 24 24"><path [attr.d]="sprout" /></svg>
        <ng-container *ngIf="glyph(entry) as g">{{ g }}</ng-container>
      </span>
    </ng-template>
  `,
  styles: [
    `
      .dp-overlay {
        position: fixed;
        inset: 0;
        z-index: 3200;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow-y: auto;
        padding: 40px 12px 24px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.55);
        color: var(--color-text);
      }
      .dp-sheet {
        width: 100%;
        max-width: 720px;
        max-height: calc(100vh - 64px);
        overflow-y: auto;
        box-sizing: border-box;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-radius: 14px;
        border: 1px solid var(--color-border-light);
        background: var(--color-background);
      }
      .dp-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .dp-close {
        width: 26px;
        height: 26px;
        padding: 0;
        flex: none;
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
      h2 {
        font-size: 1.1rem;
      }
      .dp-note {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .dp-tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 8px;
      }
      .dp-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 6px;
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        background: var(--color-surface);
        color: inherit;
        cursor: pointer;
      }
      .dp-tile small {
        opacity: 0.7;
      }
      .dp-icon {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-size: 1.3rem;
        background: var(--color-border-light);
      }
      .dp-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .dp-icon svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
      }
      .dp-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .dp-chip {
        padding: 4px 10px;
        border: 1px solid var(--color-border-light);
        border-radius: 14px;
        background: var(--color-surface);
        color: inherit;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .dp-chip--pile {
        font-size: 0.9rem;
        padding: 6px 14px;
      }
      .dp-chip--on {
        background: var(--color-primary, #1976d2);
        border-color: var(--color-primary, #1976d2);
        color: #fff;
      }
      .dp-search {
        padding: 8px;
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        background: var(--color-input-bg, var(--color-surface));
        color: inherit;
      }
      .dp-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 8px;
      }
      .dp-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        padding: 8px 10px;
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        background: var(--color-surface);
        color: inherit;
        text-align: start;
        cursor: pointer;
      }
      .dp-card-title {
        font-size: 0.9rem;
      }
      .dp-facts {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .dp-facts small {
        padding: 1px 6px;
        border-radius: 8px;
        background: var(--color-border-light);
        font-size: 0.7rem;
      }
      .dp-wide {
        width: 100%;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
      }
    `,
  ],
})
export class DebugPanelComponent {
  /** Where the panel starts: a pile (the symbol of a card), or nothing (the debug symbol of the screen). */
  @Input() set start(value: { tile?: string; pile?: string } | null) {
    const tile = value?.tile as Place | undefined;
    this.place.set(tile && PLACES.includes(tile) ? tile : null);
    this.stack.set(value?.pile ?? 'seed');
    this.filterA.set('');
    this.filterB.set('');
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

  readonly placeList = PLACES;
  readonly piles: ('seed' | 'sapling' | 'tree')[] = ['seed', 'sapling', 'tree'];
  readonly sprout = SPROUT_PATH;
  readonly place = signal<Place | null>(null);
  /** The Opportunity stack that is open: seed, sapling or tree. */
  readonly stack = signal('seed');
  readonly filterA = signal('');
  readonly filterB = signal('');
  readonly query = signal('');

  get w(): Words {
    return this.lang.slice(0, 2) === 'de' ? { ...EN, ...DE } : EN;
  }

  pileOf(place: Place | null): Pile | null {
    return place && (PILES as string[]).includes(place) ? (place as Pile) : null;
  }

  pileIcon(name: string): string {
    return name === 'seed' ? '🌱' : name === 'sapling' ? '🌿' : '🌳';
  }

  image(place: Place): string {
    return place === 'emergency' || place === 'dream' ? (TILE_ICONS[place].image ?? '') : '';
  }

  glyph(place: Place): string {
    return place === 'opportunity' ? '' : (TILE_ICONS[place].glyph ?? '');
  }

  private get set() {
    return CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');
  }

  private l(value: { en?: string; de?: string } | string | undefined, fallback: string): string {
    if (typeof value === 'string') return value;
    return (this.lang.slice(0, 2) === 'de' ? value?.de : value?.en) ?? value?.en ?? fallback;
  }

  private money(minor: number): string {
    return Math.round(minor / 100).toLocaleString(
      this.lang.slice(0, 2) === 'de' ? 'de-DE' : 'en-US',
    );
  }

  private raw(pile: Pile): RawCard[] {
    return ((this.set?.decks as unknown as Record<string, unknown[]> | undefined)?.[pile] ??
      []) as RawCard[];
  }

  count(place: Place): number {
    const pile = this.pileOf(place);
    return pile ? this.raw(pile).length : 0;
  }

  /** The cards of a pile with what is told of each: the two filters and the key facts. */
  private cardsOf(pile: Pile): DebugCard[] {
    const w = this.w;
    return this.raw(pile).map((card) => {
      let a: string;
      let b = '';
      const facts: string[] = [];
      const rolls = Array.isArray(card.dice) && card.dice.length > 0;
      if (pile === 'opportunity') {
        a = card.growType ?? '';
        b = (card.category ?? '').split('·')[1]?.trim() ?? '';
        if (b) facts.push(b);
        if (rolls) facts.push(`🎲 ${w.dice}`);
        if (card.costMinor) facts.push(`${w.cost} ${this.money(card.costMinor)}`);
        else if (!rolls) facts.push(w.free);
        if (card.riskScore !== undefined) facts.push(`${w.risk} ${card.riskScore}`);
        if (a) facts.push(a);
      } else if (pile === 'emergency') {
        a = card.type ?? '';
        b = card.category ?? '';
        facts.push(card.tier ?? '', a === 'fixed' ? w.fixed : a === 'dice' ? `🎲 ${w.dice}` : a);
        const sum = (card.buckets ?? []).reduce((acc, bucket) => acc + bucket.amountMinor, 0);
        if (sum) facts.push(`${w.total} ${this.money(sum)}`);
        if (b) facts.push(b);
      } else if (pile === 'life') {
        a = card.type ?? '';
        facts.push(a);
        if (rolls) facts.push(`🎲 ${w.dice}`);
      } else if (pile === 'dream') {
        a = card.category ?? '';
        b = card.tier ?? '';
        facts.push(a, b);
        if (card.totalMinor) facts.push(`${w.total} ${this.money(card.totalMinor)}`);
        if (card.points) facts.push(`${card.points} ${w.points}`);
      } else {
        a = card.group ?? '';
        facts.push(a);
        if (card.copies && card.copies > 1) facts.push(`× ${card.copies}`);
      }
      return {
        id: card.id,
        title: this.l(card.title, card.id),
        a,
        b,
        pile: card.pile ?? '',
        facts: facts.filter(Boolean),
      };
    });
  }

  /** The cards of the open pile; of Opportunity only the open stack. */
  private readonly open = computed(() => {
    const pile = this.pileOf(this.place());
    if (!pile) return [] as DebugCard[];
    const all = this.cardsOf(pile);
    return pile === 'opportunity' ? all.filter((card) => card.pile === this.stack()) : all;
  });

  readonly filtersA = computed(() => [
    ...new Set(
      this.open()
        .map((card) => card.a)
        .filter(Boolean),
    ),
  ]);
  readonly filtersB = computed(() => [
    ...new Set(
      this.open()
        .map((card) => card.b)
        .filter(Boolean),
    ),
  ]);

  readonly shown = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const a = this.filterA();
    const b = this.filterB();
    return this.open().filter(
      (card) =>
        (!a || card.a === a) &&
        (!b || card.b === b) &&
        (!needle ||
          `${card.id} ${card.title} ${card.facts.join(' ')}`.toLowerCase().includes(needle)),
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
          stages: { id: string; title: { en?: string; de?: string }; branch?: string }[];
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

  choose(entry: Place): void {
    this.place.set(entry);
    this.filterA.set('');
    this.filterB.set('');
    this.query.set('');
  }

  /** One step back: to the choice of what to load. */
  up(): void {
    this.place.set(null);
    this.filterA.set('');
    this.filterB.set('');
    this.query.set('');
  }

  trackKey = (_: number, key: string): string => key;
  trackId = (_: number, card: { id: string }): string => card.id;
}
