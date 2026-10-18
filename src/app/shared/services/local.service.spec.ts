import { LocalService } from './local.service';
import { CrypticService } from './cryptic.service';

describe('LocalService', () => {
  let service: LocalService;
  let cryptic: CrypticService;

  beforeEach(() => {
    localStorage.clear();
    // Enable local encryption for realistic tests
    localStorage.setItem('encryptKey', 'testKey123');
    localStorage.setItem('encryptLocal', 'true');
    cryptic = new CrypticService();
    service = new LocalService(cryptic);
  });

  describe('saveData() + getData()', () => {
    it('stores and retrieves a string value', () => {
      service.saveData('name', 'Alice');
      expect(service.getData('name')).toBe('Alice');
    });

    it('encrypts data before storing', () => {
      service.saveData('secret', 'myPassword');
      const raw = localStorage.getItem('secret');
      expect(raw).not.toBe('myPassword');
    });

    it('returns empty string for missing key', () => {
      expect(service.getData('nonexistent')).toBe('');
    });
  });

  describe('with encryption disabled', () => {
    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('encryptLocal', 'false');
      cryptic = new CrypticService();
      service = new LocalService(cryptic);
    });

    it('stores plaintext when encryption is disabled', () => {
      service.saveData('key', 'value');
      expect(localStorage.getItem('key')).toBe('value');
    });

    it('retrieves plaintext when encryption is disabled', () => {
      localStorage.setItem('key', 'value');
      expect(service.getData('key')).toBe('value');
    });
  });

  describe('removeData()', () => {
    it('removes the item from localStorage', () => {
      localStorage.setItem('x', 'y');
      service.removeData('x');
      expect(localStorage.getItem('x')).toBeNull();
    });
  });

  describe('clearData()', () => {
    it('clears all localStorage', () => {
      localStorage.setItem('a', '1');
      localStorage.setItem('b', '2');
      service.clearData();
      expect(localStorage.length).toBe(0);
    });
  });

  describe('shadow (data shown from somewhere else)', () => {
    afterEach(() => {
      LocalService.shadow = null;
    });

    it('answers a shadowed key with what is on screen and leaves the real cache alone', () => {
      service.saveData('grow', JSON.stringify([{ title: 'MINE' }]));
      LocalService.shadow = { grow: () => [{ title: 'TABLE' }], dailyR: () => '40' };
      expect(JSON.parse(service.getData('grow'))).toEqual([{ title: 'TABLE' }]);
      expect(service.getData('dailyR')).toBe('40');
      service.saveData('grow', JSON.stringify([{ title: 'OVERWRITE' }]));
      service.removeData('grow');
      LocalService.shadow = null;
      expect(JSON.parse(service.getData('grow'))).toEqual([{ title: 'MINE' }]);
    });

    it('lets every other key through, read and written', () => {
      LocalService.shadow = { grow: () => [] };
      service.saveData('isShares', 'true');
      expect(service.getData('isShares')).toBe('true');
    });
  });
});
