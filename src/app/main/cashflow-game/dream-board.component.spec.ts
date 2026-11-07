import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { buildDreamfundBoard, type BoardShape } from '@money/domain';
import { DreamBoardComponent, seamSpot, tokenSpots } from './dream-board.component';
import type { BoardToken } from './rat-race-board.component';

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
    // the token stands inside the map, beside its tile: close to it, not on it, and nearer the middle of the map than the tile is
    const cx = Number(tile.getAttribute('x')) + Number(tile.getAttribute('width')) / 2;
    const cy = Number(tile.getAttribute('y')) + Number(tile.getAttribute('height')) / 2;
    const [tx, ty] = /translate\(([\d.-]+)px, ([\d.-]+)px\)/
      .exec(token.style.transform)!
      .slice(1)
      .map(Number);
    const distance = Math.hypot(tx - cx, ty - cy);
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(95);
    const all = Array.from(moved.querySelectorAll('.db-tile rect')).map((r) => ({
      x: Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2,
      y: Number(r.getAttribute('y')) + Number(r.getAttribute('height')) / 2,
    }));
    const mid = {
      x: all.reduce((sum, t) => sum + t.x, 0) / all.length,
      y: all.reduce((sum, t) => sum + t.y, 0) / all.length,
    };
    expect(Math.hypot(tx - mid.x, ty - mid.y)).toBeLessThan(Math.hypot(cx - mid.x, cy - mid.y));
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

  it('on every map the token beside a tile covers no other tile', () => {
    for (const shape of ['ring', 'infinity', 'rectangle', 'square', 'mountain'] as BoardShape[]) {
      const element = render(shape, 3);
      const tiles = Array.from(element.querySelectorAll('.db-tile rect')).map((r) => ({
        x: Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2,
        y: Number(r.getAttribute('y')) + Number(r.getAttribute('height')) / 2,
      }));
      const spots = tokenSpots(tiles, shape === 'infinity');
      spots.forEach((spot, index) => {
        tiles.forEach((tile, other) => {
          if (other === index) return;
          // the token (radius 15 and its rim) is clear of the other tiles (half a tile of 76)
          expect(Math.hypot(spot.x - tile.x, spot.y - tile.y)).toBeGreaterThan(38);
        });
      });
    }
  });

  it('on a ring every token stands on the line from the middle through its tile, inside it', () => {
    const element = render('ring', 3);
    const tiles = Array.from(element.querySelectorAll('.db-tile rect')).map((r) => ({
      x: Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2,
      y: Number(r.getAttribute('y')) + Number(r.getAttribute('height')) / 2,
    }));
    const centre = {
      x: tiles.reduce((sum, t) => sum + t.x, 0) / tiles.length,
      y: tiles.reduce((sum, t) => sum + t.y, 0) / tiles.length,
    };
    tokenSpots(tiles).forEach((spot, i) => {
      const radial = { x: tiles[i].x - centre.x, y: tiles[i].y - centre.y };
      const offset = { x: spot.x - tiles[i].x, y: spot.y - tiles[i].y };
      const cross = radial.x * offset.y - radial.y * offset.x;
      expect(Math.abs(cross) / Math.hypot(radial.x, radial.y)).toBeLessThan(1);
      // inside the ring: nearer the middle than its tile
      expect(Math.hypot(spot.x - centre.x, spot.y - centre.y)).toBeLessThan(
        Math.hypot(radial.x, radial.y),
      );
    });
  });

  describe('the Yin Yang map', () => {
    const renderYinYang = (tokens: BoardToken[]) => {
      fixture = TestBed.createComponent(DreamBoardComponent);
      fixture.componentRef.setInput(
        'map',
        buildDreamfundBoard({ shape: 'yinyang', size: 'medium', seed: 2 }),
      );
      fixture.componentRef.setInput('position', 3);
      fixture.componentRef.setInput('tokens', tokens);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };
    const token = (id: string, lane: number, position: number | null): BoardToken => ({
      id,
      lane,
      position,
      color: lane === 0 ? '#1976d2' : '#d81b60',
      label: id.toUpperCase(),
      name: 'Player ' + id,
      photo: id === 'a' ? 'https://example.test/a.jpg' : null,
    });

    it('draws every tile of both tracks once, the S and the circle, and the two heads', () => {
      const element = renderYinYang([]);
      // 36 tiles on a track; the S with its ends (19) is shared: 2 x 36 - 19
      expect(element.querySelectorAll('.db-tile')).toHaveLength(53);
      expect(element.querySelectorAll('polyline.db-track, polygon.db-track')).toHaveLength(2);
      expect(element.querySelectorAll('.db-head-disc')).toHaveLength(2);
    });

    it('shows the players of each side in the head of their colour, small and side by side when there are several', () => {
      const element = renderYinYang([
        token('a', 0, 3),
        token('b', 1, 3),
        token('c', 0, 20),
        token('d', 0, null),
      ]);
      const heads = Array.from(element.querySelectorAll('.db-head'));
      expect(heads[0].querySelectorAll('.db-head-ring')).toHaveLength(3);
      expect(heads[1].querySelectorAll('.db-head-ring')).toHaveLength(1);
      // the picture of a player who has one is drawn, the others show a letter on their colour
      expect(heads[0].querySelectorAll('image')).toHaveLength(1);
      expect(element.querySelectorAll('.db-token--player')).toHaveLength(4);
    });

    it('on the S each track stays on its own side the whole way: no jumping from one side of the tiles to the other', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const map = buildDreamfundBoard({ shape: 'yinyang', size, seed: 2 });
        const picture = map.picture!;
        const scale = 100 / map.spacing;
        const seam = picture.seam.map((p) => ({ x: p.x * scale, y: p.y * scale }));
        const tiles = picture.tiles.map((t) => ({ x: t.x * scale, y: t.y * scale }));
        const shared = picture.lanes[0].filter((i) => picture.lanes[1].includes(i));
        // which side of the way (top to bottom) a spot is on: the sign of the cross product with the way's direction there
        const sideOf = (tile: { x: number; y: number }, spot: { x: number; y: number }) => {
          let nearest = 0;
          seam.forEach((p, k) => {
            if (
              Math.hypot(p.x - tile.x, p.y - tile.y) <
              Math.hypot(seam[nearest].x - tile.x, seam[nearest].y - tile.y)
            )
              nearest = k;
          });
          const before = seam[Math.max(0, nearest - 3)];
          const after = seam[Math.min(seam.length - 1, nearest + 3)];
          return Math.sign(
            (after.x - before.x) * (spot.y - tile.y) - (after.y - before.y) * (spot.x - tile.x),
          );
        };
        const sides = { white: new Set<number>(), black: new Set<number>() };
        for (const index of shared) {
          const white = seamSpot(tiles[index], seam, 1, tiles);
          const black = seamSpot(tiles[index], seam, -1, tiles);
          sides.white.add(sideOf(tiles[index], white));
          sides.black.add(sideOf(tiles[index], black));
          // and a token beside a tile covers no other tile
          for (const spot of [white, black]) {
            const room = Math.min(
              ...tiles
                .filter((_, k) => k !== index)
                .map((t) => Math.hypot(spot.x - t.x, spot.y - t.y)),
            );
            expect(room).toBeGreaterThanOrEqual(38 + 4);
          }
        }
        expect(sides.white.size).toBe(1);
        expect(sides.black.size).toBe(1);
        expect([...sides.white][0]).toBe(-[...sides.black][0]);
      }
    });

    it('a token of each track stands on its own side of a tile the tracks share', () => {
      const element = renderYinYang([token('a', 0, 3), token('b', 1, 0)]);
      const [white, black] = Array.from(element.querySelectorAll<HTMLElement>('.db-token--player'));
      expect(white.style.transform).not.toBe(black.style.transform);
    });
  });
});
