import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TableRoomComponent } from './table-room.component';
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
  maxSeats: 6,
  gameSetId: 'cashflow',
  clock: { mode: 'none' },
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

async function render(session: ReturnType<typeof fakeSession>) {
  await TestBed.configureTestingModule({
    imports: [TableRoomComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'r1' } } } },
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
});
