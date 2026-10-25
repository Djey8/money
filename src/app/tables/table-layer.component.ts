import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { GameBooks } from '@money/domain';
import { formatClock, clockReading } from './table-clock';
import { standings } from './table-statements';
import { tableLayerTexts } from './table-layer.texts';
import { TableModeService } from './table-mode.service';
import { TableStageComponent } from './table-stage.component';
import { TradeOfferComponent } from './trade-offer.component';
import { RemoteGameHook } from '../shared/services/remote-game';
import { TablesApiService } from './tables-api.service';

/**
 * The online layer on top of the solo game's own screen (todo/cashflow-multiplayer-solo-ui.md R2): whose turn it is and how much
 * time is left, who the table waits for, the players (tap one to look at their books - the same screens, read only), a short feed
 * of what happens, and the way back to the table's lobby. Everything else - dice, cards, assets, the dashboards - is the solo
 * game's screen itself. Self-hosted only: the game screen shows it through a generic hook, nothing of it is in the shared files.
 */
@Component({
  selector: 'app-table-layer',
  standalone: true,
  imports: [CommonModule, FormsModule, TableStageComponent, TradeOfferComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tables.css',
  template: `
    <section class="tl-layer" *ngIf="view() as table" [attr.dir]="rtl ? 'rtl' : 'ltr'">
      <div class="tl-status" [class.tl-status--mine]="isMyTurn()">
        <strong class="tl-turn">{{ turnText() }}</strong>
        <span class="tl-meta">{{ t.round }} {{ table.tableRound }}</span>
        <span
          class="tl-clock"
          *ngIf="clockText() as clock"
          [class.tl-clock--low]="low()"
          [attr.aria-label]="t.time"
          >⏱ {{ clock }}</span
        >
      </div>

      <div class="tl-away" *ngIf="iAmAway()" role="status">
        <span>{{ t.awayNote }}</span>
        <button type="button" class="tx-btn tx-btn--primary tx-btn--small" (click)="comeBack()">
          {{ t.imBack }}
        </button>
      </div>
      <p class="tl-note" *ngIf="table.clock.pausedAt !== null">
        {{ t.paused }}
        <button
          type="button"
          class="tx-btn tx-btn--small"
          *ngIf="session()?.can('resume')"
          (click)="resumeGame()"
        >
          {{ t.resumeButton }}
        </button>
      </p>
      <div
        class="tl-offers"
        *ngIf="offers().length"
        role="region"
        [attr.aria-label]="t.offersTitle"
      >
        <strong>{{ t.offersTitle }}</strong>
        <div class="tl-row" *ngFor="let offer of offers()">
          <span
            >{{ offer.title }} · {{ offer.label }} · {{ offer.price }}
            <small class="tl-left">({{ offerLeft(offer.left) }})</small></span
          >
          <button
            type="button"
            class="tx-btn tx-btn--primary tx-btn--small"
            (click)="sell(offer.title)"
          >
            {{ t.sell }}
          </button>
        </div>
      </div>

      <!-- a card on offer: every player who may answer reads it as a card, and the seller sees the offers that came in -->
      <app-trade-offer
        *ngIf="table.trade && (table.trade.you || table.trade.sellerSeat === table.youSeat)"
        [view]="table"
        [lang]="lang"
        [busy]="busy()"
        (move)="move($event)"
      ></app-trade-offer>

      <div class="tl-players" role="tablist" [attr.aria-label]="t.players">
        <button
          *ngFor="let row of rows(); trackBy: trackSeat"
          type="button"
          role="tab"
          class="tx-btn tx-btn--small tl-player"
          [class.tl-player--active]="row.seat === table.activeSeat"
          [style.--pc]="row.color"
          [class.tl-player--looked]="row.seat === shownSeat()"
          [class.tl-player--out]="row.outcome !== 'playing'"
          [class.tl-player--bankrupt]="row.outcome === 'bankrupt'"
          [attr.aria-selected]="row.seat === shownSeat()"
          [title]="
            t.lookAt +
            ' ' +
            row.name +
            (table.settings.showProgress ? ' · ' + t.coverage + ' ' + percent(row.coverage) : '')
          "
          (click)="look(row.seat)"
        >
          <span class="tl-swatch" [style.background]="row.color"></span>
          <span class="tl-name"> {{ row.name }}</span>
          <span class="tl-sub">
            <span
              class="tl-place"
              *ngIf="row.rank"
              [class.tl-place--escaped]="row.outcome === 'escaped'"
              [class.tl-place--out]="row.outcome === 'bankrupt' || row.outcome === 'left'"
              [title]="placeTitle(row)"
              >{{ placeLabel(row) }}</span
            >
            <span class="tl-playing" *ngIf="row.seat === table.activeSeat">{{ t.playingNow }}</span>
            <span class="tl-tag" *ngIf="row.seat === table.youSeat">{{ t.you }}</span>
            <span class="tl-tag" *ngIf="row.bot">🤖 {{ t.bot }}</span>
            <span class="tl-tag" *ngIf="row.away">{{ t.away }}</span>
            <span class="tl-num" *ngIf="table.settings.showProgress" [title]="t.coverage">{{
              percent(row.coverage)
            }}</span>
          </span>
        </button>
      </div>

      <div class="tl-looking" *ngIf="lookedName() as who" role="status">
        <span>{{ t.lookingAt.replace('{name}', who) }}</span>
        <button type="button" class="tx-btn tx-btn--small" (click)="look(null)">
          {{ t.backToMe }}
        </button>
      </div>

      <!-- always there, so the bar keeps its height before the first move and after it -->
      <p
        class="tl-latest"
        [class.tl-latest--card]="!!latest()?.cardId"
        [attr.role]="latest()?.cardId ? 'link' : null"
        [attr.tabindex]="latest()?.cardId ? 0 : null"
        (click)="openCard(latest()?.cardId)"
        (keydown.enter)="openCard(latest()?.cardId)"
      >
        <ng-container *ngIf="latest() as last"
          ><span class="tl-meta">{{ t.latest }}:</span> <strong>{{ last.who }}</strong>
          {{ last.title }} {{ last.detail }}</ng-container
        >&nbsp;
      </p>

      <div class="tl-undo" *ngIf="table.undo as undo" role="status">
        <span>{{ undoText() }}</span>
        <ng-container *ngIf="canVote()">
          <button type="button" class="tx-btn tx-btn--primary tx-btn--small" (click)="vote(true)">
            {{ t.yes }}
          </button>
          <button type="button" class="tx-btn tx-btn--small" (click)="vote(false)">
            {{ t.no }}
          </button>
        </ng-container>
      </div>

      <!-- the short notices (who the table waits for, a refusal, a lost connection) hang over the wheel with an x: they never push it down -->
      <div class="tl-float-slot">
        <div class="tl-float">
          <p class="tl-connection" *ngIf="lost()" role="alert">{{ t.connectionLost }}</p>
          <div class="tl-hold" *ngIf="floatHold() as hold" role="status">
            <span>{{ hold }}</span>
            <button
              type="button"
              class="tl-float-x"
              [attr.aria-label]="t.hide"
              (click)="hide(hold)"
            >
              ✕
            </button>
          </div>
          <div class="tl-problem" *ngIf="floatProblem() as problem" role="alert">
            <span>{{ problem }}</span>
            <button
              type="button"
              class="tl-float-x"
              [attr.aria-label]="t.hide"
              (click)="hide(problem)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- what the others do floats over the dashboard: telling a move never pushes the screen about -->
      <!-- where the wheel is not on screen the telling floats at the top; otherwise the game screen holds it in its wheel -->
      <div class="tl-overlay-slot" *ngIf="!ringShown()">
        <div class="tl-overlay">
          <app-table-stage></app-table-stage>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tl-layer {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-border, #ddd);
        background: var(--color-surface, #fff);
      }
      .tl-status {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }
      .tl-status--mine .tl-turn {
        color: var(--color-primary, #2a7de1);
      }
      .tl-meta,
      .tl-note {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
        margin: 0;
      }
      .tl-clock {
        margin-inline-start: auto;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
      }
      .tl-clock--low {
        color: var(--color-danger, #c0392b);
      }
      .tl-hold,
      .tl-undo,
      .tl-looking {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 8px;
        background: var(--color-surface-alt, #f4f6f8);
      }
      .tl-hold > span,
      .tl-undo > span,
      .tl-looking > span {
        flex: 1 1 12em;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      /* always one row: when the players do not fit, this row (only) scrolls sideways; the player on the move is first anyway */
      .tl-players {
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        padding-bottom: 6px;
        scrollbar-width: thin;
      }
      /* a player: the colour on the left, the name above, who they are and how close to escaping below */
      .tl-player {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas:
          'swatch name'
          'swatch sub';
        align-items: center;
        column-gap: 8px;
        row-gap: 0;
        flex: 1 0 9em;
        min-width: 9em;
        padding: 6px 10px;
        text-align: start;
      }
      .tl-player .tl-swatch {
        grid-area: swatch;
        width: 14px;
        height: 14px;
      }
      .tl-player .tl-name {
        grid-area: name;
        max-width: none;
      }
      .tl-sub {
        grid-area: sub;
        display: flex;
        flex-wrap: wrap;
        gap: 2px 8px;
        font-size: 0.8em;
        opacity: 0.8;
      }
      /* the blue highlight follows the player whose books are on screen; the one on the move carries a marker instead */
      .tl-player--looked {
        font-weight: 700;
        outline: 2px solid var(--color-primary, #2a7de1);
        background: rgba(42, 125, 225, 0.12);
      }
      /* whose turn it is: the player's own colour as a frame, a glow, a swatch that pulses and a "playing" label */
      .tl-player--active {
        --pc: #888;
        border-color: var(--pc);
        border-width: 2px;
        background: color-mix(in srgb, var(--pc) 14%, var(--color-surface, #fff));
        box-shadow:
          0 0 0 3px color-mix(in srgb, var(--pc) 28%, transparent),
          0 3px 12px color-mix(in srgb, var(--pc) 35%, transparent);
        animation: tl-glow 1.8s ease-in-out infinite;
      }
      .tl-player--active .tl-swatch {
        width: 18px;
        height: 18px;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc) 35%, transparent);
      }
      /* where a player stands: the ones who are out hold their final place, the others their place as it is now */
      .tl-place {
        font-weight: 700;
        opacity: 0.9;
      }
      .tl-place--escaped {
        color: var(--color-success, #2e7d32);
      }
      .tl-place--out {
        color: var(--color-danger, #c62828);
      }
      .tl-player--out {
        opacity: 0.7;
      }
      .tl-player--bankrupt .tl-name {
        text-decoration: line-through;
      }
      .tl-playing {
        font-weight: 700;
        color: var(--pc);
        opacity: 1;
        text-transform: uppercase;
        font-size: 0.85em;
        letter-spacing: 0.03em;
      }
      @keyframes tl-glow {
        50% {
          box-shadow:
            0 0 0 5px color-mix(in srgb, var(--pc) 12%, transparent),
            0 3px 16px color-mix(in srgb, var(--pc) 50%, transparent);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tl-player--active {
          animation: none;
        }
      }
      .tl-connection {
        margin: 0;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--color-danger, #c0392b);
        color: #fff;
        font-weight: 600;
      }
      .tl-away {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        background: #fff7d6;
        color: #3b3000;
        border-left: 4px solid #f39c12;
      }
      .tl-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 10em;
      }
      .tl-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex: none;
      }
      .tl-tag {
        font-size: 0.75em;
        opacity: 0.7;
      }
      .tl-num {
        font-variant-numeric: tabular-nums;
      }
      .tl-offers {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border-radius: 8px;
        background: var(--color-surface-alt, #f4f6f8);
      }
      .tl-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .tl-row > span {
        flex: 1 1 12em;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .tl-input {
        width: 7em;
        min-width: 0;
      }
      .tl-problem {
        margin: 0;
        color: var(--color-danger, #c0392b);
      }
      .tl-over {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border-radius: 8px;
        background: var(--color-surface-alt, #f4f6f8);
      }
      .tl-ranking {
        margin: 0;
        padding-inline-start: 1.2em;
      }
      .tl-latest .tl-meta {
        margin-inline-end: 0.4em;
      }
      .tl-latest--card {
        cursor: pointer;
        text-decoration: underline dotted;
      }
      .tl-latest {
        margin: 0;
        min-height: 1.3em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tl-float-slot {
        position: relative;
        height: 0;
        z-index: 7;
        overflow: visible;
      }
      .tl-float {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: none;
      }
      .tl-float > * {
        pointer-events: auto;
        margin: 0;
        box-shadow: var(--shadow-lg, 0 6px 18px rgba(0, 0, 0, 0.25));
      }
      .tl-float .tl-hold,
      .tl-float .tl-problem {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #ddd);
      }
      .tl-float .tl-problem {
        border-color: var(--color-danger, #c0392b);
      }
      .tl-float .tl-hold > span,
      .tl-float .tl-problem > span {
        flex: 1 1 auto;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .tl-float-x {
        flex: none;
        border: 0;
        background: transparent;
        color: inherit;
        font-size: 1.1rem;
        line-height: 1;
        padding: 2px 6px;
        cursor: pointer;
      }
      .tl-overlay-slot {
        position: sticky;
        top: 0;
        height: 0;
        z-index: 8;
        overflow: visible;
      }
      .tl-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
      }
      .tl-feed ol {
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
        max-height: 160px;
        overflow-y: auto;
      }
      .tl-feed summary {
        cursor: pointer;
      }
      .tl-lobby {
        align-self: flex-start;
      }
    `,
  ],
})
export class TableLayerComponent implements OnDestroy {
  private readonly mode = inject(TableModeService);
  private readonly injector = inject(Injector);

