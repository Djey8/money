import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { TablesApiService, type GamePlayer } from './tables-api.service';
import { leaderboardTexts, type LeaderboardTexts } from './leaderboard.texts';

/**
 * One player of the leaderboard, opened from its list: a panel like the app's own info panels - who they are, the rating, the
 * numbers of their games as cards, how the rating moved over their last games and those games one by one. Self-hosted game
 * accounts only (the lazy tables chunk).
 */
@Component({
  selector: 'app-table-player-info',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pi-backdrop" (click)="closed.emit()"></div>
    <aside
      class="pi-panel"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="player.name"
      [attr.dir]="rtl ? 'rtl' : 'ltr'"
    >
      <header class="pi-head">
        <span class="pi-avatar" [class.pi-avatar--bot]="player.type === 'bot'" aria-hidden="true"
          >{{ player.type === 'bot' ? '🤖' : initial
          }}<img
            *ngIf="pictureSrc as src"
            class="pi-photo"
            [src]="src"
            alt=""
            (error)="$any($event.target).style.display = 'none'"
        /></span>
        <div class="pi-who">
          <h3>{{ player.name }}</h3>
          <span class="pi-sub">
            {{ player.type === 'bot' ? t.typeBot : t.typeHuman }}
            <ng-container *ngIf="player.type === 'bot' && player.level">
              · {{ t.level[player.level] }}</ng-container
            >
            <ng-container *ngIf="player.place"> · #{{ player.place }}</ng-container>
          </span>
        </div>
        <button type="button" class="pi-close" [attr.aria-label]="t.close" (click)="closed.emit()">
          ✕
        </button>
      </header>

      <section class="pi-rating">
        <strong class="pi-rating-value">{{ player.rating }}</strong>
        <span class="pi-rating-label">{{ t.colRating }}</span>
        <small *ngIf="player.provisional" class="pi-note">{{ t.provisionalNote }}</small>
      </section>

      <section class="pi-grid" [attr.aria-label]="t.statistics">
        <div class="pi-stat">
          <strong>{{ player.games }}</strong
          ><span>{{ t.games }}</span>
        </div>
        <div class="pi-stat">
          <strong>{{ player.wins }}</strong
          ><span>{{ t.wins }}</span>
        </div>
        <div class="pi-stat">
          <strong>{{ player.winRate }}%</strong><span>{{ t.winRateLabel }}</span>
        </div>
        <div class="pi-stat">
          <strong>{{ player.avgPlace ?? '–' }}</strong
          ><span>{{ t.avgPlace }}</span>
        </div>
        <div class="pi-stat">
          <strong>{{ player.bestPlace ?? '–' }}</strong
          ><span>{{ t.bestPlace }}</span>
        </div>
        <div class="pi-stat">
          <strong>{{ player.peakRating }}</strong
          ><span>{{ t.peak }}</span>
        </div>
        <div class="pi-stat">
          <strong>{{ player.escaped }}</strong
          ><span>{{ t.escaped }}</span>
        </div>
        <div class="pi-stat pi-stat--bad">
          <strong>{{ player.bankruptcies }}</strong
          ><span>{{ t.bankruptcies }}</span>
        </div>
        <div class="pi-stat pi-stat--bad">
          <strong>{{ player.gaveUp }}</strong
          ><span>{{ t.gaveUp }}</span>
        </div>
      </section>

      <section class="pi-trend" *ngIf="chart as c">
        <h4>{{ t.trend }}</h4>
        <svg
          class="pi-chart"
          [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
          role="img"
          [attr.aria-label]="t.trend"
        >
          <!-- the rating axis: three levels, as numbers -->
          <g class="pi-grid-lines">
            <ng-container *ngFor="let tick of c.yTicks">
              <line
                [attr.x1]="c.left"
                [attr.x2]="c.width - c.right"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
              />
              <text class="pi-axis-y" [attr.x]="c.left - 6" [attr.y]="tick.y">
                {{ tick.label }}
              </text>
            </ng-container>
          </g>
          <!-- the games axis: the first, the last and the middle one -->
          <ng-container *ngFor="let tick of c.xTicks; let first = first; let last = last">
            <line
              class="pi-tick"
              [attr.x1]="tick.x"
              [attr.x2]="tick.x"
              [attr.y1]="c.height - c.bottom"
              [attr.y2]="c.height - c.bottom + 4"
            />
            <text
              class="pi-axis-x"
              [style.text-anchor]="first ? 'start' : last ? 'end' : 'middle'"
              [attr.x]="first ? c.left : last ? c.width - 2 : tick.x"
              [attr.y]="c.height - 8"
            >
              {{ tick.label }}
            </text>
          </ng-container>
          <polygon class="pi-area" [attr.points]="c.area" />
          <polyline class="pi-line" [attr.points]="c.line" fill="none" />
          <circle
            *ngFor="let dot of c.dots"
            class="pi-dot"
            [class.pi-dot--last]="dot.last"
            [attr.cx]="dot.x"
            [attr.cy]="dot.y"
            r="3.5"
          >
            <title>{{ dot.label }}</title>
          </circle>
        </svg>
        <p class="pi-axis-note">{{ t.axisNote }}</p>
      </section>

      <section class="pi-recent">
        <h4>{{ t.recent }}</h4>
        <p class="pi-empty" *ngIf="loaded && !detail?.recent?.length">{{ t.noGames }}</p>
        <!-- the last five games are in view; the rest scrolls inside the list -->
        <ul #recentList [style.max-height.px]="recentMax">
          <li *ngFor="let r of detail?.recent">
            <span class="pi-place" [attr.data-place]="r.place">{{ medal(r.place) }}</span>
            <span class="pi-game">
              <strong>{{ r.table }}</strong>
              <small>
                {{ r.endedAt | date: 'dd.MM.yyyy HH:mm' }} · {{ r.players }}
                <ng-container *ngIf="!r.ranked">
                  · {{ t.notRanked
                  }}<ng-container *ngIf="r.notRankedBecause">
                    ({{ t.why[r.notRankedBecause] || r.notRankedBecause }})</ng-container
                  ></ng-container
                >
              </small>
            </span>
            <span
              class="pi-delta"
              *ngIf="r.ranked"
              [class.pi-delta--up]="r.ratingChange > 0"
              [class.pi-delta--down]="r.ratingChange < 0"
              >{{ r.ratingChange > 0 ? '+' : '' }}{{ r.ratingChange }}</span
            >
          </li>
        </ul>
      </section>
    </aside>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: block;
      }
      .pi-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
      }
      .pi-panel {
        position: absolute;
        top: 0;
        bottom: 0;
        inset-inline-end: 0;
        width: min(100%, 440px);
        overflow-y: auto;
        background: var(--color-surface, #fff);
        color: var(--color-text, #222);
        border-inline-start: 1px solid var(--color-border-light, #ddd);
        box-shadow: var(--shadow-lg, -8px 0 24px rgba(0, 0, 0, 0.25));
        padding: 16px 16px 28px;
        box-sizing: border-box;
        max-width: 100vw;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      /* the sections keep their own height (the panel scrolls, they are not squeezed to fit it) and may not push it wider */
      .pi-panel > * {
        flex: none;
        min-width: 0;
        max-width: 100%;
      }
      .pi-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pi-avatar {
        position: relative;
        overflow: hidden;
        flex: none;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 1.5rem;
        font-weight: 700;
        color: #fff;
        background: var(--color-primary, #1976d2);
      }
      .pi-photo {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .pi-avatar--bot {
        background: var(--color-surface-alt, #eef1f4);
      }
      .pi-who {
        flex: 1 1 auto;
        min-width: 0;
      }
      .pi-who h3 {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .pi-sub {
        color: var(--color-text-secondary, #666);
        font-size: 0.9rem;
      }
      .pi-close {
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid var(--color-border, #ddd);
        background: var(--color-surface, #fff);
        cursor: pointer;
        font-size: 1rem;
      }
      .pi-rating {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 14px;
        border-radius: 12px;
        background: var(--color-surface-alt, #f4f6f8);
      }
      .pi-rating-value {
        font-size: 2.6rem;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--color-primary, #1976d2);
      }
      .pi-rating-label {
        color: var(--color-text-secondary, #666);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .pi-note {
        margin-top: 6px;
        text-align: center;
        color: var(--color-text-secondary, #666);
      }
      .pi-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .pi-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 6px;
        border: 1px solid var(--color-border-light, #e5e5e5);
        border-radius: 10px;
        text-align: center;
      }
      .pi-stat strong {
        font-size: 1.3rem;
        font-variant-numeric: tabular-nums;
      }
      .pi-stat span {
        font-size: 0.78rem;
        color: var(--color-text-secondary, #666);
      }
      .pi-stat--bad strong {
        color: var(--color-danger, #c0392b);
      }
      h4 {
        margin: 0 0 6px;
        font-size: 0.95rem;
      }
      .pi-chart {
        display: block;
        width: 100%;
        height: auto;
        color: var(--color-primary, #1976d2);
        background: var(--color-surface-alt, #f4f6f8);
        border-radius: 10px;
      }
      .pi-grid-lines line {
        stroke: var(--color-border, #d5d9de);
        stroke-width: 1;
        stroke-dasharray: 3 3;
      }
      .pi-tick {
        stroke: var(--color-text-secondary, #666);
        stroke-width: 1;
      }
      .pi-axis-y,
      .pi-axis-x {
        font-size: 10px;
        fill: var(--color-text-secondary, #666);
      }
      .pi-axis-y {
        text-anchor: end;
        dominant-baseline: central;
      }
      .pi-axis-x {
        text-anchor: middle;
      }
      .pi-area {
        fill: currentColor;
        opacity: 0.12;
      }
      .pi-line {
        stroke: currentColor;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .pi-dot {
        fill: var(--color-surface, #fff);
        stroke: currentColor;
        stroke-width: 2;
      }
      .pi-dot--last {
        fill: currentColor;
      }
      .pi-axis-note {
        margin: 4px 0 0;
        font-size: 0.78rem;
        color: var(--color-text-secondary, #666);
      }
      .pi-recent ul {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .pi-recent li {
        display: grid;
        grid-template-columns: 2.4rem minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--color-border-light, #eee);
      }
      .pi-recent li:last-child {
        border-bottom: 0;
      }
      .pi-place {
        text-align: center;
        font-weight: 700;
        font-size: 1.15rem;
      }
      .pi-game {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .pi-game small {
        color: var(--color-text-secondary, #666);
      }
      .pi-delta {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .pi-delta--up {
        color: var(--color-success, #1e8449);
      }
      .pi-delta--down {
        color: var(--color-danger, #c0392b);
      }
      .pi-empty {
        color: var(--color-text-secondary, #666);
      }
      @media (max-width: 520px) {
        .pi-panel {
          width: 100%;
          padding: 12px 12px 24px;
          gap: 12px;
        }
        .pi-rating-value {
          font-size: 2.2rem;
        }
        .pi-stat {
          padding: 8px 4px;
        }
        .pi-stat strong {
          font-size: 1.1rem;
        }
        .pi-stat span {
          font-size: 0.72rem;
          overflow-wrap: anywhere;
        }
        .pi-recent li {
          grid-template-columns: 2rem minmax(0, 1fr) auto;
          gap: 8px;
        }
      }
    `,
  ],
})
export class TablePlayerInfoComponent implements OnChanges {
  @Input({ required: true }) player!: GamePlayer;
  @Output() closed = new EventEmitter<void>();

  t: LeaderboardTexts;
  rtl: boolean;
  detail: GamePlayer | null = null;
  loaded = false;
  /** The list of the last games is as high as its first five rows (null: five or fewer); the rest scrolls. */
  recentMax: number | null = null;
  @ViewChild('recentList') private recentList?: ElementRef<HTMLElement>;

  constructor(
    private api: TablesApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.t = leaderboardTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
  }

  get pictureSrc(): string | null {
    return this.api.pictureUrl(this.player);
  }

  get initial(): string {
    return (this.player.name || '?').trim().charAt(0).toUpperCase();
  }

  ngOnChanges(): void {
    this.detail = null;
    this.loaded = false;
    this.api.player(this.player.playerId).subscribe({
      next: (full) => {
        this.detail = full;
        this.loaded = true;
        this.cdr.markForCheck();
        setTimeout(() => this.fitRecent());
      },
      error: () => {
        this.loaded = true;
        this.cdr.markForCheck();
      },
    });
  }

  /** Measured, because a game is two to four lines high depending on the width of the screen. */
  @HostListener('window:resize')
  fitRecent(): void {
    const list = this.recentList?.nativeElement;
    const rows = list ? Array.from(list.querySelectorAll<HTMLElement>(':scope > li')) : [];
    const before = this.recentMax;
    this.recentMax =
      list && rows.length > 5
        ? Math.ceil(rows[4].getBoundingClientRect().bottom - list.getBoundingClientRect().top)
        : null;
    if (before !== this.recentMax) this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  medal(place: number): string {
    return place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `#${place}`;
  }

  /**
   * The rating after each of the last games, oldest first, as a chart with its axes: the rating on the left (three levels, in
   * numbers), the games along the bottom (their number, and the date of the first and the last), a dot for every game.
   */
  get chart(): Chart | null {
    const games = [...(this.detail?.recent ?? [])].reverse();
    if (games.length < 2) return null;
    const width = 320;
    const height = 170;
    const left = 40;
    const right = 12;
    const top = 12;
    const bottom = 30;
    const values = games.map((game) => game.ratingAfter);
    const rawLow = Math.min(...values);
    const rawHigh = Math.max(...values);
    // a little air above and below, and never a flat axis
    const pad = Math.max(5, Math.round((rawHigh - rawLow) * 0.12));
    const low = rawLow - pad;
    const high = rawHigh + pad;
    const span = high - low;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const x = (index: number) => left + (index * plotW) / (games.length - 1);
    const y = (value: number) => top + plotH - ((value - low) / span) * plotH;
    const dots = games.map((game, index) => ({
      x: x(index),
      y: y(game.ratingAfter),
      last: index === games.length - 1,
      label: `${game.table}: ${game.ratingAfter} (${game.ratingChange > 0 ? '+' : ''}${game.ratingChange})`,
    }));
    const line = dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
    const base = top + plotH;
    const area = `${left},${base} ${line} ${dots[dots.length - 1].x},${base}`;
    const levels = [high, (high + low) / 2, low];
    const yTicks = levels.map((value) => ({ y: y(value), label: String(Math.round(value)) }));
    const day = (iso: string) => {
      const date = new Date(iso);
      return Number.isNaN(date.getTime())
        ? ''
        : `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
    };
    const xTicks = [0, Math.floor((games.length - 1) / 2), games.length - 1]
      .filter((index, at, all) => all.indexOf(index) === at)
      .map((index) => ({
        x: x(index),
        label:
          index === 0 || index === games.length - 1
            ? `${index + 1} · ${day(games[index].endedAt)}`.trim()
            : String(index + 1),
      }));
    return { width, height, left, right, bottom, line, area, dots, yTicks, xTicks };
  }
}

interface Chart {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  line: string;
  area: string;
  dots: { x: number; y: number; last: boolean; label: string }[];
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
}
