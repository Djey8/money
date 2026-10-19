import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal, type WritableSignal } from '@angular/core';
import type { GameBooks, TableView } from '@money/domain';
import { RemoteGameHook } from '../shared/services/remote-game';
import type { TableSessionService } from './table-session.service';
import { AppStateService } from '../shared/services/app-state.service';
import { DatabaseService } from '../shared/services/database.service';
import { TableModeService, applyBooksToApp } from './table-mode.service';

const books = (): GameBooks =>
  ({
    state: {
      gameSetId: 'cashflow',
      professionId: 'lehrer',
      mode: 'solo',
      boardPosition: 4,
      round: 2,
      virtualDate: '2026-02-01',
      children: 1,
      charityRoundsLeft: 0,
      unemployedRoundsLeft: 0,
      gameSubscriptionTitles: ['Salary'],
      history: [],
    },
    allocation: { daily: 50, splurge: 20, smile: 10, fire: 20 },
    subscriptions: [
      {
        title: 'Salary',
        account: 'Income',
        amountMinor: 330000,
        startDate: '2026-01-01',
        endDate: '',
        category: '@Salary',
        comment: '',
        frequency: 'monthly',
      },
    ],
    transactions: [
      {
        account: 'Income',
        amountMinor: 330000,
        date: '2026-01-01',
        time: '',
        category: '@Salary',
        comment: '',
      },
    ],
    liabilities: [{ tag: 'Bank loan', amountMinor: 1000000, investment: false }],
    shares: [{ tag: 'OK4U', quantity: 100, priceMinor: 500 }],
    investments: [{ tag: 'EFH', depositMinor: 300000, amountMinor: 4700000 }],
    assets: [],
    growProjects: [],
  }) as unknown as GameBooks;

const discards = { dealSmall: ['a'], dealBig: [], market: ['m1', 'm2'], doodad: [] };

describe('applyBooksToApp', () => {
  it('makes the app show the books: decimal amounts, the game state, the allocation, the public discards', () => {
    const state = new AppStateService();
    applyBooksToApp(state, books(), discards);
    expect(state.allTransactions).toHaveLength(1);
    expect(Number(state.allTransactions[0].amount)).toBe(3300);
    expect(Number(state.allSubscriptions[0].amount)).toBe(3300);
    expect(state.allShares[0]).toMatchObject({ tag: 'OK4U', quantity: 100, price: 5 });
    expect(state.allInvestments[0]).toMatchObject({ tag: 'EFH', deposit: 3000, amount: 47000 });
    expect(Number(state.liabilities[0].amount)).toBe(10000);
    expect(state.cashflowGame.professionId).toBe('lehrer');
    expect(state.cashflowGame.boardPosition).toBe(4);
    expect(state.cashflowGame.drawnCardIds).toEqual(discards);
    expect([state.daily, state.splurge, state.smile, state.fire]).toEqual([50, 20, 10, 20]);
  });

  it('shows every booking on the default location, whose balance is what they add up to', () => {
    const state = new AppStateService();
    applyBooksToApp(state, books(), discards, { name: 'Banco', subName: 'Principal' });
    expect(state.allLocations).toEqual([
      { id: 'game-bank', name: 'Banco', subName: 'Principal', amount: 3300, kind: 'bank' },
    ]);
    expect((state.allTransactions[0] as { locationId?: string }).locationId).toBe('game-bank');
    expect((state.allSubscriptions[0] as { locationId?: string }).locationId).toBe('game-bank');
  });

  it('marks every data tier as loaded, so nothing is read from the account over the books', () => {
    const state = new AppStateService();
    state.tier2Loaded = false;
    state.tier3GrowLoaded = false;
    state.tier3BalanceLoaded = false;
    state.tier3CashflowGameLoaded = false;
    applyBooksToApp(state, books(), discards);
    expect([
      state.tier2Loaded,
      state.tier3GrowLoaded,
      state.tier3BalanceLoaded,
      state.tier3CashflowGameLoaded,
    ]).toEqual([true, true, true, true]);
  });
});

