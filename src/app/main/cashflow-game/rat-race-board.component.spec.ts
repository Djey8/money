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

  it('shows START above the ring with a line to the first tile, and drops it once the token has moved', () => {
    fixture.componentRef.setInput('position', null);
    fixture.detectChanges();
    const text = element.querySelector('.rr-start-text')!;
    expect(Number(text.getAttribute('y'))).toBeLessThan(0); // above the ring, not on it
    expect(element.querySelector('.rr-start-line')).not.toBeNull();

    fixture.componentRef.setInput('position', 0);
    fixture.detectChanges();
    expect(element.querySelector('.rr-start-text')).toBeNull();
    expect(element.querySelector('.rr-start-line')).toBeNull();
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
