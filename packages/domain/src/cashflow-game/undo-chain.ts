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

/**
 * Lists inside the game state that only ever grow at their end, too: the game's own log repeats in every step, so left
 * whole the stored chain grew with the square of the step count and filled the browser's storage (JFK, 2026-10-11).
 */
const STATE_LIST_KEYS = ['history', 'budgetPlan'] as const;
const STATE_KEY = 'cashflowGame';
const STATE_PREFIX = 'cashflowGame.';

type Snapshot = Record<string, unknown>;

interface EncodedList {
  /** How many items at the start equal those of the next newer snapshot's list (moved by `shift` months, when it is given). */
  keep: number;
  /** The items after them. */
  tail: unknown[];
  /**
   * A Payday moves every date of the books back by a month, so the snapshot before it differs from the one after it in every item
   * - but only by that move. The shared items are the newer ones with their dates moved forward by this many months.
   */
  shift?: number;
}

type EncodedSnapshot = Record<string, unknown> & { lists: Record<string, EncodedList> };

export interface EncodedUndoChain {
  /** 1: lists share a prefix with the newer snapshot; 2: they may also share it moved by some months (and more lists are kept). */
  format: 1 | 2;
  /** Oldest first, like the undo stack itself. */
  snapshots: EncodedSnapshot[];
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** `2026-03-31` moved by some months: the day stays or is the last of the month (the rule the game uses to move its dates). */
function moveDate(text: string, months: number): string {
  const date = DATE.exec(text);
  if (date) {
    const [year, month, day] = [Number(date[1]), Number(date[2]), Number(date[3])];
    const zero = month - 1 + months;
    const targetYear = year + Math.floor(zero / 12);
    const targetMonth = ((zero % 12) + 12) % 12;
    const clamped = Math.min(day, new Date(targetYear, targetMonth + 1, 0).getDate());
    return `${targetYear}-${pad(targetMonth + 1)}-${pad(clamped)}`;
  }
  const month = MONTH.exec(text);
  if (month) {
    const zero = Number(month[2]) - 1 + months;
    return `${Number(month[1]) + Math.floor(zero / 12)}-${pad((((zero % 12) + 12) % 12) + 1)}`;
  }
  return text;
}

/** A copy of a value with every date (and every month) in it moved by some months. */
function moved(value: unknown, months: number): unknown {
  if (typeof value === 'string') return moveDate(value, months);
  if (Array.isArray(value)) return value.map((item) => moved(item, months));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        moved(item, months),
      ]),
    );
  }
  return value;
}

const keys = new WeakMap<object, string>();
/** An item as text, worked out once per item (a chain compares the same items again and again). */
function keyOf(item: unknown): string {
  if (item === null || typeof item !== 'object') return JSON.stringify(item);
  let key = keys.get(item);
  if (key === undefined) {
    key = JSON.stringify(item);
    keys.set(item, key);
  }
  return key;
}

function sameItems(older: unknown[], newer: unknown[], shift = 0): number {
  const limit = Math.min(older.length, newer.length);
  let keep = 0;
  while (keep < limit) {
    const other = shift === 0 ? keyOf(newer[keep]) : JSON.stringify(moved(newer[keep], shift));
    if (keyOf(older[keep]) !== other) break;
    keep++;
  }
  return keep;
}

/** How a list of an older snapshot relates to the newer one: the shared start, and by how many months the dates moved. */
function relate(older: unknown[], newer: unknown[]): { keep: number; shift: number } {
  const limit = Math.min(older.length, newer.length);
  let best = { keep: sameItems(older, newer), shift: 0 };
  // a Payday moved every date: look for that only when nothing (or little) is shared as it is
  if (best.keep < limit / 2) {
    for (const shift of [1, 2, 3]) {
      const keep = sameItems(older, newer, shift);
      if (keep > best.keep) best = { keep, shift };
      if (best.keep === limit) break;
    }
  }
  return best;
}

/**
 * `cache` (optional) keeps what was worked out for a pair of snapshots, so a chain that grows by one step is encoded by working out one
 * step and not all of them (JFK, 2026-10-27: a long Dreamfund game spent seconds on its own history). Snapshots are never changed once
 * they are in the chain.
 */
