import { Injectable, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TablesApiService } from './tables-api.service';
import { leaderboardTexts } from './leaderboard.texts';
import { problemText } from './problem.texts';
import { TableStageComponent } from './table-stage.component';
import {
  GAME_BANK_LOCATION_ID,
  snapshotFromBooks,
  type GameBooks,
  type TableView,
} from '@money/domain';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService } from '../shared/services/app-state.service';
import { DatabaseService } from '../shared/services/database.service';
import { IncomeStatementService } from '../shared/services/income-statement.service';
import { LocalService } from '../shared/services/local.service';
import { ToastService } from '../shared/services/toast.service';
import type { BoardToken } from '../main/cashflow-game/rat-race-board.component';
import {
  RemoteGameHook,
  type RemoteGate,
  type RemoteOver,
  type RemoteMenuItem,
  type RemoteHistoryLine,
} from '../shared/services/remote-game';
import { historyLines } from './table-history';
import { TablePresenter } from './table-presenter';
import { applyDreamExtrasToApp, dreamLifeToApp } from './dream-books-bridge';
import { lifeOf } from '../dreamfund-tables/dream-table-view';
import { CashflowGameComponent } from '../main/cashflow-game/cashflow-game.component';
import { TableGameDriver } from './table-game-driver';
import { TableBannerComponent } from './table-banner.component';
import { TableLayerComponent } from './table-layer.component';
import { tableLayerTexts } from './table-layer.texts';
import type { TableSessionService } from './table-session.service';

/**
 * Table mode (todo/cashflow-multiplayer-solo-ui.md): while someone is at a table the app shows the books of their table character
 * instead of their account's - the solo game panel and the normal pages then draw from it exactly as they do for a solo game.
 *
 * Nothing is written to the account meanwhile (`DatabaseService.readOnly`), the data tiers are marked as loaded so nothing is read
 * over the books, and leaving reloads the whole app, so the account's own data comes back from the database and never from memory.
 *
 * The service holds the open table (its session outlives the table's own page, so the game screen goes on while the player moves
 * through the app), whose books are on screen - the player's own, or another player's to look at, read only - and the moves.
 */
@Injectable({ providedIn: 'root' })
export class TableModeService {
  private readonly injector = inject(Injector);

  /** Whether the app is showing a table's books. */
  readonly active = signal(false);
  /** The seat whose books are on screen. */
  readonly seat = signal<number | null>(null);
  /** The table being played. */
  readonly session = signal<TableSessionService | null>(null);
  /** The seat the player chose to look at, or null for their own books. */
  readonly looking = signal<number | null>(null);
  /** The words' language (the app's). */
  lang = 'en';
  /** Tells the other players' moves round by round. */
  readonly presenter = new TablePresenter(
    () => this.lang,
    () => ({ fast: 0.6, normal: 1, slow: 1.8 })[this.view()?.settings.pace ?? 'normal'],
  );

  /** The table as the viewer may see it. */
  readonly view = computed(() => this.session()?.view() ?? null);

  /**
   * The buyers' offers open for the player (a Market card, a stock price card): what they may sell into, and for how many more of
   * their turns each stays open (`left`; null: until the next Payday).
   */
  readonly myOffers = computed(() => {
    const view = this.view();
    if (!view || view.youSeat === null || !this.session()?.can('sell_position')) return [];
    const books = view.players[view.youSeat]?.books as unknown as GameBooks | null;
    if (!books) return [];
    const rolls = view.settings.rules?.sellOfferRolls ?? 0;
    const count = books.state.turn?.count ?? 0;
    return (books.state.marketOffers ?? []).map((offer) => ({
      title: offer.title,
      label: offer.label,
      priceMinor: offer.pricePerShareMinor ?? offer.pricePerCoinMinor ?? offer.salePriceMinor,
      cardId: offer.cardId,
      left:
        rolls > 0 && offer.offeredAtRoll !== undefined
          ? Math.max(1, rolls - (count - offer.offeredAtRoll))
          : null,
    }));
  });

  private lastOffersKey = '';

