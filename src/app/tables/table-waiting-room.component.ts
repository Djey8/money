import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PlayerView, TableView } from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { TableSessionService } from './table-session.service';
import {
  TablesApiService,
  type BotInfo,
  type BotLevel,
  type GamePlayer,
  type TableSeat,
} from './tables-api.service';
import { AddTableComponent } from './add-table.component';
import { SeatAvatarComponent } from './seat-avatar.component';
import { seatToPlayer } from './seat-stats';
import { TablePlayerInfoComponent } from './table-player-info.component';
import { tableRoomTexts, type TableRoomTexts } from './table-room.texts';
import { tablesTexts, type TablesTexts } from './tables.texts';
import { addTableTexts, type AddTableTexts } from './add-table.texts';
import { hallTexts, type HallTexts } from './hall.texts';

const BOT_LEVELS: BotLevel[] = ['master', 'strong', 'casual', 'beginner'];

/**
 * The table before the game starts (JFK, 2026-10-25): what the table is (its settings, for everybody - the host changes them with the
 * same panel that opens a table), who sits at it (a card for everyone with picture and rating; a tap opens their leaderboard stats),
 * the bots the host can add, ready / start / leave, and the profession pick. Lives inside the table screen and uses its session.
 */
@Component({
  selector: 'app-table-waiting-room',
  standalone: true,
  imports: [CommonModule, AddTableComponent, SeatAvatarComponent, TablePlayerInfoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tables.css'],
  template: `
    <div class="wr" [attr.dir]="rtl ? 'rtl' : 'ltr'">
      <!-- what this table is -->
      <section class="wr-group">
        <header class="wr-group-head">
          <h3>{{ h.settingsTitle }}</h3>
          <button
            *ngIf="isHost && table.phase === 'lobby'"
            type="button"
            class="tx-btn tx-btn--small"
            (click)="editing = true"
          >
            ✎ {{ h.settingsEdit }}
          </button>
        </header>
        <div class="wr-chips">
          <span class="wr-chip" [class.wr-chip--accent]="table.settings.ranked">{{
            table.settings.ranked ? '🏆 ' + h.rankedTag : h.friendlyTag
          }}</span>
          <span class="wr-chip">{{
            table.settings.visibility === 'public' ? a.public : '🔒 ' + a.private
          }}</span>
          <span class="wr-chip">{{ table.settings.maxSeats }} {{ h.seatsChip }}</span>
          <span class="wr-chip">{{ professionLabel() }}</span>
          <span class="wr-chip">{{ endLabel() }}</span>
          <span class="wr-chip">{{ clockLabel() }}</span>
        </div>
        <p class="wr-line">
          {{ table.settings.ranked ? h.rankedLine : h.friendlyLine }}
        </p>
        <button type="button" class="wr-more" (click)="showRules = !showRules">
          {{ showRules ? '▾ ' + h.fewerRules : '▸ ' + h.allRules }}
        </button>
        <ul class="wr-rules" *ngIf="showRules">
          <li *ngFor="let rule of rules()">
            <span>{{ rule.title }}</span>
            <strong [class.wr-off]="rule.value === off">{{ rule.value }}</strong>
          </li>
        </ul>
        <p class="wr-hint" *ngIf="!isHost">{{ h.settingsHostOnly }}</p>
      </section>

      <!-- who sits here -->
      <section class="wr-group">
        <header class="wr-group-head">
          <h3>{{ h.playersTitle }} ({{ table.players.length }}/{{ table.settings.maxSeats }})</h3>
          <button
            *ngIf="inviteCode"
            type="button"
            class="wr-code"
            [title]="h.inviteTitle"
            (click)="copyCode()"
          >
            {{ t.inviteCode }}: <strong>{{ inviteCode }}</strong>
            <small>{{ copied ? '✓ ' + h.copied : h.copy }}</small>
          </button>
        </header>
        <ul class="wr-seats">
          <li *ngFor="let row of seatRows()" class="wr-seat" [class.wr-seat--you]="row.isYou">
            <button
              type="button"
              class="wr-seat-main"
              [disabled]="!row.stats"
              [title]="row.stats ? h.tapStats : ''"
              (click)="row.stats && (selected = row.stats)"
            >
              <app-seat-avatar
                [name]="row.player.name"
                [bot]="!!row.player.bot"
                [color]="row.player.color"
                [src]="row.picture"
                [size]="52"
              ></app-seat-avatar>
              <span class="wr-seat-name">{{ row.player.name }}</span>
              <span class="wr-seat-tags">
                <small *ngIf="row.isYou">{{ t.you }}</small>
                <small *ngIf="row.isHost">{{ t.host }}</small>
                <small *ngIf="row.player.bot">🤖 {{ levelText(row.seat?.level) }}</small>
                <small *ngIf="!row.online && !row.player.bot">{{ t.offline }}</small>
              </span>
              <span class="wr-rating" *ngIf="row.seat as seat">
                <strong>{{ seat.rating }}</strong>
                <small *ngIf="seat.ratedGames > 0">{{ seat.ratedGames }} {{ h.ratedGames }}</small>
                <small *ngIf="seat.ratedGames === 0 && !seat.bot">{{ h.newcomer }}</small>
              </span>
              <small class="wr-seat-note" *ngIf="row.seat && !row.seat.listed && !row.seat.bot">{{
                h.notListed
              }}</small>
            </button>
            <span class="wr-state" [class.wr-state--ok]="row.done">{{ row.stateText }}</span>
            <button
              *ngIf="row.player.bot && isHost && table.phase === 'lobby'"
              type="button"
              class="wr-x"
              [title]="t.removeBot"
              [attr.aria-label]="t.removeBot + ': ' + row.player.name"
              [disabled]="session.busy()"
              (click)="session.lobby('kick', { seat: row.player.seat })"
            >
              ×
            </button>
          </li>
          <li *ngFor="let free of freeSeats(); let first = first" class="wr-seat wr-seat--free">
            <div class="wr-seat-main wr-seat-main--free">
              <app-seat-avatar [empty]="true" [size]="52"></app-seat-avatar>
              <span class="wr-seat-name">{{ h.freeSeat }}</span>
              <button
                *ngIf="first && isHost && table.phase === 'lobby'"
                type="button"
                class="tx-btn tx-btn--small"
                (click)="openBots()"
              >
                🤖 {{ h.addSeatBot }}
              </button>
            </div>
          </li>
        </ul>

        <div class="wr-actions" *ngIf="table.phase === 'lobby'">
          <button class="tx-btn" type="button" [disabled]="session.busy()" (click)="toggleReady()">
            {{ me?.ready ? t.notReady : t.ready }}
          </button>
          <button
            *ngIf="isHost"
            class="tx-btn tx-btn--primary"
            type="button"
            [disabled]="session.busy() || !canStart"
            (click)="session.lobby('start')"
          >
            {{ t.start }}
          </button>
          <button class="tx-btn" type="button" (click)="leaveRequested.emit()">
            {{ t.leave }}
          </button>
        </div>
        <p class="wr-hint" *ngIf="table.phase === 'lobby' && isHost && !canStart">
          {{ t.needPlayers }}
        </p>
        <p class="wr-hint" *ngIf="table.phase === 'lobby' && !isHost && table.players.length < 2">
          {{ h.waitingFor }}
        </p>
      </section>

      <!-- the profession pick -->
      <section class="wr-group" *ngIf="table.phase === 'picking' && me">
        <header class="wr-group-head">
          <h3>{{ t.pickProfession }}</h3>
        </header>
        <div class="wr-professions">
          <button
            *ngFor="let profession of professions()"
            class="tx-btn"
            type="button"
            [class.tx-btn--primary]="me.pick === profession.id"
            [disabled]="session.busy()"
            (click)="session.lobby('profession', { professionId: profession.id })"
          >
            {{ profession.title }}
          </button>
          <button
            class="tx-btn"
            type="button"
            [class.tx-btn--primary]="me.pick === 'random'"
            [disabled]="session.busy()"
            (click)="session.lobby('profession', { professionId: 'random' })"
          >
            🎲 {{ t.random }}
          </button>
        </div>
        <p class="wr-hint">{{ t.waitingPicks }}</p>
      </section>
    </div>

    <!-- the host changes the settings with the panel that opens a table -->
    <app-add-table
      *ngIf="editing"
      [existing]="table.settings"
      [problem]="session.problem()"
      (saved)="saveSettings($event)"
      (closed)="editing = false"
    ></app-add-table>

    <!-- the bots the host can seat -->
    <div
      class="wr-modal"
      *ngIf="botsOpen"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="h.botTitle"
    >
      <div class="wr-panel" [attr.dir]="rtl ? 'rtl' : 'ltr'">
        <header class="wr-panel-head">
          <h2>🤖 {{ h.botTitle }}</h2>
          <button
            type="button"
            class="wr-close"
            [attr.aria-label]="h.botClose"
            (click)="botsOpen = false"
          >
            ×
          </button>
        </header>
        <p class="wr-hint">{{ t.botHint }}</p>
        <div class="wr-label">{{ h.botSkill }}</div>
        <div class="wr-seg" role="radiogroup" [attr.aria-label]="h.botSkill">
          <button
            *ngFor="let level of botLevels"
            type="button"
            role="radio"
            [class.wr-seg--on]="botLevel === level"
            [attr.aria-checked]="botLevel === level"
            (click)="setLevel(level)"
          >
            {{ skillText(level) }}
          </button>
        </div>
        <p class="wr-hint" *ngIf="table.players.length >= table.settings.maxSeats">
          {{ h.botTableFull }}
        </p>
        <ul class="wr-bots">
          <li
            *ngFor="let bot of sortedBots()"
            class="wr-bot"
            [class.wr-bot--seated]="botSeated(bot)"
          >
            <app-seat-avatar [bot]="true" [size]="44"></app-seat-avatar>
            <div class="wr-bot-text">
              <strong>{{ bot.name }}</strong>
              <small
                >{{ difficultyText(bot)
                }}<ng-container *ngIf="bot.ratings?.[botLevel] as rating">
                  · {{ rating }}</ng-container
                ></small
              >
              <small class="wr-bot-desc">{{ bot.description }}</small>
            </div>
            <div class="wr-bot-actions">
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [disabled]="!botPlayer(bot)"
                (click)="selected = botPlayer(bot)"
              >
                {{ h.botStats }}
              </button>
              <button
                type="button"
                class="tx-btn tx-btn--small tx-btn--primary"
                [disabled]="
                  session.busy() ||
                  botSeated(bot) ||
                  table.players.length >= table.settings.maxSeats
                "
                (click)="addBot(bot)"
              >
                {{ botSeated(bot) ? h.botSeated : h.botAddTo }}
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <app-table-player-info
      *ngIf="selected as chosen"
      [player]="chosen"
      (closed)="selected = null"
    ></app-table-player-info>
  `,
  styles: [
    `
      .wr {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* a group, as in the panel that opens a table */
      .wr-group {
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-surface, #fff);
        padding: 12px;
      }
      .wr-group-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
      }
      .wr-group-head h3 {
        margin: 0;
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .wr-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .wr-chip {
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid var(--color-border, #d9dde3);
        background: var(--color-background, #f6f7f9);
        font-size: 0.85rem;
      }
      .wr-chip--accent {
        border-color: var(--color-primary, #2a7de1);
        color: var(--color-primary, #2a7de1);
        font-weight: 600;
      }
      .wr-line,
      .wr-hint {
        margin: 8px 0 0;
        font-size: 0.85rem;
        opacity: 0.75;
      }
      .wr-more {
        margin-top: 6px;
        padding: 4px 0;
        border: 0;
        background: transparent;
        color: var(--color-primary, #2a7de1);
        font: inherit;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .wr-rules {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        border: 1px solid var(--color-border, #e3e6ea);
        border-radius: 10px;
        background: var(--color-background, #f6f7f9);
      }
      .wr-rules li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border-top: 1px solid var(--color-border, #e3e6ea);
        font-size: 0.9rem;
      }
      .wr-rules li:first-child {
        border-top: 0;
      }
      .wr-off {
        opacity: 0.55;
        font-weight: 400;
      }
      .wr-code {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 4px 10px;
        border: 1px dashed var(--color-border, #bbb);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .wr-code strong {
        letter-spacing: 0.08em;
      }
      .wr-code small {
        color: var(--color-primary, #2a7de1);
      }
      /* the seats: a card for everybody */
      .wr-seats {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
      }
      .wr-seat {
        position: relative;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-background, #f6f7f9);
        overflow: hidden;
      }
      .wr-seat--you {
        border-color: var(--color-primary, #2a7de1);
        box-shadow: 0 0 0 1px var(--color-primary, #2a7de1);
      }
      .wr-seat--free {
        background: transparent;
        border-style: dashed;
      }
      .wr-seat-main {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px 8px 8px;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: center;
        cursor: pointer;
        min-width: 0;
      }
      .wr-seat-main:disabled {
        cursor: default;
      }
      .wr-seat-main--free {
        cursor: default;
        opacity: 0.8;
        min-height: 130px;
        justify-content: center;
      }
      .wr-seat-name {
        max-width: 100%;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wr-seat-tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 2px 6px;
        min-height: 1.1em;
        font-size: 0.78rem;
        opacity: 0.75;
      }
      .wr-rating {
        display: flex;
        flex-direction: column;
        align-items: center;
        line-height: 1.15;
      }
      .wr-rating strong {
        font-size: 1.3rem;
        font-variant-numeric: tabular-nums;
      }
      .wr-rating small,
      .wr-seat-note {
        font-size: 0.75rem;
        opacity: 0.7;
      }
      .wr-state {
        padding: 5px 8px;
        text-align: center;
        font-size: 0.82rem;
        border-top: 1px solid var(--color-border, #e3e6ea);
        opacity: 0.75;
      }
      .wr-state--ok {
        color: var(--color-success, #2e7d32);
        font-weight: 600;
        opacity: 1;
      }
      .wr-x {
        position: absolute;
        top: 4px;
        inset-inline-end: 4px;
        width: 26px;
        height: 26px;
        border: 0;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.12);
        color: inherit;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
      }
      .wr-actions,
      .wr-professions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      /* the bot picker */
      .wr-modal {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow-y: auto;
        padding: 16px 12px calc(var(--page-bottom-spacer, 72px) + 28px);
        background: rgba(0, 0, 0, 0.5);
      }
      .wr-panel {
        width: 100%;
        max-width: 580px;
        box-sizing: border-box;
        padding: 14px;
        border-radius: 14px;
        background: var(--color-surface, #fff);
        color: var(--color-text, #222);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }
      .wr-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .wr-panel-head h2 {
        margin: 0;
      }
      .wr-close {
        border: 0;
        background: transparent;
        color: inherit;
        font-size: 1.8rem;
        line-height: 1;
        padding: 0 8px;
        cursor: pointer;
      }
      .wr-label {
        margin: 10px 0 4px;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .wr-seg {
        display: flex;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-surface, #fff);
      }
      .wr-seg button {
        flex: 1 1 0;
        min-width: 0;
        padding: 9px 4px;
        border: 0;
        border-inline-start: 1px solid var(--color-border, #ddd);
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .wr-seg button:first-child {
        border-inline-start: 0;
      }
      .wr-seg .wr-seg--on {
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-weight: 600;
      }
      .wr-bots {
        list-style: none;
        margin: 12px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wr-bot {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 4px 12px;
        align-items: center;
        padding: 10px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 12px;
        background: var(--color-background, #f6f7f9);
      }
      .wr-bot--seated {
        opacity: 0.6;
      }
      .wr-bot-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .wr-bot-text small {
        opacity: 0.75;
      }
      .wr-bot-desc {
        margin-top: 2px;
        line-height: 1.25;
      }
      .wr-bot-actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      @media (max-width: 480px) {
        .wr-seats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .wr-actions .tx-btn {
          flex: 1 1 120px;
          min-height: 44px;
        }
      }
    `,
  ],
})
export class TableWaitingRoomComponent implements OnChanges, OnDestroy {
  readonly session = inject(TableSessionService);
  private readonly api = inject(TablesApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) table!: TableView;
  @Input({ required: true }) roomId!: string;
  @Input() inviteCode: string | null = null;
  @Input() lang = 'en';
  /** The seats connected now (empty: not known). */
  @Input() presentSeats: number[] = [];
  @Output() leaveRequested = new EventEmitter<void>();

  t: TableRoomTexts = tableRoomTexts('en');
  tt: TablesTexts = tablesTexts('en');
  a: AddTableTexts = addTableTexts('en');
  h: HallTexts = hallTexts('en');
  rtl = false;
  readonly off = '–';
  readonly botLevels = BOT_LEVELS;

  seats: TableSeat[] = [];
  selected: GamePlayer | null = null;
  editing = false;
  showRules = false;
  copied = false;
  botsOpen = false;
  botLevel: BotLevel = 'master';
  botCatalog: BotInfo[] = [];
  private seatKey = '';
  private botsRequested = false;
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lang']) {
      this.t = tableRoomTexts(this.lang);
      this.tt = tablesTexts(this.lang);
      this.a = addTableTexts(this.lang);
      this.h = hallTexts(this.lang);
      this.rtl = this.lang.toLowerCase().startsWith('ar');
    }
    if (changes['table'] || changes['roomId']) {
      // the seat cards need the leaderboard side of everybody: asked again when somebody comes or goes
      const key = this.table.players.map((p) => `${p.bot?.policyId ?? p.name}`).join('|');
      if (key !== this.seatKey) {
        this.seatKey = key;
        this.loadSeats();
      }
      // the host's changes close the panel once the table has them
      if (this.editing && changes['table'] && !changes['table'].firstChange) {
        const before = changes['table'].previousValue as TableView | undefined;
        if (before && before.settings !== this.table.settings) this.editing = false;
      }
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.copyTimer);
  }

  private loadSeats(): void {
    if (!this.roomId) return;
    this.api.seats(this.roomId).subscribe({
      next: (r) => {
        this.seats = r.seats;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  get me(): PlayerView | null {
    return this.table.youSeat !== null ? (this.table.players[this.table.youSeat] ?? null) : null;
  }

  get isHost(): boolean {
    return this.table.youSeat !== null && this.table.youSeat === this.table.hostSeat;
  }

  get canStart(): boolean {
    return this.table.players.length >= 2 && this.table.players.every((p) => p.ready);
  }

  professions(): { id: string; title: string }[] {
    const set = CASHFLOW_GAME_SETS.find((s) => s.id === this.table.settings.gameSetId);
    return (set?.professions ?? []).map((p) => ({ id: p.id, title: p.title }));
  }

  // ── the settings, in words ──

  professionLabel(): string {
    const value = this.table.settings.professions;
    return value === 'duplicates'
      ? this.a.profFree
      : value === 'unique'
        ? this.a.profUnique
        : this.a.profRandom;
  }

  endLabel(): string {
    const s = this.table.settings;
    if (s.endCondition === 'round-limit') return `${this.a.endRounds}: ${s.roundLimit ?? ''}`;
    return s.endCondition === 'first-escape' ? this.a.endFirst : this.a.endAll;
  }

  clockLabel(): string {
    const clock = this.table.settings.clock;
    switch (clock.mode) {
      case 'per-move':
        return `⏱ ${clock.secondsPerMove}${this.tt.perMove}`;
      case 'bank':
        return `⏱ ${clock.bankSeconds}${this.tt.bank}`;
      case 'daily':
        return `⏱ ${clock.hoursPerMove}${this.tt.daily}`;
      default:
        return this.tt.noClock;
    }
  }

  rules(): { title: string; value: string }[] {
    const s = this.table.settings;
    const yes = '✓';
    const no = this.off;
    const flag = (on: boolean) => (on ? yes : no);
    const pace =
      s.pace === 'fast' ? this.a.paceFast : s.pace === 'slow' ? this.a.paceSlow : this.a.paceNormal;
    return [
      { title: this.a.pace, value: pace },
      { title: this.a.turnGate, value: flag(s.turnGate) },
      { title: this.a.spectators, value: flag(s.spectators) },
      { title: this.a.showProgress, value: flag(s.showProgress) },
      { title: this.a.allowUndo, value: flag(s.allowRewind) },
      { title: this.a.repayOffTurn, value: flag(s.repayOffTurn) },
      ...(s.ranked ? [{ title: this.a.leaveFree, value: String(s.leaveFreeRounds) }] : []),
      { title: this.a.offerRolls, value: String(s.rules.sellOfferRolls) },
    ];
  }

  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    if (await this.session.lobby('settings', { settings })) {
      this.editing = false;
      this.cdr.markForCheck();
    }
  }

  // ── the seats ──

  seatRows(): {
    player: PlayerView;
    seat: TableSeat | null;
    isYou: boolean;
    isHost: boolean;
    online: boolean;
    picture: string | null;
    stats: GamePlayer | null;
    done: boolean;
    stateText: string;
  }[] {
    const t = this.table;
    return t.players.map((player) => {
      const seat = this.seats.find((s) => s.seat === player.seat) ?? null;
      const done = t.phase === 'picking' ? player.hasPicked : player.ready;
      return {
        player,
        seat,
        isYou: player.seat === t.youSeat,
        isHost: player.seat === t.hostSeat,
        online: this.presentSeats.length === 0 || this.presentSeats.includes(player.seat),
        picture: seat ? this.api.pictureUrl(seat, this.roomId) : null,
        stats: seat ? seatToPlayer(seat) : null,
        done,
        stateText:
          t.phase === 'picking'
            ? done
              ? '✓ ' + this.t.picked
              : '…'
            : done
              ? '✓ ' + this.t.ready
              : this.t.notReady,
      };
    });
  }

  freeSeats(): number[] {
    return Array.from(
      { length: Math.max(0, this.table.settings.maxSeats - this.table.players.length) },
      (_, i) => i,
    );
  }

  levelText(level: BotLevel | undefined): string {
    return level ? this.skillText(level) : this.t.botTag;
  }

  toggleReady(): void {
    void this.session.lobby('ready', { ready: !this.me?.ready });
  }

  async copyCode(): Promise<void> {
    if (!this.inviteCode) return;
    try {
      await navigator.clipboard.writeText(this.inviteCode);
      this.copied = true;
      this.cdr.markForCheck();
      this.copyTimer = setTimeout(() => {
        this.copied = false;
        this.cdr.markForCheck();
      }, 1800);
    } catch {
      // no clipboard here: the code is on the screen to be read out
    }
  }

  // ── the bots ──

  openBots(): void {
    this.botsOpen = true;
    if (this.botsRequested) return;
    this.botsRequested = true;
    this.api.bots().subscribe({
      next: (r) => {
        this.botCatalog = r.items;
        this.cdr.markForCheck();
      },
      error: () => {
        this.botsRequested = false;
      },
    });
  }

  setLevel(level: BotLevel): void {
    this.botLevel = level;
  }

  /** The bots with the highest rating first, by their rating at the chosen skill level (those without one last, by name). */
  sortedBots(): BotInfo[] {
    const level = this.botLevel;
    return [...this.botCatalog].sort(
      (a, b) =>
        (b.ratings?.[level] ?? -1) - (a.ratings?.[level] ?? -1) || a.name.localeCompare(b.name),
    );
  }

  /** The chosen strategy at the chosen level already sits at the table (it sits once: the leaderboard knows it as one player). */
  botSeated(bot: BotInfo): boolean {
    const id = this.botLevel === 'master' ? bot.id : `${bot.id}--${this.botLevel}`;
    return this.table.players.some((player) => player.bot?.policyId === id);
  }

  /** The leaderboard player of a bot at the chosen level, for its stats panel. */
  botPlayer(bot: BotInfo): GamePlayer | null {
    const playerId = bot.playerIds?.[this.botLevel];
    if (!playerId) return null;
    const rating = bot.ratings?.[this.botLevel] ?? 1500;
    return {
      playerId,
      name: bot.name,
      type: 'bot',
      level: this.botLevel,
      rating,
      peakRating: rating,
      ratedGames: 0,
      provisional: false,
      games: 0,
      wins: 0,
      losses: 0,
      gaveUp: 0,
      bankruptcies: 0,
      escaped: 0,
      winRate: 0,
      avgPlace: null,
      bestPlace: null,
    };
  }

  addBot(bot: BotInfo): void {
    void this.session.lobby('bots', { policyId: bot.id, level: this.botLevel });
  }

  difficultyText(bot: BotInfo): string {
    switch (bot.difficulty) {
      case 'easy':
        return this.t.levelEasy;
      case 'medium':
        return this.t.levelMedium;
      case 'hard':
        return this.t.levelHard;
      default:
        return this.t.levelChampion;
    }
  }

  skillText(level: BotLevel): string {
    switch (level) {
      case 'master':
        return this.t.skillMaster;
      case 'strong':
        return this.t.skillStrong;
      case 'casual':
        return this.t.skillCasual;
      default:
        return this.t.skillBeginner;
    }
  }
}
