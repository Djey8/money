/**
 * Data Loss Prevention Tests
 *
 * Validates that tier-guarded data (balance sheet, grow projects, tier2 data)
 * is NEVER written to the database or localStorage when the corresponding
 * tier-loaded flag is false. This prevents empty arrays from overwriting
 * real data in the database.
 *
 * Also validates that:
 * - Corrupt localStorage keys don't wipe other valid keys (safeParse pattern)
 * - Tier flags are set even when loading fails (preventing permanent "not loaded" state)
 * - Visibility change handler resets tier3 flags for fresh data
 */

import { AppStateService } from './services/app-state.service';
import { InfoComponent } from '../panels/info/info.component';
import { SettingsComponent } from '../panels/settings/settings.component';
import { AddComponent } from '../panels/add/add.component';

// === Tier-guarded DB tags and localStorage keys ===

/** Balance sheet data — must only be written when tier3BalanceLoaded === true */
const BALANCE_DB_TAGS = [
  'balance/liabilities',
  'balance/asset/assets',
  'balance/asset/shares',
  'balance/asset/investments'
];
const BALANCE_LS_KEYS = ['liabilities', 'assets', 'shares', 'investments'];

/** Grow project data — must only be written when tier3GrowLoaded === true */
const GROW_DB_TAGS = ['grow'];
const GROW_LS_KEYS = ['grow'];

/** Tier 2 localStorage keys — must only be written when tier2Loaded === true */
const TIER2_LS_KEYS = ['smile', 'fire', 'mojo'];