export function encodeUndoChain<T extends object>(
  snapshotStack: T[],
  cache?: WeakMap<object, { newer: object | undefined; encoded: EncodedSnapshot }>,
): EncodedUndoChain {
  const stack = snapshotStack as unknown as Snapshot[];
  const snapshots = stack.map((snapshot, index) => {
    const newer = stack[index + 1];
    const cached = cache?.get(snapshot);
    if (cached && cached.newer === newer) return cached.encoded;
    const { ...rest } = snapshot;
    const lists: Record<string, EncodedList> = {};
    const state = snapshot[STATE_KEY] as Snapshot | undefined;
    const newerState = newer?.[STATE_KEY] as Snapshot | undefined;
    if (state && typeof state === 'object') {
      const slim: Snapshot = { ...state };
      for (const key of STATE_LIST_KEYS) {
        if (!Array.isArray(state[key])) continue;
        const items = state[key] as unknown[];
        const shared = Array.isArray(newerState?.[key])
          ? relate(items, newerState![key] as unknown[])
          : { keep: 0, shift: 0 };
        lists[STATE_PREFIX + key] = {
          keep: shared.keep,
          tail: items.slice(shared.keep),
          ...(shared.shift ? { shift: shared.shift } : {}),
        };
        delete slim[key];
      }
      rest[STATE_KEY] = slim;
    }
    for (const key of LIST_KEYS) {
      const items = (snapshot[key] ?? []) as unknown[];
      const shared = newer ? relate(items, (newer[key] ?? []) as unknown[]) : { keep: 0, shift: 0 };
      // An empty list says nothing: it is left out and decodes as empty.
      if (shared.keep > 0 || items.length > shared.keep) {
        lists[key] = {
          keep: shared.keep,
          tail: items.slice(shared.keep),
          ...(shared.shift ? { shift: shared.shift } : {}),
        };
      }
      delete rest[key];
    }
    const encoded = { ...rest, lists } as EncodedSnapshot;
    cache?.set(snapshot, { newer, encoded });
    return encoded;
  });
  return { format: 2, snapshots };
}

export function isEncodedUndoChain(value: unknown): value is EncodedUndoChain {
  const chain = value as Partial<EncodedUndoChain> | null;
  return Boolean(
    chain && (chain.format === 1 || chain.format === 2) && Array.isArray(chain.snapshots),
  );
}

export function decodeUndoChain<T extends object = Snapshot>(chain: EncodedUndoChain): T[] {
  const decoded: Snapshot[] = new Array(chain.snapshots.length);
  for (let index = chain.snapshots.length - 1; index >= 0; index--) {
    const { lists, ...rest } = chain.snapshots[index];
    const newer = decoded[index + 1];
    const snapshot: Snapshot = { ...rest };
    for (const key of LIST_KEYS) {
      const { keep, tail, shift } = lists[key] ?? { keep: 0, tail: [] };
      const shared: unknown[] = newer ? (newer[key] as unknown[]).slice(0, keep) : [];
      // The lists are the chain's own arrays; the items that are shared between steps are shared here too, so a long chain is read
      // without copying every item of every step - whatever is put back into the game is copied then (see `applySnapshot`).
      snapshot[key] = [...(shift ? shared.map((item) => moved(item, shift)) : shared), ...tail];
    }
    const state = snapshot[STATE_KEY] as Snapshot | undefined;
    if (state && typeof state === 'object') {
      const restored: Snapshot = { ...state };
      const newerState = newer?.[STATE_KEY] as Snapshot | undefined;
      for (const key of STATE_LIST_KEYS) {
        const encoded = lists[STATE_PREFIX + key];
        if (!encoded) continue;
        const shared = Array.isArray(newerState?.[key])
          ? (newerState![key] as unknown[]).slice(0, encoded.keep)
          : [];
        restored[key] = [
          ...(encoded.shift ? shared.map((item) => moved(item, encoded.shift!)) : shared),
          ...encoded.tail,
        ];
      }
      snapshot[STATE_KEY] = restored;
    }
    decoded[index] = snapshot;
  }
  return decoded as unknown as T[];
}