  readonly view = this.mode.view;
  /** A move of mine is on its way to the server. */
  readonly busy = computed(() => this.mode.session()?.busy() ?? false);
  readonly presenter = this.mode.presenter;
  readonly stage = this.mode.presenter.stage;
  readonly faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  /** Wall clock, once a second: the countdown is drawn from the server's deadline against it. */
  private readonly now = signal(Date.now());
  private readonly ticker = setInterval(() => this.now.set(Date.now()), 1000);

  get t() {
    return tableLayerTexts(this.mode.lang);
  }
  /** The language of the table's texts (for the panels the layer opens). */
  get lang(): string {
    return this.mode.lang;
  }
  get rtl(): boolean {
    return this.mode.lang.toLowerCase().startsWith('ar');
  }

  /** The place of a player as the badge shows it: a medal for the first three out, a cross for those who are out of the game. */
  placeLabel(row: { rank: number; outcome: string }): string {
    if (row.outcome === 'escaped') {
      return `${['🥇', '🥈', '🥉'][row.rank - 1] ?? '✓'} #${row.rank}`;
    }
    if (row.outcome === 'bankrupt' || row.outcome === 'left') return `✖ #${row.rank}`;
    return `#${row.rank}`;
  }

  placeTitle(row: { rank: number; outcome: string }): string {
    const t = this.t;
    if (row.outcome === 'escaped') return `${t.placeEscaped}: #${row.rank}`;
    if (row.outcome === 'bankrupt') return `${t.placeBankrupt} - ${t.placeOut}: #${row.rank}`;
    if (row.outcome === 'left') return `${t.placeLeft} - ${t.placeOut}: #${row.rank}`;
    return `${t.placeNow}: #${row.rank}`;
  }

