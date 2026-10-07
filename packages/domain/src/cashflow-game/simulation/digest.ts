import { CLASSIC_RAT_RACE_BOARD } from '../board';
import type { CashflowGameSet } from '../types';

/** Bump when the simulator or a strategy changes in a way that moves the lab's numbers. */
export const SIMULATION_VERSION = 'v1';

/**
 * A short fingerprint of everything the strategy lab's numbers depend on: the game sets (every card, profession and the
 * loan rule), the board and the simulator's version. The lab stamps its results with it, and a test compares the stamp with
 * the rules as they are now - so a card or a rule that changes cannot leave stale numbers in the manual unnoticed.
 * A plain string hash (cyrb53): the domain package also runs in the browser, which has no `crypto` module.
 */
export function strategyRulesDigest(sets: CashflowGameSet[]): string {
  const text = JSON.stringify({
    sets,
    board: CLASSIC_RAT_RACE_BOARD,
    simulation: SIMULATION_VERSION,
  });
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
