import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { RatRaceBoardComponent } from './rat-race-board.component';

describe('RatRaceBoardComponent', () => {
  let fixture: ComponentFixture<RatRaceBoardComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatRaceBoardComponent, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(RatRaceBoardComponent);
    element = fixture.nativeElement;
  });

  const cells = () => Array.from(element.querySelectorAll('.rr-cell'));
  const tokenAt = () => element.querySelector('.rr-token')!.getAttribute('transform');

  it('draws the 24 spaces of the ring, coloured by what they are', () => {
    fixture.detectChanges();
    expect(cells()).toHaveLength(24);
    const count = (kind: string) => element.querySelectorAll(`.rr-cell--${kind}`).length;
    // a cell's own class plus none other: 12 deals, 3 doodads, 3 markets, 3 paydays, 1 each of the purple ones
    expect([count('deal'), count('doodad'), count('market'), count('payday')]).toEqual([
      12, 3, 3, 3,
    ]);
    expect([count('charity'), count('downsized'), count('baby')]).toEqual([1, 1, 1]);
    expect(element.querySelector('.rr-start-text')?.textContent).toBe('START');
  });

  it('before the first roll the totem waits outside the ring, top middle, with START written below it; no line', () => {
    fixture.componentRef.setInput('position', null);
    fixture.detectChanges();
    const transform = element.querySelector('.rr-token')!.getAttribute('transform')!;
    const [x, y] = transform.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(x).toBe(200); // middle
    expect(y).toBeLessThan(0); // above the ring, outside the rat race
    const label = element.querySelector('.rr-start-text')!;
    expect(label.textContent).toBe('START');
    expect(Number(label.getAttribute('y'))).toBeGreaterThan(y); // below the totem
    expect(Number(label.getAttribute('y'))).toBeLessThan(0); // and still above the ring
    expect(element.querySelector('.rr-start-line')).toBeNull();
  });

  it('with the first roll the totem is inside the ring and START is gone', () => {
    fixture.componentRef.setInput('position', 0);
    fixture.detectChanges();
    const [, y] = element
      .querySelector('.rr-token')!
      .getAttribute('transform')!
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    expect(y).toBeGreaterThan(0); // inside the circle now
    expect(element.querySelector('.rr-start-text')).toBeNull();
  });

  it('names every space for assistive technology', () => {
    fixture.detectChanges();
    expect(cells().every((cell) => (cell.querySelector('title')?.textContent ?? '') !== '')).toBe(
      true,
    );
    expect(element.querySelector('svg')?.getAttribute('role')).toBe('img');
  });

  it('puts the token at START, then on the space it is given, and marks that space', () => {
    fixture.componentRef.setInput('position', null);
    fixture.detectChanges();
    const atStart = tokenAt();
    expect(element.querySelector('.rr-token--at-start')).not.toBeNull();
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toMatch(/start/);

    fixture.componentRef.setInput('position', 5);
    fixture.detectChanges();
    expect(tokenAt()).not.toBe(atStart);
    expect(element.querySelector('.rr-token--at-start')).toBeNull();
    expect(element.querySelectorAll('rect.rr-cell--here')).toHaveLength(1);
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toMatch(/space 6 of 24/);
  });

  it('each space of the ring is on its own spot, evenly round the circle', () => {
    fixture.detectChanges();
    const spots = cells().map((cell) => {
      const rect = cell.querySelector('rect')!;
      return `${rect.getAttribute('x')},${rect.getAttribute('y')}`;
    });
    expect(new Set(spots).size).toBe(24);
  });
});