  readonly rows = computed(() => {
    const table = this.view();
    if (!table) return [];
    const byCoverage = new Map(standings(table).map((row) => [row.seat, row.coverage]));
    const placed = new Map((table.standings ?? []).map((row) => [row.seat, row]));
    const rows = table.players.map((player) => ({
      seat: player.seat,
      name: player.name,
      color: player.color,
      bot: !!player.bot,
      away: player.away,
      coverage: byCoverage.get(player.seat) ?? 0,
      rank: placed.get(player.seat)?.rank ?? 0,
      outcome: (placed.get(player.seat)?.outcome ?? 'playing') as
        'escaped' | 'playing' | 'bankrupt' | 'left',
    }));
    // In the order they play, the one on the move first: the line moves up one with every turn, and the player who just played
    // jumps to the end - so it is plain who still comes before me.
    const order = table.order?.length ? table.order : rows.map((row) => row.seat);
    const at = order.indexOf(table.activeSeat ?? -1);
    if (at < 0) return rows;
    const rank = (seat: number) => {
      const index = order.indexOf(seat);
      return index < 0 ? order.length : (index - at + order.length) % order.length;
    };
    return [...rows].sort((a, b) => rank(a.seat) - rank(b.seat));
  });

  readonly isMyTurn = computed(() => {
    const table = this.view();
    return !!table && table.youSeat !== null && table.activeSeat === table.youSeat;
  });

