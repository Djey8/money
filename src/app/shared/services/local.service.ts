import { Injectable } from '@angular/core';
import { CrypticService } from './cryptic.service';

/**
 * Service for interacting with the local storage.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalService {
  /**
   * Keys whose data the app is showing from somewhere else right now (a shared game table's books, held in memory): pages read
   * their cached lists from here while they are built, so these keys answer with what is on screen instead of the account's own
   * cache, and are never written - the account's cache must come out of it untouched. Null when nothing is shadowed.
   */
  static shadow: Record<string, () => unknown> | null = null;

  constructor(private cryptic: CrypticService) {}

  /**
   * Saves data to the local storage.
   * @param key - The key under which the data will be stored.
   * @param value - The value to be stored.
   */
  public saveData(key: string, value: any) {
    if (LocalService.shadow && key in LocalService.shadow) return;
    const encrypted = this.cryptic.encrypt(value, 'local');
    try {
      localStorage.setItem(key, encrypted);
    } catch (error) {
      // The account's own data outranks the game's undo history, which is only a best-effort copy: make room, then retry once.
      for (const cache of ['cashflowUndoStack', 'cashflowUndoStackAt'])
        localStorage.removeItem(cache);
      try {
        localStorage.setItem(key, encrypted);
      } catch {
        throw error;
      }
    }
  }

  /**
   * Retrieves data from the local storage.
   * @param key - The key under which the data is stored.
   * @returns The retrieved data.
   */
  public getData(key: string) {
    if (LocalService.shadow && key in LocalService.shadow) {
      const shown = LocalService.shadow[key]();
      return typeof shown === 'string' ? shown : JSON.stringify(shown ?? []);
    }
    const data = localStorage.getItem(key) || '';
    return this.cryptic.decrypt(data, 'local');
  }

  /**
   * Removes data from the local storage.
   * @param key - The key under which the data is stored.
   */
  public removeData(key: string) {
    if (LocalService.shadow && key in LocalService.shadow) return;
    localStorage.removeItem(key);
  }

  /**
   * Clears all data from the local storage.
   */
  public clearData() {
    localStorage.clear();
  }
}
