import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DreamRoomComponent } from './dream-room.component';
import { DreamSessionService, type DreamTableView } from './dream-session.service';

const summary = (over: Record<string, unknown> = {}) => ({
  months: 3,
  cashMinor: 150000,
  reserveMinor: 20000,
  reserveTargetMinor: 700000,
  passiveMinor: 5000,
  expensesMinor: 233300,
  livingMinor: 150000,
  cashflowMinor: 50000,
  netWorthMinor: 90000,
  bankLoanMinor: 0,
  dreamTargetMinor: 2450000,
  dreamSavedMinor: 0,
  dreamPoints: 0,
  goals: { reserve: 0.03, debts: 0, dream: 0, independence: 0.03 },
  debts: [{ tag: 'Autokredit', amountMinor: 150000 }],
  holdings: [{ title: 'Tutoring', cardId: 'S31', monthlyMinor: 12000, paidMinor: 5000 }],
  plans: [],
  smile: [],
  career: 'C1',
  ...over,
});

const player = (seat: number, over: Record<string, unknown> = {}) => ({
  seat,
  name: seat === 0 ? 'Ann' : 'Bot',
  color: '#e6194b',
  ready: true,
  pick: null,
  professionId: 'dual-student-informatik',
  status: 'active',
  away: false,
  bot: seat === 0 ? null : { policyId: 'expert' },
  summary: summary(),
  pending: null,
  pendingInfo: null,
  harvest: null,
  paydayDue: false,
  reached: {},
  you: seat === 0,
  ...over,
});

const playing = (over: Record<string, unknown> = {}): DreamTableView =>
  ({
    kind: 'dreamfund',
    id: 'r1',
    version: 9,
    phase: 'playing',
    settings: {
      name: 'Friday',
      difficulty: 'medium',
      shape: 'ring',
      size: 'medium',
      mode: 'guided',
      maxSeats: 4,
    },
    hostSeat: 0,
    you: 0,
    order: [0, 1],
    activeSeat: 0,
    tableRound: 4,
    turnRolled: false,
    finishers: [],
    result: null,
    clock: { deadlineAt: null, pausedAt: null },
    markets: { tech: 1.2, gold: 1 },
    trade: null,
    players: [player(0), player(1)],
    ...over,
  }) as unknown as DreamTableView;

function fakeSession(view: DreamTableView, can: string[]) {
  return {
    view: signal(view),
    room: signal({ id: 'r1', inviteCode: 'ABCD2345' }),
    events: signal([]),
    legalActions: signal(can.map((type) => ({ type }))),
    connection: signal('live'),
    problem: signal<string | null>(null),
    busy: signal(false),
    tableId: 'r1',
    open: jest.fn(),
    close: jest.fn(),
    can: (type: string) => can.includes(type),
    play: jest.fn().mockResolvedValue(true),
    lobby: jest.fn().mockResolvedValue(true),
  };
}

describe('DreamRoomComponent', () => {
  let fixture: ComponentFixture<DreamRoomComponent>;
  let element: HTMLElement;
  let session: ReturnType<typeof fakeSession>;

  async function render(view: DreamTableView, can: string[]) {
    session = fakeSession(view, can);
    await TestBed.configureTestingModule({
      imports: [DreamRoomComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'r1' } } } },
      ],
    })
      .overrideComponent(DreamRoomComponent, {
        set: { providers: [{ provide: DreamSessionService, useValue: session }] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(DreamRoomComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .match((r) => r.url.includes('/bots'))
      .forEach((r) =>
        r.flush({
          items: [{ id: 'expert', name: 'Informed investor' }],
          levels: [{ id: 'master', mistakes: 0 }],
        }),
      );
    fixture.detectChanges();
  }

  const click = (text: string) => {
    const button = Array.from(element.querySelectorAll<HTMLElement>('button')).find((b) =>
      b.textContent!.includes(text),
    );
    expect(button).toBeTruthy();
    button!.click();
  };

  it('shows every player with the goals, and a roll button only when the server lists it', async () => {
    await render(playing(), ['roll', 'fund_reserve']);
    expect(element.textContent).toContain('Ann');
    expect(element.textContent).toContain('Bot');
    expect(element.querySelectorAll('.dr-goal').length).toBe(8);
    expect(element.textContent).toContain('Your turn');
    click('Roll the dice');
    expect(session.play).toHaveBeenCalledWith({ type: 'roll' });
    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent!.includes('End the turn'),
      ),
    ).toBe(false);
  });

  it('asks for the decision of an emergency, with how to pay it, and sends the answer', async () => {
    const view = playing({
      turnRolled: true,
      players: [
        player(0, {
          pending: { kind: 'emergency', cardId: 'E01' },
          pendingInfo: {
            emergency: {
              payMinor: 60000,
              mustPayNow: false,
              choices: [],
              plans: [{ months: 3, perMinor: 22000, totalMinor: 66000 }],
            },
          },
        }),
        player(1),
      ],
    });
    await render(view, ['pay_emergency']);
    expect(element.textContent).toContain('Pay now');
    click('Pay now');
    expect(session.play).toHaveBeenCalledWith({ type: 'pay_emergency', pay: 'now' });
    click('Pay over 3');
    expect(session.play).toHaveBeenCalledWith({ type: 'pay_emergency', pay: 3 });
  });

  it('offers the cards of an Opportunity landing with their price, and a card that cannot be taken is disabled', async () => {
    const view = playing({
      turnRolled: true,
      players: [
        player(0, {
          pending: { kind: 'opportunity', pile: 'seed', offers: ['S29', 'S31'] },
          pendingInfo: {
            offers: [
              { id: 'S29', costMinor: 20000, monthlyMinor: 9000, ok: true },
              {
                id: 'S31',
                costMinor: 5000,
                monthlyMinor: 4000,
                ok: false,
                reason: 'sideHustleFull',
              },
            ],
          },
        }),
        player(1),
      ],
    });
    await render(view, ['take_opportunity', 'skip']);
    const takes = Array.from(element.querySelectorAll<HTMLButtonElement>('.dr-offer button'));
    expect(takes).toHaveLength(2);
    expect(takes[0].disabled).toBe(false);
    expect(takes[1].disabled).toBe(true);
    takes[0].click();
    expect(session.play).toHaveBeenCalledWith({ type: 'take_opportunity', cardId: 'S29' });
  });

  it('shows the waiting room with the host controls the server allows', async () => {
    const view = playing({ phase: 'lobby', activeSeat: null, tableRound: 0 });
    await render(view, ['start', 'add_bot', 'leave', 'set_ready']);
    expect(element.textContent).toContain('Seat a bot');
    click('Start the game');
    expect(session.lobby).toHaveBeenCalledWith('start');
  });

  it('shows the result of a finished game in order', async () => {
    const view = playing({
      phase: 'finished',
      activeSeat: null,
      result: {
        reason: 'round-limit',
        winnerSeat: 1,
        ranking: [
          { seat: 1, rank: 1, outcome: 'playing', goalsMet: 2, dreamPoints: 5, score: 900 },
          { seat: 0, rank: 2, outcome: 'playing', goalsMet: 1, dreamPoints: 0, score: 300 },
        ],
      },
    });
    await render(view, []);
    const rows = Array.from(element.querySelectorAll('.dr-rank')).map((row) => row.textContent!);
    expect(rows[0]).toContain('Bot');
    expect(rows[0]).toContain('900');
    expect(rows[1]).toContain('Ann');
  });
});