  /** When a buyer's offer comes in for the player, the screen goes to Grow, where the position is sold (once the story is told). */
  private readonly offersWatch = effect(() => {
    const offers = this.myOffers();
    const busy = this.presenter.busy();
    if (!this.active() || busy || this.looking() !== null) return;
    const key = offers.map((offer) => `${offer.title}:${offer.cardId}`).join('|');
    if (!key) {
      this.lastOffersKey = '';
      return;
    }
    if (key === this.lastOffersKey) return;
    this.lastOffersKey = key;
    CashflowGameComponent.instance?.closeWindow();
    void this.injector.get(Router).navigate(['/grow']);
  });

  /**
   * While the player's own roll is animated: the number of the newest history line from before it. Lines newer than that (the roll
   * itself, what it brought) are not told yet - the Latest line waits for the dice to rest and the token to land.
   */
  readonly holdFloor = signal<number | null>(null);
  private readonly holdWatch = effect(() => {
    const holding = RemoteGameHook.holdUpdates;
    untracked(() => {
      if (!holding) {
        this.holdFloor.set(null);
        return;
      }
      const lines = this.history();
      this.holdFloor.set(lines.length ? Math.max(...lines.map((line) => line.id)) : 0);
    });
  });

  /**
   * The game ended for the player (they escaped or went bankrupt, or the table finished) while they were somewhere else in the
   * app, e.g. buying the winning share on the Grow page: the game dashboard comes up with the result. Not for a table that was
   * already over when it was opened - the first look only records where things stand.
   */
  private endSeen: boolean | null = null;
  private readonly endWatch = effect(() => {
    const view = this.view();
    if (!this.active() || !view || view.youSeat === null) {
      this.endSeen = null;
      return;
    }
    const mine = view.players[view.youSeat]?.books as unknown as GameBooks | null | undefined;
    const ended = view.phase === 'finished' || mine?.state.turn?.phase === 'over';
    const before = this.endSeen;
    this.endSeen = ended;
    if (before === false && ended) untracked(() => RemoteGameHook.reopen?.());
  });

  /** Every table update (and every change of whose books are looked at) puts the right books on screen. */
  private readonly showing = effect(() => {
    const view = this.view();
    const looking = this.looking();
    // another player's books on screen are there to read: the app's add and change buttons go (styles.css) while it lasts
    document.body.classList.toggle('table-view-only', this.active() && looking !== null);
    // the player's own books wait while somebody else's move is being told: what a card did to them shows when the story gets there
    const telling = this.presenter.busy() && looking === null;
    if (!this.active() || !view || view.youSeat === null || RemoteGameHook.holdUpdates || telling) {
      return;
    }
    this.show(view, looking !== null && view.players[looking] ? looking : view.youSeat);
  });

  /**
   * Switches table mode on for a table: from here nothing is written to the account and the game screen's moves go to the table.
   * `reopen` brings the game screen up (false when it is already on screen).
   */
  begin(session: TableSessionService, lang = 'en', reopen = true): void {
    this.lang = lang;
    const previous = this.session();
    if (previous && previous !== session) previous.close();
    this.session.set(session);
    this.looking.set(null);
    // a reload of the browser tab puts the player back at this table (the app reads the account's own books until it does)
    try {
      if (session.tableId) sessionStorage.setItem(RESUME_TABLE_KEY, session.tableId);
    } catch {
      // no storage: a reload then lands on the lobby
    }
    DatabaseService.readOnly = true;
    LocalService.shadow = shownData();
    RemoteGameHook.current = new TableGameDriver(
      session,
      () => this.refusal(),
      () => this.history(),
      () => {
        const words = tableLayerTexts(this.lang);
        return { label: words.resign, confirm: words.resignConfirm, lobby: words.toLobby };
      },
      {
        viewOnly: () => this.looking() !== null,
        gate: () => this.gate(),
        turnBanner: () => this.turnBanner(),
        over: () => this.over(),
        menu: () => this.tableMenu(),
        quick: () => this.quickToggles(),
        runMenu: (id) => this.runTableMenu(id),
      },
    );
    RemoteGameHook.otherDice = () => this.presenter.dice();
    RemoteGameHook.leaveGame = () =>
      this.leave(() => {
        window.location.hash = '#/tables?lobby=1';
        window.location.reload();
      });
    RemoteGameHook.leaveHome = () =>
      this.leave(() => {
        window.location.hash = '#/home';
        window.location.reload();
      });
    RemoteGameHook.layer = TableLayerComponent;
    RemoteGameHook.stage = TableStageComponent;
    RemoteGameHook.banner = TableBannerComponent;
    RemoteGameHook.resume = () => this.showLatest();
    RemoteGameHook.reopen = () => CashflowGameComponent.open();
    RemoteGameHook.tokens = (mine) => this.tokens(mine);
    session.onEvents = (lines, view) => this.presenter.push(lines, view);
    this.active.set(true);
    // the small confirmations (saved, done ...) can be switched off while playing: they sit over the buttons on a phone
    ToastService.quiet = () => !this.presenter.toasts();
    document.body.classList.add('table-mode');
    const view = session.view();
    if (view && view.youSeat !== null) this.show(view, view.youSeat);
    if (reopen) CashflowGameComponent.open();
  }

