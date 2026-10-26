import { spaceAt, type RatRaceBoard, type RatRaceSpace, type RatRaceSpaceKind } from './board';

/**
 * The maps of Dreamfund (JFK, 2026-10-25): a closed track of tiles in a shape - ring, infinity, rectangle, square, mountain - and a
 * size, with the tiles laid out by a seeded generator under a few rules. The engine only ever sees the ordered list of tiles (the
 * `RatRaceBoard`), exactly as with the classic ring; where a tile is drawn is geometry, and only the picture needs it.
 */

/** The kinds of tile of a Dreamfund map. */
export type DreamfundTile =
  'payday' | 'dream' | 'emergency' | 'opportunity' | 'harvest' | 'life' | 'career';

export const DREAMFUND_TILES: readonly DreamfundTile[] = [
  'payday',
  'dream',
  'emergency',
  'opportunity',
  'harvest',
  'life',
  'career',
];

export type BoardShape = 'ring' | 'infinity' | 'rectangle' | 'square' | 'mountain';
export type BoardSize = 'small' | 'medium' | 'large';
/** How much luck and bad luck the map holds. Only `medium` is offered while the balance is being measured. */
export type BoardDifficulty = 'easy' | 'medium' | 'hard';

export const BOARD_SHAPES: readonly BoardShape[] = [
  'ring',
  'infinity',
  'rectangle',
  'square',
  'mountain',
];
export const BOARD_SIZES: readonly BoardSize[] = ['small', 'medium', 'large'];

/** What a game's map is made of: kept in the game, so the same map comes back whenever the game is loaded. */
export interface BoardSetup {
  shape: BoardShape;
  size: BoardSize;
  /** The seed of the layout: the same seed gives the same tiles. */
  seed: number;
  difficulty?: BoardDifficulty;
}

export const TILE_COUNTS: Record<BoardSize, number> = { small: 24, medium: 36, large: 48 };

type Mix = Record<DreamfundTile, number>;
const mix = (
  payday: number,
  opportunity: number,
  harvest: number,
  dream: number,
  emergency: number,
  life: number,
  career: number,
): Mix => ({ payday, opportunity, harvest, dream, emergency, life, career });

/** How many tiles of each kind a map has, by size and difficulty: easy holds more chances, hard more emergencies. */
export const TILE_MIX: Record<BoardSize, Record<BoardDifficulty, Mix>> = {
  // payday, opportunity, harvest, dream, emergency, life, career - Opportunity is the most common tile; Career is a chance of a
  // promotion (JFK, 2026-10-26): a few a map, one fewer than first planned, the tile went to Opportunity
  // JFK, 2026-10-26: fewer Career tiles (the promotion comes slowly), more Opportunity and Harvest - the Grow chances
  small: {
    easy: mix(3, 9, 5, 2, 1, 3, 1),
    medium: mix(3, 9, 4, 2, 2, 3, 1),
    hard: mix(3, 7, 3, 3, 4, 3, 1),
  },
  medium: {
    easy: mix(4, 13, 8, 3, 2, 4, 2),
    medium: mix(4, 14, 6, 3, 3, 4, 2),
    hard: mix(4, 10, 5, 4, 5, 5, 3),
  },
  large: {
    easy: mix(6, 17, 11, 4, 3, 6, 1),
    medium: mix(6, 15, 9, 4, 4, 7, 3),
    hard: mix(6, 12, 7, 5, 7, 7, 4),
  },
};

// ── the seeded random numbers ──

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── the layout ──

