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

const settings = { name: 'Friday', maxSeats: 6, gameSetId: 'cashflow' };
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
});
