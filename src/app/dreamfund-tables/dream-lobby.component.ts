import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppComponent } from '../app.component';
import { ProfileComponent } from '../panels/profile/profile.component';
import { BoardThumbComponent } from '../main/cashflow-game/board-thumb.component';
import { LanguageService } from '../shared/services/language.service';
import { DreamApiService, type DreamTableSummary } from './dream-session.service';
import { dreamTexts, type DreamTexts } from './dream-texts';

/** The account's own name: the one name at every table. */
function accountName(): string {
  const name = ProfileComponent.username;
  return name && name !== 'Username' ? name.slice(0, 24) : 'Player';
}

const SHAPES = ['ring', 'infinity', 'rectangle', 'square', 'mountain'] as const;
const SIZES = ['small', 'medium', 'large'] as const;

/**
 * The lobby of the Dreamfund tables (todo/dreamfund-multiplayer.md, slice 7): find a table, open one with the settings of the solo game
 * (difficulty, map, rules) and the table's own (seats, characters, clock, end), join with a code. A world of its own - the classic
 * tables have their page, nothing is shared with it. Self-hosted game accounts only.
 */
@Component({
  selector: 'app-dream-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BoardThumbComponent],
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
        {{ t.title }}
      </div>
      <div class="spacer"></div>
      <button
        id="addbtn"
        class="add-circle-btn"
        [attr.aria-label]="t.newTable"
        [title]="t.newTable"
        (click)="showForm = !showForm"
      >
        +
      </button>
    </div>

    <div class="dl-page">
      <nav class="dl-nav">
        <a routerLink="/tables">{{ t.classicLink }}</a>
        <a routerLink="/docs/dreamfund">ⓘ</a>
      </nav>
      <p class="dl-problem" *ngIf="problem">{{ problem }}</p>

      <!-- open a table: the settings of the solo game and of the table -->
      <section class="tx-card dl-form" *ngIf="showForm">
        <h3>{{ t.newTable }}</h3>
        <label class="tx-field">
          <span>{{ t.tableName }}</span>
          <input type="text" maxlength="60" [(ngModel)]="form.name" />
        </label>

        <div class="tx-field">
          <span>{{ t.difficulty }}</span>
          <div class="dl-seg">
            <button
              type="button"
              *ngFor="let d of levels"
              [class.on]="form.difficulty === d"
              (click)="form.difficulty = d"
            >
              {{ t[d] }}
            </button>
          </div>
          <small class="tx-muted">{{ hint }}</small>
        </div>

        <div class="tx-field">
          <span>{{ t.map }}</span>
          <div class="dl-maps">
            <button
              type="button"
              *ngFor="let s of shapes"
              class="dl-map"
              [class.on]="form.shape === s"
              (click)="form.shape = s"
            >
              <app-board-thumb [shape]="s" [size]="form.size" [seed]="7"></app-board-thumb>
              <small>{{ s }}</small>
            </button>
          </div>
          <div class="dl-seg">
            <button
              type="button"
              *ngFor="let z of sizes"
              [class.on]="form.size === z"
              (click)="form.size = z"
            >
              {{ sizeText(z) }}
            </button>
          </div>
        </div>

        <div class="tx-field">
          <span>{{ t.mode }}</span>
          <div class="dl-seg">
            <button
              type="button"
              [class.on]="form.mode === 'guided'"
              (click)="form.mode = 'guided'"
            >
              {{ t.guided }}
            </button>
            <button
              type="button"
              [class.on]="form.mode === 'strict'"
              (click)="form.mode = 'strict'"
            >
              {{ t.strict }}
            </button>
          </div>
        </div>

        <label class="tx-field">
          <span>{{ t.seats }}</span>
          <input type="number" min="2" max="24" [(ngModel)]="form.maxSeats" />
        </label>

        <label class="tx-field">
          <span>{{ t.characters }}</span>
          <select [(ngModel)]="form.professions">
            <option value="duplicates">{{ t.duplicates }}</option>
            <option value="unique">{{ t.unique }}</option>
            <option value="random">{{ t.random }}</option>
          </select>
        </label>

        <label class="tx-field">
          <span>{{ t.turnOrder }}</span>
          <select [(ngModel)]="form.turnOrder">
            <option value="random">{{ t.orderRandom }}</option>
            <option value="seat">{{ t.orderSeat }}</option>
          </select>
        </label>

        <label class="tx-field">
          <span>{{ t.clock }}</span>
          <select [(ngModel)]="form.clockMode">
            <option value="none">{{ t.clockNone }}</option>
            <option value="per-move">{{ t.clockPerMove }}</option>
            <option value="bank">{{ t.clockBank }}</option>
          </select>
        </label>
        <label class="tx-field" *ngIf="form.clockMode !== 'none'">
          <span
            >{{ form.clockMode === 'bank' ? t.clockBank : t.clockPerMove }} ({{ t.seconds }})</span
          >
          <input type="number" min="10" max="14400" [(ngModel)]="form.clockSeconds" />
        </label>

        <label class="tx-field">
          <span>{{ t.endCondition }}</span>
          <select [(ngModel)]="form.endCondition">
            <option value="first-win">{{ t.firstWin }}</option>
            <option value="all-done">{{ t.allDone }}</option>
            <option value="round-limit">{{ t.roundLimit }}</option>
          </select>
        </label>
        <label class="tx-field" *ngIf="form.endCondition === 'round-limit'">
          <span>{{ t.rounds }}</span>
          <input type="number" min="1" max="1000" [(ngModel)]="form.roundLimit" />
        </label>

        <label class="tx-field">
          <span>{{ t.visibility }}</span>
          <select [(ngModel)]="form.visibility">
            <option value="public">{{ t.publicTable }}</option>
            <option value="private">{{ t.privateTable }}</option>
          </select>
        </label>
        <label class="tx-field">
          <span>{{ t.pace }}</span>
          <select [(ngModel)]="form.pace">
            <option value="fast">{{ t.fast }}</option>
            <option value="normal">{{ t.normal }}</option>
            <option value="slow">{{ t.slow }}</option>
          </select>
        </label>
        <label class="dl-check"
          ><input type="checkbox" [(ngModel)]="form.spectators" /> {{ t.spectators }}</label
        >

        <div class="tx-actions">
          <button
            class="tx-btn tx-btn--primary"
            type="button"
            [disabled]="busy || !form.name.trim()"
            (click)="create()"
          >
            {{ t.create }}
          </button>
          <button class="tx-btn" type="button" (click)="showForm = false">{{ t.back }}</button>
        </div>
      </section>

      <!-- join with a code -->
      <section class="tx-card dl-join">
        <h3>{{ t.joinWithCode }}</h3>
        <div class="dl-row">
          <input
            type="text"
            maxlength="8"
            [(ngModel)]="code"
            [placeholder]="t.code"
            (keydown.enter)="joinCode()"
          />
          <button
            class="tx-btn tx-btn--primary"
            type="button"
            [disabled]="busy || code.trim().length < 4"
            (click)="joinCode()"
          >
            {{ t.join }}
          </button>
        </div>
      </section>

      <ng-container *ngFor="let list of lists">
        <section class="tx-card" *ngIf="list.items.length">
          <h3>{{ t[list.title] }}</h3>
          <div class="dl-table" *ngFor="let row of list.items">
            <div class="dl-table-main">
              <strong>{{ row.name }}</strong>
              <small>
                {{ t[asLevel(row.difficulty)] }} · {{ row.shape }} {{ row.size }} ·
                {{ row.seatsTaken }}/{{ row.maxSeats }} ·
                {{ row.hostName }}
              </small>
            </div>
            <button
              class="tx-btn tx-btn--small"
              type="button"
              *ngIf="row.joined"
              (click)="open(row.id)"
            >
              →
            </button>
            <button
              class="tx-btn tx-btn--small tx-btn--primary"
              type="button"
              *ngIf="!row.joined && list.title === 'openTables'"
              [disabled]="busy"
              (click)="joinRoom(row.id)"
            >
              {{ t.join }}
            </button>
          </div>
        </section>
      </ng-container>
      <p
        class="tx-muted"
        *ngIf="!lists[0].items.length && !lists[1].items.length && !lists[2].items.length"
      >
        {{ t.noTables }}
      </p>
    </div>
  `,
  styles: [
    `
      .dl-page {
        max-width: 760px;
        margin: 0 auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .dl-nav {
        display: flex;
        gap: 1rem;
      }
      .dl-problem {
        color: var(--color-danger, #c62828);
      }
      .dl-form {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .dl-seg {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .dl-seg button,
      .dl-map {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text);
        padding: 0.45rem 0.8rem;
        border-radius: 6px;
        cursor: pointer;
      }
      .dl-seg button.on,
      .dl-map.on {
        border-color: var(--color-primary);
        background: var(--color-primary-soft, rgba(25, 118, 210, 0.12));
      }
      .dl-maps {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
        gap: 0.5rem;
      }
      .dl-map {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0.4rem;
      }
      .dl-check {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .dl-row {
        display: flex;
        gap: 0.5rem;
      }
      .dl-table {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-top: 1px solid var(--color-border);
      }
      .dl-table-main {
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class DreamLobbyComponent implements OnInit {
  private readonly api = inject(DreamApiService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly language = inject(LanguageService);

  readonly app = AppComponent;
  readonly shapes = SHAPES;
  readonly sizes = SIZES;
  readonly levels = ['easy', 'medium', 'hard'] as const;
  readonly nickname = accountName();

  showForm = false;
  busy = false;
  problem = '';
  code = '';
  lists: { title: 'openTables' | 'myTables' | 'recentTables'; items: DreamTableSummary[] }[] = [
    { title: 'myTables', items: [] },
    { title: 'openTables', items: [] },
    { title: 'recentTables', items: [] },
  ];
  form = {
    name: `${accountName()}'s table`,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    shape: 'ring' as (typeof SHAPES)[number],
    size: 'medium' as (typeof SIZES)[number],
    mode: 'guided' as 'guided' | 'strict',
    maxSeats: 4,
    professions: 'duplicates' as 'duplicates' | 'unique' | 'random',
    turnOrder: 'random' as 'random' | 'seat',
    clockMode: 'none' as 'none' | 'per-move' | 'bank',
    clockSeconds: 90,
    endCondition: 'round-limit' as 'first-win' | 'all-done' | 'round-limit',
    roundLimit: 60,
    visibility: 'public' as 'public' | 'private',
    pace: 'normal' as 'fast' | 'normal' | 'slow',
    spectators: true,
  };

  get lang(): string {
    return this.language.current;
  }
  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }
  get hint(): string {
    return this.t[`${this.form.difficulty}Hint` as 'easyHint'];
  }
  sizeText(size: string): string {
    return size === 'small' ? this.t.small : size === 'large' ? this.t.large : this.t.mediumSize;
  }
  asLevel(value: string): 'easy' | 'medium' | 'hard' {
    return value === 'easy' || value === 'hard' ? value : 'medium';
  }

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    (['myTables', 'openTables', 'recentTables'] as const).forEach((title, index) => {
      const scope = title === 'myTables' ? 'mine' : title === 'openTables' ? 'open' : 'recent';
      this.api.list(scope).subscribe({
        next: (answer) => {
          this.lists[index].items = answer.items;
          this.cdr.markForCheck();
        },
        error: () => undefined,
      });
    });
  }

  open(id: string): void {
    void this.router.navigate(['/dreamfund', id]);
  }

  create(): void {
    this.busy = true;
    this.problem = '';
    const f = this.form;
    const clock =
      f.clockMode === 'none'
        ? { mode: 'none' }
        : f.clockMode === 'per-move'
          ? { mode: 'per-move', secondsPerMove: Number(f.clockSeconds) }
          : { mode: 'bank', bankSeconds: Number(f.clockSeconds) * 10, incrementSeconds: 5 };
    this.api
      .create({
        kind: 'dreamfund',
        nickname: this.nickname,
        language: this.lang,
        settings: {
          name: f.name.trim(),
          visibility: f.visibility,
          maxSeats: Number(f.maxSeats),
          difficulty: f.difficulty,
          shape: f.shape,
          size: f.size,
          mode: f.mode,
          professions: f.professions,
          turnOrder: f.turnOrder,
          clock,
          endCondition: f.endCondition,
          ...(f.endCondition === 'round-limit' ? { roundLimit: Number(f.roundLimit) } : {}),
          spectators: f.spectators,
          pace: f.pace,
        },
      })
      .subscribe({
        next: (made) => this.open(made.id),
        error: (error) => this.fail(error),
      });
  }

  joinRoom(roomId: string): void {
    this.busy = true;
    this.api.join({ roomId }, this.nickname).subscribe({
      next: () => this.open(roomId),
      error: (error) => this.fail(error),
    });
  }

  joinCode(): void {
    this.busy = true;
    this.api.join({ code: this.code.trim().toUpperCase() }, this.nickname).subscribe({
      next: (answer) => (answer.id ? this.open(answer.id) : this.refresh()),
      error: (error) => this.fail(error),
    });
  }

  private fail(error: { error?: { detail?: string }; message?: string }): void {
    this.busy = false;
    this.problem = error?.error?.detail ?? error?.message ?? '';
    this.cdr.markForCheck();
  }
}
