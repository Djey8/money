import { CrypticService } from './cryptic.service';
import * as CryptoJS from 'crypto-js';

describe('CrypticService', () => {
  let service: CrypticService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    service = new CrypticService();
  });

  // --- constructor / loadConfig (default env = Firebase mode) ---------------

  describe('loadConfig()', () => {
    it('restores key from localStorage in Firebase mode', () => {
      localStorage.setItem('encryptKey', 'myKey');
      const s = new CrypticService();
      expect(s.getKey()).toBe('myKey');
    });

    it('clears legacy encryptKey from sessionStorage on init', () => {
      sessionStorage.setItem('encryptKey', 'sessionKey');
      const s = new CrypticService();
      expect(sessionStorage.getItem('encryptKey')).toBeNull();
    });

    it('returns null when stored value is "default"', () => {
      localStorage.setItem('encryptKey', 'default');
      const s = new CrypticService();
      expect(s.getKey()).toBeNull();
    });

    it('defaults encryption toggles to false', () => {
      expect(service.getEncryptionLocalEnabled()).toBe(false);
      expect(service.getEncryptionDatabaseEnabled()).toBe(false);
    });

    it('reads encryption toggles from localStorage', () => {
      localStorage.setItem('encryptLocal', 'true');
      localStorage.setItem('encryptDatabase', 'true');
      const s = new CrypticService();
      expect(s.getEncryptionLocalEnabled()).toBe(true);
      expect(s.getEncryptionDatabaseEnabled()).toBe(true);
    });
  });

  // --- loadFromServer -----------------------------------------------------

  describe('loadFromServer()', () => {
    it('sets key and toggles from server config', () => {
      service.loadFromServer({ key: 'serverKey', encryptLocal: true, encryptDatabase: true });
      expect(service.getKey()).toBe('serverKey');
      expect(service.getEncryptionLocalEnabled()).toBe(true);
      expect(service.getEncryptionDatabaseEnabled()).toBe(true);
    });

    it('sets key to null when server sends "default"', () => {
      service.loadFromServer({ key: 'default', encryptLocal: true, encryptDatabase: false });
      expect(service.getKey()).toBeNull();
    });

    it('does not write key to localStorage or sessionStorage', () => {
      service.loadFromServer({ key: 'secret', encryptLocal: false, encryptDatabase: false });
      expect(localStorage.getItem('encryptKey')).toBeNull();
      expect(sessionStorage.getItem('encryptKey')).toBeNull();
    });

    it('does nothing when config is null', () => {
      service.loadFromServer(null);
      expect(service.getKey()).toBeNull();
    });
  });

  // --- updateConfig (Firebase mode: persists key to localStorage) ----------

  describe('updateConfig()', () => {
    it('updates key and persists to localStorage in Firebase mode', () => {
      service.updateConfig('newKey', false, false);
      expect(service.getKey()).toBe('newKey');
      expect(localStorage.getItem('encryptKey')).toBe('newKey');
    });

    it('stores "default" as null key', () => {
      service.updateConfig('default', false, false);
      expect(service.getKey()).toBeNull();
      expect(localStorage.getItem('encryptKey')).toBe('default');
    });

    it('persists encryption toggles to localStorage', () => {
      service.updateConfig('k', true, true);
      expect(localStorage.getItem('encryptLocal')).toBe('true');
      expect(localStorage.getItem('encryptDatabase')).toBe('true');
    });
  });

  // --- clearConfig --------------------------------------------------------

  describe('clearConfig()', () => {
    it('wipes key and toggles from memory and storage', () => {
      service.updateConfig('myKey', true, true);
      expect(service.getKey()).toBe('myKey');
      expect(localStorage.getItem('encryptKey')).toBe('myKey');

      service.clearConfig();

      expect(service.getKey()).toBe('default');
      expect(service.getEncryptionLocalEnabled()).toBe(false);
      expect(service.getEncryptionDatabaseEnabled()).toBe(false);
      expect(localStorage.getItem('encryptKey')).toBeNull();
      expect(localStorage.getItem('encryptLocal')).toBeNull();
      expect(localStorage.getItem('encryptDatabase')).toBeNull();
    });
  });

  // --- encrypt / decrypt (v2 PBKDF2 format) ------------------------------

  describe('encrypt() + decrypt()', () => {
    beforeEach(() => {
      service.updateConfig('testKey', true, true);
    });

    it('encrypts and decrypts for "local" location', () => {
      const cipher = service.encrypt('secret', 'local');
      expect(cipher).not.toBe('secret');
      expect(cipher.startsWith('v2:')).toBe(true);
      expect(service.decrypt(cipher, 'local')).toBe('secret');
    });

    it('encrypts and decrypts for "database" location', () => {
      const cipher = service.encrypt('dbSecret', 'database');
      expect(cipher).not.toBe('dbSecret');
      expect(cipher.startsWith('v2:')).toBe(true);
      expect(service.decrypt(cipher, 'database')).toBe('dbSecret');
    });

    it('returns plaintext when local encryption is disabled', () => {
      service.updateConfig('testKey', false, true);
      expect(service.encrypt('plain', 'local')).toBe('plain');
      expect(service.decrypt('plain', 'local')).toBe('plain');
    });

    it('returns plaintext when database encryption is disabled', () => {
      service.updateConfig('testKey', true, false);
      expect(service.encrypt('plain', 'database')).toBe('plain');
      expect(service.decrypt('plain', 'database')).toBe('plain');
    });

    it('returns empty string when decryption fails (wrong key)', () => {
      const cipher = service.encrypt('secret', 'local');
      service.updateConfig('wrongKey', true, false);
      expect(service.decrypt(cipher, 'local')).toBe('');
    });

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const cipher1 = service.encrypt('same', 'database');
      const cipher2 = service.encrypt('same', 'database');
      expect(cipher1).not.toBe(cipher2);
    });
  });

  // --- backward compatibility with legacy CryptoJS format -----------------

  describe('legacy decrypt', () => {
    beforeEach(() => {
      service.updateConfig('testKey', true, true);
    });

    it('decrypts legacy CryptoJS passphrase-encrypted data', () => {
      const legacyCipher = CryptoJS.AES.encrypt('legacyData', 'testKey').toString();
      expect(legacyCipher.startsWith('v2:')).toBe(false);
      expect(service.decrypt(legacyCipher, 'database')).toBe('legacyData');
    });

    it('decrypts legacy CryptoJS data for local location', () => {
      const legacyCipher = CryptoJS.AES.encrypt('localLegacy', 'testKey').toString();
      expect(service.decrypt(legacyCipher, 'local')).toBe('localLegacy');
    });
  });

  // --- HMAC tamper detection ----------------------------------------------

  describe('HMAC authentication', () => {
    beforeEach(() => {
      service.updateConfig('testKey', true, true);
    });

    it('detects tampered ciphertext via HMAC', () => {
      const cipher = service.encrypt('secret', 'database');
      // Corrupt one character in the base64 payload (after "v2:" prefix)
      const base64 = cipher.slice(3);
      const chars = base64.split('');
      // Flip a character deep in the ciphertext (past salt+iv+hmac header)
      const idx = Math.min(90, chars.length - 2);
      chars[idx] = chars[idx] === 'A' ? 'B' : 'A';
      const tampered = 'v2:' + chars.join('');
      expect(service.decrypt(tampered, 'database')).toBe('');
    });
  });
});
