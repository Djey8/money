import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import type { TableView } from '@money/domain';
import { TableWaitingRoomComponent } from './table-waiting-room.component';

const player = (seat: number, over: Record<string, unknown> = {}) => ({
  seat,
  name: seat === 0 ? 'Ann' : 'Bot',
  color: '#e6194b',
  ready: true,
  status: 'active',
  away: false,
  hasPicked: false,
  bot: seat === 0 ? null : { policyId: 'expert' },
  pick: null,
  professionId: null,
  books: null,
  ...over,
});

const lobby = (over: Record<string, unknown> = {}) =>
  ({
    kind: 'dreamfund',
    id: 'r1',
    phase: 'lobby',
    youSeat: 0,
    hostSeat: 0,
    players: [player(0), player(1)],
    settings: {
      name: 'Friday',
      visibility: 'public',
      maxSeats: 4,
      difficulty: 'hard',
      shape: 'ring',
      size: 'medium',
      mode: 'guided',
      professions: 'duplicates',
      endCondition: 'first-win',
      clock: { mode: 'none' },
      pace: 'normal',
      ranked: true,
      spectators: true,
      turnGate: false,
      showProgress: true,
      allowRewind: false,
      repayOffTurn: false,
      leaveFreeRounds: 0,
      rules: { sellOfferRolls: 0 },
      gameSetId: 'jfk-stories',
    },
    ...over,
  }) as unknown as TableView;

describe('TableWaitingRoomComponent at a Dreamfund table', () => {
  let fixture: ComponentFixture<TableWaitingRoomComponent>;
  let element: HTMLElement;
  let http: HttpTestingController;
  const lobbyCalls: unknown[][] = [];

  beforeEach(async () => {
    lobbyCalls.length = 0;
    await TestBed.configureTestingModule({
      imports: [TableWaitingRoomComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TableWaitingRoomComponent);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
    const c = fixture.componentInstance;
    c.game = 'dreamfund';
    c.table = lobby();
    c.roomId = 'r1';
    c.lang = 'en';
    c.characters = [{ id: 'dual-student-informatik', title: 'Dual student' }];
    c.sessionOverride = {
      busy: () => false,
      problem: () => null,
      lobby: jest.fn(async (...args: unknown[]) => {
        lobbyCalls.push(args);
        return true;
      }),
    };
    fixture.componentRef.setInput('lang', 'en');
    fixture.detectChanges();
    c.ngOnChanges({
      lang: {
        currentValue: 'en',
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      },
      table: {
        currentValue: c.table,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    http
      .match((r) => r.url.endsWith('/v1/game/rooms/r1/seats'))
      .forEach((r) => r.flush({ seats: [] }));
    fixture.detectChanges();
  });

  it('shows what the table is: the difficulty and the map beside the common settings', () => {
    expect(element.textContent).toContain('Hard');
    expect(element.textContent).toContain('ring');
    expect(element.textContent).toContain('Ann');
  });

  it('seats a Dreamfund strategy with its own prefix, at the skill level chosen', () => {
    const open = Array.from(element.querySelectorAll<HTMLElement>('button')).find((b) =>
      b.textContent!.includes('Add a bot'),
    )!;
    open.click();
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/v1/game/rooms/bots?kind=dreamfund&difficulty=hard'))
      .flush({ items: [{ id: 'saver', name: 'Cautious saver', ratings: { master: 1450 } }] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Cautious saver');
    expect(element.textContent).toContain('1450');
    const add = Array.from(element.querySelectorAll<HTMLElement>('.wr-bot button')).pop()!;
    add.click();
    expect(lobbyCalls).toEqual([['bots', { policyId: 'dream:saver', level: 'master' }]]);
  });
});