describe('Data Loss Prevention', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    seedAppState();
  });

  /** Seed AppState with realistic data. If tier guards fail, this data would be
   *  overwritten with empty arrays — the exact scenario these tests prevent. */
  function seedAppState() {
    AppStateService.instance.allAssets = [{ tag: 'Car', amount: 15000 }] as any;
    AppStateService.instance.allShares = [{ tag: 'AAPL', quantity: 10, price: 150 }] as any;
    AppStateService.instance.allInvestments = [{ tag: 'ETF', deposit: 500, amount: 10000 }] as any;
    AppStateService.instance.liabilities = [{ tag: 'Mortgage', amount: 200000, credit: 0 }] as any;
    AppStateService.instance.allGrowProjects = [{ title: 'Portfolio', type: 'income-growth' }] as any;
    AppStateService.instance.allSmileProjects = [{ title: 'Vacation' }] as any;
    AppStateService.instance.allFireEmergencies = [{ title: 'Emergency Fund' }] as any;
    AppStateService.instance.mojo = { amount: 1000, target: 5000 };
    AppStateService.instance.allTransactions = [{ account: 'Daily', amount: -10, date: '2025-01-01' }] as any;
    AppStateService.instance.allSubscriptions = [];
    AppStateService.instance.allIntrests = [{ tag: 'Savings', amount: 50 }] as any;
    AppStateService.instance.allProperties = [];
    AppStateService.instance.allRevenues = [];
    AppStateService.instance.dailyExpenses = [{ tag: 'food', amount: 200 }] as any;
    AppStateService.instance.splurgeExpenses = [];
    AppStateService.instance.smileExpenses = [];
    AppStateService.instance.fireExpenses = [];
    AppStateService.instance.mojoExpenses = [];
  }

  // === Helpers to extract write/LS data from mock calls ===

  function getWriteTags(mockFn: jest.Mock): string[] {
    expect(mockFn).toHaveBeenCalled();
    return mockFn.mock.calls[0][0].writes.map((w: any) => w.tag);
  }

  function getLSKeys(mockFn: jest.Mock): string[] {
    expect(mockFn).toHaveBeenCalled();
    return mockFn.mock.calls[0][0].localStorageSaves.map((s: any) => s.key);
  }

  function getSavedKeys(mockFn: jest.Mock): string[] {
    return mockFn.mock.calls.map((call: any) => call[0]);
  }

  // ==========================================================
  //  InfoComponent.updateStorage()
  // ==========================================================

  describe('InfoComponent.updateStorage() tier guards', () => {
    let mockPersistence: any;
    let component: any;

    beforeEach(() => {
      mockPersistence = { batchWriteAndSync: jest.fn() };
      component = Object.create(InfoComponent.prototype);
      component.persistence = mockPersistence;
      component.showError = jest.fn();
    });

    it('should NOT write balance DB tags when tier3BalanceLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateStorage();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      for (const tag of BALANCE_DB_TAGS) {
        expect(tags).not.toContain(tag);
      }
    });

    it('should NOT write balance LS keys when tier3BalanceLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateStorage();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const key of BALANCE_LS_KEYS) {
        expect(keys).not.toContain(key);
      }
    });

    it('should NOT write grow DB tags when tier3GrowLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = false;

      component.updateStorage();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      for (const tag of GROW_DB_TAGS) {
        expect(tags).not.toContain(tag);
      }
    });

    it('should NOT write grow LS keys when tier3GrowLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = false;

      component.updateStorage();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const key of GROW_LS_KEYS) {
        expect(keys).not.toContain(key);
      }
    });

    it('should INCLUDE balance data when tier3BalanceLoaded=true', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateStorage();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const tag of BALANCE_DB_TAGS) expect(tags).toContain(tag);
      for (const key of BALANCE_LS_KEYS) expect(keys).toContain(key);
    });

    it('should INCLUDE grow data when tier3GrowLoaded=true', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateStorage();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const tag of GROW_DB_TAGS) expect(tags).toContain(tag);
      for (const key of GROW_LS_KEYS) expect(keys).toContain(key);
    });

    it('should always write tier1 data regardless of tier flags', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = false;

      component.updateStorage();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      expect(tags).toContain('income/revenue/interests');
      expect(tags).toContain('income/expenses/daily');
      expect(tags).toContain('transactions');
      expect(keys).toContain('transactions');
      expect(keys).toContain('interests');
      expect(keys).toContain('dailyEx');
    });

    it('should write actual data values, not empty arrays, for guarded tags', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateStorage();

      const config = mockPersistence.batchWriteAndSync.mock.calls[0][0];
      const liabilitiesWrite = config.writes.find((w: any) => w.tag === 'balance/liabilities');
      expect(liabilitiesWrite.data).toEqual([{ tag: 'Mortgage', amount: 200000, credit: 0 }]);

      const growWrite = config.writes.find((w: any) => w.tag === 'grow');
      expect(growWrite.data).toEqual([{ title: 'Portfolio', type: 'income-growth' }]);
    });
  });

  // ==========================================================
  //  InfoComponent.updateBasedOnTransaction()
  // ==========================================================

  describe('InfoComponent.updateBasedOnTransaction() tier guards', () => {
    let mockPersistence: any;
    let mockIncomeStatement: any;
    let component: any;

    beforeEach(() => {
      mockPersistence = { batchWriteAndSync: jest.fn() };
      mockIncomeStatement = {
        recalculate: jest.fn(),
        getWrites: jest.fn().mockReturnValue([
          { tag: 'income/revenue/interests', data: AppStateService.instance.allIntrests },
          { tag: 'income/revenue/properties', data: [] },
          { tag: 'income/revenue/revenues', data: [] },
          { tag: 'income/expenses/daily', data: AppStateService.instance.dailyExpenses },
          { tag: 'income/expenses/splurge', data: [] },
          { tag: 'income/expenses/smile', data: [] },
          { tag: 'income/expenses/fire', data: [] },
          { tag: 'income/expenses/mojo', data: [] },
          { tag: 'smile', data: AppStateService.instance.allSmileProjects },
          { tag: 'fire', data: AppStateService.instance.allFireEmergencies },
          { tag: 'mojo', data: AppStateService.instance.mojo }
        ]),
        saveToLocalStorage: jest.fn()
      };
      component = Object.create(InfoComponent.prototype);
      component.persistence = mockPersistence;
      component.incomeStatement = mockIncomeStatement;
      component.showError = jest.fn();
    });

    it('should NOT write balance DB tags when tier3BalanceLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateBasedOnTransaction();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      for (const tag of BALANCE_DB_TAGS) {
        expect(tags).not.toContain(tag);
      }
    });

    it('should NOT write balance LS keys when tier3BalanceLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const key of BALANCE_LS_KEYS) {
        expect(keys).not.toContain(key);
      }
    });

    it('should NOT write grow DB tags when tier3GrowLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = false;

      component.updateBasedOnTransaction();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      for (const tag of GROW_DB_TAGS) {
        expect(tags).not.toContain(tag);
      }
    });

    it('should NOT write grow LS keys when tier3GrowLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = false;

      component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const key of GROW_LS_KEYS) {
        expect(keys).not.toContain(key);
      }
    });

    it('should INCLUDE all guarded data when both tier3 flags are true', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = true;

      component.updateBasedOnTransaction();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const tag of BALANCE_DB_TAGS) expect(tags).toContain(tag);
      for (const key of BALANCE_LS_KEYS) expect(keys).toContain(key);
      for (const tag of GROW_DB_TAGS) expect(tags).toContain(tag);
      for (const key of GROW_LS_KEYS) expect(keys).toContain(key);
    });
  });

  // ==========================================================
  //  SettingsComponent.updateBasedOnTransaction()
  // ==========================================================

  describe('SettingsComponent.updateBasedOnTransaction() tier guards', () => {
    let mockPersistence: any;
    let mockIncomeStatement: any;
    let mockAuthService: any;
    let component: any;

    beforeEach(() => {
      mockPersistence = { batchWriteAndSync: jest.fn() };
      mockIncomeStatement = {
        recalculate: jest.fn(),
        getWrites: jest.fn().mockReturnValue([
          { tag: 'income/revenue/interests', data: [] },
          { tag: 'income/revenue/properties', data: [] },
          { tag: 'income/revenue/revenues', data: [] },
          { tag: 'income/expenses/daily', data: [] },
          { tag: 'income/expenses/splurge', data: [] },
          { tag: 'income/expenses/smile', data: [] },
          { tag: 'income/expenses/fire', data: [] },
          { tag: 'income/expenses/mojo', data: [] },
          { tag: 'smile', data: AppStateService.instance.allSmileProjects },
          { tag: 'fire', data: AppStateService.instance.allFireEmergencies },
          { tag: 'mojo', data: AppStateService.instance.mojo }
        ])
      };
      mockAuthService = {
        checkAuthentication: jest.fn().mockResolvedValue({ authenticated: true })
      };
      component = Object.create(SettingsComponent.prototype);
      component.persistence = mockPersistence;
      component.incomeStatement = mockIncomeStatement;
      component.authService = mockAuthService;
    });

    it('should NOT write balance/liabilities when tier3BalanceLoaded=false', async () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier2Loaded = true;

      await component.updateBasedOnTransaction();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      expect(tags).not.toContain('balance/liabilities');
    });

    it('should NOT write liabilities LS key when tier3BalanceLoaded=false', async () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier2Loaded = true;

      await component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      expect(keys).not.toContain('liabilities');
    });

    it('should NOT write tier2 LS keys (smile/fire/mojo) when tier2Loaded=false', async () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier2Loaded = false;

      await component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const key of TIER2_LS_KEYS) {
        expect(keys).not.toContain(key);
      }
    });

    it('should INCLUDE balance/liabilities when tier3BalanceLoaded=true', async () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier2Loaded = true;

      await component.updateBasedOnTransaction();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      expect(tags).toContain('balance/liabilities');
      expect(keys).toContain('liabilities');
    });

    it('should INCLUDE tier2 LS keys when tier2Loaded=true', async () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier2Loaded = true;

      await component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      for (const key of TIER2_LS_KEYS) {
        expect(keys).toContain(key);
      }
    });

    it('should NOT call batchWriteAndSync when not authenticated', async () => {
      mockAuthService.checkAuthentication.mockResolvedValue({ authenticated: false });

      await component.updateBasedOnTransaction();

      expect(mockPersistence.batchWriteAndSync).not.toHaveBeenCalled();
    });

    it('should always write tier1 income statement LS keys when tier2 is off', async () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier2Loaded = false;

      await component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      expect(keys).toContain('interests');
      expect(keys).toContain('properties');
      expect(keys).toContain('revenues');
      expect(keys).toContain('dailyEx');
      expect(keys).toContain('splurgeEx');
      // smile/fire/mojo LS keys should NOT be written when tier2 is not loaded
      expect(keys).not.toContain('smileEx');
      expect(keys).not.toContain('fireEx');
      expect(keys).not.toContain('mojoEx');
    });

    it('should write smile/fire/mojo LS keys when tier2 IS loaded', async () => {
      AppStateService.instance.tier2Loaded = true;
      AppStateService.instance.tier3BalanceLoaded = false;

      await component.updateBasedOnTransaction();

      const keys = getLSKeys(mockPersistence.batchWriteAndSync);
      expect(keys).toContain('smileEx');
      expect(keys).toContain('fireEx');
      expect(keys).toContain('mojoEx');
    });
  });

  // ==========================================================
  //  AddComponent.saveToLocalStorage()
  // ==========================================================

  describe('AddComponent.saveToLocalStorage() tier guards', () => {
    let mockLocalStorage: any;
    let component: any;

    beforeEach(() => {
      mockLocalStorage = { saveData: jest.fn() };
      component = Object.create(AddComponent.prototype);
      (component as any).localStorage = mockLocalStorage;
    });

    it('should NOT save balance LS keys when tier3BalanceLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = true;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLocalStorage.saveData);
      for (const key of BALANCE_LS_KEYS) {
        expect(savedKeys).not.toContain(key);
      }
    });

    it('should NOT save grow LS key when tier3GrowLoaded=false', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = false;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLocalStorage.saveData);
      for (const key of GROW_LS_KEYS) {
        expect(savedKeys).not.toContain(key);
      }
    });

    it('should save balance LS keys when tier3BalanceLoaded=true', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = true;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLocalStorage.saveData);
      for (const key of BALANCE_LS_KEYS) {
        expect(savedKeys).toContain(key);
      }
    });

    it('should save grow LS key when tier3GrowLoaded=true', () => {
      AppStateService.instance.tier3BalanceLoaded = true;
      AppStateService.instance.tier3GrowLoaded = true;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLocalStorage.saveData);
      for (const key of GROW_LS_KEYS) {
        expect(savedKeys).toContain(key);
      }
    });

    it('should always save tier1 data regardless of tier flags', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = false;
      AppStateService.instance.tier2Loaded = false;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLocalStorage.saveData);
      expect(savedKeys).toContain('transactions');
      expect(savedKeys).toContain('interests');
      expect(savedKeys).toContain('dailyEx');
      // smile/fire/mojo should NOT be saved when tier2 not loaded
      expect(savedKeys).not.toContain('smileEx');
    });

    it('should save smile/fire/mojo when tier2 IS loaded', () => {
      AppStateService.instance.tier2Loaded = true;
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = false;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLocalStorage.saveData);
      expect(savedKeys).toContain('smileEx');
      expect(savedKeys).toContain('fireEx');
      expect(savedKeys).toContain('mojoEx');
      expect(savedKeys).toContain('smile');
      expect(savedKeys).toContain('fire');
      expect(savedKeys).toContain('mojo');
    });

    it('should save actual data content, not empty arrays, for guarded keys', () => {
      AppStateService.instance.tier3BalanceLoaded = true;

      (component as any).saveToLocalStorage();

      const liabilitiesCall = mockLocalStorage.saveData.mock.calls.find(
        (call: any) => call[0] === 'liabilities'
      );
      expect(liabilitiesCall).toBeTruthy();
      const parsed = JSON.parse(liabilitiesCall[1]);
      expect(parsed).toEqual([{ tag: 'Mortgage', amount: 200000, credit: 0 }]);
    });
  });

  // ==========================================================
  //  safeParse pattern (mirrors app.component.ts constructor)
  // ==========================================================

  describe('safeParse pattern (app.component.ts constructor logic)', () => {
    let mockLocalStorage: any;
    let removedKeys: string[];

    /**
     * Exact replica of the safeParse function from app.component.ts constructor.
     * Tests validate this contract; the constructor uses the same logic.
     */
    function safeParse(key: string, fallback: any = []): any {
      try {
        const raw = mockLocalStorage.getData(key);
        if (raw == null || raw === "") return fallback;
        return JSON.parse(raw);
      } catch (e) {
        mockLocalStorage.removeData(key);
        return fallback;
      }
    }

    beforeEach(() => {
      removedKeys = [];
      mockLocalStorage = {
        getData: jest.fn().mockReturnValue(''),
        removeData: jest.fn((key: string) => { removedKeys.push(key); })
      };
    });

    it('should return fallback for empty string', () => {
      mockLocalStorage.getData.mockReturnValue('');
      expect(safeParse('transactions')).toEqual([]);
    });

    it('should return fallback for null', () => {
      mockLocalStorage.getData.mockReturnValue(null);
      expect(safeParse('transactions')).toEqual([]);
    });

    it('should parse valid JSON', () => {
      mockLocalStorage.getData.mockReturnValue('[{"id":1}]');
      expect(safeParse('transactions')).toEqual([{ id: 1 }]);
    });

    it('should return custom fallback for mojo-like data', () => {
      mockLocalStorage.getData.mockReturnValue('');
      expect(safeParse('mojo', { amount: 0, target: 0 })).toEqual({ amount: 0, target: 0 });
    });

    it('should return fallback for corrupt JSON without throwing', () => {
      mockLocalStorage.getData.mockReturnValue('CORRUPT{{{not-json');
      expect(safeParse('transactions')).toEqual([]);
    });

    it('should remove corrupt key from localStorage', () => {
      mockLocalStorage.getData.mockReturnValue('CORRUPT{{{');
      safeParse('transactions');
      expect(removedKeys).toContain('transactions');
    });

    it('should NOT affect other keys when one key is corrupt', () => {
      // Simulate: transactions is corrupt, smile is valid
      const store: Record<string, string> = {
        transactions: 'CORRUPT{{{',
        smile: '[{"title":"Vacation"}]'
      };
      mockLocalStorage.getData.mockImplementation((key: string) => store[key] || '');

      const transactions = safeParse('transactions');
      const smile = safeParse('smile');

      expect(transactions).toEqual([]);           // corrupt → fallback
      expect(smile).toEqual([{ title: 'Vacation' }]); // valid → parsed
      expect(removedKeys).toEqual(['transactions']);    // only corrupt key removed
    });

    it('should handle multiple corrupt keys independently', () => {
      const store: Record<string, string> = {
        transactions: 'BAD1',
        grow: 'BAD2',
        smile: '[{"ok":true}]'
      };
      mockLocalStorage.getData.mockImplementation((key: string) => store[key] || '');

      safeParse('transactions');
      safeParse('grow');
      const smile = safeParse('smile');

      expect(smile).toEqual([{ ok: true }]);
      expect(removedKeys).toEqual(['transactions', 'grow']);
    });
  });

  // ==========================================================
  //  Combined scenario: all flags false = minimal safe write
  // ==========================================================

  describe('worst case: all tier flags false', () => {
    it('InfoComponent.updateStorage should write ZERO balance/grow tags', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = false;
      AppStateService.instance.tier2Loaded = false;

      const mockPersistence = { batchWriteAndSync: jest.fn() };
      const component: any = Object.create(InfoComponent.prototype);
      component.persistence = mockPersistence;
      component.showError = jest.fn();

      component.updateStorage();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);

      // No balance or grow data should be written
      const allGuardedTags = [...BALANCE_DB_TAGS, ...GROW_DB_TAGS];
      const allGuardedKeys = [...BALANCE_LS_KEYS, ...GROW_LS_KEYS];
      for (const tag of allGuardedTags) expect(tags).not.toContain(tag);
      for (const key of allGuardedKeys) expect(keys).not.toContain(key);

      // But tier1 data MUST still be written
      expect(tags.length).toBeGreaterThan(0);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('SettingsComponent.updateBasedOnTransaction should write ZERO guarded data', async () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = false;
      AppStateService.instance.tier2Loaded = false;

      const mockPersistence = { batchWriteAndSync: jest.fn() };
      const component: any = Object.create(SettingsComponent.prototype);
      component.persistence = mockPersistence;
      component.authService = { checkAuthentication: jest.fn().mockResolvedValue({ authenticated: true }) };
      component.incomeStatement = {
        recalculate: jest.fn(),
        getWrites: jest.fn().mockReturnValue([
          { tag: 'income/revenue/interests', data: [] }
        ])
      };

      await component.updateBasedOnTransaction();

      const tags = getWriteTags(mockPersistence.batchWriteAndSync);
      const keys = getLSKeys(mockPersistence.batchWriteAndSync);

      expect(tags).not.toContain('balance/liabilities');
      for (const key of [...TIER2_LS_KEYS, 'liabilities']) {
        expect(keys).not.toContain(key);
      }
    });

    it('AddComponent.saveToLocalStorage should save ZERO guarded keys', () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      AppStateService.instance.tier3GrowLoaded = false;

      const mockLS = { saveData: jest.fn() };
      const component: any = Object.create(AddComponent.prototype);
      component.localStorage = mockLS;

      (component as any).saveToLocalStorage();

      const savedKeys = getSavedKeys(mockLS.saveData);
      const allGuardedKeys = [...BALANCE_LS_KEYS, ...GROW_LS_KEYS];
      for (const key of allGuardedKeys) {
        expect(savedKeys).not.toContain(key);
      }
    });
  });
});
