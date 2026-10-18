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
    http.expectOne((r) => r.url.endsWith('/v1/game/rooms?scope=recent')).flush({ items: [] });
    fixture.detectChanges();
  };

  it('lists open tables, and the ones you are in apart from them', () => {
    answer(
      [row({ id: 'a', name: 'Open one' }), row({ id: 'b', name: 'Mine', joined: true })],
      [row({ id: 'b', name: 'Mine', joined: true })],
    );
    const text = element.textContent!;
    expect(text).toContain('Open one');
    expect(text).toContain('2/6 seats');
    const lists = Array.from(element.querySelectorAll('.tl-list')).filter(
      (list) => !list.closest('app-tables-leaderboard'),
    );
    expect(lists).toHaveLength(2);
    // the joined table shows under My tables only, not again under Open tables
    expect(text.match(/Mine/g)!.length).toBe(1);
  });

  it('says so when no table is open', () => {
    answer([], []);
    expect(element.textContent).toContain(tablesTexts('en').noOpen);
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
    const names = Array.from(element.querySelectorAll('.tl-list--scroll .tl-row strong')).map((e) =>
      e.textContent!.trim(),
    );
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
