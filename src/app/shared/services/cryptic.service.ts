import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../../environments/environment';

const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_SIZE = 8; // 8 words = 32 bytes = 256 bits
const V2_PREFIX = 'v2:';

@Injectable({
  providedIn: 'root'
})
/**
 * Encryption service using AES-256-CBC with PBKDF2-SHA256 key derivation
 * and HMAC-SHA256 authentication. Maintains backward compatibility with
 * legacy CryptoJS passphrase-encrypted data.
 */
export class CrypticService {
  private key: string;
  encryptionLocalEnabled: boolean;
  encryptionDatabaseEnabled: boolean;

  private derivedKeyCache = new Map<string, CryptoJS.lib.WordArray>();
  private sessionSalt: CryptoJS.lib.WordArray | null = null;

  /** Key found in localStorage during init — needs migration to server. */
  public _pendingMigrationKey: string | null = null;
  /** Flags from localStorage captured alongside _pendingMigrationKey for migration. */
  public _pendingMigrationEncryptLocal: boolean | null = null;
  public _pendingMigrationEncryptDatabase: boolean | null = null;

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
    if (environment.mode === 'selfhosted') {
      // Selfhosted: key is fetched from server, kept in memory only.
      // Preserve any pre-existing localStorage key + flags for migration to server.
      const legacyKey = localStorage.getItem('encryptKey');
      this._pendingMigrationKey = (legacyKey && legacyKey !== 'default') ? legacyKey : null;
      if (this._pendingMigrationKey) {
        this._pendingMigrationEncryptLocal = localStorage.getItem('encryptLocal') === 'true';
        this._pendingMigrationEncryptDatabase = localStorage.getItem('encryptDatabase') === 'true';
      }
      localStorage.removeItem('encryptKey');
      // Use sessionStorage-cached key for instant decrypt on page refresh
      const cached = sessionStorage.getItem('encryptKey');
      this.key = (cached && cached !== 'default') ? cached : null as any;
    } else {
      // Firebase: key persists in localStorage (no backend to store it)
      sessionStorage.removeItem('encryptKey'); // clean up any stale session cache
      const stored = localStorage.getItem('encryptKey');
      this.key = (stored && stored !== 'default') ? stored : null as any;
    }

    const encryptLocal = localStorage.getItem('encryptLocal');
    this.encryptionLocalEnabled = encryptLocal === "true" ? true : false;