/** Indexes spread as evenly as possible round a ring of `n`, `count` of them, keeping the `fixed` ones where they are. */
function spreadEvenly(n: number, count: number, fixed: number[] = []): number[] {
  const chosen = [...new Set(fixed)];
  if (chosen.length === 0 && count > 0) {
    // nothing is held in place: they are simply n / count apart, the first at the start of the track
    return Array.from({ length: count }, (_, i) => Math.floor((i * n) / count));
  }
  while (chosen.length < count) {
    let best = -1;
    let bestGap = -1;
    for (let candidate = 0; candidate < n; candidate += 1) {
      if (chosen.includes(candidate)) continue;
      const gap = Math.min(
        ...chosen.map((other) => {
          const d = Math.abs(candidate - other);
          return Math.min(d, n - d);
        }),
      );
      if (gap > bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
    chosen.push(best);
  }
  return chosen.sort((a, b) => a - b);
}

/**
 * The tiles of a map, in order. The Paydays are spread evenly; the rest is dealt out by the seed under three rules: no two tiles of
 * a kind side by side, an Emergency never directly after a Payday, and the Paydays of a map with a crossing (the infinity) are the
 * crossing itself, which is walked twice a lap.
 */
export function layoutTiles(setup: BoardSetup, fixedPaydays: number[] = []): DreamfundTile[] {
  const n = TILE_COUNTS[setup.size];
  const counts = { ...TILE_MIX[setup.size][setup.difficulty ?? 'medium'] };
  const random = mulberry32(setup.seed * 7919 + n);
  const paydays = new Set(spreadEvenly(n, counts.payday, fixedPaydays));
  const rest = (Object.keys(counts) as DreamfundTile[]).filter((kind) => kind !== 'payday');
  const left: Record<string, number> = {};
  for (const kind of rest) left[kind] = counts[kind];

  const placed: (DreamfundTile | null)[] = Array.from({ length: n }, (_, i) =>
    paydays.has(i) ? 'payday' : null,
  );

  // each kind is spread round the track: the rarest first, every tile as far from the others of its kind as the free places allow
  // (JFK, 2026-10-26: well distributed, not clustered). The most common kind takes what is left.
  const order = [...rest].sort((x, y) => left[x] - left[y]);
  const circular = (x: number, y: number) => {
    const d = Math.abs(x - y);
    return Math.min(d, n - d);
  };
  for (const kind of order) {
    const isLast = kind === order[order.length - 1];
    while (left[kind] > 0) {
      const free = Array.from({ length: n }, (_, i) => i).filter(
        (i) =>
          placed[i] === null &&
          !(kind === 'emergency' && placed[(i - 1 + n) % n] === 'payday') &&
          !(kind === 'emergency' && placed[(i + 1) % n] === 'payday' && false),
      );
      if (free.length === 0) break;
      if (isLast) {
        placed[free[0]] = kind;
        left[kind] -= 1;
        continue;
      }
      const same = placed.flatMap((tile, i) => (tile === kind ? [i] : []));
      const score = (i: number) =>
        same.length === 0 ? 0 : Math.min(...same.map((other) => circular(i, other)));
      const best = Math.max(...free.map(score));
      const ties = free.filter((i) => score(i) === best);
      const pick = ties[Math.floor(random() * ties.length)];
      placed[pick] = kind;
      left[kind] -= 1;
    }
  }
  const result = placed as DreamfundTile[];
  repair(result, paydays, random);
  return result;
}

/** How many rules the tile at `i` breaks with its neighbours. */
function broken(tiles: DreamfundTile[], i: number): number {
  const n = tiles.length;
  const before = tiles[(i - 1 + n) % n];
  const after = tiles[(i + 1) % n];
  const kind = tiles[i];
  return (
    Number(kind === before && kind !== 'payday') +
    Number(kind === after && kind !== 'payday') +
    Number(kind === 'emergency' && before === 'payday') +
    Number(after === 'emergency' && kind === 'payday')
  );
}

/** The smallest distance round the track between two tiles of a kind. */
function minGap(tiles: DreamfundTile[], kind: DreamfundTile): number {
  const n = tiles.length;
  const at = tiles.flatMap((tile, i) => (tile === kind ? [i] : []));
  if (at.length < 2) return n;
  return Math.min(...at.map((spot, k) => (at[(k + 1) % at.length] - spot + n) % n));
}

/** How close two tiles of a kind may stand: a third of an even spread. */
function spreadFloor(tiles: DreamfundTile[], kind: DreamfundTile): number {
  const count = tiles.filter((tile) => tile === kind).length;
  return Math.floor(tiles.length / Math.max(1, count) / 3);
}

/** The dealing can corner itself at the end of the track: tiles that break a rule trade places with others until none does. */
function repair(tiles: DreamfundTile[], paydays: Set<number>, random: () => number): void {
  const n = tiles.length;
  const movable = Array.from({ length: n }, (_, i) => i).filter((i) => !paydays.has(i));
  const total = () => tiles.reduce((sum, _, i) => sum + broken(tiles, i), 0);
  for (let round = 0; round < 400 && total() > 0; round += 1) {
    const bad = movable.filter((i) => broken(tiles, i) > 0);
    if (bad.length === 0) return;
    const i = bad[Math.floor(random() * bad.length)];
    const j = movable[Math.floor(random() * movable.length)];
    if (i === j) continue;
    const before = total();
    const kinds = [tiles[i], tiles[j]];
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    // a swap that fixes a rule must not clump a kind together again
    const clumped = kinds.some(
      (kind) => kind !== 'payday' && minGap(tiles, kind) < spreadFloor(tiles, kind),
    );
    if (total() >= before || clumped) [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; // no better: back
  }
}

// ── the shapes ──

export interface BoardPoint {
  x: number;
  y: number;
}

/** Where the tiles stand, for drawing: the points in a box `aspect` wide and 1 high, how far apart neighbours are, and the board. */
export interface DreamfundBoard {
  setup: BoardSetup;
  board: RatRaceBoard;
  points: BoardPoint[];
  /** Width over height of the box the points lie in (at least 1). */
  aspect: number;
  /** Whether the map may stand up on a portrait screen (a mountain always stands on its base). */
  standsUp: boolean;
  /** The distance between neighbouring tiles. */
  spacing: number;
}

function dense(count: number, at: (t: number) => BoardPoint): BoardPoint[] {
  return Array.from({ length: count }, (_, i) => at(i / count));
}

function roundedRectangle(width: number, height: number, radius: number): BoardPoint[] {
  const points: BoardPoint[] = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let step = 0; step <= 12; step += 1) {
      const angle = from + (step / 12) * (Math.PI / 2);
      points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
  };
  // clockwise from the middle of the top edge
  points.push({ x: width / 2, y: 0 });
  corner(width - radius, radius, -Math.PI / 2);
  corner(width - radius, height - radius, 0);
  corner(radius, height - radius, Math.PI / 2);
  corner(radius, radius, Math.PI);
  return points;
}

/** The closed outline of a shape, landscape, in a box `aspect` wide and 1 high, as a dense polyline. */
function outline(shape: BoardShape): { points: BoardPoint[]; aspect: number } {
  switch (shape) {
    case 'ring':
      return {
        aspect: 1,
        points: dense(720, (t) => {
          const angle = t * 2 * Math.PI; // clockwise from the top
          return { x: 0.5 + 0.5 * Math.sin(angle), y: 0.5 - 0.5 * Math.cos(angle) };
        }),
      };
    case 'square':
      return { aspect: 1, points: roundedRectangle(1, 1, 0.2) };
    case 'rectangle':
      return { aspect: 1.6, points: roundedRectangle(1.6, 1, 0.18) };
    case 'mountain': {
      const w = 1.5;
      // the silhouette of a peak with a shoulder on each side; the corners are cut so tiles never crowd into a point
      const corners: BoardPoint[] = [
        { x: 0.5 * w, y: 0 },
        { x: 0.64 * w, y: 0.55 },
        { x: 0.78 * w, y: 0.45 },
        { x: w, y: 1 },
        { x: 0, y: 1 },
        { x: 0.22 * w, y: 0.45 },
        { x: 0.36 * w, y: 0.55 },
      ];
      let rounded = corners;
      for (let pass = 0; pass < 3; pass += 1) {
        const cut: BoardPoint[] = [];
        rounded.forEach((from, i) => {
          const to = rounded[(i + 1) % rounded.length];
          cut.push(
            { x: from.x * 0.75 + to.x * 0.25, y: from.y * 0.75 + to.y * 0.25 },
            { x: from.x * 0.25 + to.x * 0.75, y: from.y * 0.25 + to.y * 0.75 },
          );
        });
        rounded = cut;
      }
      const xs = rounded.map((p) => p.x);
      const ys = rounded.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const points: BoardPoint[] = [];
      rounded.forEach((from, i) => {
        const to = rounded[(i + 1) % rounded.length];
        for (let step = 0; step < 24; step += 1) {
          points.push({
            x: from.x + ((to.x - from.x) * step) / 24,
            y: from.y + ((to.y - from.y) * step) / 24,
          });
        }
      });
      // the box of the rounded outline, as wide as it is
      return {
        aspect: (maxX - minX) / (maxY - minY),
        points: points.map((p) => ({
          x: (p.x - minX) / (maxY - minY),
          y: (p.y - minY) / (maxY - minY),
        })),
      };
    }
    case 'infinity': {
      // the lemniscate, from its left end: the crossing is a quarter of the way and three quarters of the way round
      const raw = dense(1440, (t) => {
        const angle = Math.PI + t * 2 * Math.PI;
        const d = 1 + Math.sin(angle) ** 2;
        return { x: Math.cos(angle) / d, y: (Math.sin(angle) * Math.cos(angle)) / d };
      });
      const xs = raw.map((p) => p.x);
      const ys = raw.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const height = 1;
      const width = 2;
      return {
        aspect: width,
        points: raw.map((p) => ({
          x: ((p.x - minX) / (maxX - minX)) * width,
          y: ((p.y - minY) / (maxY - minY)) * height,
        })),
      };
    }
  }
}

/** `count` points at equal distances along a closed polyline, starting at its first point. */
function resample(polyline: BoardPoint[], count: number): BoardPoint[] {
  const lengths: number[] = [0];
  for (let i = 1; i <= polyline.length; i += 1) {
    const a = polyline[i - 1];
    const b = polyline[i % polyline.length];
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[lengths.length - 1];
  const points: BoardPoint[] = [];
  let segment = 0;
  for (let k = 0; k < count; k += 1) {
    const target = (k * total) / count;
    while (lengths[segment + 1] < target) segment += 1;
    const a = polyline[segment];
    const b = polyline[(segment + 1) % polyline.length];
    const span = lengths[segment + 1] - lengths[segment] || 1;
    const f = (target - lengths[segment]) / span;
    points.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return points;
}

const cache = new Map<string, DreamfundBoard>();

/** The map of a setup: its tiles for the engine and where they stand for the picture. The same setup is always the same map. */
export function buildDreamfundBoard(setup: BoardSetup): DreamfundBoard {
  const key = `${setup.shape}/${setup.size}/${setup.seed}/${setup.difficulty ?? 'medium'}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const n = TILE_COUNTS[setup.size];
  const { points: outlinePoints, aspect } = outline(setup.shape);
  const points = resample(outlinePoints, n);
  // the crossing of the infinity is walked twice a lap: both visits are its Paydays
  const fixed = setup.shape === 'infinity' ? [n / 4, (3 * n) / 4] : [];
  const kinds = layoutTiles(setup, fixed);
  const spaces: RatRaceSpace[] = kinds.map((kind, index) => ({
    index,
    kind: kind as RatRaceSpaceKind,
    printed: kind,
  }));
  const spacing =
    points.slice(0, 5).reduce((sum, p, i) => {
      const q = points[(i + 1) % n];
      return sum + Math.hypot(q.x - p.x, q.y - p.y);
    }, 0) / 5;
  const built: DreamfundBoard = {
    setup,
    board: Object.freeze(spaces.map((space) => Object.freeze(space))),
    points,
    aspect,
    standsUp: setup.shape === 'rectangle' || setup.shape === 'infinity',
    spacing,
  };
  cache.set(key, built);
  return built;
}

/** Whether a map has the tiles it should: every kind present, the Paydays where they belong. For tests and for stored games. */
export function describeBoard(board: RatRaceBoard): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < board.length; i += 1) {
    const kind = spaceAt(board, i).kind;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}
