/**
 * The game's source of chance, injected like the `Clock` (todo/cashflow-game-pro.md slice A3): the browser uses the
 * system's, the solo engine and the Pro API can be played from a seed, and every test can pin a die or a draw.
 */

/** A number in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** The system's randomness. Looks `Math.random` up on every call, so a test that replaces it still takes effect. */
export const systemRng: Rng = () => Math.random();

/** A repeatable source: the same seed always gives the same sequence (mulberry32). */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One roll of a six-sided die: 1 to 6. */
export function rollDie(rng: Rng = systemRng): number {
  return Math.floor(rng() * 6) + 1;
}

/** One item of a non-empty list, chosen evenly. */
export function pickOne<T>(items: readonly T[], rng: Rng = systemRng): T {
  if (items.length === 0) throw new Error('Nothing to pick from.');
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}
