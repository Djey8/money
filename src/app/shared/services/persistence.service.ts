import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { LocalService } from './local.service';
import { FrontendLoggerService } from './frontend-logger.service';
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

@Injectable({
  providedIn: 'root'
})
/**
 * Unified write service that handles firebase-vs-selfhosted persistence logic.
 * Provides `writeAndSync` for single writes and `batchWriteAndSync` for bulk writes,
 * each handling local storage saves, database writes, and frontend logging.
 */
export class PersistenceService {

  constructor(
    private database: DatabaseService,
    private localStorage: LocalService,
    private frontendLogger: FrontendLoggerService
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

      const writeResult = this.database.writeObject(config.tag, config.data);

      const handleSuccess = () => {
        this.frontendLogger.logActivity(config.logEvent, 'info', config.logMetadata);
        config.onSuccess();
      };

      // writeResult is now always an Observable (both Firebase and selfhosted)
      if (writeResult) {
        writeResult.subscribe({
          next: handleSuccess,
          error: (error: any) => config.onError(error)
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

      if (environment.mode === 'selfhosted') {
        this.database.batchWrite(config.writes, config.forceWrite).subscribe({
          next: () => handleSuccess(),
          error: (error: any) => config.onError?.(error)
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