  /** Switches it off by reloading the app: the account's own state is read again from the database. */
  leave(reload: () => void = () => window.location.reload()): void {
    try {
      sessionStorage.removeItem(RESUME_TABLE_KEY);
    } catch {
      // nothing stored
    }
    LocalService.shadow = null;
    RemoteGameHook.current = null;
    RemoteGameHook.layer = null;
    RemoteGameHook.banner = null;
    RemoteGameHook.onMenuEntry = null;
    RemoteGameHook.resume = null;
    RemoteGameHook.reopen = null;
    RemoteGameHook.leaveGame = null;
    RemoteGameHook.leaveHome = null;
    RemoteGameHook.stage = null;
    RemoteGameHook.otherDice = null;
    document.body.classList.remove('table-view-only', 'table-mode');
    RemoteGameHook.tokens = null;
    RemoteGameHook.holdUpdates = false;
    this.presenter.stop();
    const open = this.session();
    if (open) open.onEvents = null;
    open?.close();
    this.session.set(null);
    this.active.set(false);
    ToastService.quiet = null;
    this.seat.set(null);
    this.looking.set(null);
    reload();
  }

  private historyMemo: { key: string; lines: RemoteHistoryLine[] } = { key: '', lines: [] };

  /** The game's history for the History view: every player's moves, newest first. Rebuilt only when something new happened. */
  history(): RemoteHistoryLine[] {
    const view = this.view();
    const events = this.session()?.events() ?? [];
    if (!view) return [];
    const key = `${events.length}:${events[events.length - 1]?.seq ?? 0}:${view.version}:${this.lang}`;
    if (this.historyMemo.key !== key) {
      this.historyMemo = { key, lines: historyLines(view, events, this.lang) };
    }
    return this.historyMemo.lines;
  }

  /** Everybody's token for the board: their own books say where each stands; mine is where the screen draws it right now. */
  private tokens(mine: number | null): BoardToken[] {
    const view = this.view();
    if (!view) return [];
    // a walk that is being told keeps its token where the story has got to
    const told = this.presenter.tokenAt();
    // the board is the table's: it shows where everybody stands, whoever's books are looked at. Only the player's own token walks
    // while their roll is animated (`mine`); looking at somebody else changes nothing on it.
    const walking = RemoteGameHook.holdUpdates && this.looking() === null;
    return view.players.map((player) => {
      const books = player.books as unknown as GameBooks | null;
      return {
        id: String(player.seat),
        position:
          player.seat === view.youSeat && walking
            ? mine
            : player.seat in told
              ? told[player.seat]
              : (books?.state.boardPosition ?? null),
        color: player.color,
        label: (player.initials || player.name.slice(0, 2)).toUpperCase(),
        active: player.seat === view.activeSeat,
      };
    });
  }