    const encryptDatabase = localStorage.getItem('encryptDatabase');
    this.encryptionDatabaseEnabled = encryptDatabase === "true" ? true : false;
  }

  /**
   * Load encryption config from a server response (login, register, refresh, or GET /encryption-config).
   * Key is kept in memory only — never written to localStorage or sessionStorage.
   */
  public loadFromServer(config: { key: string; encryptLocal: boolean; encryptDatabase: boolean } | null): void {
    if (!config) return;
    const serverKey = (config.key && config.key !== 'default') ? config.key : null;

    // Migration: server has no real key but localStorage had one → use the old key + flags
    if (!serverKey && this._pendingMigrationKey) {
      this.key = this._pendingMigrationKey;
      // Preserve localStorage flags — server has defaults, not the user's real settings
      this.derivedKeyCache.clear();
      this.sessionSalt = null;
      if (this._pendingMigrationEncryptLocal !== null) {
        this.encryptionLocalEnabled = this._pendingMigrationEncryptLocal;
        localStorage.setItem('encryptLocal', this.encryptionLocalEnabled.toString());
      }
      if (this._pendingMigrationEncryptDatabase !== null) {
        this.encryptionDatabaseEnabled = this._pendingMigrationEncryptDatabase;
        localStorage.setItem('encryptDatabase', this.encryptionDatabaseEnabled.toString());
      }
      // _pendingMigrationKey is consumed by the caller to push it to the server
    } else {
      this.key = serverKey;
      this._pendingMigrationKey = null; // server already has the right key
      this._pendingMigrationEncryptLocal = null;
      this._pendingMigrationEncryptDatabase = null;

      this.derivedKeyCache.clear();
      this.sessionSalt = null;
      this.encryptionLocalEnabled = !!config.encryptLocal;
      localStorage.setItem('encryptLocal', this.encryptionLocalEnabled.toString());
      this.encryptionDatabaseEnabled = !!config.encryptDatabase;
      localStorage.setItem('encryptDatabase', this.encryptionDatabaseEnabled.toString());
    }
    // Cache key in sessionStorage for instant decrypt on next page refresh
    if (environment.mode === 'selfhosted') {
      sessionStorage.setItem('encryptKey', this.key || 'default');
    }
  }

  public updateConfig(key: string, encryptLocal: boolean, encryptDatabase: boolean): void {
    this.key = (key && key !== 'default') ? key : null;
    this.derivedKeyCache.clear();
    this.sessionSalt = null;
    // Firebase: persist key in localStorage (no backend). Selfhosted: memory-only.
    if (environment.mode !== 'selfhosted') {
      localStorage.setItem('encryptKey', key || 'default');
    }
    this.encryptionLocalEnabled = encryptLocal;
    localStorage.setItem('encryptLocal', encryptLocal.toString());
    this.encryptionDatabaseEnabled = encryptDatabase;
    localStorage.setItem('encryptDatabase', encryptDatabase.toString());
  }

  /**
   * Wipe all encryption state (key + toggles) from memory and storage.
   * Called on logout to ensure no sensitive data lingers.
   */
  public clearConfig(): void {
    this.key = 'default';
    this.derivedKeyCache.clear();
    this.sessionSalt = null;
    this.encryptionLocalEnabled = false;
    this.encryptionDatabaseEnabled = false;
    localStorage.removeItem('encryptKey');
    localStorage.removeItem('encryptLocal');
    localStorage.removeItem('encryptDatabase');
    sessionStorage.removeItem('encryptKey');
  }

  private getDerivedKey(salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
    const saltHex = CryptoJS.enc.Hex.stringify(salt);
    const cached = this.derivedKeyCache.get(saltHex);
    if (cached) return cached;

    const key = CryptoJS.PBKDF2(this.key, salt, {
      keySize: PBKDF2_KEY_SIZE,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
    this.derivedKeyCache.set(saltHex, key);
    return key;
  }

  private getSessionSalt(): CryptoJS.lib.WordArray {
    if (!this.sessionSalt) {
      this.sessionSalt = CryptoJS.lib.WordArray.random(16);
    }
    return this.sessionSalt;
  }

  public encrypt(txt: string, location: string): string {
    const shouldEncrypt = (location === 'local' && this.encryptionLocalEnabled) ||
                          (location === 'database' && this.encryptionDatabaseEnabled);
    if (!shouldEncrypt || !this.key) return txt;

    const salt = this.getSessionSalt();
    const iv = CryptoJS.lib.WordArray.random(16);
    const derivedKey = this.getDerivedKey(salt);

    const encrypted = CryptoJS.AES.encrypt(txt, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const ciphertextWA = encrypted.ciphertext;
    const payload = salt.clone().concat(iv).concat(ciphertextWA);
    const hmac = CryptoJS.HmacSHA256(payload, derivedKey);

    // Format: "v2:" + base64(salt[16] + iv[16] + hmac[32] + ciphertext)
    const result = salt.clone().concat(iv).concat(hmac).concat(ciphertextWA);
    return V2_PREFIX + CryptoJS.enc.Base64.stringify(result);
  }

  public decrypt(txtToDecrypt: string, location: string): string {
    try {
      const shouldDecrypt = (location === 'local' && this.encryptionLocalEnabled) ||
                            (location === 'database' && this.encryptionDatabaseEnabled);
      if (!shouldDecrypt || !this.key) {
        // If data looks encrypted but we can't decrypt (no key yet, or decryption disabled),
        // return empty string instead of leaking the raw ciphertext blob
        if (txtToDecrypt.startsWith(V2_PREFIX)) return '';
        return txtToDecrypt;
      }

      if (txtToDecrypt.startsWith(V2_PREFIX)) {
        return this.decryptV2(txtToDecrypt.slice(V2_PREFIX.length));
      } else {
        return this.decryptLegacy(txtToDecrypt);
      }
    } catch (error) {
      console.warn('Decryption failed for location:', location, 'Error:', error);
      return '';
    }
  }

  private decryptV2(base64Data: string): string {
    const data = CryptoJS.enc.Base64.parse(base64Data);
    const words = data.words;
    const totalBytes = data.sigBytes;
    if (totalBytes < 64) throw new Error('Invalid v2 ciphertext: too short');

    const salt = CryptoJS.lib.WordArray.create(words.slice(0, 4), 16);
    const iv = CryptoJS.lib.WordArray.create(words.slice(4, 8), 16);
    const storedHmac = CryptoJS.lib.WordArray.create(words.slice(8, 16), 32);
    const ciphertext = CryptoJS.lib.WordArray.create(words.slice(16), totalBytes - 64);

    const derivedKey = this.getDerivedKey(salt);

    // Verify HMAC before decrypting
    const payload = salt.clone().concat(iv).concat(ciphertext);
    const computedHmac = CryptoJS.HmacSHA256(payload, derivedKey);
    if (CryptoJS.enc.Hex.stringify(computedHmac) !== CryptoJS.enc.Hex.stringify(storedHmac)) {
      throw new Error('HMAC verification failed');
    }

    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertext });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  private decryptLegacy(txtToDecrypt: string): string {
    return CryptoJS.AES.decrypt(txtToDecrypt, this.key).toString(CryptoJS.enc.Utf8);
  }
}
