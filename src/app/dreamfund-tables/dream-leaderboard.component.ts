import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppComponent } from '../app.component';
import { LanguageService } from '../shared/services/language.service';
import { DreamApiService, type DreamBoardRow, type DreamMyPlayer } from './dream-session.service';
import { dreamTexts, type DreamTexts } from './dream-texts';

/**
 * The Dreamfund leaderboard (todo/dreamfund-multiplayer.md, slice 8): a page of its own, nothing of the classic board in it. One rating
 * per difficulty - the tabs - for people who switched themselves on and for the bots (each strategy at each skill level) as they play.
 */
@Component({
  selector: 'app-dream-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../tables/tables.css', '../app.component.css'],
  template: `
    <div class="toolbar" role="banner">
      <div
        id="heading"
        role="button"
        tabindex="0"
        (click)="app.openNavBar()"
        (keydown.enter)="app.openNavBar()"
      >
        🏆 {{ t.leaderboard }}
      </div>
      <div class="spacer"></div>
      <a class="tx-btn tx-btn--small" routerLink="/dreamfund">{{ t.back }}</a>
    </div>

    <div class="lb-page">
      <div class="lb-seg">
        <button
          type="button"
          *ngFor="let d of levels"
          [class.on]="difficulty === d"
          (click)="pickDifficulty(d)"
        >
          {{ t[d] }}
        </button>
      </div>
      <div class="lb-seg">
        <button type="button" [class.on]="type === 'all'" (click)="pickType('all')">
          {{ t.everybody }}
        </button>
        <button type="button" [class.on]="type === 'human'" (click)="pickType('human')">
          {{ t.people }}
        </button>
        <button type="button" [class.on]="type === 'bot'" (click)="pickType('bot')">
          {{ t.bots }}
        </button>
      </div>

      <section class="tx-card">
        <table class="lb-table" *ngIf="rows.length; else none">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t.nameCol }}</th>
              <th>{{ t.rating }}</th>
              <th>{{ t.games }}</th>
              <th>{{ t.tableWins }}</th>
              <th>{{ t.avgPlace }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows" [class.me]="row.playerId === mine?.playerId">
              <td>{{ row.place }}</td>
              <td>
                {{ row.name }}
                <small class="tx-muted" *ngIf="row.type === 'bot'">· bot</small>
              </td>
              <td>{{ row.rating }}<small class="tx-muted" *ngIf="row.provisional"> ~</small></td>
              <td>{{ row.games }}</td>
              <td>{{ row.wins }}</td>
              <td>{{ row.avgPlace ?? '–' }}</td>
            </tr>
          </tbody>
        </table>
        <ng-template #none
          ><p class="tx-muted">{{ t.noPlayers }}</p></ng-template
        >
        <div class="tx-actions" *ngIf="next">
          <button class="tx-btn" type="button" (click)="more()">…</button>
        </div>
      </section>

      <section class="tx-card" *ngIf="mine as me">
        <h3>{{ t.myRatings }}</h3>
        <div class="lb-mine">
          <div *ngFor="let d of levels">
            <strong>{{ t[d] }}</strong>
            <span
              >{{ me.ratings[d].rating
              }}<small class="tx-muted" *ngIf="me.ratings[d].provisional"> ~</small></span
            >
            <small class="tx-muted">{{ me.ratings[d].games }} {{ t.games }}</small>
          </div>
        </div>
        <label class="lb-check"
          ><input type="checkbox" [checked]="me.visible" (change)="toggle($event)" />
          {{ t.showMe }}</label
        >
        <div *ngIf="me.recent.length">
          <h4>{{ t.recent }}</h4>
          <div class="lb-recent" *ngFor="let r of me.recent">
            <span>{{ r.name }} · {{ t[asLevel(r.difficulty)] }}</span>
            <small class="tx-muted">
              {{ t.placeCol }} {{ r.place ?? '–' }} ·
              <ng-container *ngIf="r.counted">{{ r.ratingChange ?? 0 }}</ng-container>
              <ng-container *ngIf="!r.counted">{{ t.notCounted }}</ng-container>
            </small>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .lb-page {
        max-width: 760px;
        margin: 0 auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .lb-seg {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .lb-seg button {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text);
        padding: 0.45rem 0.9rem;
        border-radius: 6px;
        cursor: pointer;
      }
      .lb-seg button.on {
        border-color: var(--color-primary);
        background: var(--color-primary-soft, rgba(25, 118, 210, 0.12));
      }
      .lb-table {
        width: 100%;
        border-collapse: collapse;
      }
      .lb-table th,
      .lb-table td {
        text-align: left;
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid var(--color-border);
      }
      .lb-table tr.me {
        background: var(--color-primary-soft, rgba(25, 118, 210, 0.08));
      }
      .lb-mine {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.6rem;
      }
      .lb-mine > div {
        display: flex;
        flex-direction: column;
      }
      .lb-check {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin: 0.4rem 0;
      }
      .lb-recent {
        display: flex;
        justify-content: space-between;
        padding: 0.2rem 0;
      }
    `,
  ],
})
export class DreamLeaderboardComponent implements OnInit {
  private readonly api = inject(DreamApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly language = inject(LanguageService);

  readonly app = AppComponent;
  readonly levels = ['easy', 'medium', 'hard'] as const;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  type: 'all' | 'human' | 'bot' = 'all';
  rows: DreamBoardRow[] = [];
  next: string | null = null;
  mine: DreamMyPlayer | null = null;

  get t(): DreamTexts {
    return dreamTexts(this.language.current);
  }
  asLevel(value: string): 'easy' | 'medium' | 'hard' {
    return value === 'easy' || value === 'hard' ? value : 'medium';
  }

  ngOnInit(): void {
    this.load();
    this.api.me().subscribe({
      next: (me) => {
        this.mine = me;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  pickDifficulty(difficulty: 'easy' | 'medium' | 'hard'): void {
    this.difficulty = difficulty;
    this.load();
  }

  pickType(type: 'all' | 'human' | 'bot'): void {
    this.type = type;
    this.load();
  }

  private load(): void {
    this.api.leaderboard(this.difficulty, this.type).subscribe({
      next: (page) => {
        this.rows = page.items;
        this.next = page.next;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  more(): void {
    if (!this.next) return;
    this.api.leaderboard(this.difficulty, this.type, this.next).subscribe({
      next: (page) => {
        this.rows = [...this.rows, ...page.items];
        this.next = page.next;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  toggle(event: Event): void {
    const visible = (event.target as HTMLInputElement).checked;
    this.api.setVisible(visible).subscribe({
      next: (me) => {
        this.mine = me;
        this.load();
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }
}