  /** Puts the latest books of whoever is being looked at on screen (after a held animation). */
  private showLatest(): void {
    const view = this.view();
    if (!view || view.youSeat === null) return;
    const looking = this.looking();
    this.show(view, looking !== null && view.players[looking] ? looking : view.youSeat);
  }

  /** Looks at another player's books (read only); the player's own seat, or null, goes back to their own. */
  look(seat: number | null): void {
    const view = this.view();
    const next = seat !== null && seat !== view?.youSeat ? seat : null;
    if (next === this.looking()) return;
    this.looking.set(next);
    // the page on screen shows the other books (or mine again): it is built anew from them, stats and charts included
    const url = this.injector.get(Router).url ?? '';
    if (!url.startsWith('/tables')) {
      setTimeout(() => RemoteGameHook.refreshPages?.());
    }
  }

  /** Why a move of play cannot be made now, in the viewer's language; null when it can. */
  refusal(): string | null {
    const view = this.view();
    const words = tableLayerTexts(this.lang);
    if (!view || view.youSeat === null) return words.notYourTurn;
    if (this.looking() !== null) return words.lookingRefusal;
    if (view.phase !== 'playing') return words.over;
    if (view.clock.pausedAt !== null) return words.paused;
    if (view.holdSeats.includes(view.youSeat)) return words.holdRefusal;
    if (this.presenter.busy()) return words.waitStory;
    if (view.activeSeat !== view.youSeat) return words.notYourTurn;
    return null;
  }

  /** The table's menu: what the owner may do with the table, and what the player may set for themselves. */
  tableMenu(): { title: string; items: RemoteMenuItem[] } | null {
    const view = this.view();
    if (!view || view.youSeat === null) return null;
    const words = tableLayerTexts(this.lang);
    const session = this.session();
    const away = !!view.players[view.youSeat]?.away;
    const items: RemoteMenuItem[] = [
      { id: 'messages', label: this.presenter.messages() ? words.messagesOn : words.messagesOff },
      { id: 'toasts', label: this.presenter.toasts() ? words.toastsOn : words.toastsOff },
    ];
    // going away on purpose: the table plays my turns passively, like a timeout, so nobody waits for me
    if (view.phase === 'playing') {
      items.push({ id: 'autoplay', label: away ? words.autoplayOn : words.autoplayOff });
    }
    if (session?.can('pause')) items.push({ id: 'pause', label: words.pauseGame });
    if (session?.can('resume')) items.push({ id: 'resume', label: words.resumeGame });
    items.push({ id: 'page', label: words.tablePage }, { id: 'lobby', label: words.toLobby });
    // the table is the host's to take away only while nobody else is at it; with others it is left (resigned) like any seat
    const others = view.players.filter(
      (player, seat) => seat !== view.youSeat && !player.bot && player.status === 'active',
    );
    if (view.hostSeat === view.youSeat && others.length === 0 && view.phase !== 'finished') {
      items.push({
        id: 'remove',
        label: words.removeTable,
        confirm: words.removeConfirm,
        danger: true,
      });
    }
    return { title: words.settingsTitle, items };
  }

  /** The small switches kept on the game screen itself, so they need no trip into the settings. */
  quickToggles(): { id: string; icon: string; title: string; on: boolean }[] {
    const words = tableLayerTexts(this.lang);
    const on = this.presenter.messages();
    return [
      {
        id: 'messages',
        icon: on ? '🔔' : '🔕',
        title: on ? words.messagesOn : words.messagesOff,
        on,
      },
      {
        id: 'toasts',
        icon: this.presenter.toasts() ? '💬' : '🚫',
        title: this.presenter.toasts() ? words.toastsOn : words.toastsOff,
        on: this.presenter.toasts(),
      },
    ];
  }

  async runTableMenu(id: string): Promise<void> {
    const view = this.view();
    if (id === 'messages') this.presenter.setMessages(!this.presenter.messages());
    else if (id === 'toasts') this.presenter.setToasts(!this.presenter.toasts());
    else if (id === 'autoplay') {
      const away = !!view?.players[view.youSeat ?? -1]?.away;
      await this.session()?.play({ type: away ? 'back' : 'away' });
    } else if (id === 'pause' || id === 'resume') await this.session()?.play({ type: id });
    else if (id === 'page') this.toTablePage();
    else if (id === 'lobby') this.toLobby();
    else if (id === 'remove') await this.removeTable();
  }

