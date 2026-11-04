import {
  buildDreamfundBoard,
  describeBoard,
  TILE_COUNTS,
  TILE_MIX,
  type BoardSize,
} from './dreamfund-board';
import { DreamPlayer } from './dreamfund/player';

const SIZES: BoardSize[] = ['small', 'medium', 'large'];

describe('the Yin Yang map: two tracks that share the S', () => {
  it('gives each track the tiles of a map of that size, with the mix of the size', () => {
    for (const size of SIZES) {
      for (const seed of [1, 2, 3, 99]) {
        for (const lane of [0, 1]) {
          const map = buildDreamfundBoard({ shape: 'yinyang', size, seed, lane });
          expect(map.board).toHaveLength(TILE_COUNTS[size]);
          expect(map.points).toHaveLength(TILE_COUNTS[size]);
          expect(describeBoard(map.board)).toEqual(
            Object.fromEntries(
              Object.entries(TILE_MIX[size].medium).filter(([, count]) => count > 0),
            ),
          );
        }
      }
    }
  });

  it('the S is common ground: both tracks walk the same tiles on it, the second one the other way round', () => {
    for (const size of SIZES) {
      const white = buildDreamfundBoard({ shape: 'yinyang', size, seed: 7, lane: 0 });
      const black = buildDreamfundBoard({ shape: 'yinyang', size, seed: 7, lane: 1 });
      const picture = white.picture!;
      expect(black.picture).toEqual(picture);
      const n = TILE_COUNTS[size];
      const m = n / 2;
      // the S, with the two ends where the tracks meet, is m + 1 tiles that both tracks have
      const shared = picture.lanes[0].filter((tile) => picture.lanes[1].includes(tile));
      expect(shared).toHaveLength(m + 1);
      for (const tile of shared) {
        const a = picture.lanes[0].indexOf(tile);
        const b = picture.lanes[1].indexOf(tile);
        expect(white.board[a].kind).toBe(black.board[b].kind);
      }
      // every tile of the picture belongs to a track, and the own halves are not shared
      expect(picture.tiles).toHaveLength(2 * n - (m + 1));
      expect(new Set([...picture.lanes[0], ...picture.lanes[1]]).size).toBe(picture.tiles.length);
    }
  });

  it('the Paydays are on the common S, with one more on each side of a big map', () => {
    for (const size of SIZES) {
      const map = buildDreamfundBoard({ shape: 'yinyang', size, seed: 11, lane: 0 });
      const picture = map.picture!;
      const m = TILE_COUNTS[size] / 2;
      const onSeam = picture.lanes[0]
        .slice(0, m + 1)
        .filter((tile) => picture.tiles[tile].kind === 'payday').length;
      const total = map.board.filter((space) => space.kind === 'payday').length;
      expect(total).toBe(TILE_MIX[size].medium.payday);
      expect(total - onSeam).toBe(size === 'large' ? 1 : 0);
    }
  });

  it('draws every tile apart from the others, inside the box of the circle', () => {
    for (const size of SIZES) {
      const { picture } = buildDreamfundBoard({ shape: 'yinyang', size, seed: 5 });
      const tiles = picture!.tiles;
      for (const a of tiles) {
        expect(a.x).toBeGreaterThanOrEqual(-0.001);
        expect(a.x).toBeLessThanOrEqual(1.001);
        expect(a.y).toBeGreaterThanOrEqual(-0.001);
        expect(a.y).toBeLessThanOrEqual(1.001);
      }
      const spacing = buildDreamfundBoard({ shape: 'yinyang', size, seed: 5 }).spacing;
      for (let i = 0; i < tiles.length; i += 1) {
        for (let j = i + 1; j < tiles.length; j += 1) {
          expect(Math.hypot(tiles[i].x - tiles[j].x, tiles[i].y - tiles[j].y)).toBeGreaterThan(
            spacing * 0.5,
          );
        }
      }
    }
  });

  it('a player walks their own track: a lane is part of the life and comes back with it', () => {
    const black = DreamPlayer.fromSeed({
      seed: 4,
      professionId: 'dual-student-informatik',
      shape: 'yinyang',
      lane: 1,
      rules: { mode: 'free' } as never,
    });
    const data = black.snapshot();
    expect(data.lane).toBe(1);
    const again = DreamPlayer.restore(data, () => 0.5);
    expect(again.setup.lane).toBe(1);
    expect(again.board.map((s) => s.kind)).toEqual(black.board.map((s) => s.kind));
    const white = DreamPlayer.fromSeed({
      seed: 4,
      professionId: 'dual-student-informatik',
      shape: 'yinyang',
      rules: { mode: 'free' } as never,
    });
    expect(white.board.map((s) => s.kind)).not.toEqual(black.board.map((s) => s.kind));
  });
});
