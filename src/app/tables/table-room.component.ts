import {
  ChangeDetectionStrategy,
  Component,
  effect,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { finalSummary, type GameBooks, type PlayerView } from '@money/domain';
import { CLASSIC_RAT_RACE_BOARD } from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import {
  RatRaceBoardComponent,
  type BoardToken,
} from '../main/cashflow-game/rat-race-board.component';
import { TableCardsComponent } from './table-cards.component';
import { TableInspectorComponent } from './table-inspector.component';
import { TableSessionService } from './table-session.service';
import { TablesApiService, type BotInfo } from './tables-api.service';
import { bankSeconds, clockReading, formatClock } from './table-clock';
import { TurnAlert } from './table-turn-alert';
import { tableRoomTexts, type TableRoomTexts } from './table-room.texts';

/** A player's numbers as the table shows them to everyone. */
interface PlayerRow {
  player: PlayerView;
  isYou: boolean;
  isHost: boolean;
  isActive: boolean;
  online: boolean;
  cash: number | null;
  passive: number | null;
  expenses: number | null;
  cashflow: number | null;
  standing: 'escaped' | 'bankrupt' | 'playing' | null;
  professionTitle: string | null;
}

const money = (minor: number | null): string =>
  minor === null ? '–' : (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });

/**
 * One open table (todo/cashflow-multiplayer.md phase U2): the lobby before play, the profession pick, and the table itself -
 * a ring with one token per player, whose turn it is, the clock, every player's numbers, and the moves the server lists as
 * legal. Self-hosted game accounts only (lazy route in app.routes.selfhosted.ts). Card flows come in U3, the player inspector
 * in U4; the server decides every rule, this screen only shows and asks.
 */