  /** The seat whose books are on screen. */
  readonly shownSeat = computed(() => this.mode.looking() ?? this.view()?.youSeat ?? null);

  readonly lookedName = computed(() => {
    const seat = this.mode.looking();
    const table = this.view();
    return seat !== null && table?.players[seat] ? table.players[seat].name : null;
  });

  readonly turnText = computed(() => {
    const table = this.view();
    if (!table) return '';
    if (table.phase === 'finished') return this.t.over;
    if (this.isMyTurn()) return this.t.yourTurn;
    const active = table.activeSeat === null ? null : table.players[table.activeSeat];
    return active ? this.t.turnOf.replace('{name}', active.name) : '';
  });

  /** Time left for whoever the table is waiting on: the player on the move, or - while the turn is held - the sellers. */
  private readonly reading = computed(() => {
    const table = this.view();
    return table ? clockReading(table, this.now()) : null;
  });
  readonly clockText = computed(() => {
    const seconds = this.reading()?.secondsLeft;
    return seconds === null || seconds === undefined ? '' : formatClock(seconds);
  });
  readonly low = computed(() => !!this.reading()?.low);

  readonly holdText = computed(() => {
    const table = this.view();
    if (!table || table.holdSeats.length === 0) return '';
    const mine = table.youSeat !== null && table.holdSeats.includes(table.youSeat);
    // a seller is told what they can do; the one who only ends their turn needs no text, the button says it
    if (mine) return this.offers().length > 0 ? this.t.waitingForYou : '';
    const names = table.holdSeats.map((seat) => table.players[seat]?.name ?? '').join(', ');
    return this.t.waitingFor.replace('{names}', names);
  });

