import type { Rng } from '../rng';

/**
 * The table's source of chance as a value: mulberry32 whose whole state is one 32-bit number, so a table can store "where the
 * stream is" (`Table.rngState`) and a restarted server - or a replay - continues exactly where it stopped. Produces the same
 * sequence as `seededRng(seed)` from `state = seed`.
 */
const STEP = 0x6d2b79f5;

export interface TableRng {
  rng: Rng;
  /** The stream's position now; store it back on the table. */
  state(): number;
}

export function tableRng(startState: number): TableRng {
  let state = startState >>> 0;
  const rng: Rng = () => {
    state = (state + STEP) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rng, state: () => state };
}

/** Fisher-Yates, drawing from `rng`; returns a new array. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
