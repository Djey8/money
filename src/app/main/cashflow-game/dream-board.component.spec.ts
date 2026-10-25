import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { buildDreamfundBoard, type BoardShape } from '@money/domain';
import { DreamBoardComponent } from './dream-board.component';

describe('DreamBoardComponent', () => {
  let fixture: ComponentFixture<DreamBoardComponent>;

  const render = (shape: BoardShape, position: number | null = null, orientation = 'landscape') => {
    fixture = TestBed.createComponent(DreamBoardComponent);
    fixture.componentRef.setInput('map', buildDreamfundBoard({ shape, size: 'medium', seed: 2 }));
    fixture.componentRef.setInput('position', position);
    fixture.componentRef.setInput('orientation', orientation);
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
    const centre = Number(tile.getAttribute('x')) + Number(tile.getAttribute('width')) / 2;
    expect(token.style.transform).toContain(`${centre}px`);
  });

  it('a wide map stands up on a portrait screen, so its tiles come out bigger', () => {
    const landscape = render('infinity', 1, 'landscape')
      .querySelector('svg')!
      .getAttribute('viewBox')!;
    const portrait = render('infinity', 1, 'portrait')
      .querySelector('svg')!
      .getAttribute('viewBox')!;
    const ratio = (box: string) => {
      const [, , w, h] = box.split(' ').map(Number);
      return w / h;
    };
    expect(ratio(landscape)).toBeGreaterThan(1.3);
    expect(ratio(portrait)).toBeLessThan(0.9);
    // a ring is as it is in either
    const ring = (o: string) =>
      ratio(render('ring', 1, o).querySelector('svg')!.getAttribute('viewBox')!);
    expect(Math.abs(ring('landscape') - ring('portrait'))).toBeLessThan(0.01);
  });

  it('every shape fits its viewBox: all tiles inside', () => {
    for (const shape of ['ring', 'infinity', 'rectangle', 'square', 'mountain'] as BoardShape[]) {
      for (const orientation of ['landscape', 'portrait']) {
        const element = render(shape, 3, orientation);
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
