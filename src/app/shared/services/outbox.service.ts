import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { idbDelete, idbGetAll, idbPut, isIndexedDbAvailable, OUTBOX_STORE } from '../storage/indexed-db';

/**
 * One pending write to the backend. We snapshot the full data array per `tag` because the
 * existing persistence model already writes whole-tag snapshots (e.g. the entire
 * `transactions` array on every save). Per-tag last-write-wins is the natural fit.
 */
export interface OutboxEntry {
  /** Stable id (uuid). Used as IndexedDB primary key. */
  id: string;
  /** Database tag the snapshot belongs to (e.g. "transactions", "income/expenses/daily"). */
  tag: string;
  /** Snapshot of the data the user wanted to write. */
  data: unknown;
  /** ISO timestamp at the moment this entry was queued. Used for LWW tie-breaking on sync. */
  clientUpdatedAt: string;
  /** How many drain attempts have been made. Bounded so a poison entry can't loop forever. */
  attempts: number;
  /** Last error message seen while attempting to drain this entry. Diagnostic only. */
  lastError?: string;
}

const LOCALSTORAGE_FALLBACK_KEY = '__money_outbox_fallback__';
export const MAX_OUTBOX_ATTEMPTS = 5;

/**
 * Stores writes that couldn't reach the server (because the user is offline or the request
 * failed) and replays them when connectivity returns.
 *
 * The outbox is keyed by entry id, but logically de-duplicated by `tag`: when a newer
 * snapshot for the same tag is enqueued, the older entry for that tag is dropped. This means
 * the outbox always reflects the user's *latest* intent for each tag, never a long history of
 * intermediate states.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private entries: OutboxEntry[] = [];
  private readonly _pendingCount$ = new BehaviorSubject<number>(0);
  private loadPromise: Promise<void> | null = null;
  private readonly useIdb = isIndexedDbAvailable();

  /** Number of writes still waiting to sync. Useful for UI badges. */
  readonly pendingCount$: Observable<number> = this._pendingCount$.asObservable();

  /**
   * Initialize from persistent storage. Idempotent — repeated calls share the same promise.
   * Callers MUST await this before reading or mutating the queue on cold start.
   */
  async ready(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        if (this.useIdb) {
          this.entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
        } else {
          this.entries = this.readFallback();
        }
      } catch (err) {
        console.error('[Outbox] Failed to load persisted entries:', err);
        this.entries = [];
      }
      this.publish();
    })();
    return this.loadPromise;
  }

  /** Synchronous snapshot of pending entries (only valid after `ready()` has resolved). */
  list(): OutboxEntry[] {
    return [...this.entries];
  }

  pendingCount(): number {
    return this.entries.length;
  }

  hasPending(): boolean {
    return this.entries.length > 0;
  }

  /**
   * Queue a snapshot for the given tag. If a pending entry for the same tag already exists,
   * it is replaced — the latest snapshot wins. This avoids the queue growing unbounded when
   * the user is offline and edits the same data repeatedly.
   */
  async enqueue(tag: string, data: unknown): Promise<OutboxEntry> {
    await this.ready();
    const existing = this.entries.find(e => e.tag === tag);
    if (existing) {
      await this.remove(existing.id);
    }
    const entry: OutboxEntry = {
      id: this.generateId(),
      tag,
      data,
      clientUpdatedAt: new Date().toISOString(),
      attempts: 0
    };
    this.entries.push(entry);
    await this.persist(entry);
    this.publish();
    return entry;
  }

  /** Permanently remove an entry (e.g. after it has been successfully synced). */
  async remove(id: string): Promise<void> {
    this.entries = this.entries.filter(e => e.id !== id);
    try {
      if (this.useIdb) {
        await idbDelete(OUTBOX_STORE, id);
      } else {
        this.writeFallback();
      }
    } catch (err) {
      console.error('[Outbox] Failed to remove entry', id, err);
    }
    this.publish();
  }

  /** Update an existing entry in place (used after a failed drain attempt). */
  async update(entry: OutboxEntry): Promise<void> {
    const idx = this.entries.findIndex(e => e.id === entry.id);
    if (idx === -1) return;
    this.entries[idx] = entry;
    await this.persist(entry);
    this.publish();
  }

  /** Drop everything. Used when the user explicitly chooses "Use server's version". */
  async clear(): Promise<void> {
    this.entries = [];
    try {
      if (this.useIdb) {
        // Use individual deletes via idb wrapper to avoid pulling in idbClear here unnecessarily
        const all = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
        await Promise.all(all.map(e => idbDelete(OUTBOX_STORE, e.id)));
      } else {
        this.writeFallback();
      }
    } catch (err) {
      console.error('[Outbox] Failed to clear', err);
    }
    this.publish();
  }

  private async persist(entry: OutboxEntry): Promise<void> {
    try {
      if (this.useIdb) {
        await idbPut(OUTBOX_STORE, entry);
      } else {
        this.writeFallback();
      }
    } catch (err) {
      console.error('[Outbox] Failed to persist entry', entry.id, err);
    }
  }

  private publish(): void {
    this._pendingCount$.next(this.entries.length);
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback for very old browsers / jsdom: timestamp + random.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private readFallback(): OutboxEntry[] {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_FALLBACK_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
    } catch {
      return [];
    }
  }

  private writeFallback(): void {
    try {
      localStorage.setItem(LOCALSTORAGE_FALLBACK_KEY, JSON.stringify(this.entries));
    } catch (err) {
      console.error('[Outbox] localStorage fallback write failed', err);
    }
  }
}