  /** The table's own page (pause and resume, the table's state): the game screen is left, the table stays and goes on. */
  toTablePage(): void {
    const id = this.view()?.id;
    if (!id) return this.toLobby();
    this.leave(() => {
      window.location.hash = `#/tables/${id}?lobby=1`;
      window.location.reload();
    });
  }

  /** Back to the table's lobby: the app is reloaded on its own account, the lobby page asks not to jump straight back in. */
  toLobby(): void {
    this.leave(() => {
      window.location.hash = '#/tables?lobby=1';
      window.location.reload();
    });
  }

  /** The owner takes the table away for everybody (closed, then deleted with its log). */
  async removeTable(): Promise<void> {
    const id = this.view()?.id;
    if (!id) return;
    try {
      await firstValueFrom(this.injector.get(TablesApiService).remove(id));
      this.toLobby();
    } catch (error) {
      // the table stays, and the player is told why (other players are at it, it was saved ...)
      const e = error as { error?: { detail?: string; code?: string }; message?: string };
      this.session()?.problem.set(
        problemText(this.lang, e?.error?.code, e?.error?.detail) ?? e?.message ?? '',
      );
    }
  }

  /** The game is over (or the table was closed): how it ended for the player, for the game screen's game-over panel. */
  over(): RemoteOver | null {
    const view = this.view();
    if (!view || view.youSeat === null) return null;
    if (view.phase !== 'finished' && view.phase !== 'abandoned') return null;
    const words = tableLayerTexts(this.lang);
    const ranking = (view.result?.ranking ?? []).map((entry) => ({
      rank: entry.rank,
      name: view.players[entry.seat]?.name ?? '',
      me: entry.seat === view.youSeat,
    }));
    const mine = ranking.find((entry) => entry.me);
    const winner = view.result?.winnerSeat != null ? view.players[view.result.winnerSeat] : null;
    const won = !!mine && mine.rank === 1 && view.phase === 'finished';
    const headline = won
      ? words.overWon
      : mine
        ? words.overPlace
            .replace('{rank}', String(mine.rank))
            .replace('{n}', String(ranking.length))
        : words.overClosed;
    return {
      won,
      headline,
      hint: winner && !won ? words.overWinner.replace('{name}', winner.name) : '',
      ranking,
      saved: this.session()?.saved() ?? false,
      saveLabel: words.saveGame,
      savedLabel: words.savedGame,
      leaveLabel: words.leaveGame,
      note: this.ratingNote(view.youSeat),
    };
  }

  /** "Ranked: 1520 -> 1534 (+14)" or "Not ranked (under 8 rounds)" for the player's own seat; empty until the board has the game. */
  private ratingNote(seat: number): string {
    const rating = this.session()?.rating?.();
    if (!rating) return '';
    const words = leaderboardTexts(this.lang);
    if (!rating.ranked) {
      const why = rating.why ? (words.why[rating.why] ?? rating.why) : '';
      return capital(why ? `${words.notRanked}: ${why}` : words.notRanked);
    }
    const mine = rating.changes.find((change) => change.seat === seat);
    if (!mine) return capital(words.ranked);
    const sign = mine.delta > 0 ? '+' : '';
    return capital(`${words.ranked}: ${mine.before} → ${mine.after} (${sign}${mine.delta})`);
  }

