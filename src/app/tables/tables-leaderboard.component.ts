import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TablesApiService, type GamePlayer } from './tables-api.service';
import { leaderboardTexts, type LeaderboardTexts } from './leaderboard.texts';
import { TablePlayerInfoComponent } from './table-player-info.component';
import {
  DreamApiService,
  type DreamBoardRow,
  type DreamMyPlayer,
} from '../dreamfund-tables/dream-session.service';
import { dreamTexts, type DreamTexts } from '../dreamfund-tables/dream-texts';
import { keepGame, savedGame, type TableGame } from './table-game';

type Filter = 'all' | 'human' | 'bot';

/**
 * The Cashflow leaderboard (todo/cashflow-leaderboard.md §10): the players by rating - humans who opted in, and every bot persona at
 * every level - as a list whose columns line up, with the player's own rating and the switch for being listed. A row opens the
 * player's own panel (all their numbers). Rows, never a wide table: nothing scrolls sideways. Self-hosted game accounts only.
 */
@Component({
  selector: 'app-tables-leaderboard',
  standalone: true,
  imports: [CommonModule, TablePlayerInfoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tables.css'],
  template: `
    <section class="lb" [attr.dir]="rtl ? 'rtl' : 'ltr'">
      <div class="lb-tabs" role="radiogroup" [attr.aria-label]="d.gameChoice">
        <button
          type="button"
          role="radio"
          class="lb-tab"
          [class.lb-tab--on]="game === 'classic'"
          [attr.aria-checked]="game === 'classic'"
          (click)="setGame('classic')"
        >
          {{ d.gameClassic }}
        </button>
        <button
          type="button"
          role="radio"
          class="lb-tab"
          [class.lb-tab--on]="game === 'dreamfund'"
          [attr.aria-checked]="game === 'dreamfund'"
          (click)="setGame('dreamfund')"
        >
          {{ d.gameDream }}
        </button>
      </div>
      <!-- the Dreamfund has one rating for each difficulty -->
      <div class="lb-tabs" role="tablist" *ngIf="game === 'dreamfund'">
        <button
          *ngFor="let level of levels"
          type="button"
          role="tab"
          class="lb-tab"
          [class.lb-tab--on]="difficulty === level"
          [attr.aria-selected]="difficulty === level"
          (click)="chooseDifficulty(level)"
        >
          {{ d[level] }}
        </button>
      </div>
      <div class="lb-me" *ngIf="me as mine">
        <button type="button" class="lb-me-card" (click)="open(mine)">
          <span class="lb-me-rating">{{ mine.rating }}</span>
          <span class="lb-me-text">
            <strong>{{ t.myRating }}</strong>
            <small *ngIf="mine.provisional">{{ t.provisional }}</small>
            <small *ngIf="!mine.provisional">{{ mine.wins }} / {{ mine.games }}</small>
          </span>
        </button>
        <label class="lb-switch">
          <input type="checkbox" [checked]="!!mine.visible" (change)="toggleVisible($event)" />
          <span>{{ t.showMe }}</span>
        </label>
      </div>

      <div class="lb-tabs" role="tablist">
        <button
          *ngFor="let f of filters"
          type="button"
          role="tab"
          class="lb-tab"
          [class.lb-tab--on]="filter === f.id"
          [attr.aria-selected]="filter === f.id"
          (click)="choose(f.id)"
        >
          {{ f.label }}
        </button>
      </div>

      <p class="lb-empty" *ngIf="!loading && !items.length">{{ t.empty }}</p>

      <div class="lb-head" *ngIf="items.length" aria-hidden="true">
        <span></span><span>{{ t.colPlayer }}</span
        ><span class="lb-num">{{ t.colRating }}</span
        ><span class="lb-num">{{ t.colRecord }}</span>
      </div>
      <ol class="lb-list" *ngIf="items.length">
        <li *ngFor="let p of items" class="lb-item">
          <button type="button" class="lb-row" (click)="open(p)">
            <span class="lb-place" [attr.data-place]="p.place">{{ medal(p.place) }}</span>
            <span class="lb-player">
              <span class="lb-avatar" [class.lb-avatar--bot]="p.type === 'bot'" aria-hidden="true"
                >{{ p.type === 'bot' ? '🤖' : initial(p)
                }}<img
                  *ngIf="pictureOf(p) as src"
                  class="lb-photo"
                  [src]="src"
                  alt=""
                  (error)="$any($event.target).style.display = 'none'"
              /></span>
              <span class="lb-name">
                <strong>{{ p.name }}</strong>
                <small>{{ sub(p) }}</small>
              </span>
            </span>
            <span class="lb-num lb-rating"
              >{{ p.rating }}<small *ngIf="p.provisional"> ~</small></span
            >
            <span class="lb-num lb-record">{{ p.wins }} / {{ p.games }}</span>
          </button>
        </li>
      </ol>
      <button type="button" class="tx-btn tx-btn--small lb-more" *ngIf="next" (click)="more()">
        {{ t.more }}
      </button>
      <p class="lb-hint">{{ t.hint }}</p>
    </section>

    <app-table-player-info
      *ngIf="selected as chosen"
      [player]="chosen"
      (closed)="selected = null"
    ></app-table-player-info>
  `,
  styles: [
    `
      .lb {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .lb-me {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .lb-me-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--color-border, #ddd);
        background: var(--color-surface-alt, #f4f6f8);
        color: inherit;
        font: inherit;
        cursor: pointer;
        text-align: start;
      }
      .lb-me-rating {
        font-size: 1.9rem;
        font-weight: 700;
        line-height: 1;
        color: var(--color-primary, #1976d2);
        font-variant-numeric: tabular-nums;
      }
      .lb-me-text {
        display: flex;
        flex-direction: column;
      }
      .lb-me-text small {
        color: var(--color-text-secondary, #666);
      }
      .lb-switch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
      }
      .lb-tabs {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        background: var(--color-surface-alt, #f4f6f8);
        align-self: flex-start;
      }
      .lb-tab {
        border: 0;
        background: transparent;
        color: inherit;
        padding: 6px 16px;
        border-radius: 999px;
        font: inherit;
        cursor: pointer;
      }
      .lb-tab--on {
        background: var(--color-primary, #1976d2);
        color: #fff;
        font-weight: 600;
      }
      .lb-head,
      .lb-row {
        display: grid;
        grid-template-columns: 2.6rem minmax(0, 1fr) 4.2rem 4.6rem;
        gap: 8px;
        align-items: center;
      }
      .lb-head {
        padding: 0 8px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-secondary, #666);
      }
      .lb-num {
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .lb-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .lb-row {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--color-border-light, #e5e5e5);
        border-radius: 10px;
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .lb-row:hover,
      .lb-row:focus-visible {
        border-color: var(--color-primary, #1976d2);
      }
      .lb-place {
        text-align: center;
        font-weight: 700;
        color: var(--color-text-secondary, #666);
      }
      .lb-place[data-place='1'],
      .lb-place[data-place='2'],
      .lb-place[data-place='3'] {
        font-size: 1.25rem;
      }
      .lb-player {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .lb-avatar {
        position: relative;
        overflow: hidden;
        flex: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 700;
        color: #fff;
        background: var(--color-primary, #1976d2);
      }
      .lb-photo {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .lb-avatar--bot {
        background: var(--color-surface-alt, #eef1f4);
      }
      .lb-name {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .lb-name strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lb-name small {
        color: var(--color-text-secondary, #666);
      }
      .lb-rating {
        font-weight: 700;
      }
      .lb-record {
        color: var(--color-text-secondary, #666);
      }
      .lb-empty,
      .lb-hint {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
        margin: 0;
      }
      .lb-more {
        align-self: center;
      }
      @media (max-width: 420px) {
        .lb-head,
        .lb-row {
          grid-template-columns: 2.2rem minmax(0, 1fr) 3.6rem 3.6rem;
        }
      }
    `,
  ],
})
export class TablesLeaderboardComponent implements OnInit {
  t: LeaderboardTexts;
  d: DreamTexts;
  rtl: boolean;
  /** The game of the board: the classic Cashflow's, or the Dreamfund's (shared with the lobby, kept on this device). */
  game: TableGame = savedGame();
  readonly levels = ['easy', 'medium', 'hard'] as const;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  filter: Filter = 'all';
  items: GamePlayer[] = [];
  next: string | null = null;
  me: GamePlayer | null = null;
  loading = true;
  selected: GamePlayer | null = null;

  constructor(
    private api: TablesApiService,
    private dreamApi: DreamApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.t = leaderboardTexts(lang);
    this.d = dreamTexts(lang);
    this.rtl = lang.toLowerCase().startsWith('ar');
  }

  get filters(): { id: Filter; label: string }[] {
    return [
      { id: 'all', label: this.t.all },
      { id: 'human', label: this.t.humans },
      { id: 'bot', label: this.t.bots },
    ];
  }

  ngOnInit(): void {
    this.loadMe();
    this.load();
  }

  setGame(game: TableGame): void {
    if (game === this.game) return;
    this.game = game;
    keepGame(game);
    this.items = [];
    this.next = null;
    this.me = null;
    this.loadMe();
    this.load();
  }

  chooseDifficulty(level: 'easy' | 'medium' | 'hard'): void {
    this.difficulty = level;
    this.load();
    this.loadMe();
  }

  /** A player of the classic board opens their panel (the Dreamfund board has none yet). */
  open(player: GamePlayer): void {
    if (this.game === 'classic') this.selected = player;
  }

  /** One row of the Dreamfund board in the shape of the classic one, so the same list shows both. */
  private fromDream(row: DreamBoardRow): GamePlayer {
    return {
      place: row.place,
      // the picture is fetched by the id it is kept under
      playerId: row.pictureId ?? row.playerId,
      ...(row.pictureVersion ? { pictureVersion: row.pictureVersion } : {}),
      name: row.name,
      type: row.type,
      rating: row.rating,
      peakRating: row.peakRating,
      ratedGames: row.ratedGames,
      provisional: row.provisional,
      games: row.games,
      wins: row.wins,
      losses: 0,
      gaveUp: 0,
      bankruptcies: row.bankruptcies,
      escaped: row.won,
      winRate: row.games ? row.wins / row.games : 0,
      avgPlace: row.avgPlace,
      bestPlace: null,
      ...(row.level ? { level: row.level } : {}),
    } as GamePlayer;
  }

  private fromDreamMe(me: DreamMyPlayer): GamePlayer {
    return {
      ...this.fromDream({
        ...me.ratings[this.difficulty],
        pictureId: me.pictureId,
        pictureVersion: me.pictureVersion,
      }),
      visible: me.visible,
    };
  }

  private loadMe(): void {
    const done = (me: GamePlayer) => {
      this.me = me;
      this.cdr.markForCheck();
    };
    if (this.game === 'dreamfund') {
      this.dreamApi
        .me()
        .subscribe({ next: (me) => done(this.fromDreamMe(me)), error: () => undefined });
    } else {
      this.api.me().subscribe({ next: done, error: () => undefined });
    }
  }

  choose(filter: Filter): void {
    this.filter = filter;
    this.load();
  }

  medal(place: number | undefined): string {
    return place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : String(place ?? '');
  }

  pictureOf(player: GamePlayer): string | null {
    return this.api.pictureUrl(player);
  }

  initial(player: GamePlayer): string {
    return (player.name || '?').trim().charAt(0).toUpperCase();
  }

  /** The line under a name: a bot's level, or that it is a player. */
  sub(player: GamePlayer): string {
    if (player.type === 'bot') {
      return `${this.t.typeBot}${player.level ? ' · ' + this.t.level[player.level] : ''}`;
    }
    return this.t.typeHuman;
  }

  private load(): void {
    this.loading = true;
    const source =
      this.game === 'dreamfund'
        ? this.dreamApi
            .leaderboard(this.difficulty, this.filter)
            .pipe(map((page) => ({ ...page, items: page.items.map((row) => this.fromDream(row)) })))
        : this.api.leaderboard(this.filter);
    source.subscribe({
      next: (page) => {
        this.items = page.items;
        this.next = page.next;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  more(): void {
    if (!this.next) return;
    const source =
      this.game === 'dreamfund'
        ? this.dreamApi
            .leaderboard(this.difficulty, this.filter, this.next)
            .pipe(map((page) => ({ ...page, items: page.items.map((row) => this.fromDream(row)) })))
        : this.api.leaderboard(this.filter, this.next);
    source.subscribe({
      next: (page) => {
        this.items = [...this.items, ...page.items];
        this.next = page.next;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  toggleVisible(event: Event): void {
    const visible = (event.target as HTMLInputElement).checked;
    if (this.game === 'dreamfund') {
      this.dreamApi.setVisible(visible).subscribe({
        next: (me) => {
          this.me = this.fromDreamMe(me);
          this.load();
        },
        error: () => undefined,
      });
      return;
    }
    this.api.setVisible(visible).subscribe({
      next: (me) => {
        this.me = me;
        this.load();
      },
      error: () => undefined,
    });
  }
}
