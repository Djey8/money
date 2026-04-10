import { CrypticService } from './cryptic.service';

describe('CrypticService', () => {
  let service: CrypticService;

  beforeEach(() => {
    localStorage.clear();
    service = new CrypticService();
  });

  // --- constructor / loadConfig -------------------------------------------

  describe('loadConfig()', () => {
    it('uses stored key when present', () => {
      localStorage.setItem('encryptKey', 'myKey');
      const s = new CrypticService();
      expect(s.getKey()).toBe('myKey');
    });

    it('uses default key when stored value is "default"', () => {
      localStorage.setItem('encryptKey', 'default');
      const s = new CrypticService();
      expect(s.getKey()).toBe(s.getDefaultKey());
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

  // --- updateConfig -------------------------------------------------------

  describe('updateConfig()', () => {
    it('updates key and persists to localStorage', () => {
      service.updateConfig('newKey', false, false);
      expect(service.getKey()).toBe('newKey');
      expect(localStorage.getItem('encryptKey')).toBe('newKey');
    });

    it('converts "default" to the default key', () => {
      service.updateConfig('default', false, false);
      expect(service.getKey()).toBe(service.getDefaultKey());
    });

    it('persists encryption toggles', () => {
      service.updateConfig('k', true, true);
      expect(localStorage.getItem('encryptLocal')).toBe('true');
      expect(localStorage.getItem('encryptDatabase')).toBe('true');
    });
  });

  // --- encrypt / decrypt --------------------------------------------------

  describe('encrypt() + decrypt()', () => {
    beforeEach(() => {
      service.updateConfig('testKey', true, true);
    });

    it('encrypts and decrypts for "local" location', () => {
      const cipher = service.encrypt('secret', 'local');
      expect(cipher).not.toBe('secret');
      expect(service.decrypt(cipher, 'local')).toBe('secret');
    });

    it('encrypts and decrypts for "database" location', () => {
      const cipher = service.encrypt('dbSecret', 'database');
      expect(cipher).not.toBe('dbSecret');
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
  });
});
