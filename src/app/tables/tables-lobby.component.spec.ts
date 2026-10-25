import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablesLobbyComponent } from './tables-lobby.component';
import { tablesTexts } from './tables.texts';

const row = (over: Record<string, unknown>) => ({
  id: 'r1',
  name: 'Friday',
  hostName: 'Ann',
  phase: 'lobby',
  visibility: 'public',
  seatsTaken: 2,
  maxSeats: 6,
  gameSetId: 'cashflow',
  professions: 'duplicates',
  turnOrder: 'random',
  clock: { mode: 'none' },
  endCondition: 'first-escape',
  language: 'en',
  joined: false,
  ...over,
});

describe('TablesLobbyComponent', () => {
  let fixture: ComponentFixture<TablesLobbyComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TablesLobbyComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TablesLobbyComponent);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const answer = (open: unknown[], mine: unknown[]) => {
    http.expectOne((r) => r.url.endsWith('/v1/game/rooms?scope=open')).flush({ items: open });
    http.expectOne((r) => r.url.endsWith('/v1/game/rooms?scope=mine')).flush({ items: mine });
    http
      .expectOne((r) => r.url.endsWith('/v1/game/players/me'))
      .flush({ playerId: 'me', name: 'Me', rating: 1520, provisional: false });
    fixture.detectChanges();
  };
  const cards = () => Array.from(element.querySelectorAll('.tl-card'));
  const click = (selector: string, text?: string) => {
    const target = Array.from(element.querySelectorAll<HTMLElement>(selector)).find(
      (e) => !text || e.textContent!.includes(text),
    );
    target!.click();
    fixture.detectChanges();
  };

  it('lists open tables as cards, and the ones you are in apart from them', () => {
    answer(
      [row({ id: 'a', name: 'Open one' }), row({ id: 'b', name: 'Mine', joined: true })],
      [row({ id: 'b', name: 'Mine', joined: true })],
    );
    const text = element.textContent!;
    expect(text).toContain('Open one');
    // the joined table shows under Your tables only, not again under Open tables
    expect(text.match(/Mine/g)!.length).toBe(1);
    expect(cards()).toHaveLength(2);
    expect(cards()[1].textContent).toContain('4 free');
  });

  it('shows who sits at a table before joining, and opens their stats with a tap', () => {
    answer(
      [
        row({
          id: 'a',
          name: 'Open one',
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
          ],
        }),
      ],
      [],
    );
    const seats = element.querySelectorAll('button.tl-seat');
    expect(seats).toHaveLength(2);
    expect(seats[0].textContent).toContain('Ann');
    expect(seats[0].textContent).toContain('1534');
    // somebody who is not on the leaderboard has no stats to open
    expect((seats[1] as HTMLButtonElement).disabled).toBe(true);
    (seats[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('app-table-player-info')).not.toBeNull();
    http.expectOne((r) => r.url.endsWith('/v1/game/players/p-ann')).flush({});
  });

  it('says so when no table is open, with a way to open one', () => {
    answer([], []);
    expect(element.textContent).toContain(tablesTexts('en').noOpen);
    expect(element.querySelector('.tl-empty-box button')).not.toBeNull();
  });

  it('filters the open tables by what you want to play, and keeps the choice', () => {
    answer(
      [
        row({ id: 'a', name: 'Ranked one', ranked: true, language: 'en' }),
        row({ id: 'b', name: 'Friendly one', ranked: false, language: 'de' }),
        row({
          id: 'c',
          name: 'Timed one',
          ranked: true,
          clock: { mode: 'per-move', secondsPerMove: 60 },
        }),
      ],
      [],
    );
    expect(cards()).toHaveLength(3);
    click('.tl-head-buttons button', 'Filters');
    click('.tl-filter .tl-seg button', 'Friendly');
    expect(cards().map((c) => c.querySelector('h4')!.textContent)).toEqual(['Friendly one']);
    expect(element.querySelector('.tl-count')!.textContent).toBe('1');
    expect(JSON.parse(localStorage.getItem('mm.tables.filters')!).game).toBe('friendly');
    click('.tl-reset');
    click('.tl-filter:nth-of-type(3) .tl-seg button', 'With clock');
    expect(cards().map((c) => c.querySelector('h4')!.textContent)).toEqual(['Timed one']);
    click('.tl-reset');
    expect(cards()).toHaveLength(3);
    // no table fits: it says so, not that nobody is playing
    (element.querySelector('button.tl-flag[title="Français"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.textContent).toContain('No open table fits these filters.');
  });

  it('opens the add-table panel with the plus button, and goes to the table it opened', () => {
    answer([], []);
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(element.querySelector('app-add-table')).toBeNull();
    (element.querySelector('#addbtn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('app-add-table')).not.toBeNull();
    fixture.componentInstance.onCreated('new1');
    fixture.detectChanges();
    expect(element.querySelector('app-add-table')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/tables', 'new1']);
  });

  it('shows when a table was opened, the newest open table first', () => {
    answer(
      [
        row({ id: 'old', name: 'Older', createdAt: '2026-10-01T10:00:00.000Z' }),
        row({ id: 'new', name: 'Newer', createdAt: '2026-10-02T10:00:00.000Z' }),
      ],
      [],
    );
    const names = cards().map((c) => c.querySelector('h4')!.textContent!.trim());
    expect(names).toEqual(['Newer', 'Older']);
    expect(element.textContent).toContain(tablesTexts('en').openedAt);
  });

  it('keeps the initials on this device and sends them with a join', () => {
    answer([], []);
    const component = fixture.componentInstance;
    component.nickname = 'Bob';
    component.initials = 'x1y';
    component.initialsChanged();
    expect(component.initials).toBe('X1');
    expect(localStorage.getItem('mm.tables.initials')).toBe('X1');
    component.join({ roomId: 'r9' });
    const req = http.expectOne((r) => r.url.endsWith('/v1/game/rooms/join'));
    expect(req.request.body).toEqual({ roomId: 'r9', nickname: 'Bob', initials: 'X1' });
  });

  it('joins by invite code, upper-cased, and shows a refusal for a normal account', () => {
    answer([], []);
    const component = fixture.componentInstance;
    component.nickname = 'Bob';
    component.join({ code: 'H2LX8D4L' });
    const req = http.expectOne((r) => r.url.endsWith('/v1/game/rooms/join'));
    expect(req.request.body).toEqual({ code: 'H2LX8D4L', nickname: 'Bob' });
    req.flush({ detail: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(element.querySelector('.tl-error')!.textContent).toContain(tablesTexts('en').notGame);
  });

  it('speaks the language of the app, right-to-left for Arabic', () => {
    answer([], []);
    TestBed.inject(TranslateService).use('ar');
    const again = TestBed.createComponent(TablesLobbyComponent);
    again.detectChanges();
    http.match(() => true).forEach((r) => r.flush({ items: [] }));
    again.detectChanges();
    expect(again.nativeElement.querySelector('.tl-page').getAttribute('dir')).toBe('rtl');
    expect(again.nativeElement.textContent).toContain(tablesTexts('ar').title);
  });
});
