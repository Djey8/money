/**
 * The undo history of a Cashflow game is a list of full game snapshots, one per step (JFK, 2026-10-04:
 * "save the full history of every move and make it possible that the full undo works after loading a
 * game"). Stored as they are, every step would repeat the whole game; most of it never changes between
 * two steps, though - the transaction list only ever grows at its end. So each snapshot is stored
 * relative to the next newer one: for every list, how many leading items are identical and the items
 * after them. The newest snapshot has no newer neighbour and is stored whole. Lossless: decoding gives
 * back exactly what was encoded.
 */
const LIST_KEYS = [
  'allTransactions',
  'allSubscriptions',
  'allGrowProjects',
  'allShares',
  'allInvestments',
  'allAssets',
  'liabilities',
  'allSmileProjects',
  'allFireEmergencies',
] as const;

type Snapshot = Record<string, unknown>;

interface EncodedList {
  /** How many items at the start equal those of the next newer snapshot's list. */
  keep: number;
  /** The items after them. */
  tail: unknown[];
}

type EncodedSnapshot = Record<string, unknown> & { lists: Record<string, EncodedList> };

export interface EncodedUndoChain {
  format: 1;
  /** Oldest first, like the undo stack itself. */
  snapshots: EncodedSnapshot[];
}

function sameItems(older: unknown[], newer: unknown[]): number {
  const limit = Math.min(older.length, newer.length);
  let keep = 0;
  while (keep < limit && JSON.stringify(older[keep]) === JSON.stringify(newer[keep])) keep++;
  return keep;
}

export function encodeUndoChain<T extends object>(snapshotStack: T[]): EncodedUndoChain {
  const stack = snapshotStack as unknown as Snapshot[];
  const snapshots = stack.map((snapshot, index) => {
    const newer = stack[index + 1];
    const { ...rest } = snapshot;
    const lists: Record<string, EncodedList> = {};
    for (const key of LIST_KEYS) {
      const items = (snapshot[key] ?? []) as unknown[];
      const keep = newer ? sameItems(items, (newer[key] ?? []) as unknown[]) : 0;
      // An empty list says nothing: it is left out and decodes as empty.
      if (keep > 0 || items.length > keep) lists[key] = { keep, tail: items.slice(keep) };
      delete rest[key];
    }
    return { ...rest, lists } as EncodedSnapshot;
  });
  return { format: 1, snapshots };
}

export function isEncodedUndoChain(value: unknown): value is EncodedUndoChain {
  const chain = value as Partial<EncodedUndoChain> | null;
  return Boolean(chain && chain.format === 1 && Array.isArray(chain.snapshots));
}

export function decodeUndoChain<T extends object = Snapshot>(chain: EncodedUndoChain): T[] {
  const decoded: Snapshot[] = new Array(chain.snapshots.length);
  for (let index = chain.snapshots.length - 1; index >= 0; index--) {
    const { lists, ...rest } = chain.snapshots[index];
    const newer = decoded[index + 1];
    const snapshot: Snapshot = { ...rest };
    for (const key of LIST_KEYS) {
      const { keep, tail } = lists[key] ?? { keep: 0, tail: [] };
      const shared: unknown[] = newer ? (newer[key] as unknown[]).slice(0, keep) : [];
      // Own copies: the stack entries are mutated independently of each other.
      snapshot[key] = JSON.parse(JSON.stringify([...shared, ...tail]));
    }
    decoded[index] = snapshot;
  }
  return decoded as unknown as T[];
}