  /** Whose turn it is while it is somebody else's: shown where the roll button is, instead of a button that cannot be used. */
  turnBanner(): { text: string; color: string } | null {
    const view = this.view();
    if (!view || view.youSeat === null || view.phase !== 'playing') return null;
    if (view.activeSeat === null) return null;
    if (view.activeSeat === view.youSeat) {
      // the turn is the player's, but the move before it is still being told: the dice come once the story is over
      if (!this.presenter.busy() || this.looking() !== null) return null;
      const told = this.presenter.stage();
      const teller = told && told.seat !== view.youSeat ? view.players[told.seat] : null;
      return teller
        ? {
            text: tableLayerTexts(this.lang).turnOf.replace('{name}', teller.name),
            color: teller.color,
          }
        : { text: tableLayerTexts(this.lang).waitStory, color: '#888' };
    }
    const active = view.players[view.activeSeat];
    if (!active) return null;
    return {
      text: tableLayerTexts(this.lang).turnOf.replace('{name}', active.name),
      color: active.color,
    };
  }

  /**
   * The button at the place of the roll button when something waits for the player: "End turn" for the one who moved, "Continue" for
   * somebody a card lets sell; nothing for everybody else. Not usable while the last move of somebody else is still being told.
   */
  gate(): RemoteGate | null {
    const view = this.view();
    const words = tableLayerTexts(this.lang);
    if (!view || view.youSeat === null || !view.holdSeats.includes(view.youSeat)) return null;
    if (this.looking() !== null) return null;
    // not while the player's own roll is still being shown
    if (RemoteGameHook.holdUpdates) return null;
    return {
      label: view.activeSeat === view.youSeat ? words.endTurn : words.continueLabel,
      disabled: this.presenter.busy(),
    };
  }

  /** The default location's name and sub name, in the language of the app. */
  private bankLocationNames(): { name: string; subName: string } {
    try {
      const translate = this.injector.get(TranslateService);
      const name = translate.instant('CashflowGame.bankLocationName');
      const subName = translate.instant('CashflowGame.bankLocationSub');
      return {
        name: name === 'CashflowGame.bankLocationName' ? 'Bank' : name,
        subName: subName === 'CashflowGame.bankLocationSub' ? 'Main' : subName,
      };
    } catch {
      return { name: 'Bank', subName: 'Main' };
    }
  }

