import { EnvironmentInjector, Injectable, runInInjectionContext } from '@angular/core';
import {
  AngularFireDatabase,
  AngularFireList,
  AngularFireObject
} from '@angular/fire/compat/database';
import { LocalService } from './local.service';
import { CrypticService } from './cryptic.service';
import { SelfhostedService } from './selfhosted.service';
import { DirtyTrackerService } from './dirty-tracker.service';
import { CacheService } from './cache.service';
import { ConnectivityService } from './connectivity.service';
import { environment } from '../../../environments/environment';
import { Observable, from, forkJoin, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
/**
 * Unified database service that abstracts Firebase and selfhosted (CouchDB) backends.
 * Routes read/write operations to the correct backend based on environment mode.
 * Supports dirty-tracking and caching optimizations in selfhosted mode.
 */
export class DatabaseService {

  studentsRef: AngularFireList<any>;
  studentRef: AngularFireObject<any>;
  
  private mode: 'firebase' | 'selfhosted' = (environment.mode as 'firebase' | 'selfhosted') || 'firebase';
  
  /**
   * Constructs a new instance of the DatabaseService class.
   * @param db - The AngularFireDatabase instance (optional for selfhosted mode).
   * @param localStorage - The LocalService instance.
   * @param cryptic - The CrypticService instance.
   * @param selfhosted - The SelfhostedService instance.
   * @param dirtyTracker - The DirtyTrackerService instance (for selfhosted optimization).
   * @param cacheService - The CacheService instance (for selfhosted optimization).
   */
  constructor(
    private db: AngularFireDatabase, 
    private localStorage: LocalService, 
    private cryptic: CrypticService,
    private selfhosted: SelfhostedService,
    private dirtyTracker: DirtyTrackerService,
    private cacheService: CacheService,
    private injector: EnvironmentInjector,
    private connectivity: ConnectivityService
  ) {
    if (this.mode === 'selfhosted') {
    }
  }

  /**
   * Writes data to the database.
   * @param {string} tag - The tag under which the data will be stored.
   * @param {any} element - The data to be stored.
   * @returns {Observable<any>} Observable that completes when write succeeds or errors on failure.
   * 
   * Note: Username and email (info/username, info/email) are NOT encrypted.
   * All other user data is encrypted when isDatabase is enabled.
   * The auth database email (backend) remains unencrypted for login matching.
   */
  writeObject(tag: string, element: any): Observable<any> {
    // Skip encryption for username and email
    const isUserInfo = tag === 'info/username' || tag === 'info/email';
    
    const clonedElement = JSON.parse(JSON.stringify(element));

    const encryptObjectValues = (obj: any): void => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'number' || typeof obj[key] === 'boolean' || typeof obj[key] === 'string') {
            obj[key] = this.cryptic.encrypt(obj[key].toString(), 'database');
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            encryptObjectValues(obj[key]);
          }
        }
      }
    };

    // Handle encryption for different data types
    let dataToWrite = clonedElement;
    
    if (!isUserInfo) {
      // Only encrypt if NOT username or email
      if (Array.isArray(clonedElement)) {
        clonedElement.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            encryptObjectValues(item);
          }
        });
        dataToWrite = clonedElement;
      } else if (typeof clonedElement === 'object' && clonedElement !== null) {
        encryptObjectValues(clonedElement);
        dataToWrite = clonedElement;
      } else if (typeof clonedElement === 'string' || typeof clonedElement === 'number' || typeof clonedElement === 'boolean') {
        // For primitive values, encrypt them
        dataToWrite = this.cryptic.encrypt(clonedElement.toString(), 'database');
      }
    }
    
    if (this.mode === 'firebase') {
      this.db.database.goOnline();
      const promise = runInInjectionContext(this.injector, () =>
        this.db.object(`users/${this.localStorage.getData("uid")}/${tag}`).set(dataToWrite)
      );
      return from(promise); // Convert Promise to Observable for consistent API
    } else {
      // Self-hosted mode with optimization
      const result = this.selfhosted.writeObject(tag, dataToWrite);
      
      // Mark as clean and take snapshot after successful write
      result.subscribe({
        next: () => {
          this.dirtyTracker.markClean(tag);
          this.dirtyTracker.takeSnapshot(tag, element); // Snapshot original (unencrypted) data
          this.cacheService.invalidate(tag); // Invalidate cache on write
          this.selfhosted.clearEtagCache(); // Invalidate ETags so next read fetches fresh data
        },
        error: (error) => {
          console.error(`[Write] Failed: ${tag}`, error);
        }
      });
      
      return result;
    }
  }

  /**
   * Write object only if it has changed (selfhosted optimization).
   * In Firebase mode, always writes immediately.
   * @param {string} tag - The tag under which the data will be stored.
   * @param {any} element - The data to be stored.
   * @returns {Observable<any>} Observable that completes when write succeeds or errors on failure.
   */
  writeObjectIfDirty(tag: string, element: any): Observable<any> {
    if (this.mode === 'firebase') {
      // Firebase mode: write immediately (no optimization needed)
      return this.writeObject(tag, element);
    } else {
      // Selfhosted mode: check if dirty first
      if (this.dirtyTracker.hasChanged(tag, element)) {
        this.dirtyTracker.markDirty(tag);
        return this.writeObject(tag, element);
      } else {
        // No changes detected, skip write
        return of({ success: true, skipped: true });
      }
    }
  }

  /**
   * Batch write multiple objects, filtering only dirty ones in selfhosted mode.
   * @param {Array<{tag: string, data: any}>} writes - Array of write operations
   * @param {boolean} forceWrite - If true, skip dirty tracking and write all (for encryption changes)
   * @returns {Observable<any>} - Observable that completes when all writes finish
   */
  batchWrite(writes: {tag: string, data: any}[], forceWrite: boolean = false): Observable<any> {
    if (this.mode === 'firebase') {
      // Firebase: write all
      const observables = writes
        .map(w => this.writeObject(w.tag, w.data) as Observable<any>)
        .filter(obs => obs !== undefined);
      
      return observables.length > 0 ? forkJoin(observables) : of([]);
    } else {
      // Selfhosted: filter dirty only (unless forceWrite is true)
      const dirtyWrites = forceWrite 
        ? writes 
        : writes.filter(w => this.dirtyTracker.hasChanged(w.tag, w.data));
      if (dirtyWrites.length === 0) {
        return of({ success: true, skipped: true, totalWrites: 0 });
      }

      // Use backend batch endpoint if available (more efficient)
      if (dirtyWrites.length > 1) {
        return this.selfhosted.writeBatch(dirtyWrites.map(w => ({
          path: w.tag,
          data: this.prepareDataForWrite(w.tag, w.data)
        }))).pipe(
          tap({
            next: () => {
              // Mark all as clean and take snapshots
              dirtyWrites.forEach(w => {
                this.dirtyTracker.markClean(w.tag);
                this.dirtyTracker.takeSnapshot(w.tag, w.data);
                this.cacheService.invalidate(w.tag);
              });
              this.selfhosted.clearEtagCache(); // Invalidate ETags so next read fetches fresh data
            },
            error: (error) => {
              console.error('[BatchWrite] Failed:', error);
            }
          }),
          map((response) => ({
            success: true,
            skipped: false,
            totalWrites: dirtyWrites.length,
            response
          }))
        );
      } else {
        // Single write, use regular write
        const observables = dirtyWrites.map(w => this.writeObject(w.tag, w.data) as Observable<any>);
        return forkJoin(observables).pipe(
          map(() => ({
            success: true,
            skipped: false,
            totalWrites: dirtyWrites.length
          }))
        );
      }
    }
  }

  /**
   * Prepare data for writing (encryption + cloning)
   * @param {string} tag - The tag
   * @param {any} element - The data
   * @returns {any} - Processed data ready for writing
   */
  private prepareDataForWrite(tag: string, element: any): any {
    // Skip encryption for username and email
    const isUserInfo = tag === 'info/username' || tag === 'info/email';
    
    const clonedElement = JSON.parse(JSON.stringify(element));

    const encryptObjectValues = (obj: any): void => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'number' || typeof obj[key] === 'boolean' || typeof obj[key] === 'string') {
            obj[key] = this.cryptic.encrypt(obj[key].toString(), 'database');
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            encryptObjectValues(obj[key]);
          }
        }
      }
    };

    // Handle encryption for different data types
    let dataToWrite = clonedElement;
    
    if (!isUserInfo) {
      // Only encrypt if NOT username or email (encrypt method checks if encryption is enabled)
      if (Array.isArray(clonedElement)) {
        clonedElement.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            encryptObjectValues(item);
          }
        });
        dataToWrite = clonedElement;
      } else if (typeof clonedElement === 'object' && clonedElement !== null) {
        encryptObjectValues(clonedElement);
        dataToWrite = clonedElement;
      } else if (typeof clonedElement === 'string' || typeof clonedElement === 'number' || typeof clonedElement === 'boolean') {
        // For primitive values, encrypt them
        dataToWrite = this.cryptic.encrypt(clonedElement.toString(), 'database');
      }
    }

    return dataToWrite;
  }

  /**
   * Retrieves data from the database.
   * Uses caching in selfhosted mode to reduce redundant reads.
   * @param {string} id - The ID of the data to be retrieved.
   * @returns {Promise<any>} - A promise that resolves with the retrieved data.
   */
  getData(id: string): Promise<any> {
    if (this.mode === 'firebase') {
      // Wrap once('value') in a timeout. The Firebase SDK queues reads indefinitely while
      // disconnected (e.g. when an ad-blocker blocks .lp long-polling). Without this, any
      // post-reconnect loadTier1 can hang forever and the UI sits on a spinner.
      const FIREBASE_READ_TIMEOUT_MS = 10_000;
      const ref = this.db.database.ref(`users/${this.localStorage.getData("uid")}/${id}`);
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          // Resolve with an empty snapshot rather than rejecting so callers fall back to
          // their cached/local copy instead of crashing the load pipeline.
          resolve({ val: () => null, exists: () => false });
        }, FIREBASE_READ_TIMEOUT_MS);
        ref.once('value').then(snap => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(snap);
        }).catch(err => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
      });
    } else {
      // Selfhosted mode with caching
      // Check cache first
      const cached = this.cacheService.get(id);
      if (cached !== null) {
        return Promise.resolve({
          val: () => cached,
          exists: () => true
        });
      }
      // Cache miss - fetch from database
      return new Promise((resolve, reject) => {
        this.selfhosted.getData(id).subscribe({
          next: (data) => {
            // Store in cache for future use (5 minute TTL)
            if (data !== null) {
              this.cacheService.set(id, data, 5 * 60 * 1000);
            }
            
            // Mimic Firebase DataSnapshot structure
            resolve({
              val: () => data,
              exists: () => data !== null
            });
          },
          error: (error) => {
            console.error(`[Read] Failed: ${id}`, error);
            reject(error);
          }
        });
      });
    }
  }

  /**
   * Clears all read caches so the next getData() calls fetch fresh data from the server.
   * Must be called before loadFromDB() to prevent stale cached data from overriding
   * newer server data (e.g. when switching between devices).
   */
  clearReadCache(): void {
    this.cacheService.clearAll();
  }

  async getBatchData(paths: string[]): Promise<{data: Record<string, any>, updatedAt: string | null} | null> {
    // In firebase mode the cached `connectivity.isOnline` value can be optimistically true
    // at cold start (initialized from `navigator.onLine`) before Firebase's `.info/connected`
    // has reported. Wait for the definitive verdict so we don't fire reads that will hang
    // for the full 10s timeout when the SDK is actually blocked (ad-blocker, captive portal).
    if (this.mode === 'firebase') {
      await this.connectivity.waitForReady();
    }
    // Offline short-circuit: don't even attempt the network. Callers fall back to the
    // localStorage snapshot loaded at boot, so the UI renders instantly instead of waiting
    // for the request to time out.
    if (!this.connectivity.isOnline) {
      return null;
    }
    if (this.mode === 'firebase') {
      const results: Record<string, any> = {};
      const promises = paths.map(path =>
        this.getData(path).then(snapshot => {
          results[path] = snapshot.val();
        }).catch(() => {
          results[path] = null;
        })
      );
      await Promise.all(promises);
      // Defensive: if EVERY path came back null/empty, the most likely cause is that the
      // Firebase SDK is silently failing (blocked socket, auth glitch). Treat it as
      // "no change" rather than wiping the user's localStorage-cached state with empties.
      const allEmpty = paths.every(p => {
        const v = results[p];
        return v == null || (typeof v === 'object' && Object.keys(v).length === 0);
      });
      if (allEmpty) return null;
      return { data: results, updatedAt: null };
    } else {
      return new Promise((resolve, reject) => {
        this.selfhosted.readBatch(paths).subscribe({
          next: (response) => resolve(response),  // null means 304 Not Modified
          error: reject
        });
      });
    }
  }

  getUpdatedAt(): Promise<string | null> {
    if (!this.connectivity.isOnline) {
      return Promise.resolve(null);
    }
    if (this.mode === 'firebase') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.selfhosted.getUpdatedAt().subscribe({
        next: (response) => resolve(response ? (response.updatedAt || null) : null),
        error: () => resolve(null)
      });
    });
  }

  /**
   * Get the current database mode.
   * @returns {'firebase' | 'selfhosted'}
   */
  getMode(): 'firebase' | 'selfhosted' {
    return this.mode;
  }

  /**
   * Check if using self-hosted mode.
   * @returns {boolean}
   */
  isSelfhosted(): boolean {
    return this.mode === 'selfhosted';
  }

  /**
   * Clears all in-memory caches (read cache, ETag cache, dirty-tracker snapshots).
   * Must be called on logout so the next login fetches fresh data from the server.
   */
  clearAllCaches(): void {
    this.cacheService.clearAll();
    if (this.mode === 'selfhosted') {
      this.selfhosted.clearEtagCache();
      this.dirtyTracker.clearAll();
      this.dirtyTracker.clearAllSnapshots();
    }
  }

  /**
   * Delete the entire user data node from Firebase Realtime Database.
   * @param {string} uid - The user's Firebase UID.
   * @returns {Promise<void>}
   */
  deleteUserNode(uid: string): Promise<void> {
    this.db.database.goOnline();
    return this.db.database.ref(`users/${uid}`).remove();
  }

}

