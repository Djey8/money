import { validateRatRaceBoard } from './board';
import {
  BOARD_SHAPES,
  BOARD_SIZES,
  TILE_COUNTS,
  TILE_MIX,
  buildDreamfundBoard,
  describeBoard,
  layoutTiles,
  type BoardDifficulty,
  type BoardSetup,
} from './dreamfund-board';

const setupOf = (
  shape: BoardSetup['shape'],
  size: BoardSetup['size'],
  seed = 1,
  difficulty?: BoardDifficulty,
): BoardSetup => ({ shape, size, seed, ...(difficulty ? { difficulty } : {}) });

describe('the Dreamfund maps', () => {
  it('every size and difficulty adds up to the tiles of the size', () => {
    for (const size of BOARD_SIZES) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const total = Object.values(TILE_MIX[size][difficulty]).reduce((sum, n) => sum + n, 0);
        expect(total).toBe(TILE_COUNTS[size]);
      }
    }
  });

  it('Opportunity is the most common tile, careers are several, and the tiles that cost money stay a fifth of the map or less (not on hard)', () => {
    for (const size of BOARD_SIZES) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const mix = TILE_MIX[size][difficulty];
        const others = (Object.keys(mix) as (keyof typeof mix)[]).filter(
          (k) => k !== 'opportunity',
        );
        for (const kind of others) expect(mix.opportunity).toBeGreaterThan(mix[kind]);
        expect(mix.career).toBeGreaterThanOrEqual(1);
        expect(mix.harvest).toBeGreaterThanOrEqual(3);
        expect(mix.life).toBeGreaterThanOrEqual(3);
        if (difficulty !== 'hard') {
          expect((mix.dream + mix.emergency) / TILE_COUNTS[size]).toBeLessThanOrEqual(1 / 5);
        }
      }
    }
  });

  it('every shape in every size is a valid board with exactly the mix of its size', () => {
    for (const shape of BOARD_SHAPES) {
      for (const size of BOARD_SIZES) {
        const map = buildDreamfundBoard(setupOf(shape, size));
        expect(map.board).toHaveLength(TILE_COUNTS[size]);
        expect(validateRatRaceBoard(map.board)).toEqual([]);
        expect(describeBoard(map.board)).toEqual(TILE_MIX[size].medium);
        expect(map.points).toHaveLength(TILE_COUNTS[size]);
      }
    }
  });

  it('the same seed is the same map, another seed another layout', () => {
    const a = buildDreamfundBoard(setupOf('ring', 'medium', 5));
    expect(buildDreamfundBoard(setupOf('ring', 'medium', 5)).board.map((s) => s.kind)).toEqual(
      a.board.map((s) => s.kind),
    );
    expect(buildDreamfundBoard(setupOf('ring', 'medium', 6)).board.map((s) => s.kind)).not.toEqual(
      a.board.map((s) => s.kind),
    );
  });

  it('keeps the rules: no kind next to itself, no Emergency right after a Payday, Paydays spread out', () => {
    for (const shape of BOARD_SHAPES) {
      for (const size of BOARD_SIZES) {
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
          const kinds = buildDreamfundBoard(setupOf(shape, size, seed)).board.map((s) => s.kind);
          const n = kinds.length;
          kinds.forEach((kind, i) => {
            const next = kinds[(i + 1) % n];
            expect(`${shape}/${size}/${seed}@${i}:${kind === next}`).toMatch(/:false$/);
            if (kind === 'payday') expect(next).not.toBe('emergency');
          });
          const paydays = kinds.flatMap((kind, i) => (kind === 'payday' ? [i] : []));
          const gaps = paydays.map((at, i) => (paydays[(i + 1) % paydays.length] - at + n) % n);
          // never closer than a third of the even spacing
          expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.floor(n / paydays.length / 3));
        }
      }
    }
  });

  it('the infinity is crossed on its Paydays: the two visits stand on one spot', () => {
    for (const size of BOARD_SIZES) {
      const map = buildDreamfundBoard(setupOf('infinity', size));
      const n = TILE_COUNTS[size];
      const [a, b] = [map.points[n / 4], map.points[(3 * n) / 4]];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(map.spacing * 0.1);
      expect(map.board[n / 4].kind).toBe('payday');
      expect(map.board[(3 * n) / 4].kind).toBe('payday');
    }
  });

  it('the tiles stand evenly along the track: neighbours about one spacing apart, nothing on top of anything else', () => {
    for (const [shape, size] of BOARD_SHAPES.flatMap((shape) =>
      BOARD_SIZES.map((size) => [shape, size] as const),
    )) {
      const map = buildDreamfundBoard(setupOf(shape, size));
      const n = map.points.length;
      for (let i = 0; i < n; i += 1) {
        const a = map.points[i];
        const b = map.points[(i + 1) % n];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        // equal arc length: round the corners a chord is a little shorter than the arc
        expect(d).toBeGreaterThan(map.spacing * 0.8);
        expect(d).toBeLessThan(map.spacing * 1.25);
      }
      // no two tiles share a spot, except the crossing of the infinity
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const d = Math.hypot(
            map.points[i].x - map.points[j].x,
            map.points[i].y - map.points[j].y,
          );
          const crossing = shape === 'infinity' && i === n / 4 && j === (3 * n) / 4;
          if (!crossing) expect(d).toBeGreaterThan(map.spacing * 0.8);
        }
      }
    }
  });

  it('easy holds more chances and fewer emergencies than hard', () => {
    const easy = describeBoard(buildDreamfundBoard(setupOf('ring', 'medium', 1, 'easy')).board);
    const hard = describeBoard(buildDreamfundBoard(setupOf('ring', 'medium', 1, 'hard')).board);
    expect(easy['opportunity']).toBeGreaterThan(hard['opportunity']);
    expect(easy['emergency']).toBeLessThan(hard['emergency']);
  });

  it('every kind of tile is spread round the track, not clustered', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const tiles = layoutTiles({ shape: 'ring', size: 'medium', seed });
      const n = tiles.length;
      for (const kind of ['career', 'dream', 'emergency', 'harvest'] as const) {
        const at = tiles.flatMap((tile, i) => (tile === kind ? [i] : []));
        const gaps = at.map((spot, k) => (at[(k + 1) % at.length] - spot + n) % n);
        // no two of a kind closer than a third of an even spread
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.floor(n / at.length / 3));
      }
    }
  });
});
