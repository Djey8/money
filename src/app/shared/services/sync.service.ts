import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { OutboxService, OutboxEntry, MAX_OUTBOX_ATTEMPTS } from './outbox.service';
import { DatabaseService } from './database.service';
import { ToastService } from './toast.service';
import { AppStateService } from './app-state.service';
import { AppDataService } from './app-data.service';

/**
 * Drains the outbox to the backend whenever connectivity is restored.
 *
 * Conflict policy: when the server has a newer `updatedAt` than the snapshot we last loaded,
 * another device wrote while we were offline. Per the agreed UX default we keep the local
 * (offline) edits — they overwrite the server copy. The user is informed via toast so they
 * can manually reconcile if needed. Per-item three-way merge is intentionally out of scope
 * for this iteration.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  /**
   * Tracks the in-flight drain so concurrent callers can await the same operation rather than
   * skipping it. Without this, a `drain()` started by the cold-start `online$` emit would set
   * `syncing=true` and any subsequent `await syncService.drain()` from app init would return
   * instantly — racing with `loadTier1()` and silently dropping offline edits.
   */
  private syncing: Promise<void> | null = null;
  private initialized = false;

  constructor(
    private connectivity: ConnectivityService,
    private outbox: OutboxService,
    private database: DatabaseService,
    private toast: ToastService,
    private appData: AppDataService
  ) {}

  /**
   * Subscribe to connectivity changes. Safe to call multiple times — only the first call
   * actually wires up listeners.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.connectivity.online$.subscribe(online => {
      if (online) {
        // Fire-and-forget; errors are surfaced via toast inside drain()
        this.drain().catch(err => console.error('[Sync] drain failed', err));
      }
    });
  }

  /**
   * Push every queued entry to the backend, in the order they were enqueued.
   * Skips quietly if there's nothing to do. Concurrent callers receive the same in-flight promise.
   */
  drain(): Promise<void> {
    if (this.syncing) return this.syncing;
    this.syncing = this.runDrain().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  private async runDrain(): Promise<void> {
    await this.outbox.ready();

    // Confirm we're really online before pushing — the OS event can fire before the radio
    // is ready, causing the first request to fail and bump every entry's attempt counter.
    const online = await this.connectivity.probe();
    if (!online) return;

    // Even when there's nothing to push, a peer device may have changed data while we were
    // offline. Refresh tier1 + already-loaded tiers so the UI reflects the latest server
    // state without forcing the user to refresh manually. Skip if a tier1 load is already
    // happening at boot — app.component drives that.
    if (!this.outbox.hasPending()) {
      const hasChanged = await this.appData.checkUpdatedAt().catch(() => true);
      if (hasChanged) {
        await this.refreshAllLoadedTiers();
      }
      return;
    }

    const queueSnapshot = this.outbox.list();

    let conflictDetected = false;
    // Detect "another device wrote while we were offline" before we start overwriting.
    // The user's offline edits still win (per agreed UX), but we surface a toast so they
    // know the server's pre-sync state was different.
    try {
      const hasChanged = await this.appData.checkUpdatedAt();
      if (hasChanged) {
        conflictDetected = true;
      }
    } catch {
      // checkUpdatedAt failure is non-fatal — proceed with sync.
    }

    let synced = 0;
    let failed = 0;
    for (const entry of queueSnapshot) {
      try {
        await this.pushEntry(entry);
        await this.outbox.remove(entry.id);
        synced++;
      } catch (err: any) {
        failed++;
        const updated: OutboxEntry = {
          ...entry,
          attempts: entry.attempts + 1,
          lastError: err?.message ?? String(err)
        };
        if (updated.attempts >= MAX_OUTBOX_ATTEMPTS) {
          // Give up on this entry so it doesn't block the rest of the queue forever.
          console.error('[Sync] dropping entry after max attempts:', updated);
          await this.outbox.remove(entry.id);
        } else {
          await this.outbox.update(updated);
        }
      }
    }

    if (synced > 0) {
      const label = synced === 1 ? 'change' : 'changes';
      if (conflictDetected) {
        this.toast.show(
          `Synced ${synced} offline ${label}. Another device had newer data — your local edits were kept.`,
          'info'
        );
      } else {
        this.toast.show(`Synced ${synced} offline ${label}`, 'success');
      }
    }
    if (failed > 0 && synced === 0) {
      this.toast.show("Couldn't sync your offline changes. Will retry automatically.", 'error');
    }

    // Invalidate tier2/tier3 flags so subsequent navigation refetches the now-authoritative
    // server copy. We intentionally do NOT call loadTier1 here on cold start — the caller
    // (app.component) drives that and we'd just race with it.
    AppStateService.instance.tier2Loaded = false;
    AppStateService.instance.tier3BalanceLoaded = false;
    AppStateService.instance.tier3GrowLoaded = false;

    // After a successful sync we must refresh the UI with the now-authoritative server state.
    // Without this, the user sits on stale-looking data (or a stuck spinner from an earlier
    // optimistic load) until they manually refresh. We do this only when something was
    // actually synced, to avoid an unnecessary network round-trip on every reconnect.
    if (synced > 0) {
      try {
        await this.refreshAllLoadedTiers();
      } catch (err) {
        console.error('[Sync] post-drain refresh failed', err);
      } finally {
        // Belt-and-braces: ensure the global spinner is cleared even if loadTier1 set it.
        AppStateService.instance.isLoading = false;
      }
    }
  }

  /**
   * Reload tier1 and any tier that had been loaded before. Without this, a successful
   * drain or peer-device update only refreshes tier1 — the user has to navigate to
   * balance/grow/etc to see the updated data, hence the "needs two refreshes" bug.
   */
  private async refreshAllLoadedTiers(): Promise<void> {
    // Snapshot which tiers had been loaded before we invalidate them.
    const wasTier2 = AppStateService.instance.tier2Loaded !== false;
    const wasBalance = AppStateService.instance.tier3BalanceLoaded === true;
    const wasGrow = AppStateService.instance.tier3GrowLoaded === true;

    AppStateService.instance.tier2Loaded = false;
    AppStateService.instance.tier3BalanceLoaded = false;
    AppStateService.instance.tier3GrowLoaded = false;

    await this.appData.loadTier1();
    const followUps: Promise<unknown>[] = [];
    if (wasTier2) followUps.push(this.appData.loadTier2());
    if (wasBalance) followUps.push(this.appData.loadBalanceData());
    if (wasGrow) followUps.push(this.appData.loadGrowData());
    if (followUps.length) {
      await Promise.allSettled(followUps);
    }
  }

  private pushEntry(entry: OutboxEntry): Promise<unknown> {
    const obs = this.database.writeObject(entry.tag, entry.data) as Observable<unknown>;
    if (!obs) return Promise.resolve();
    return firstValueFrom(obs);
  }
}
