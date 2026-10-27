import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AddTableComponent } from './add-table.component';

describe('AddTableComponent', () => {
  let fixture: ComponentFixture<AddTableComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AddTableComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AddTableComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('offers the game in English and German only, for now', () => {
    expect(fixture.componentInstance.languages.map((lang) => lang.code)).toEqual(['en', 'de']);
    expect(fixture.nativeElement.querySelectorAll('.tl-flag')).toHaveLength(2);
  });

  it('opens a table with the form and says which one', () => {
    const component = fixture.componentInstance;
    const created = jest.fn();
    component.created.subscribe(created);
    component.form.name = 'Friday';
    component.form.clock = 'per-move';
    component.form.seconds = 45;
    component.form.endCondition = 'round-limit';
    component.form.roundLimit = 8;
    component.initials = 'ab';
    component.create();
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/v1/game/rooms'));
    expect(req.request.body.initials).toBe('AB');
    expect(req.request.body.settings).toMatchObject({
      name: 'Friday',
      maxSeats: 6,
      clock: { mode: 'per-move', secondsPerMove: 45 },
      endCondition: 'round-limit',
      roundLimit: 8,
      repayOffTurn: true,
    });
    req.flush({ id: 'new1' });
    expect(created).toHaveBeenCalledWith('new1');
    expect(localStorage.getItem('mm.tables.initials')).toBe('AB');
  });

  it('opens a Dreamfund table with the same panel: the game is a choice, the solo settings come with it', () => {
    const component = fixture.componentInstance;
    component.game = 'dreamfund';
    component.form.name = 'Dreams';
    component.form.difficulty = 'hard';
    component.form.shape = 'mountain';
    component.form.size = 'large';
    component.form.mode = 'strict';
    component.form.ranked = true;
    component.create();
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/v1/game/rooms'));
    expect(req.request.body.kind).toBe('dreamfund');
    expect(req.request.body.settings).toMatchObject({
      name: 'Dreams',
      difficulty: 'hard',
      shape: 'mountain',
      size: 'large',
      mode: 'strict',
      ranked: true,
      endCondition: 'first-win',
    });
    // nothing of the classic table's own rules
    expect(req.request.body.settings.allowRewind).toBeUndefined();
    expect(req.request.body.settings.rules).toBeUndefined();
  });

  it('leaves out the rules only the classic game has when the game is the Dreamfund', () => {
    const component = fixture.componentInstance;
    const keys = () => component.switches().map((rule) => rule.key);
    expect(keys()).toContain('allowUndo');
    component.game = 'dreamfund';
    expect(keys()).not.toContain('allowUndo');
    expect(keys()).toContain('spectators');
  });

  it('sends no initials when none were chosen (the default is the first two letters of the name)', () => {
    const component = fixture.componentInstance;
    component.form.name = 'Friday';
    component.create();
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/v1/game/rooms'));
    expect('initials' in req.request.body).toBe(false);
  });

  it('shows why a table could not be opened', () => {
    const component = fixture.componentInstance;
    component.form.name = 'Friday';
    component.create();
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.at-error').textContent).toContain(
      component.t.notGame,
    );
  });

  it('needs no name: an empty one is replaced by the suggestion on the dice, which another throw changes', () => {
    const component = fixture.componentInstance;
    expect(component.suggestion.length).toBeGreaterThan(0);
    const first = component.suggestion;
    component.nextSuggestion();
    expect(component.suggestion).not.toBe(first);
    component.form.name = '';
    component.create();
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/v1/game/rooms'));
    expect(req.request.body.settings.name).toBe(component.suggestion);
  });

  it('picks the players on the wheel and takes a number of your own when none fits', () => {
    const component = fixture.componentInstance;
    const wheel: HTMLElement = fixture.nativeElement.querySelector('app-wheel-picker');
    const items = Array.from<HTMLButtonElement>(wheel.querySelectorAll('.wp-item'));
    items.find((b) => b.textContent!.trim() === '4')!.click();
    fixture.detectChanges();
    expect(component.form.maxSeats).toBe(4);
    (wheel.querySelector('.wp-other') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input: HTMLInputElement = wheel.querySelector('.wp-input')!;
    input.value = '9';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.form.maxSeats).toBe(9);
    // a number outside the limits is held to them
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    expect(component.form.maxSeats).toBe(24);
  });

  it('keeps the rules of play behind an Advanced button until they are asked for', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('input[name="spectators"]')).toBeNull();
    (element.querySelector('.at-advanced') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('input[name="spectators"]')).not.toBeNull();
    (element.querySelector('.at-advanced') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('input[name="spectators"]')).toBeNull();
  });

  it('every setting says in a line what it does, and a switch flips its rule', () => {
    const component = fixture.componentInstance;
    (fixture.nativeElement.querySelector('.at-advanced') as HTMLButtonElement).click();
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.at-row');
    expect(rows.length).toBeGreaterThan(10);
    for (const row of Array.from<HTMLElement>(rows)) {
      expect(row.querySelector('.at-label strong')?.textContent?.trim().length).toBeGreaterThan(0);
    }
    const before = component.form.spectators;
    const spectators: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[name="spectators"]',
    );
    spectators.dispatchEvent(new Event('change'));
    expect(component.form.spectators).toBe(!before);
  });
});