  /** The newest line of the game's history: what the others are doing right now. */
  readonly latest = computed(() => {
    const lines = this.mode.history();
    // Only what has been told: a move of another player waits for its telling, the player's own roll for the dice and the landing.
    // A roll says what was rolled as soon as the dice rest, and where the token landed when it has (JFK, 2026-10-18).
    const waiting = this.mode.presenter.unfinished();
    const rested = this.mode.presenter.rested();
    const floor = this.mode.holdFloor();
    const diceRested = RemoteGameHook.diceRested;
    for (const line of lines) {
      const held = waiting.has(line.id) || (floor !== null && line.id > floor);
      if (!held) return line;
      const isRoll = line.detail.startsWith('🎲');
      if (isRoll && (rested.has(line.id) || (floor !== null && line.id > floor && diceRested))) {
        return { ...line, detail: line.detail.replace(/ → .*$/, '') };
      }
    }
    return null;
  });

  readonly session = this.mode.session;

  /** The game screen shows its wheel and holds the telling there. */
  ringShown(): boolean {
    return !!RemoteGameHook.ringVisible?.();
  }

  /** The line to the table is down (the browser is offline, or the stream broke after it had been live): said, and mended by itself. */
  readonly lost = computed(() => {
    const open = this.mode.session();
    return (
      !!open && (!!open.offline?.() || (!!open.everLive?.() && open.connection?.() !== 'live'))
    );
  });

