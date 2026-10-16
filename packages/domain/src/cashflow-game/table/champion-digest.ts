import type { CashflowGameSet } from '../types';
import { strategyRulesDigest } from '../simulation/digest';
import { FORCED_TABLE_RULES } from './settings';

/**
 * The fingerprint of everything the champions, the characters and the tournament were measured on: the strategy lab's rules
 * (cards, professions, loan rule, board, simulator version) AND the rules every table forces on its players. A change to either
 * makes the numbers stale - the freshness test fails until `npm run champions:refresh` has searched again - so a bot is never sold
 * as a champion on rules it was not measured on. (The forced table rules matter on their own: the first champions were found while
 * a Doodad could still be passed at a guided table.)
 */
export function championRulesDigest(sets: CashflowGameSet[]): string {
  const text = JSON.stringify({ lab: strategyRulesDigest(sets), forced: FORCED_TABLE_RULES });
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
