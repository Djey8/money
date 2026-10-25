import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { buildDreamfundBoard, type BoardShape } from '@money/domain';
import { DreamBoardComponent } from './dream-board.component';

describe('DreamBoardComponent', () => {
  let fixture: ComponentFixture<DreamBoardComponent>;

  const render = (shape: BoardShape, position: number | null = null) => {
    fixture = TestBed.createComponent(DreamBoardComponent);
    fixture.componentRef.setInput('map', buildDreamfundBoard({ shape, size: 'medium', seed: 2 }));
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DreamBoardComponent, TranslateModule.forRoot()],
    }).compileComponents();
  });

  it('draws every tile of the map in the colour of its kind', () => {
    const element = render('ring');
    const tiles = Array.from(element.querySelectorAll('.db-tile'));
    expect(tiles).toHaveLength(36);
    const kinds = new Set(tiles.map((tile) => tile.getAttribute('data-kind')));
    expect([...kinds].sort()).toEqual(
      ['career', 'dream', 'emergency', 'harvest', 'life', 'opportunity', 'payday'].sort(),
    );
    const dream = element.querySelector('.db-tile[data-kind="dream"] rect') as SVGRectElement;
    expect(dream.getAttribute('style')).toContain('--tc');
    // the Smile and Fire tiles wear the app's own icons
    expect(
      element.querySelector('.db-tile[data-kind="dream"] image')!.getAttribute('href'),
    ).toContain('smile');
    expect(
      element.querySelector('.db-tile[data-kind="emergency"] image')!.getAttribute('href'),
    ).toContain('fire');
    expect(element.querySelector('.db-tile[data-kind="opportunity"] .db-sprout')).not.toBeNull();
  });

  it('waits at START before the first roll, and then stands on its tile', () => {
    const waiting = render('square', null);
    expect(waiting.textContent).toContain('START');
    expect(waiting.querySelector('.db-here')).toBeNull();
    const moved = render('square', 5);
    expect(moved.textContent).not.toContain('START');
    expect(moved.querySelector('.db-here')).not.toBeNull();
    const token = moved.querySelector('.db-token') as HTMLElement;
    const tile = moved.querySelectorAll('.db-tile rect')[5] as SVGRectElement;
    // the token stands at the corner of its tile, so the picture of the tile stays in view
    const right = Number(tile.getAttribute('x')) + Number(tile.getAttribute('width'));
    const x = Number(/translate\(([\d.]+)px/.exec(token.style.transform)![1]);
    expect(x).toBeGreaterThan(right - 12);
    expect(x).toBeLessThan(right + 12);
  });

  it('is always drawn as in the choice of maps: an infinity lies down on any screen', () => {
    const [, , w, h] = render('infinity', 1)
      .querySelector('svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number);
    expect(w / h).toBeGreaterThan(1.3);
  });

  it('START is a pad above the map, in the middle, and the token waits on it', () => {
    const element = render('rectangle', null);
    const [minX, minY, w] = element
      .querySelector('svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number);
    const pad = element.querySelector('.db-start-pad') as SVGRectElement;
    const padCentre = Number(pad.getAttribute('x')) + Number(pad.getAttribute('width')) / 2;
    expect(padCentre).toBeCloseTo(minX + w / 2, 0);
    expect(Number(pad.getAttribute('y')) + Number(pad.getAttribute('height'))).toBeLessThan(0);
    expect(minY).toBeLessThan(0);
    const firstTile = element.querySelector('.db-tile rect') as SVGRectElement;
    expect(Number(firstTile.getAttribute('y'))).toBeGreaterThan(0);
  });

  it('every shape fits its viewBox: all tiles inside', () => {
    for (const shape of ['ring', 'infinity', 'rectangle', 'square', 'mountain'] as BoardShape[]) {
      {
        const element = render(shape, 3);
        const [minX, minY, w, h] = element
          .querySelector('svg')!
          .getAttribute('viewBox')!
          .split(' ')
          .map(Number);
        for (const rect of Array.from(element.querySelectorAll('.db-tile rect'))) {
          const x = Number(rect.getAttribute('x'));
          const y = Number(rect.getAttribute('y'));
          const size = Number(rect.getAttribute('width'));
          expect(x).toBeGreaterThanOrEqual(minX);
          expect(y).toBeGreaterThanOrEqual(minY);
          expect(x + size).toBeLessThanOrEqual(minX + w + 0.01);
          expect(y + size).toBeLessThanOrEqual(minY + h + 0.01);
        }
      }
    }
  });
});
