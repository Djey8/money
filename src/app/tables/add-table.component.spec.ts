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
});