@Component({
  selector: 'app-table-room',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RatRaceBoardComponent,
    TableCardsComponent,
    TableInspectorComponent,
  ],
  providers: [TableSessionService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tr-page" [attr.dir]="rtl ? 'rtl' : 'ltr'" *ngIf="view() as table">
      <header class="tr-head">
        <a class="btn" routerLink="/tables">‹ {{ t.back }}</a>
        <h2>{{ table.settings.name }}</h2>
        <span class="tr-code" *ngIf="session.room()?.inviteCode as code"
          >{{ t.inviteCode }}: <strong>{{ code }}</strong></span
        >
      </header>

      <p
        class="tr-banner tr-banner--warn"
        *ngIf="session.connection() === 'reconnecting'"
        role="status"
      >
        {{ t.reconnecting }}
      </p>
      <p class="tr-banner tr-banner--warn" *ngIf="session.connection() === 'closed'" role="alert">
        {{ t.closedStream }}
      </p>
      <p class="tr-banner tr-banner--error" *ngIf="session.problem() as problem" role="alert">
        {{ problem }}
      </p>

      <!-- Before play: who is here, ready, start; then the profession pick. -->
      <ng-container *ngIf="table.phase === 'lobby' || table.phase === 'picking'">
        <section class="tr-card">
          <h3>{{ t.seatsHeading }} ({{ table.players.length }}/{{ table.settings.maxSeats }})</h3>
          <ul class="tr-players">
            <li *ngFor="let row of rows()" class="tr-player">
              <span class="tr-swatch" [style.background]="row.player.color"></span>
              <span class="tr-name"
                >{{ row.player.name }}
                <small *ngIf="row.isYou">({{ t.you }})</small>
                <small *ngIf="row.isHost">· {{ t.host }}</small>
                <small *ngIf="row.player.bot">· 🤖 {{ t.botTag }}</small>
                <small *ngIf="!row.online && !row.player.bot">· {{ t.offline }}</small></span
              >
              <button
                *ngIf="row.player.bot && isHost() && table.phase === 'lobby'"
                class="btn"
                type="button"
                [disabled]="session.busy()"
                (click)="session.lobby('kick', { seat: row.player.seat })"
              >
                {{ t.removeBot }}
              </button>
              <span *ngIf="table.phase === 'lobby'">{{
                row.player.ready ? '✓ ' + t.ready : t.notReady
              }}</span>
              <span *ngIf="table.phase === 'picking'">{{
                row.player.hasPicked ? '✓ ' + t.picked : '…'
              }}</span>
            </li>
          </ul>
          <div class="tr-actions" *ngIf="table.phase === 'lobby'">
            <button class="btn" type="button" [disabled]="session.busy()" (click)="toggleReady()">
              {{ myPlayer()?.ready ? t.notReady : t.ready }}
            </button>
            <button
              *ngIf="isHost()"
              class="btn btn--primary"
              type="button"
              [disabled]="session.busy() || !canStart()"
              (click)="session.lobby('start')"
            >
              {{ t.start }}
            </button>
            <button class="btn" type="button" (click)="leave()">{{ t.leave }}</button>
          </div>
          <div class="tr-bots" *ngIf="table.phase === 'lobby' && isHost() && botCatalog().length">
            <h4>🤖 {{ t.addBot }}</h4>
            <p class="tr-hint">{{ t.botHint }}</p>
            <div class="tr-actions">
              <select
                class="tr-bot-select"
                [value]="botChoice"
                (change)="botChoice = $any($event.target).value"
                [attr.aria-label]="t.addBot"
              >
                <option *ngFor="let bot of botCatalog()" [value]="bot.id">
                  {{ bot.name }} - {{ level(bot) }}
                </option>
              </select>
              <button
                class="btn"
                type="button"
                [disabled]="session.busy() || table.players.length >= table.settings.maxSeats"
                (click)="addBot()"
              >
                {{ t.addBot }}
              </button>
            </div>
            <p class="tr-hint">{{ botDescription() }}</p>
          </div>
          <p class="tr-hint" *ngIf="table.phase === 'lobby' && isHost() && !canStart()">
            {{ t.needPlayers }}
          </p>
        </section>

        <section class="tr-card" *ngIf="table.phase === 'picking' && myPlayer() as me">
          <h3>{{ t.pickProfession }}</h3>
          <div class="tr-professions">
            <button
              *ngFor="let profession of professions()"
              class="btn"
              type="button"
              [class.btn--primary]="me.pick === profession.id"
              [disabled]="session.busy()"
              (click)="session.lobby('profession', { professionId: profession.id })"
            >
              {{ profession.title }}
            </button>
            <button
              class="btn"
              type="button"
              [class.btn--primary]="me.pick === 'random'"
              [disabled]="session.busy()"
              (click)="session.lobby('profession', { professionId: 'random' })"
            >
              🎲 {{ t.random }}
            </button>
          </div>
          <p class="tr-hint">{{ t.waitingPicks }}</p>
        </section>
      </ng-container>

      <!-- Play. -->
      <ng-container *ngIf="table.phase === 'playing' || table.phase === 'finished'">
        <section class="tr-card tr-turn" *ngIf="table.phase === 'playing'">
          <div class="tr-turn-line">
            <strong *ngIf="isMyTurn(); else others">{{ t.yourTurn }}</strong>
            <ng-template #others
              >{{ t.turnOf }} <strong>{{ activeName() }}</strong></ng-template
            >
            <span class="tr-round">{{ t.round }} {{ table.tableRound }}</span>
            <span
              class="tr-clock"
              *ngIf="secondsLeft() !== null"
              [class.tr-clock--low]="secondsLeft()! <= 10"
              >{{ t.timeLeft }}: {{ clockText() }}</span
            >
          </div>
          <div
            class="tr-bar"
            *ngIf="reading().fraction !== null"
            role="progressbar"
            [attr.aria-valuenow]="reading().secondsLeft"
            aria-valuemin="0"
          >
            <div
              class="tr-bar-fill"
              [class.tr-bar-fill--low]="reading().low"
              [style.width.%]="reading().fraction! * 100"
            ></div>
          </div>
          <button *ngIf="alert.canAsk" class="btn tr-notify" type="button" (click)="alert.ask()">
            🔔 {{ t.notifyMe }}
          </button>
          <p class="tr-banner tr-banner--warn" *ngIf="table.clock.pausedAt !== null">
            {{ t.paused }}
          </p>
          <div class="tr-actions">
            <button
              *ngIf="session.can('roll')"
              class="btn btn--primary"
              type="button"
              [disabled]="session.busy()"
              (click)="session.play({ type: 'roll' })"
            >
              {{ t.roll }}
            </button>
            <button
              *ngIf="session.can('roll') && canRollTwo()"
              class="btn"
              type="button"
              [disabled]="session.busy()"
              (click)="session.play({ type: 'roll', dice: 2 })"
            >
              {{ t.rollTwo }}
            </button>
            <button
              *ngIf="session.can('back')"
              class="btn"
              type="button"
              (click)="session.play({ type: 'back' })"
            >
              {{ t.imBack }}
            </button>
            <button
              *ngIf="session.can('pause')"
              class="btn"
              type="button"
              (click)="session.play({ type: 'pause' })"
            >
              {{ t.pause }}
            </button>
            <button
              *ngIf="session.can('resume')"
              class="btn btn--primary"
              type="button"
              (click)="session.play({ type: 'resume' })"
            >
              {{ t.resume }}
            </button>
          </div>
        </section>

        <app-table-cards
          *ngIf="table.phase === 'playing'"
          [view]="table"
          [allowed]="allowedActions()"
          [gameSets]="gameSets"
          [lang]="lang"
          [busy]="session.busy()"
          (move)="session.play($event)"
        ></app-table-cards>

        <section
          class="tr-card tr-result"
          *ngIf="table.phase === 'finished' && table.result as result"
        >
          <h3>🏁 {{ t.finished }}</h3>
          <p class="tr-hint">{{ reasonText(result.reason) }}</p>
          <ol class="tr-ranking">
            <li *ngFor="let standing of result.ranking" class="tr-rank">
              <strong>{{ standing.rank }}.</strong>
              <span class="tr-swatch" [style.background]="colorOf(standing.seat)"></span>
              <span class="tr-name">{{ nameOf(standing.seat) }}</span>
              <small>{{ standingText(standing.outcome) }}</small>
              <small class="tr-num"
                >{{ t.passiveShort }} {{ fmt(standing.passiveIncomeMinor) }}</small
              >
            </li>
          </ol>
          <div class="tr-actions" *ngIf="table.youSeat !== null">
            <button
              class="btn btn--primary"
              type="button"
              [disabled]="session.busy() || saved()"
              (click)="saveGame()"
            >
              {{ saved() ? t.savedGame : t.saveGame }}
            </button>
            <a class="btn" routerLink="/tables">‹ {{ t.back }}</a>
          </div>
        </section>

        <section class="tr-card">
          <app-rat-race-board [board]="board" [tokens]="tokens()"></app-rat-race-board>
        </section>

        <section class="tr-card">
          <h3>{{ t.seatsHeading }}</h3>
          <ul class="tr-players tr-players--books">
            <li
              *ngFor="let row of rows()"
              class="tr-player tr-player--books"
              [class.tr-player--active]="row.isActive"
            >
              <div class="tr-player-head">
                <span class="tr-swatch" [style.background]="row.player.color"></span>
                <span class="tr-name"
                  >{{ row.player.name }}
                  <small *ngIf="row.isYou">({{ t.you }})</small>
                  <small *ngIf="row.player.bot">· 🤖 {{ t.botTag }}</small>
                  <small *ngIf="row.player.away">· {{ t.away }}</small>
                  <small *ngIf="!row.online && !row.player.bot">· {{ t.offline }}</small></span
                >
                <small *ngIf="row.professionTitle">{{ row.professionTitle }}</small>
                <small *ngIf="bank(row.player.seat) !== null" class="tr-bank"
                  >⏱ {{ formatBank(row.player.seat) }}</small
                >
              </div>
              <dl class="tr-numbers">
                <div>
                  <dt>{{ t.cash }}</dt>
                  <dd>{{ fmt(row.cash) }}</dd>
                </div>
                <div>
                  <dt>{{ t.passive }}</dt>
                  <dd>{{ fmt(row.passive) }}</dd>
                </div>
                <div>
                  <dt>{{ t.expenses }}</dt>
                  <dd>{{ fmt(row.expenses) }}</dd>
                </div>
                <div>
                  <dt>{{ t.cashflow }}</dt>
                  <dd>{{ fmt(row.cashflow) }}</dd>
                </div>
              </dl>
              <small *ngIf="row.standing === 'escaped'">🏆 {{ t.escaped }}</small>
              <small *ngIf="row.standing === 'bankrupt'">💥 {{ t.bankrupt }}</small>
            </li>
          </ul>
        </section>
        <app-table-inspector
          *ngIf="table.players.length"
          [view]="table"
          [events]="session.events()"
          [lang]="lang"
        ></app-table-inspector>
      </ng-container>
    </div>
    <p *ngIf="!view() && session.connection() !== 'closed'" class="tr-hint">{{ t.connecting }}</p>
  `,
  styles: [
    `
      .tr-page {
        max-width: 760px;
        margin: 0 auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .tr-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }
      .tr-head h2 {
        margin: 0;
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .tr-card {
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #ddd);
        border-radius: 12px;
        padding: 16px;
      }
      .tr-banner {
        margin: 0;
        padding: 8px 12px;
        border-radius: 8px;
      }
      .tr-banner--warn {
        background: rgba(243, 156, 18, 0.18);
      }
      .tr-banner--error {
        background: rgba(211, 47, 47, 0.15);
      }
      .tr-players {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .tr-player {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tr-player--books {
        flex-direction: column;
        align-items: stretch;
        border: 1px solid var(--color-border, #ddd);
        border-radius: 10px;
        padding: 8px 12px;
      }
      .tr-player--active {
        border-color: var(--color-warning, #f39c12);
        border-width: 2px;
      }
      .tr-player-head {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .tr-swatch {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        flex: none;
      }
      .tr-name {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .tr-numbers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 4px 12px;
        margin: 4px 0;
      }
      .tr-numbers div {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .tr-numbers dt {
        color: var(--color-text-secondary, #666);
      }
      .tr-numbers dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .tr-actions,
      .tr-professions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .tr-turn-line {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        align-items: baseline;
      }
      .tr-clock--low {
        color: var(--color-danger, #c00);
        font-weight: 700;
      }
      .tr-ranking {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tr-rank {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 8px;
      }
      .tr-bots {
        margin-top: 16px;
        border-top: 1px solid var(--color-border, #ddd);
        padding-top: 8px;
      }
      .tr-bots h4 {
        margin: 0 0 4px;
      }
      .tr-bot-select {
        flex: 1 1 180px;
        min-width: 0;
      }
      .tr-hint {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
      }
      .tr-bar {
        height: 8px;
        border-radius: 4px;
        background: var(--color-border, #ddd);
        overflow: hidden;
        margin: 8px 0;
      }
      .tr-bar-fill {
        height: 100%;
        background: var(--color-success, #4caf50);
        transition: width 0.5s linear;
      }
      .tr-bar-fill--low {
        background: var(--color-danger, #c00);
      }
      .tr-bank {
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 600px) {
        .tr-page {
          padding: 8px;
          gap: 8px;
        }
        .tr-card {
          padding: 12px;
        }
        .tr-actions .btn,
        .tr-professions .btn,
        .tr-notify {
          flex: 1 1 140px;
          min-height: 44px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tr-bar-fill {
          transition: none;
        }
      }
    `,
  ],
})
export class TableRoomComponent implements OnInit, OnDestroy {
  readonly session = inject(TableSessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private tablesApi = inject(TablesApiService);

  t: TableRoomTexts = tableRoomTexts('en');
  rtl = false;
  readonly board = CLASSIC_RAT_RACE_BOARD;
  readonly gameSets = CASHFLOW_GAME_SETS;
  lang = 'en';
  readonly allowedActions = computed(() =>
    this.session.legalActions().map((entry) => entry.action),
  );
  readonly view = this.session.view;
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly myPlayer = computed(() => {
    const view = this.view();
    return view && view.youSeat !== null ? (view.players[view.youSeat] ?? null) : null;
  });
  readonly isHost = computed(() => {
    const view = this.view();
    return !!view && view.youSeat !== null && view.youSeat === view.hostSeat;
  });
  readonly isMyTurn = computed(() => {
    const view = this.view();
    return !!view && view.youSeat !== null && view.youSeat === view.activeSeat;
  });
  readonly canStart = computed(() => {
    const view = this.view();
    return !!view && view.players.length >= 2 && view.players.every((p) => p.ready);
  });
  readonly professions = computed(() => {
    const view = this.view();
    const set = CASHFLOW_GAME_SETS.find((s) => s.id === view?.settings.gameSetId);
    return (set?.professions ?? []).map((p) => ({ id: p.id, title: p.title }));
  });

  readonly rows = computed<PlayerRow[]>(() => {
    const view = this.view();
    if (!view) return [];
    const online = new Set(this.session.presence().seats);
    return view.players.map((player) => {
      const books = player.books as unknown as GameBooks | null;
      const summary = books && books.state.professionId ? finalSummary(books) : null;
      return {
        player,
        isYou: player.seat === view.youSeat,
        isHost: player.seat === view.hostSeat,
        isActive: player.seat === view.activeSeat,
        online: online.size === 0 || online.has(player.seat),
        cash: summary ? summary.cashMinor : null,
        passive: summary ? summary.finances.passiveIncomeMinor : null,
        expenses: summary ? summary.finances.expensesMinor : null,
        cashflow: summary ? summary.finances.monthlyCashflowMinor : null,
        standing: summary ? summary.outcome : null,
        professionTitle:
          this.professions().find((p) => p.id === player.professionId)?.title ?? null,
      };
    });
  });

  readonly tokens = computed<BoardToken[]>(() => {
    const view = this.view();
    if (!view) return [];
    return view.players
      .filter((p) => p.status === 'active' && p.books)
      .map((p) => ({
        id: String(p.seat),
        position: (p.books as unknown as GameBooks).state.boardPosition,
        color: p.color,
        label: (p.name.trim()[0] ?? '?').toUpperCase(),
        active: p.seat === view.activeSeat,
      }));
  });

  /** The player on the move's clock, from the server's deadline: seconds, bar fraction, whether it is low. */
  readonly reading = computed(() => {
    const view = this.view();
    return view
      ? clockReading(view, this.now())
      : { secondsLeft: null, fraction: null, low: false };
  });
  /** Seconds the player on the move has left; null without a clock. */
  readonly secondsLeft = computed(() => this.reading().secondsLeft);

  /** The tab says "your turn" while it is; a notification only if the player asked for them. */
  readonly alert = new TurnAlert({
    document,
    Notification: typeof Notification === 'undefined' ? undefined : (Notification as never),
  });
  private readonly alerting = effect(() => {
    const view = this.view();
    if (view && view.phase === 'playing' && this.isMyTurn() && view.clock.pausedAt === null) {
      this.alert.turnStarted(this.t.yourTurn, view.settings.name);
    } else {
      this.alert.turnEnded();
    }
  });

  ngOnInit(): void {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.t = tableRoomTexts(lang);
    this.lang = lang;
    this.rtl = lang.toLowerCase().startsWith('ar');
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.session.open(id);
    this.timer = setInterval(() => this.now.set(Date.now()), 500);
  }

  ngOnDestroy(): void {
    this.botFetch.destroy();
    if (this.timer) clearInterval(this.timer);
    this.alerting.destroy();
    this.alert.turnEnded();
    this.session.close();
  }

  fmt = money;

  readonly saved = signal(false);

  /** The bots the host can seat, fetched once when the host sits in a lobby. */
  readonly botCatalog = signal<BotInfo[]>([]);
  botChoice = '';
  private botsRequested = false;
  private readonly botFetch = effect(() => {
    const view = this.view();
    if (view && view.phase === 'lobby' && this.isHost() && !this.botsRequested) {
      this.botsRequested = true;
      this.tablesApi.bots().subscribe({
        next: (r) => {
          this.botCatalog.set(r.items);
          if (!this.botChoice && r.items.length) this.botChoice = r.items[0].id;
        },
        error: () => (this.botsRequested = false),
      });
    }
  });

  level(bot: BotInfo): string {
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

  botDescription(): string {
    return this.botCatalog().find((bot) => bot.id === this.botChoice)?.description ?? '';
  }

  addBot(): void {
    if (this.botChoice) void this.session.lobby('bots', { policyId: this.botChoice });
  }

  async saveGame(): Promise<void> {
    if (await this.session.save()) this.saved.set(true);
  }

  colorOf(seat: number): string {
    return this.view()?.players[seat]?.color ?? '#888';
  }

  reasonText(reason: string): string {
    switch (reason) {
      case 'escaped':
        return this.t.reasonEscaped;
      case 'last-standing':
        return this.t.reasonLast;
      case 'round-limit':
        return this.t.reasonRounds;
      case 'all-done':
        return this.t.reasonAll;
      default:
        return this.t.reasonOut;
    }
  }

  standingText(outcome: string): string {
    switch (outcome) {
      case 'escaped':
        return this.t.escaped;
      case 'bankrupt':
        return this.t.bankrupt;
      case 'left':
        return this.t.left;
      default:
        return this.t.playing;
    }
  }

  clockText(): string {
    const total = this.secondsLeft();
    return total === null ? '' : formatClock(total);
  }

  /** A player's time bank in seconds at a bank-clock table, else null. */
  bank(seat: number): number | null {
    const view = this.view();
    return view ? bankSeconds(view, seat, this.now()) : null;
  }

  formatBank(seat: number): string {
    const seconds = this.bank(seat);
    return seconds === null ? '' : formatClock(seconds);
  }

  nameOf(seat: number): string {
    return this.view()?.players[seat]?.name ?? '';
  }

  activeName(): string {
    const view = this.view();
    return view && view.activeSeat !== null ? this.nameOf(view.activeSeat) : '';
  }

  /** Two dice are offered while Charity allows; the server lists `roll` either way, so ask the books. */
  canRollTwo(): boolean {
    const me = this.myPlayer();
    const books = me?.books as unknown as GameBooks | null | undefined;
    return !!books && books.state.charityRoundsLeft > 0;
  }

  toggleReady(): void {
    void this.session.lobby('ready', { ready: !this.myPlayer()?.ready });
  }

  async leave(): Promise<void> {
    if (await this.session.lobby('leave')) void this.router.navigate(['/tables']);
  }
}
