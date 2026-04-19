import { Injectable } from '@angular/core';
import *  as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
/**
 * Encryption service using AES (crypto-js) for local storage and database data.
 * Manages encryption keys and per-location (local/database) encryption toggles.
 */
export class CrypticService {
  private key: string;
  encryptionLocalEnabled: boolean;
  encryptionDatabaseEnabled: boolean;

  constructor() {
    this.loadConfig();
  }

  public getKey(): string {
    return this.key;
  }

  public getEncryptionLocalEnabled(): boolean {
    return this.encryptionLocalEnabled;
  }

  public getEncryptionDatabaseEnabled(): boolean {
    return this.encryptionDatabaseEnabled;
  }

  private loadConfig(): void {
    const storedKey = sessionStorage.getItem('encryptKey') || localStorage.getItem('encryptKey');
    this.key = (storedKey && storedKey !== 'default') ? storedKey : null;

    // Migrate key from localStorage to sessionStorage if present
    if (localStorage.getItem('encryptKey')) {
      sessionStorage.setItem('encryptKey', localStorage.getItem('encryptKey'));
      localStorage.removeItem('encryptKey');
    }

    const encryptLocal = localStorage.getItem('encryptLocal');
    this.encryptionLocalEnabled = encryptLocal === "true" ? true : false;

    const encryptDatabase = localStorage.getItem('encryptDatabase');
    this.encryptionDatabaseEnabled = encryptDatabase === "true" ? true : false;
  }

  public updateConfig(key: string, encryptLocal: boolean, encryptDatabase: boolean): void {
    this.key = (key && key !== 'default') ? key : null;
    sessionStorage.setItem('encryptKey', key);
    this.encryptionLocalEnabled = encryptLocal;
    localStorage.setItem('encryptLocal', encryptLocal.toString());
    this.encryptionDatabaseEnabled = encryptDatabase;
    localStorage.setItem('encryptDatabase', encryptDatabase.toString());
  }

  

  public encrypt(txt: string, location: string): string {
    if (location === "local" && this.encryptionLocalEnabled) {
      return CryptoJS.AES.encrypt(txt, this.key).toString();
    } else if (location === "database" && this.encryptionDatabaseEnabled) {
      return CryptoJS.AES.encrypt(txt, this.key).toString();
    } else {
      return txt;
    }
  }

  public decrypt(txtToDecrypt: string, location: string): string {
    try {
      if (location === "local" && this.encryptionLocalEnabled) {
        return CryptoJS.AES.decrypt(txtToDecrypt, this.key).toString(CryptoJS.enc.Utf8);
      } else if (location === "database" && this.encryptionDatabaseEnabled) {
        return CryptoJS.AES.decrypt(txtToDecrypt, this.key).toString(CryptoJS.enc.Utf8);
      } else {
        return txtToDecrypt;
      }
    } catch (error) {
      console.warn('Decryption failed for location:', location, 'Error:', error);
      // Return empty string if decryption fails (corrupted or wrong key)
      return '';
    }
  }
}