  /**
   * Shows one player's books: the app's in-memory state becomes theirs. Called on every table update, so the panel always shows
   * the table as the server has it.
   */
  show(view: TableView, seat: number): void {
    const player = view.players[seat];
    const books = player?.books as unknown as GameBooks | null | undefined;
    if (!books) return;
    this.seat.set(seat);
    applyBooksToApp(AppStateService.instance, books, discardsOf(view), this.bankLocationNames());
    // a Dreamfund seat keeps its Mojo, its dreams and its reserve in the app's own entities: the bridge puts them on screen
    const life = lifeOf(view, seat);
    if (life) {
      applyDreamExtrasToApp(
        AppStateService.instance,
        dreamLifeToApp(life, this.lang, new Date().toISOString()),
      );
    }
    // the income statement, the Cashflow page and the funds are rebuilt from the transactions, exactly as the solo game does after a move
    try {
      this.injector.get(IncomeStatementService).recalculate();
    } catch {
      // without the app's own services (a bare test) the books are shown as they are
    }
    // The pages that hold their own copy (Home, the account lists, the Stats charts, the Balance) redraw as they do after a solo
    // move - the table's books arrive without a save, so nothing else tells them (JFK, 2026-10-18).
    AppStateService.instance.transactionsUpdated$.next();
    AppStateService.instance.subscriptionsUpdated$.next();
  }
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The table a reloaded browser tab goes back to (sessionStorage: it belongs to the tab). */
export const RESUME_TABLE_KEY = 'mm.resumeTable';

/** What the pages find in their local caches while a table's books are on screen: the books themselves (see LocalService.shadow). */
function shownData(): Record<string, () => unknown> {
  const state = () => AppStateService.instance;
  return {
    transactions: () => state().allTransactions,
    locations: () => state().allLocations,
    grow: () => state().allGrowProjects,
    shares: () => state().allShares,
    investments: () => state().allInvestments,
    assets: () => state().allAssets,
    liabilities: () => state().liabilities,
    mojo: () => state().mojo,
    smile: () => state().allSmileProjects,
    fire: () => state().allFireEmergencies,
    revenues: () => state().allRevenues,
    interests: () => state().allIntrests,
    properties: () => state().allProperties,
    dailyEx: () => state().dailyExpenses,
    splurgeEx: () => state().splurgeExpenses,
    smileEx: () => state().smileExpenses,
    fireEx: () => state().fireExpenses,
    mojoEx: () => state().mojoExpenses,
    dailyR: () => String(state().daily),
    splurgeR: () => String(state().splurge),
    smileR: () => String(state().smile),
    fireR: () => String(state().fire),
  };
}

/** The cards drawn since each pile's last reshuffle: what the solo game keeps in its own state, public at a table. */
function discardsOf(
  view: TableView,
): Record<'dealSmall' | 'dealBig' | 'market' | 'doodad', string[]> {
  const pile = (kind: 'dealSmall' | 'dealBig' | 'market' | 'doodad') => [
    ...(view.decks?.[kind]?.discard ?? []),
  ];
  return {
    dealSmall: pile('dealSmall'),
    dealBig: pile('dealBig'),
    market: pile('market'),
    doodad: pile('doodad'),
  };
}

/** Makes the app's in-memory state the given books (a pure function of its arguments: tested without the app around it). */
export function applyBooksToApp(
  state: AppStateService,
  books: GameBooks,
  discards: Record<'dealSmall' | 'dealBig' | 'market' | 'doodad', string[]>,
  bankNames: { name: string; subName: string } = { name: 'Bank', subName: 'Main' },
): void {
  const snapshot = snapshotFromBooks(books);
  state.allTransactions = snapshot.allTransactions as any;
  state.allSubscriptions = snapshot.allSubscriptions as any;
  // Every booking of the game is on its one location, "Bank" - "Main" (JFK, 2026-10-19); its balance is what the bookings add up to.
  const bankId = GAME_BANK_LOCATION_ID;
  for (const record of [...state.allTransactions, ...state.allSubscriptions] as {
    locationId?: string;
  }[]) {
    record.locationId = bankId;
  }
  state.allLocations = [
    {
      id: bankId,
      name: bankNames.name,
      subName: bankNames.subName,
      amount:
        Math.round(
          (state.allTransactions as { amount: number }[]).reduce(
            (sum, tx) => sum + Number(tx.amount || 0),
            0,
          ) * 100,
        ) / 100,
      kind: 'bank',
    },
  ];
  // The share count of a planned project is set on the Grow page before it is bought: a table update in between (somebody else's
  // move) must not put the card's count back.
  const editing = new Map(
    (state.allGrowProjects ?? [])
      .filter((project) => project.status === 'planned' && project.share)
      .map((project) => [project.title, project.share.quantity] as const),
  );
  state.allGrowProjects = snapshot.allGrowProjects as any;
  for (const project of state.allGrowProjects) {
    const kept = editing.get(project.title);
    if (kept !== undefined && project.status === 'planned' && project.share) {
      project.share = { ...project.share, quantity: kept };
    }
  }
  state.allShares = snapshot.allShares as any;
  state.allInvestments = snapshot.allInvestments as any;
  state.allAssets = snapshot.allAssets as any;
  state.liabilities = snapshot.liabilities as any;
  state.allSmileProjects = [];
  state.allFireEmergencies = [];
  // the account's own income statement lines are not these books' (the game keeps its lines as subscriptions)
  state.allRevenues = [];
  state.allIntrests = [];
  state.allProperties = [];
  state.dailyExpenses = [];
  state.splurgeExpenses = [];
  state.smileExpenses = [];
  state.fireExpenses = [];
  state.mojoExpenses = [];
  state.mojo = snapshot.mojo as any;
  state.cashflowGame = { ...snapshot.cashflowGame, drawnCardIds: discards } as any;
  // the account's allocation of Income between its four accounts, as the books were played under
  state.daily = books.allocation.daily;
  state.splurge = books.allocation.splurge;
  state.smile = books.allocation.smile;
  state.fire = books.allocation.fire;
  // nothing may be read from the account over these books
  state.tier2Loaded = true;
  state.tier3GrowLoaded = true;
  state.tier3BalanceLoaded = true;
  state.tier3CashflowGameLoaded = true;
}
