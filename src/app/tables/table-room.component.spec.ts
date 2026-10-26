import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TableRoomComponent } from './table-room.component';
import { TableModeService } from './table-mode.service';
import { TableSessionService } from './table-session.service';

const books = (position: number | null) => ({
  state: {
    professionId: 'p',
    boardPosition: position,
    gameSubscriptionTitles: [],
    charityRoundsLeft: 0,
  },
  subscriptions: [],
  transactions: [],
  allocation: { daily: 1, splurge: 0, smile: 0, fire: 0 },
});

function fakeSession(view: unknown, legal: string[] = []) {
  const v = signal(view);
  return {
    view: v,
    room: signal({ id: 'r1', inviteCode: 'ABCD1234' }),
    legalActions: signal(legal.map((action) => ({ action, description: '' }))),
    presence: signal({ seats: [] as number[] }),
    connection: signal('live'),
    problem: signal<string | null>(null),
    busy: signal(false),
    events: signal([]),
    open: jest.fn(),
    close: jest.fn(),
    can: (a: string) => legal.includes(a),
    play: jest.fn(async () => true),
    lobby: jest.fn(async () => true),
  };
}

const settings = {
  name: 'Friday',
  visibility: 'public',
  maxSeats: 6,
  gameSetId: 'cashflow',
  professions: 'duplicates',
  endCondition: 'first-escape',
  clock: { mode: 'none' },
  pace: 'normal',
  ranked: true,
  spectators: false,
  allowRewind: true,
  repayOffTurn: true,
  turnGate: true,
  showProgress: true,
  leaveFreeRounds: 0,
  rules: { sellOfferRolls: 3 },
};
const players = (over: Record<string, unknown>[] = []) =>
  [
    {
      seat: 0,
      name: 'Ann',
      color: '#e74c3c',
      ready: true,
      status: 'active',
      away: false,
      hasPicked: true,
      pick: null,
      professionId: null,
      books: null,
    },
    {
      seat: 1,
      name: 'Bob',
      color: '#3498db',
      ready: false,
      status: 'active',
      away: false,
      hasPicked: false,
      pick: null,
      professionId: null,
      books: null,
    },
  ].map((p, i) => ({ ...p, ...(over[i] ?? {}) }));

async function render(session: ReturnType<typeof fakeSession>, query = '1') {
  await TestBed.configureTestingModule({
    imports: [TableRoomComponent, TranslateModule.forRoot()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: { get: () => 'r1' },
            // `?lobby=1` keeps the page (the game screen is not opened by itself) - these tests are about the page
            queryParamMap: { get: (key: string) => (key === 'lobby' ? query || null : null) },
          },
        },
      },
    ],
  })
    .overrideComponent(TableRoomComponent, {
      set: { providers: [{ provide: TableSessionService, useValue: session }] },
    })
    .compileComponents();
  const fixture: ComponentFixture<TableRoomComponent> = TestBed.createComponent(TableRoomComponent);
  fixture.detectChanges();
  return fixture;
}

