import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DreamLeaderboardComponent } from './dream-leaderboard.component';

const row = (over: Record<string, unknown>) => ({
  place: 1,
  playerId: 'p1',
  name: 'Informed investor',
  type: 'bot',
  difficulty: 'medium',
  rating: 1500,
  peakRating: 1510,
  ratedGames: 12,
  provisional: false,
  games: 12,
  wins: 7,
  won: 3,
  bankruptcies: 0,
  avgPlace: 1.8,
  avgGoals: 2.5,
  ...over,
});

describe('DreamLeaderboardComponent', () => {
  let fixture: ComponentFixture<DreamLeaderboardComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DreamLeaderboardComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(DreamLeaderboardComponent);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const answer = (items: unknown[], mine?: Record<string, unknown>) => {
    http
      .expectOne((r) => r.url.includes('/dreamfund/leaderboard?difficulty=medium&type=all'))
      .flush({ items, next: null });
    http
      .expectOne((r) => r.url.endsWith('/dreamfund/players/me'))
      .flush(
        mine ?? {
          playerId: 'me',
          name: 'Me',
          visible: false,
          ratings: {
            easy: row({}),
            medium: row({ rating: 1520, provisional: true }),
            hard: row({}),
          },
          recent: [],
        },
      );
    fixture.detectChanges();
  };

  it('shows the board of a difficulty, and asks again for another difficulty and for people only', () => {
    answer([
      row({}),
      row({
        place: 2,
        playerId: 'p2',
        name: 'Anna',
        type: 'human',
        rating: 1480,
        provisional: true,
      }),
    ]);
    expect(element.textContent).toContain('Informed investor');
    expect(element.textContent).toContain('Anna');
    fixture.componentInstance.pickDifficulty('hard');
    http
      .expectOne((r) => r.url.includes('difficulty=hard&type=all'))
      .flush({ items: [], next: null });
    fixture.componentInstance.pickType('human');
    http
      .expectOne((r) => r.url.includes('difficulty=hard&type=human'))
      .flush({ items: [], next: null });
    fixture.detectChanges();
    expect(element.textContent).toContain('Nobody has played');
  });

  it('shows my ratings at the three difficulties and switches me on the board', () => {
    answer([]);
    expect(element.textContent).toContain('My ratings');
    expect(element.textContent).toContain('1520');
    fixture.componentInstance.toggle({ target: { checked: true } } as unknown as Event);
    const put = http.expectOne(
      (r) => r.method === 'PUT' && r.url.endsWith('/dreamfund/players/me'),
    );
    expect(put.request.body).toEqual({ visible: true });
    put.flush({
      playerId: 'me',
      name: 'Me',
      visible: true,
      ratings: { easy: row({}), medium: row({}), hard: row({}) },
      recent: [],
    });
    http
      .expectOne((r) => r.url.includes('/dreamfund/leaderboard'))
      .flush({ items: [], next: null });
  });
});
