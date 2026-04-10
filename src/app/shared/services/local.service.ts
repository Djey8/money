import { Injectable } from '@angular/core';
import { CrypticService } from './cryptic.service';


/**
 * Service for interacting with the local storage.
 */
@Injectable({
  providedIn: 'root'
})
export class LocalService {
  
  constructor(private cryptic: CrypticService) { }

  /**
   * Saves data to the local storage.
   * @param key - The key under which the data will be stored.
   * @param value - The value to be stored.
   */
  public saveData(key: string, value: any) {
    localStorage.setItem(key, this.cryptic.encrypt(value, 'local'));
  }

  /**
   * Retrieves data from the local storage.
   * @param key - The key under which the data is stored.
   * @returns The retrieved data.
   */
  public getData(key: string) {
    let data = localStorage.getItem(key) || "";
    return this.cryptic.decrypt(data, 'local');
  }

  /**
   * Removes data from the local storage.
   * @param key - The key under which the data is stored.
   */
  public removeData(key: string) {
    localStorage.removeItem(key);
  }

  /**
   * Clears all data from the local storage.
   */
  public clearData() {
    localStorage.clear();
  }
}