const fakeSession = (view: TableView | null) =>
  ({
    view: signal(view),
    close: jest.fn(),
    can: () => false,
    events: signal([]),
    saved: signal(false),
    rating: signal(null),
  }) as unknown as TableSessionService;

const playingView = (patch: Partial<TableView> = {}): TableView =>
  ({
    phase: 'playing',
    youSeat: 1,
    activeSeat: 1,
    holdSeats: [],
    clock: { pausedAt: null, deadlineAt: null, banksMs: [], timeouts: [] },
    players: [
      { seat: 0, name: 'Ann', books: books() },
      { seat: 1, name: 'Ben', books: books() },
    ],
    decks: {
      dealSmall: { discard: ['x'] },
      dealBig: { discard: [] },
      market: { discard: [] },
      doodad: { discard: ['d'] },
    },
    ...patch,
  }) as unknown as TableView;

describe('TableModeService', () => {
  let mode: TableModeService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    mode = TestBed.inject(TableModeService);
  });
  afterEach(() => {
    DatabaseService.readOnly = false;
    RemoteGameHook.current = null;
    RemoteGameHook.layer = null;
    RemoteGameHook.onMenuEntry = null;
  });

  it('turning it on stops every write to the account and routes the moves; leaving reloads the app and says so', () => {
    expect(mode.active()).toBe(false);
    const session = fakeSession(playingView());
    mode.begin(session, 'en', false);
    expect(mode.active()).toBe(true);
    expect(DatabaseService.readOnly).toBe(true);
    expect(RemoteGameHook.current).not.toBeNull();
    expect(RemoteGameHook.layer).not.toBeNull();
    const reload = jest.fn();
    mode.leave(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalled();
    expect(mode.active()).toBe(false);
    expect(RemoteGameHook.current).toBeNull();
  });

  it('shows the books of a seat on the app, and remembers which seat', () => {
    const view = playingView({
      players: [{ books: null }, { books: books() }] as unknown as TableView['players'],
    });
    mode.show(view, 1);
    expect(mode.seat()).toBe(1);
    expect(AppStateService.instance.cashflowGame.drawnCardIds.doodad).toEqual(['d']);
    mode.show(view, 0); // no books for that seat: nothing changes
    expect(mode.seat()).toBe(1);
  });

  it('tells the pages that hold their own copy (Home, the Stats charts) that the books changed', () => {
    const view = playingView({
      players: [{ books: books() }] as unknown as TableView['players'],
    });
    const state = AppStateService.instance;
    const transactions = jest.fn();
    const subscriptions = jest.fn();
    const a = state.transactionsUpdated$.subscribe(transactions);
    const b = state.subscriptionsUpdated$.subscribe(subscriptions);
    mode.show(view, 0);
    a.unsubscribe();
    b.unsubscribe();
    expect(transactions).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveBeenCalledTimes(1);
  });

  it('says why a move cannot be made: another player is looked at, the turn is not mine, it is held, paused or over', () => {
    const session = fakeSession(playingView());
    mode.begin(session, 'en', false);
    expect(mode.refusal()).toBeNull();
    mode.look(0);
    expect(mode.refusal()).toMatch(/looking at another player/);
    mode.look(null);
    expect(mode.refusal()).toBeNull();
    (session.view as unknown as WritableSignal<TableView>).set(playingView({ activeSeat: 0 }));
    expect(mode.refusal()).toMatch(/not your turn/);
    (session.view as unknown as WritableSignal<TableView>).set(playingView({ holdSeats: [1] }));
    expect(mode.refusal()).toMatch(/waits for the others/);
    (session.view as unknown as WritableSignal<TableView>).set(
      playingView({ clock: { pausedAt: 5 } as TableView['clock'] }),
    );
    expect(mode.refusal()).toMatch(/paused/);
    (session.view as unknown as WritableSignal<TableView>).set(playingView({ phase: 'finished' }));
    expect(mode.refusal()).toMatch(/over/);
  });

  it('looking at another player puts their books on the app, going back puts mine', () => {
    const mine = books();
    const theirs = books();
    theirs.state = { ...theirs.state, round: 7 };
    const view = playingView({
      players: [
        { seat: 0, name: 'Ann', books: theirs },
        { seat: 1, name: 'Ben', books: mine },
      ] as unknown as TableView['players'],
    });
    mode.begin(fakeSession(view), 'en', false);
    TestBed.flushEffects();
    expect(AppStateService.instance.cashflowGame.round).toBe(2);
    mode.look(0);
    TestBed.flushEffects();
    expect(mode.seat()).toBe(0);
    expect(AppStateService.instance.cashflowGame.round).toBe(7);
    mode.look(1); // my own seat is the same as going back
    TestBed.flushEffects();
    expect(mode.looking()).toBeNull();
    expect(AppStateService.instance.cashflowGame.round).toBe(2);
  });

  it('the Multiplayer entry of the menu goes to the lobby also while a table is on - the way back to the lobby is always open', () => {
    mode.begin(fakeSession(playingView()), 'en', false);
    expect(RemoteGameHook.onMenuEntry).toBeNull();
  });

  it('the board is common to all: looking at another player moves no token, only my own roll walks mine', () => {
    const mine = books();
    mine.state = { ...mine.state, boardPosition: 3 };
    const theirs = books();
    theirs.state = { ...theirs.state, boardPosition: 7 };
    const view = playingView({
      players: [
        { seat: 0, name: 'Ann', color: '#a', books: theirs },
        { seat: 1, name: 'Ben', color: '#b', books: mine },
      ] as unknown as TableView['players'],
    });
    mode.begin(fakeSession(view), 'en', false);
    const tokens = (mineAt: number | null) =>
      (
        mode as unknown as {
          tokens: (m: number | null) => { id: string; position: number | null }[];
        }
      )
        .tokens(mineAt)
        .map((t) => t.position);
    // the screen draws the books of whoever is looked at; the board still has everybody where they stand
    mode.look(0);
    expect(tokens(7)).toEqual([7, 3]);
    mode.look(null);
    expect(tokens(3)).toEqual([7, 3]);
    // while my own roll is told the screen walks my token
    RemoteGameHook.holdUpdates = true;
    expect(tokens(5)).toEqual([7, 5]);
    RemoteGameHook.holdUpdates = false;
  });

  it('the gate is End turn for the one who moved, Continue for a seller, nothing for the others, and waits while a move is told', () => {
    const session = fakeSession(playingView({ activeSeat: 1, holdSeats: [1] }));
    mode.begin(session, 'en', false);
    expect(mode.gate()).toEqual({ label: 'End turn', disabled: false });
    (session.view as unknown as WritableSignal<TableView>).set(
      playingView({ activeSeat: 0, holdSeats: [0, 1] }),
    );
    expect(mode.gate()).toEqual({ label: 'Continue', disabled: false });
    (session.view as unknown as WritableSignal<TableView>).set(
      playingView({ activeSeat: 0, holdSeats: [0] }),
    );
    expect(mode.gate()).toBeNull();
    (session.view as unknown as WritableSignal<TableView>).set(
      playingView({ activeSeat: 1, holdSeats: [1] }),
    );
    // not while the player's own roll is still being shown (the token is walking)
    RemoteGameHook.holdUpdates = true;
    expect(mode.gate()).toBeNull();
    RemoteGameHook.holdUpdates = false;
    mode.presenter.busy.set(true);
    expect(mode.gate()).toEqual({ label: 'End turn', disabled: true });
    mode.look(0);
    expect(mode.gate()).toBeNull();
  });

  it('names whose turn it is while it is another player on the move, and nothing on my own turn or when the game is over', () => {
    const session = fakeSession(playingView({ activeSeat: 0 }));
    mode.begin(session, 'en', false);
    expect(mode.turnBanner()).toMatchObject({ text: "Ann's turn" });
    (session.view as unknown as WritableSignal<TableView>).set(playingView({ activeSeat: 1 }));
    expect(mode.turnBanner()).toBeNull();
    (session.view as unknown as WritableSignal<TableView>).set(
      playingView({ activeSeat: 0, phase: 'finished' }),
    );
    expect(mode.turnBanner()).toBeNull();
  });

  it('says how a finished game ended for the player: a loss is red with the place, the ranking and the way to save it', () => {
    const lost = playingView({
      phase: 'finished',
      youSeat: 1,
      result: {
        reason: 'escaped',
        winnerSeat: 0,
        ranking: [
          { seat: 0, rank: 1 },
          { seat: 1, rank: 2 },
        ],
      },
    } as Partial<TableView>);
    const session = fakeSession(lost);
    mode.begin(session, 'en', false);
    const over = mode.over()!;
    expect(over.won).toBe(false);
    expect(over.headline).toBe('You finished #2 of 2');
    expect(over.hint).toContain('won the game');
    expect(over.ranking.map((r) => [r.rank, r.me])).toEqual([
      [1, false],
      [2, true],
    ]);
    (session.view as unknown as WritableSignal<TableView>).set({
      ...lost,
      result: {
        ...lost.result!,
        winnerSeat: 1,
        ranking: [
          { seat: 1, rank: 1 },
          { seat: 0, rank: 2 },
        ],
      },
    } as TableView);
    expect(mode.over()!.won).toBe(true);
    (session.view as unknown as WritableSignal<TableView>).set(playingView());
    expect(mode.over()).toBeNull();
  });

  it('adds the rating line to the game-over panel once the board has the game', () => {
    const over = playingView({
      phase: 'finished',
      youSeat: 1,
      result: {
        reason: 'escaped',
        winnerSeat: 0,
        ranking: [
          { seat: 0, rank: 1 },
          { seat: 1, rank: 2 },
        ],
      },
    } as Partial<TableView>);
    const session = fakeSession(over);
    mode.begin(session, 'en', false);
    expect(mode.over()!.note).toBe('');
    (session as unknown as { rating: WritableSignal<unknown> }).rating.set({
      ranked: true,
      changes: [
        { seat: 0, before: 1500, after: 1512, delta: 12 },
        { seat: 1, before: 1500, after: 1488, delta: -12 },
      ],
    });
    expect(mode.over()!.note).toBe('Ranked: 1500 → 1488 (-12)');
    (session as unknown as { rating: WritableSignal<unknown> }).rating.set({
      ranked: false,
      why: 'too-short',
      changes: [],
    });
    expect(mode.over()!.note).toBe('Not ranked: under 8 rounds');
  });

  it('the settings menu: autoplay while away, the table page and the lobby; remove only for a host who is alone', () => {
    const alone = playingView({
      youSeat: 0,
      hostSeat: 0,
      players: [
        { seat: 0, name: 'Ann', status: 'active', books: books() },
        { seat: 1, name: 'Bot', status: 'active', bot: { policyId: 'x' }, books: books() },
      ],
    } as unknown as Partial<TableView>);
    const session = fakeSession(alone);
    mode.begin(session, 'en', false);
    const menu = mode.tableMenu()!;
    expect(menu.title).toBe('Settings');
    expect(menu.items.map((i) => i.id)).toEqual([
      'messages',
      'autoplay',
      'page',
      'lobby',
      'remove',
    ]);
    expect(menu.items.find((i) => i.id === 'autoplay')!.label).toContain('off');
    // with another person at the table the table is left, not removed
    (session.view as unknown as WritableSignal<TableView>).set({
      ...alone,
      players: [
        { seat: 0, name: 'Ann', status: 'active', books: books() },
        { seat: 1, name: 'Ben', status: 'active', books: books() },
      ],
    } as unknown as TableView);
    expect(mode.tableMenu()!.items.map((i) => i.id)).not.toContain('remove');
    // the bell on the game screen is the same switch as the first menu entry
    expect(mode.quickToggles()).toEqual([
      expect.objectContaining({ id: 'messages', icon: '🔔', on: true }),
    ]);
  });

  it('keeps showing the other player on my own turn while their move is still being told', () => {
    const session = fakeSession(playingView({ activeSeat: 1 }));
    mode.begin(session, 'en', false);
    expect(mode.turnBanner()).toBeNull();
    mode.presenter.busy.set(true);
    expect(mode.turnBanner()).not.toBeNull();
    expect(mode.gate()).toBeNull();
    mode.presenter.busy.set(false);
    expect(mode.turnBanner()).toBeNull();
  });

  it('rebuilds the page on screen when another player is looked at, and when the player comes back', () => {
    jest.useFakeTimers();
    const refresh = jest.fn();
    RemoteGameHook.refreshPages = refresh;
    mode.begin(fakeSession(playingView({ activeSeat: 1 })), 'en', false);
    mode.look(0);
    jest.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(1);
    mode.look(null);
    jest.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(2);
    mode.look(null);
    jest.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(2);
    RemoteGameHook.refreshPages = null;
    jest.useRealTimers();
  });
});

