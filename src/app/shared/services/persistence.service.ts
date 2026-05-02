import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { DatabaseService } from './database.service';
import { LocalService } from './local.service';
import { FrontendLoggerService } from './frontend-logger.service';
import { ConnectivityService } from './connectivity.service';
import { OutboxService } from './outbox.service';
import { environment } from '../../../environments/environment';

export interface WriteConfig {
  tag: string;
  data: any;
  localStorageKey: string;
  logEvent: string;
  logMetadata: any;
  onSuccess: () => void;
  onError: (error: any) => void;
}

export interface BatchWriteConfig {
  writes: { tag: string; data: any }[];
  localStorageSaves: { key: string; data: any }[];
  logEvent?: string;
  logMetadata?: any;
  forceWrite?: boolean;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

/**
 * Returns true when an error from the backend looks like a transient connectivity issue
 * (offline, server unreachable, gateway error). These should not bubble as failures —
 * we queue them in the outbox and surface a "synced" UX to the user.
 */
function isTransientError(error: any): boolean {
  if (!error) return false;
  if (error instanceof TimeoutError) return true;
  if (error instanceof HttpErrorResponse) {
    // status 0 = network error / CORS preflight failure / offline
    if (error.status === 0) return true;
    if (error.status >= 500 && error.status < 600) return true;
  }
  // Plain Error from fetch / Firebase SDK when offline
  const name = error?.name ?? '';
  const code = error?.code ?? '';
  if (name === 'NetworkError' || name === 'AbortError' || name === 'TimeoutError') return true;
  if (typeof code === 'string' && code.includes('network')) return true;
  return false;
}

/** Max time we'll wait for a single write before treating it as offline and queuing it. */
const WRITE_TIMEOUT_MS = 5_000;

@Injectable({
  providedIn: 'root'
})
/**
 * Unified write service that handles firebase-vs-selfhosted persistence logic.
 *
 * Always saves to localStorage immediately so reload-after-edit shows the latest data even
 * when the backend write is still in flight or the user is offline. When the network is
 * unavailable, writes are queued in the outbox (see {@link OutboxService}) and replayed by
 * {@link SyncService} once connectivity returns.
 */
export class PersistenceService {

  constructor(
    private database: DatabaseService,
    private localStorage: LocalService,
    private frontendLogger: FrontendLoggerService,
    private connectivity: ConnectivityService,
    private outbox: OutboxService
  ) {}

  /**
   * Writes data to the database, saves to localStorage, logs the activity,
   * and handles the Firebase vs Selfhosted mode branching internally.
   */
  writeAndSync(config: WriteConfig): void {
    try {
      // Save to localStorage immediately so reload always reflects the latest state,
      // even if the DB write hasn't returned yet.
      const dataToSave = JSON.stringify(config.data);
      this.localStorage.saveData(config.localStorageKey, dataToSave);

      const handleSuccess = () => {
        this.frontendLogger.logActivity(config.logEvent, 'info', config.logMetadata);
        config.onSuccess();
      };

      // If we're already known-offline, skip the round-trip and queue immediately.
      // Trust both our heartbeat-driven flag and the synchronous navigator.onLine signal
      // so a freshly-toggled-offline browser doesn't have to wait for the next heartbeat.
      const navOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!this.connectivity.isOnline || !navOnline) {
        console.log('[Offline] Queued write to outbox:', config.tag, '(reason: ' + (!navOnline ? 'navigator.onLine=false' : 'connectivity.isOnline=false') + ')');
        this.outbox.enqueue(config.tag, config.data).catch(err =>
          console.error('[Persistence] Failed to queue offline write:', err)
        );
        handleSuccess();
        return;
      }

      const writeResult = this.database.writeObject(config.tag, config.data);

      // writeResult is now always an Observable (both Firebase and selfhosted)
      if (writeResult) {
        // Wrap with a timeout so a stuck request (backend down with navigator.onLine still true,
        // Firebase queueing offline writes that never resolve) eventually flips to the outbox
        // path instead of leaving the spinner hanging forever.
        writeResult.pipe(timeout(WRITE_TIMEOUT_MS)).subscribe({
          next: handleSuccess,
          error: (error: any) => {
            if (isTransientError(error)) {
              console.log('[Offline] Write timed out / network error — queued to outbox:', config.tag, error?.name || error?.status || error);
              this.outbox.enqueue(config.tag, config.data).catch(err =>
                console.error('[Persistence] Failed to queue write after transient error:', err)
              );
              // Trigger a probe so the connectivity service flips to offline immediately and
              // the offline indicator appears without waiting for the next 30s heartbeat.
              this.connectivity.probe().catch(() => { /* probe handles its own errors */ });
              handleSuccess();
              return;
            }
            config.onError(error);
          }
        });
      } else {
        // Fallback for safety (should never happen)
        handleSuccess();
      }
    } catch (error) {
      config.onError(error);
    }
  }

  /**
   * Writes multiple objects to the database using batchWrite (selfhosted) or
   * individual writeObject calls (Firebase), saves to localStorage, logs activity,
   * and calls success/error callbacks.
   */
  batchWriteAndSync(config: BatchWriteConfig): void {
    try {
      // Save to localStorage immediately so reload always reflects the latest state,
      // even if the DB write hasn't returned yet.
      for (const save of config.localStorageSaves) {
        // Stringify data before saving (saveData expects string for encryption)
        const dataToSave = typeof save.data === 'string' ? save.data : JSON.stringify(save.data);
        this.localStorage.saveData(save.key, dataToSave);
      }

      const handleSuccess = () => {
        if (config.logEvent) {
          this.frontendLogger.logActivity(config.logEvent, 'info', config.logMetadata);
        }
        config.onSuccess?.();
      };

      const queueAll = () => {
        Promise.all(config.writes.map(w => this.outbox.enqueue(w.tag, w.data))).catch(err =>
          console.error('[Persistence] Failed to queue batch writes:', err)
        );
      };

      // Already known-offline: queue and ack synchronously.
      const navOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!this.connectivity.isOnline || !navOnline) {
        queueAll();
        handleSuccess();
        return;
      }

      if (environment.mode === 'selfhosted') {
        this.database.batchWrite(config.writes, config.forceWrite).pipe(timeout(WRITE_TIMEOUT_MS)).subscribe({
          next: () => handleSuccess(),
          error: (error: any) => {
            if (isTransientError(error)) {
              queueAll();
              this.connectivity.probe().catch(() => { /* probe handles its own errors */ });
              handleSuccess();
              return;
            }
            config.onError?.(error);
          }
        });
      } else {
        config.writes.forEach(write => {
          this.database.writeObject(write.tag, write.data);
        });
        handleSuccess();
      }
    } catch (error) {
      config.onError?.(error);
    }
  }
}