describe('TableRoomComponent', () => {
  afterEach(() => jest.useRealTimers());

  it('opens the table it is routed to and shows the lobby with the invite code', async () => {
    const session = fakeSession({
      id: 'r1',
      version: 1,
      phase: 'lobby',
      settings,
      hostSeat: 0,
      youSeat: 0,
      activeSeat: null,
      tableRound: 0,
      players: players(),
      clock: { deadlineAt: null, pausedAt: null },
    });
    const fixture = await render(session);
    expect(session.open).toHaveBeenCalledWith('r1');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Friday');
    expect(text).toContain('ABCD1234');
    expect(text).toContain('Ann');
    expect(text).toContain('Bob');
    // the host cannot start until everyone is ready
    const start = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent!.includes('Start the game'),
    ) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  it('on my turn offers the roll the server lists, and sends it', async () => {
    const session = fakeSession(
      {
        id: 'r1',
        version: 3,
        phase: 'playing',
        settings,
        hostSeat: 0,
        youSeat: 1,
        activeSeat: 1,
        tableRound: 2,
        clock: { deadlineAt: null, pausedAt: null },
        trade: null,
        result: null,
        players: players([
          { books: books(3), professionId: 'p' },
          { books: books(null), professionId: 'p' },
        ]),
      },
      ['roll'],
    );
    const fixture = await render(session);
    expect(fixture.nativeElement.textContent).toContain('Your turn');
    const roll = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent!.includes('Roll the dice'),
    ) as HTMLButtonElement;
    roll.click();
    expect(session.play).toHaveBeenCalledWith({ type: 'roll' });
    // one token per player on the ring
    expect(fixture.nativeElement.querySelectorAll('.rr-token--player')).toHaveLength(2);
  });

  it('when it is not my turn there is no roll, and it says whose turn it is', async () => {
    const session = fakeSession({
      id: 'r1',
      version: 3,
      phase: 'playing',
      settings,
      hostSeat: 0,
      youSeat: 1,
      activeSeat: 0,
      tableRound: 1,
      clock: { deadlineAt: null, pausedAt: null },
      trade: null,
      result: null,
      players: players([
        { books: books(1), professionId: 'p' },
        { books: books(2), professionId: 'p' },
      ]),
    });
    const fixture = await render(session);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Turn of');
    expect(text).toContain('Ann');
    expect(text).not.toContain('Roll the dice');
  });

  it('counts the clock down from the server deadline', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    const session = fakeSession({
      id: 'r1',
      version: 3,
      phase: 'playing',
      settings,
      hostSeat: 0,
      youSeat: 0,
      activeSeat: 0,
      tableRound: 1,
      clock: { deadlineAt: Date.now() + 65_000, pausedAt: null },
      trade: null,
      result: null,
      players: players([
        { books: books(1), professionId: 'p' },
        { books: books(2), professionId: 'p' },
      ]),
    });
    const fixture = await render(session);
    expect(fixture.componentInstance.clockText()).toBe('1:05');
    jest.advanceTimersByTime(6000);
    expect(fixture.componentInstance.clockText()).toBe('0:59');
  });

  describe('time and presence', () => {
    const playing = (clock: Record<string, unknown>, clockSettings: Record<string, unknown>) => ({
      id: 'r1',
      version: 3,
      phase: 'playing',
      settings: { ...settings, clock: clockSettings },
      hostSeat: 0,
      youSeat: 0,
      activeSeat: 0,
      tableRound: 1,
      clock: { pausedAt: null, banksMs: [], timeouts: [], ...clock },
      trade: null,
      result: null,
      players: players([
        { books: books(1), professionId: 'p' },
        { books: books(2), professionId: 'p', away: true },
      ]),
    });

    it('draws a bar that empties with the per-move clock, red when low', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      const session = fakeSession(
        playing({ deadlineAt: Date.now() + 30_000 }, { mode: 'per-move', secondsPerMove: 60 }),
      );
      const fixture = await render(session);
      const fill = () => fixture.nativeElement.querySelector('.tr-bar-fill') as HTMLElement;
      expect(fill().style.width).toBe('50%');
      expect(fill().classList).not.toContain('tr-bar-fill--low');
      jest.advanceTimersByTime(25_000);
      fixture.detectChanges();
      expect(fill().classList).toContain('tr-bar-fill--low');
    });

    it('shows no bar without a clock, and the banks of a bank clock next to each player', async () => {
      const none = await render(fakeSession(playing({ deadlineAt: null }, { mode: 'none' })));
      expect(none.nativeElement.querySelector('.tr-bar')).toBeNull();
      expect(none.nativeElement.querySelector('.tr-bank')).toBeNull();
      TestBed.resetTestingModule();
      const bank = await render(
        fakeSession(
          playing(
            { deadlineAt: Date.now() + 90_000, banksMs: [0, 300_000] },
            { mode: 'bank', bankSeconds: 600, incrementSeconds: 0 },
          ),
        ),
      );
      const banks = Array.from(bank.nativeElement.querySelectorAll('.tr-bank')).map((b) =>
        (b as HTMLElement).textContent!.trim(),
      );
      expect(banks).toEqual(['⏱ 1:30', '⏱ 5:00']);
    });

    it('marks an away player', async () => {
      const fixture = await render(fakeSession(playing({ deadlineAt: null }, { mode: 'none' })));
      expect(fixture.nativeElement.textContent).toContain('away');
    });

    it('says it is my turn in the tab title, and puts the title back when it is not', async () => {
      const original = document.title;
      const session = fakeSession(playing({ deadlineAt: null }, { mode: 'none' }));
      const fixture = await render(session);
      expect(document.title).toContain('● Your turn');
      (session.view as ReturnType<typeof signal>).set({
        ...(session.view() as object),
        activeSeat: 1,
      });
      fixture.detectChanges();
      expect(document.title).toBe(original);
    });

    it('puts the title back when the table is left', async () => {
      const original = document.title;
      const fixture = await render(fakeSession(playing({ deadlineAt: null }, { mode: 'none' })));
      expect(document.title).not.toBe(original);
      fixture.destroy();
      expect(document.title).toBe(original);
    });
  });

  describe('the result', () => {
    const finished = () => ({
      id: 'r1',
      version: 9,
      phase: 'finished',
      settings,
      hostSeat: 0,
      youSeat: 1,
      activeSeat: null,
      tableRound: 4,
      clock: { deadlineAt: null, pausedAt: null, banksMs: [], timeouts: [] },
      trade: null,
      result: {
        reason: 'escaped',
        winnerSeat: 1,
        ranking: [
          {
            seat: 1,
            rank: 1,
            outcome: 'escaped',
            passiveIncomeMinor: 500000,
            monthlyCashflowMinor: 1,
          },
          {
            seat: 0,
            rank: 2,
            outcome: 'bankrupt',
            passiveIncomeMinor: 100,
            monthlyCashflowMinor: -1,
          },
        ],
      },
      players: players([
        { books: books(1), professionId: 'p' },
        { books: books(2), professionId: 'p' },
      ]),
    });

    it('shows why it ended and the ranking with each outcome', async () => {
      const fixture = await render(fakeSession(finished()));
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('The game is over');
      expect(text).toContain('A player escaped the rat race.');
      const rows = Array.from(fixture.nativeElement.querySelectorAll('.tr-rank')).map((r) =>
        (r as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(rows[0]).toContain('Bob');
      expect(rows[0]).toContain('escaped the rat race');
      expect(rows[1]).toContain('Ann');
      expect(rows[1]).toContain('bankrupt');
    });

    it('files my game once, and then says it is saved', async () => {
      const session = fakeSession(finished()) as ReturnType<typeof fakeSession> & {
        save: jest.Mock;
      };
      session.save = jest.fn(async () => true);
      const fixture = await render(session);
      const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
        (b as HTMLElement).textContent!.includes('Save to my games'),
      ) as HTMLButtonElement;
      button.click();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
      expect(session.save).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.textContent).toContain('Saved in your games.');
    });
  });

  describe('the waiting room', () => {
    const lobbyView = (youSeat: number, extra: Record<string, unknown>[] = []) => ({
      id: 'r1',
      version: 2,
      phase: 'lobby',
      settings,
      hostSeat: 0,
      youSeat,
      activeSeat: null,
      tableRound: 0,
      players: [...players(), ...extra],
      clock: { deadlineAt: null, pausedAt: null },
    });
    const bot = {
      seat: 2,
      name: 'Allie All-Round',
      color: '#2ecc71',
      ready: true,
      status: 'active',
      away: false,
      hasPicked: false,
      pick: null,
      professionId: null,
      books: null,
      bot: { policyId: 'all-rounder' },
    };
    const catalog = {
      items: [
        {
          id: 'never-buy',
          name: 'Sleepy Sam',
          difficulty: 'easy',
          description: 'Never invests.',
          ratings: { master: 1000, casual: 1000 },
          playerIds: { master: 'bot-never-buy' },
        },
        {
          id: 'all-rounder',
          name: 'Allie All-Round',
          difficulty: 'hard',
          description: 'Does it all.',
          ratings: { master: 1650, casual: 1480 },
          playerIds: { master: 'bot-all-rounder' },
        },
      ],
    };
    const seatsOf = (extra: Record<string, unknown>[] = []) => ({
      seats: [
        {
          seat: 0,
          name: 'Ann',
          bot: false,
          listed: true,
          rating: 1534,
          ratedGames: 7,
          playerId: 'p-ann',
        },
        { seat: 1, name: 'Bob', bot: false, listed: false, rating: 1500, ratedGames: 0 },
        ...extra,
      ],
    });
    const button = (fixture: { nativeElement: HTMLElement }, text: string) =>
      Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
        (b as HTMLElement).textContent!.includes(text),
      ) as HTMLButtonElement | undefined;
    const flushSeats = (fixture: ComponentFixture<TableRoomComponent>, body = seatsOf()) => {
      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url.endsWith('/v1/game/rooms/r1/seats'))
        .flush(body);
      fixture.detectChanges();
    };

    it('tells everybody what the table is: its settings, in short', async () => {
      const fixture = await render(fakeSession(lobbyView(1)));
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Table settings');
      expect(text).toContain('Ranked');
      expect(text).toContain('6 seats');
      expect(text).toContain('Only the host can change these.');
      // a guest cannot change them
      expect(button(fixture, 'Change settings')).toBeUndefined();
      button(fixture, 'All rules')!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.wr-rules')).not.toBeNull();
    });

    it('shows a card for every player with the rating, and a free seat for the rest', async () => {
      const fixture = await render(fakeSession(lobbyView(0)));
      flushSeats(fixture);
      const cards = fixture.nativeElement.querySelectorAll('.wr-seat:not(.wr-seat--free)');
      expect(cards).toHaveLength(2);
      expect(cards[0].textContent).toContain('1534');
      expect(cards[0].textContent).toContain('7 rated');
      expect(cards[1].textContent).toContain('Not on the leaderboard');
      expect(fixture.nativeElement.querySelectorAll('.wr-seat--free')).toHaveLength(4);
    });

    it('a tap on a listed player opens their stats; an unlisted one has none to open', async () => {
      const fixture = await render(fakeSession(lobbyView(0)));
      flushSeats(fixture);
      const cards = fixture.nativeElement.querySelectorAll(
        '.wr-seat-main:not(.wr-seat-main--free)',
      );
      expect((cards[1] as HTMLButtonElement).disabled).toBe(true);
      (cards[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-table-player-info')).not.toBeNull();
      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url.endsWith('/v1/game/players/p-ann'))
        .flush({});
    });

    it('the host changes the settings with the panel that opens a table', async () => {
      const session = fakeSession(lobbyView(0));
      const fixture = await render(session);
      button(fixture, 'Change settings')!.click();
      fixture.detectChanges();
      // the panel starts from what the table has now
      const name = fixture.nativeElement.querySelector('input[name="name"]') as HTMLInputElement;
      await Promise.resolve();
      expect(name.value).toBe('Friday');
      button(fixture, 'Save settings')!.click();
      await Promise.resolve();
      expect(session.lobby).toHaveBeenCalledWith(
        'settings',
        expect.objectContaining({
          settings: expect.objectContaining({ name: 'Friday', maxSeats: 6, ranked: true }),
        }),
      );
    });

    it('the host picks a bot from the list and seats it at the chosen skill', async () => {
      const session = fakeSession(lobbyView(0));
      const fixture = await render(session);
      button(fixture, 'Add a bot')!.click();
      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url.endsWith('/v1/game/rooms/bots'))
        .flush(catalog);
      fixture.detectChanges();
      // the best bot first, at the skill level shown
      const names = Array.from(fixture.nativeElement.querySelectorAll('.wr-bot strong')).map((e) =>
        (e as HTMLElement).textContent!.trim(),
      );
      expect(names).toEqual(['Allie All-Round', 'Sleepy Sam']);
      expect(fixture.nativeElement.textContent).toContain('hard · 1650');
      expect(fixture.nativeElement.textContent).toContain('Does it all.');
      button(fixture, 'Casual')!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('hard · 1480');
      (
        fixture.nativeElement.querySelector('.wr-bot .tx-btn--primary') as HTMLButtonElement
      ).click();
      expect(session.lobby).toHaveBeenCalledWith('bots', {
        policyId: 'all-rounder',
        level: 'casual',
      });
    });

    it('a guest has no bot picker and no settings button', async () => {
      const fixture = await render(fakeSession(lobbyView(1)));
      expect(button(fixture, 'Add a bot')).toBeUndefined();
      expect(button(fixture, 'Change settings')).toBeUndefined();
    });

    it('a bot sits as a card with its level, and only the host can remove it', async () => {
      const session = fakeSession(lobbyView(0, [bot]));
      const fixture = await render(session);
      flushSeats(
        fixture,
        seatsOf([
          {
            seat: 2,
            name: 'Allie All-Round',
            bot: true,
            listed: true,
            rating: 1650,
            ratedGames: 40,
            level: 'master',
            playerId: 'bot-all-rounder',
          },
        ]),
      );
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Allie All-Round');
      expect(text).toContain('1650');
      expect(text).toContain('🤖 Master');
      (fixture.nativeElement.querySelector('.wr-x') as HTMLButtonElement).click();
      expect(session.lobby).toHaveBeenCalledWith('kick', { seat: 2 });
    });

    it('a guest sees the bot but has no remove button', async () => {
      const fixture = await render(fakeSession(lobbyView(1, [bot])));
      expect(fixture.nativeElement.textContent).toContain('🤖');
      expect(fixture.nativeElement.querySelector('.wr-x')).toBeNull();
    });
  });
});

describe('TableRoomComponent opens the game by itself', () => {
  afterEach(() => {
    TestBed.inject(TableModeService).leave(() => undefined);
    jest.useRealTimers();
  });

  const playing = {
    id: 'r1',
    version: 4,
    phase: 'playing',
    settings,
    hostSeat: 0,
    youSeat: 1,
    activeSeat: 0,
    tableRound: 1,
    holdSeats: [],
    players: players(),
    decks: {},
    clock: { deadlineAt: null, pausedAt: null, banksMs: [], timeouts: [] },
  };

  it('puts the table into the game screen once it is being played and I am seated', async () => {
    const session = fakeSession(playing);
    await render(session, '');
    const mode = TestBed.inject(TableModeService);
    expect(mode.active()).toBe(true);
    expect(mode.session()).toBe(session);
  });

  it('stays on the page when asked to (coming back from the game)', async () => {
    await render(fakeSession(playing), '1');
    expect(TestBed.inject(TableModeService).active()).toBe(false);
  });

  it('does not take a spectator in', async () => {
    await render(fakeSession({ ...playing, youSeat: null }), '');
    expect(TestBed.inject(TableModeService).active()).toBe(false);
  });
});