describe('TableModeService and the offers of buyers', () => {
  const navigate = jest.fn(async () => true);
  let mode: TableModeService;

  const withOffer = (
    offeredAtRoll: number,
    count: number,
    rolls = 3,
    extra: Partial<TableView> = {},
  ) => {
    const mine = books();
    mine.state = {
      ...mine.state,
      turn: { phase: 'roll', count },
      marketOffers: [
        { title: 'EFH', label: '+20%', salePriceMinor: 9000000, cardId: 'c1', offeredAtRoll },
      ],
    } as never;
    return playingView({
      settings: { rules: { sellOfferRolls: rolls } } as never,
      players: [
        { seat: 0, name: 'Ann', color: '#a', books: books() },
        { seat: 1, name: 'Ben', color: '#b', books: mine },
      ] as unknown as TableView['players'],
      ...extra,
    });
  };
  const sessionWith = (view: TableView) =>
    ({
      view: signal(view),
      close: jest.fn(),
      can: (action: string) => action === 'sell_position',
      events: signal([]),
    }) as unknown as TableSessionService;

  beforeEach(() => {
    navigate.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigate } }] });
    mode = TestBed.inject(TableModeService);
  });
  afterEach(() => {
    DatabaseService.readOnly = false;
    RemoteGameHook.current = null;
    RemoteGameHook.layer = null;
    RemoteGameHook.banner = null;
    RemoteGameHook.onMenuEntry = null;
    document.body.classList.remove('table-mode', 'table-view-only');
  });

  it('says for how many more turns each offer stays open, counted from the roll it was made on', () => {
    mode.begin(sessionWith(withOffer(4, 4)), 'en', false);
    expect(mode.myOffers().map((o) => [o.title, o.left])).toEqual([['EFH', 3]]);
    const later = sessionWith(withOffer(4, 6));
    mode.begin(later, 'en', false);
    expect(mode.myOffers()[0].left).toBe(1);
  });

  it('has no end for an offer that lasts until the next Payday', () => {
    mode.begin(sessionWith(withOffer(4, 5, 0)), 'en', false);
    expect(mode.myOffers()[0].left).toBeNull();
  });

  it('takes the player to the Grow page when an offer comes in, once, after the story has been told', () => {
    TestBed.flushEffects();
    mode.begin(sessionWith(withOffer(2, 2)), 'en', false);
    TestBed.flushEffects();
    expect(navigate).toHaveBeenCalledWith(['/grow']);
    expect(navigate).toHaveBeenCalledTimes(1);
    TestBed.flushEffects();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('does not take the player anywhere while another player is looked at', () => {
    mode.begin(sessionWith(withOffer(2, 2)), 'en', false);
    mode.look(0);
    navigate.mockClear();
    TestBed.flushEffects();
    expect(navigate).not.toHaveBeenCalled();
  });
});
