import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TablesLeaderboardComponent } from './tables-leaderboard.component';

const player = (over: Record<string, unknown>) => ({
  place: 1,
  playerId: 'p1',
  name: 'Champion Cleo',
  type: 'bot',
  level: 'master',
  rating: 1750,
  peakRating: 1760,
  ratedGames: 40,
  provisional: false,
  games: 50,
  wins: 26,
  losses: 24,
  gaveUp: 0,
  bankruptcies: 3,
  escaped: 26,
  winRate: 52,
  avgPlace: 2.1,
  bestPlace: 1,
  ...over,
});

describe('TablesLeaderboardComponent', () => {
  let fixture: ComponentFixture<TablesLeaderboardComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablesLeaderboardComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TablesLeaderboardComponent);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const board = (items: unknown[], next: string | null = null) => {
    http.expectOne((r) => r.url.includes('/v1/game/leaderboard')).flush({ items, next });
    fixture.detectChanges();
  };
  const me = (profile: Record<string, unknown>) => {
    http
      .expectOne((r) => r.url.endsWith('/v1/game/players/me') && r.method === 'GET')
      .flush(profile);
    fixture.detectChanges();
  };

  it('lists the players by rating, in columns, with the bots marked and the level named', () => {
    me(player({ playerId: 'me', name: 'Anna', type: 'human', visible: false, rating: 1512 }));
    board([
      player({}),
      player({
        place: 2,
        playerId: 'p2',
        name: 'Anna',
        type: 'human',
        rating: 1512,
        provisional: true,
      }),
    ]);
    const text = element.textContent!;
    expect(text).toContain('Champion Cleo');
    expect(text).toContain('Bot · master');
    expect(text).toContain('1750');
    expect(text).toContain('Anna');
    expect(text).toContain('My rating');
    expect(text).toContain('1512');
    expect(element.querySelectorAll('.lb-row')).toHaveLength(2);
    expect(element.querySelector('.lb-place')!.textContent).toContain('🥇');
  });

  it('opens a player in a panel of their own: the numbers, the last games, and why a game did not count', () => {
    me(player({ type: 'human', visible: true }));
    board([player({})]);
    (element.querySelector('.lb-row') as HTMLButtonElement).click();
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/v1/game/players/p1'))
      .flush(
        player({
          recent: [
            {
              table: 'Friday',
              endedAt: '2026-10-17T10:00:00Z',
              players: 4,
              place: 1,
              outcome: 'escaped',
              ranked: true,
              ratingChange: 12.5,
              ratingAfter: 1750,
            },
            {
              table: 'Quick',
              endedAt: '2026-10-17T09:00:00Z',
              players: 2,
              place: 2,
              outcome: 'playing',
              ranked: false,
              notRankedBecause: 'too-short',
              ratingChange: 0,
              ratingAfter: 1737,
            },
          ],
        }),
      );
    fixture.detectChanges();
    const panel = element.querySelector('app-table-player-info') as HTMLElement;
    const text = panel.textContent!;
    expect(text).toContain('Champion Cleo');
    expect(text).toContain('52%');
    expect(text).toContain('Friday');
    expect(text).toContain('+12.5');
    expect(text).toContain('not ranked (under 8 rounds)');
    // the chart has its axes: three rating levels on the left, the first and last game along the bottom, a dot per game
    expect(panel.querySelector('.pi-trend svg')).not.toBeNull();
    expect(panel.querySelectorAll('.pi-axis-y')).toHaveLength(3);
    const along = Array.from(panel.querySelectorAll('.pi-axis-x')).map((t) =>
      t.textContent!.trim(),
    );
    expect(along[0]).toMatch(/^1 · \d\d\.\d\d\.$/);
    expect(along[along.length - 1]).toMatch(/^2 · /);
    expect(panel.querySelectorAll('.pi-dot')).toHaveLength(2);
    // closed with its x
    (panel.querySelector('.pi-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('app-table-player-info')).toBeNull();
  });

  it('switches between all, players and bots, and asks the server for that', () => {
    me(player({ type: 'human' }));
    board([]);
    expect(element.textContent).toContain('Nobody has a rated game yet.');
    const bots = Array.from(element.querySelectorAll<HTMLButtonElement>('[role=tab]')).find((b) =>
      b.textContent!.includes('Bots'),
    )!;
    bots.click();
    const request = http.expectOne((r) => r.url.includes('/v1/game/leaderboard'));
    expect(request.request.url).toContain('type=bot');
    request.flush({ items: [player({})], next: null });
  });

  it('lists the player or not with the switch, and loads the board again', () => {
    me(player({ type: 'human', visible: false }));
    board([]);
    const box = element.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/v1/game/players/me'));
    expect(put.request.body).toEqual({ visible: true });
    put.flush(player({ type: 'human', visible: true }));
    http.expectOne((r) => r.url.includes('/v1/game/leaderboard')).flush({ items: [], next: null });
  });
});