  /** The player is on autoplay (away on purpose, or after too many timeouts): their turns are played for them. */
  readonly iAmAway = computed(() => {
    const table = this.view();
    return !!table && table.youSeat !== null && !!table.players[table.youSeat]?.away;
  });

  comeBack(): void {
    void this.mode.session()?.play({ type: 'back' });
  }

  resumeGame(): void {
    void this.mode.session()?.play({ type: 'resume' });
  }

  readonly canVote = computed(() => !!this.mode.session()?.can('vote_undo'));

  readonly undoText = computed(() => {
    const table = this.view();
    const vote = table?.undo;
    if (!table || !vote) return '';
    return this.t.undoVoteText
      .replace('{name}', table.players[vote.proposerSeat]?.name ?? '')
      .replace('{yes}', String(vote.yesSeats.length))
      .replace('{voters}', String(vote.voterSeats.length));
  });

  async vote(yes: boolean): Promise<void> {
    await this.mode.session()?.play({ type: 'vote_undo', yes });
  }

  readonly problem = computed(() => this.mode.session()?.problem() ?? null);

  /** The notice the player hid (by its text): it stays hidden until the text changes. */
  private readonly hidden = signal('');
  readonly floatHold = computed(() => {
    const text = this.holdText();
    return text && text !== this.hidden() ? text : null;
  });
  readonly floatProblem = computed(() => {
    const text = this.problem();
    return text && text !== this.hidden() ? text : null;
  });

  hide(text: string): void {
    this.hidden.set(text);
  }

  private money(minor: number): string {
    return (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  /** The buyers' offers open for me (a Market card, a stock price card): what I may sell into, from my own books. */
  readonly offers = computed(() =>
    this.mode.myOffers().map((offer) => ({
      title: offer.title,
      label: offer.label,
      price: this.money(offer.priceMinor),
      left: offer.left,
    })),
  );

  /** How long an offer stays open, in words. */
  offerLeft(left: number | null): string {
    if (left === null) return this.t.offerUntilPayday;
    return left <= 1 ? this.t.offerLeftOne : this.t.offerLeft.replace('{n}', String(left));
  }

  async sell(title: string): Promise<void> {
    await this.mode.session()?.play({ type: 'sell_position', input: { title } });
  }

  async move(command: Record<string, unknown>): Promise<void> {
    await this.mode.session()?.play(command);
  }

  /** The card the latest line is about opens, to be read. */
  openCard(cardId: string | undefined): void {
    if (cardId) RemoteGameHook.openCard?.(cardId);
  }

  trackSeat(_index: number, row: { seat: number }): number {
    return row.seat;
  }

  percent(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
  }

  toggleMessages(): void {
    this.mode.presenter.setMessages(!this.mode.presenter.messages());
  }

  look(seat: number | null): void {
    this.mode.look(seat);
  }

  /** The host takes the table away (closed for everyone, then deleted): asked first. */
  /** Back to the table's lobby (the way out also lives in the game screen's table menu). */
  toLobby(): void {
    this.mode.toLobby();
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }
}
