import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DreamLobbyComponent } from './dream-lobby.component';

const row = (over: Record<string, unknown>) => ({
  id: 'r1',
  name: 'Friday',
  hostName: 'Ann',
  phase: 'lobby',
  visibility: 'public',
  seatsTaken: 2,
  maxSeats: 6,
  kind: 'dreamfund',
  difficulty: 'hard',
  shape: 'infinity',
  size: 'small',
  mode: 'guided',
  professions: 'random',
  endCondition: 'round-limit',
  clock: { mode: 'none' },
  language: 'en',
  joined: false,
  ...over,
});

describe('DreamLobbyComponent', () => {
  let fixture: ComponentFixture<DreamLobbyComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DreamLobbyComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(DreamLobbyComponent);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const answer = (open: unknown[], mine: unknown[] = [], recent: unknown[] = []) => {
    http
      .expectOne((r) => r.url.endsWith('/v1/game/rooms?scope=open&kind=dreamfund'))
      .flush({ items: open });
    http
      .expectOne((r) => r.url.endsWith('/v1/game/rooms?scope=mine&kind=dreamfund'))
      .flush({ items: mine });
    http
      .expectOne((r) => r.url.endsWith('/v1/game/rooms?scope=recent&kind=dreamfund'))
      .flush({ items: recent });
    fixture.detectChanges();
  };

  it('asks only for Dreamfund tables, and lists them with their difficulty and map', () => {
    answer([row({ id: 'a', name: 'Open one' })], [row({ id: 'b', name: 'Mine', joined: true })]);
    const text = element.textContent!;
    expect(text).toContain('Open one');
    expect(text).toContain('Mine');
    expect(text).toContain('Hard');
    expect(text).toContain('infinity small');
  });

  it('opens a table with the settings of the solo game and the table, as a Dreamfund table', () => {
    answer([]);
    const component = fixture.componentInstance;
    component.showForm = true;
    component.form.name = 'My table';
    component.form.difficulty = 'hard';
    component.form.shape = 'mountain';
    component.form.size = 'large';
    component.form.mode = 'strict';
    component.form.maxSeats = 5;
    component.form.endCondition = 'round-limit';
    component.form.roundLimit = 40;
    component.form.clockMode = 'per-move';
    component.form.clockSeconds = 45;
    component.form.ranked = true;
    component.create();
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/v1/game/rooms'));
    expect(post.request.body.kind).toBe('dreamfund');
    expect(post.request.body.settings).toMatchObject({
      name: 'My table',
      difficulty: 'hard',
      shape: 'mountain',
      size: 'large',
      mode: 'strict',
      maxSeats: 5,
      endCondition: 'round-limit',
      roundLimit: 40,
      ranked: true,
      clock: { mode: 'per-move', secondsPerMove: 45 },
    });
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    post.flush({ id: 'new-table' });
    expect(navigate).toHaveBeenCalledWith(['/dreamfund', 'new-table']);
  });

  it('joins with a code and shows what the server refused', () => {
    answer([]);
    const component = fixture.componentInstance;
    component.code = 'abcd2345';
    component.joinCode();
    const post = http.expectOne((r) => r.url.endsWith('/v1/game/rooms/join'));
    expect(post.request.body.code).toBe('ABCD2345');
    post.flush(
      { detail: 'No table with that id or code.' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();
    expect(component.busy).toBe(false);
  });
});
