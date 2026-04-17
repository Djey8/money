// Mock heavy dependencies BEFORE they get resolved via AppDataService imports.
// jest.mock() calls are hoisted above imports by Jest.
jest.mock('@angular/fire/compat/auth', () => ({ AngularFireAuth: class {} }));
jest.mock('@angular/core', () => {
  const actual = jest.requireActual('@angular/core');
  return { ...actual, Injectable: () => (c: any) => c };
});
jest.mock('../../main/accounting/accounting.component', () => ({
  AccountingComponent: class {
    static allTransactions: any[] = [];
    static dataSource = { data: [] as any[] };
  }
}));
jest.mock('../../main/subscription/subscription.component', () => ({
  SubscriptionComponent: class {
    static allSubscriptions: any[] = [];
    static activeDataSource = { data: [] as any[] };
    static inactiveDataSource = { data: [] as any[] };
  }
}));
jest.mock('../../main/fire/fire-emergencies/fire-emergencies.component', () => ({
  FireEmergenciesComponent: class {
    static allSearchedFireEmergencies: any[] = [];
  }
}));
jest.mock('./database.service', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./cryptic.service', () => ({
  CrypticService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./persistence.service', () => ({
  PersistenceService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./income-statement.service', () => ({
  IncomeStatementService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./local.service', () => ({
  LocalService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./toast.service', () => ({
  ToastService: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('./subscription-processing.service', () => ({
  SubscriptionProcessingService: jest.fn().mockImplementation(() => ({}))
}));

import { AppDataService } from './app-data.service';
import { AppStateService } from './app-state.service';

// Shared mocks
const mockLocalStorage = {
  saveData: jest.fn(),
  removeData: jest.fn(),
  getData: jest.fn().mockReturnValue('')
};

const mockCryptic = {
  decrypt: jest.fn((val: string) => val),
  encrypt: jest.fn((val: string) => val)
};

const mockDatabase = {
  clearReadCache: jest.fn(),
  getBatchData: jest.fn(),
  getUpdatedAt: jest.fn(),
  getData: jest.fn()
};

const mockAfAuth = { authState: { subscribe: jest.fn() } };
const mockAuthService = { checkAuthentication: jest.fn() };
const mockPersistence = { batchWriteAndSync: jest.fn() };
const mockIncomeStatement = { recalculate: jest.fn() };
const mockToastService = { show: jest.fn(), dismiss: jest.fn() };
const mockSubscriptionProcessing = { setTransactionsForSubscriptions: jest.fn() };

function createService(): AppDataService {
  return new AppDataService(
    mockLocalStorage as any,
    mockDatabase as any,
    mockAfAuth as any,
    mockCryptic as any,
    mockAuthService as any,
    mockPersistence as any,
    mockIncomeStatement as any,
    mockToastService as any,
    mockSubscriptionProcessing as any
  );
}

describe('AppDataService', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    jest.clearAllMocks();
  });

  it('should set static instance on construction', () => {
    const service = createService();
    expect(AppDataService.instance).toBe(service);
  });

  // ---- Tier path definitions ----
  describe('Tier path constants', () => {
    it('TIER1_PATHS should contain 10 critical paths', () => {
      expect(AppDataService.TIER1_PATHS).toHaveLength(10);
      expect(AppDataService.TIER1_PATHS).toContain('transactions');
      expect(AppDataService.TIER1_PATHS).toContain('subscriptions');
      expect(AppDataService.TIER1_PATHS).toContain('income/revenue/revenues');
      expect(AppDataService.TIER1_PATHS).toContain('income/expenses/daily');
    });

    it('TIER2_PATHS should contain 4 deferred paths', () => {
      expect(AppDataService.TIER2_PATHS).toEqual(['smile', 'fire', 'mojo', 'budget']);
    });

    it('TIER3_GROW_PATHS should contain grow', () => {
      expect(AppDataService.TIER3_GROW_PATHS).toEqual(['grow']);
    });

    it('TIER3_BALANCE_PATHS should contain 4 balance paths', () => {
      expect(AppDataService.TIER3_BALANCE_PATHS).toHaveLength(4);
      expect(AppDataService.TIER3_BALANCE_PATHS).toContain('balance/asset/assets');
      expect(AppDataService.TIER3_BALANCE_PATHS).toContain('balance/liabilities');
    });

    it('all tiers together should cover all 19 data paths', () => {
      const allPaths = [
        ...AppDataService.TIER1_PATHS,
        ...AppDataService.TIER2_PATHS,
        ...AppDataService.TIER3_GROW_PATHS,
        ...AppDataService.TIER3_BALANCE_PATHS
      ];
      expect(allPaths).toHaveLength(19);
      expect(new Set(allPaths).size).toBe(19);
    });
  });

  // ---- loadTier1 ----
  describe('loadTier1()', () => {
    it('should call getBatchData with TIER1_PATHS', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: '2026-01-01T00:00:00Z' });

      await service.loadTier1();

      expect(mockDatabase.getBatchData).toHaveBeenCalledWith(AppDataService.TIER1_PATHS);
    });

    it('should clear read cache before loading', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      await service.loadTier1();

      expect(mockDatabase.clearReadCache).toHaveBeenCalled();
    });

    it('should store updatedAt timestamp in AppState', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: '2026-03-29T12:00:00Z' });

      await service.loadTier1();

      expect(AppStateService.instance.lastUpdatedAt).toBe('2026-03-29T12:00:00Z');
    });

    it('should apply transactions data to AppState', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'transactions': {
            '0': { account: 'Daily', amount: '100', date: '2026-01-01', time: '12:00', category: 'Food', comment: 'Lunch' }
          }
        },
        updatedAt: null
      });

      await service.loadTier1();

      expect(AppStateService.instance.allTransactions).toHaveLength(1);
      expect(AppStateService.instance.allTransactions[0].account).toBe('Daily');
      expect(AppStateService.instance.allTransactions[0].amount).toBe(100);
    });

    it('should apply expense data to AppState', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'income/expenses/daily': {
            '0': { tag: 'Rent', amount: '500' }
          }
        },
        updatedAt: null
      });

      await service.loadTier1();

      expect(AppStateService.instance.dailyExpenses).toHaveLength(1);
      expect(AppStateService.instance.dailyExpenses[0].tag).toBe('Rent');
    });

    it('should handle null data gracefully (empty arrays)', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'transactions': null,
          'subscriptions': null,
          'income/revenue/revenues': null
        },
        updatedAt: null
      });

      await service.loadTier1();

      expect(AppStateService.instance.allTransactions).toEqual([]);
      expect(AppStateService.instance.allSubscriptions).toEqual([]);
      expect(AppStateService.instance.allRevenues).toEqual([]);
    });
  });

  // ---- loadTier2 ----
  describe('loadTier2()', () => {
    it('should call getBatchData with TIER2_PATHS', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      await service.loadTier2();

      expect(mockDatabase.getBatchData).toHaveBeenCalledWith(AppDataService.TIER2_PATHS);
    });

    it('should set tier2Loaded flag on success', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      expect(AppStateService.instance.tier2Loaded).toBe(false);
      await service.loadTier2();
      expect(AppStateService.instance.tier2Loaded).toBe(true);
    });

    it('should apply smile data to AppState', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'smile': { '0': { title: 'Vacation', target: '5000', amount: '2000' } }
        },
        updatedAt: null
      });

      await service.loadTier2();

      expect(AppStateService.instance.allSmileProjects).toHaveLength(1);
      expect(AppStateService.instance.allSmileProjects[0].title).toBe('Vacation');
    });

    it('should apply budget data to AppState', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'budget': { '0': { date: '2026-01', tag: 'Food', amount: '300' } }
        },
        updatedAt: null
      });

      await service.loadTier2();

      expect(AppStateService.instance.allBudgets).toHaveLength(1);
      expect(AppStateService.instance.allBudgets[0].tag).toBe('Food');
    });

    it('should apply mojo data to AppState', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'mojo': { target: '10000', amount: '3000' }
        },
        updatedAt: null
      });

      await service.loadTier2();

      expect(AppStateService.instance.mojo.target).toBe(10000);
      expect(AppStateService.instance.mojo.amount).toBe(3000);
    });
  });

  // ---- loadGrowData (Tier 3 on-demand) ----
  describe('loadGrowData()', () => {
    it('should call getBatchData with TIER3_GROW_PATHS', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      await service.loadGrowData();

      expect(mockDatabase.getBatchData).toHaveBeenCalledWith(AppDataService.TIER3_GROW_PATHS);
    });

    it('should set tier3GrowLoaded flag on success', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      expect(AppStateService.instance.tier3GrowLoaded).toBe(false);
      await service.loadGrowData();
      expect(AppStateService.instance.tier3GrowLoaded).toBe(true);
    });

    it('should skip if already loaded', async () => {
      const service = createService();
      AppStateService.instance.tier3GrowLoaded = true;

      await service.loadGrowData();

      expect(mockDatabase.getBatchData).not.toHaveBeenCalled();
    });

    it('should apply grow data with nested objects', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'grow': {
            '0': {
              title: 'Real Estate', sub: 'Condo', status: 'Active',
              description: 'Rental', strategy: 'Buy/hold', risks: 'Market',
              amount: '150000', cashflow: '1200', isAsset: 'true',
              share: null, investment: null, liabilitie: null
            }
          }
        },
        updatedAt: null
      });

      await service.loadGrowData();

      expect(AppStateService.instance.allGrowProjects).toHaveLength(1);
      expect(AppStateService.instance.allGrowProjects[0].title).toBe('Real Estate');
      expect(AppStateService.instance.allGrowProjects[0].isAsset).toBe(true);
    });
  });

  // ---- loadBalanceData (Tier 3 on-demand) ----
  describe('loadBalanceData()', () => {
    it('should call getBatchData with TIER3_BALANCE_PATHS', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      await service.loadBalanceData();

      expect(mockDatabase.getBatchData).toHaveBeenCalledWith(AppDataService.TIER3_BALANCE_PATHS);
    });

    it('should set tier3BalanceLoaded flag on success', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      expect(AppStateService.instance.tier3BalanceLoaded).toBe(false);
      await service.loadBalanceData();
      expect(AppStateService.instance.tier3BalanceLoaded).toBe(true);
    });

    it('should skip if already loaded', async () => {
      const service = createService();
      AppStateService.instance.tier3BalanceLoaded = true;

      await service.loadBalanceData();

      expect(mockDatabase.getBatchData).not.toHaveBeenCalled();
    });

    it('should apply shares data with quantity and price', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'balance/asset/shares': {
            '0': { tag: 'AAPL', quantity: '10', price: '150' }
          }
        },
        updatedAt: null
      });

      await service.loadBalanceData();

      expect(AppStateService.instance.allShares).toHaveLength(1);
      expect(AppStateService.instance.allShares[0].tag).toBe('AAPL');
      expect(AppStateService.instance.allShares[0].quantity).toBe(10);
      expect(AppStateService.instance.allShares[0].price).toBe(150);
    });

    it('should apply liabilities data', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'balance/liabilities': {
            '0': { tag: 'Mortgage', amount: '200000', investment: 'true', credit: '250000' }
          }
        },
        updatedAt: null
      });

      await service.loadBalanceData();

      expect(AppStateService.instance.liabilities).toHaveLength(1);
      expect(AppStateService.instance.liabilities[0].investment).toBe(true);
      expect(AppStateService.instance.liabilities[0].credit).toBe(250000);
    });
  });

  // ---- checkUpdatedAt ----
  describe('checkUpdatedAt()', () => {
    it('should return true when server updatedAt is null (unknown)', async () => {
      const service = createService();
      mockDatabase.getUpdatedAt.mockResolvedValue(null);

      const result = await service.checkUpdatedAt();

      expect(result).toBe(true);
    });

    it('should return false when server matches local timestamp', async () => {
      const service = createService();
      AppStateService.instance.lastUpdatedAt = '2026-03-29T12:00:00Z';
      mockDatabase.getUpdatedAt.mockResolvedValue('2026-03-29T12:00:00Z');

      const result = await service.checkUpdatedAt();

      expect(result).toBe(false);
    });

    it('should return true when server timestamp is different', async () => {
      const service = createService();
      AppStateService.instance.lastUpdatedAt = '2026-03-29T12:00:00Z';
      mockDatabase.getUpdatedAt.mockResolvedValue('2026-03-29T13:00:00Z');

      const result = await service.checkUpdatedAt();

      expect(result).toBe(true);
    });

    it('should return true when no local timestamp exists', async () => {
      const service = createService();
      AppStateService.instance.lastUpdatedAt = null;
      mockDatabase.getUpdatedAt.mockResolvedValue('2026-03-29T12:00:00Z');

      const result = await service.checkUpdatedAt();

      expect(result).toBe(true);
    });
  });

  // ---- loadFromDB (backward compat) ----
  describe('loadFromDB()', () => {
    it('should call loadTier1 then loadTier2 sequentially', async () => {
      const service = createService();
      const callOrder: string[] = [];

      mockDatabase.getBatchData.mockImplementation((paths: string[]) => {
        if (paths === AppDataService.TIER1_PATHS) callOrder.push('tier1');
        if (paths === AppDataService.TIER2_PATHS) callOrder.push('tier2');
        return Promise.resolve({ data: {}, updatedAt: null });
      });

      await service.loadFromDB();

      expect(callOrder).toEqual(['tier1', 'tier2']);
    });

    it('should NOT load Tier 3 data', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({ data: {}, updatedAt: null });

      await service.loadFromDB();

      expect(mockDatabase.getBatchData).toHaveBeenCalledTimes(2);
      expect(mockDatabase.getBatchData).toHaveBeenCalledWith(AppDataService.TIER1_PATHS);
      expect(mockDatabase.getBatchData).toHaveBeenCalledWith(AppDataService.TIER2_PATHS);
    });
  });

  // ---- ETag / 304 Not Modified handling ----
  describe('304 Not Modified (ETag) handling', () => {
    it('loadTier1 should skip applyBatchData when response is null (304)', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue(null);
      AppStateService.instance.lastUpdatedAt = '2026-01-01T00:00:00Z';

      await service.loadTier1();

      // AppState should not be modified
      expect(AppStateService.instance.lastUpdatedAt).toBe('2026-01-01T00:00:00Z');
      expect(mockLocalStorage.saveData).not.toHaveBeenCalled();
    });

    it('loadTier2 should mark loaded but skip data application on null (304)', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue(null);

      await service.loadTier2();

      expect(AppStateService.instance.tier2Loaded).toBe(true);
      expect(mockLocalStorage.saveData).not.toHaveBeenCalled();
    });

    it('loadGrowData should mark loaded but skip data on null (304)', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue(null);

      await service.loadGrowData();

      expect(AppStateService.instance.tier3GrowLoaded).toBe(true);
    });

    it('loadBalanceData should mark loaded but skip data on null (304)', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue(null);

      await service.loadBalanceData();

      expect(AppStateService.instance.tier3BalanceLoaded).toBe(true);
    });
  });

  // ---- localStorage persistence ----
  describe('localStorage persistence', () => {
    it('should save transaction data to localStorage', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'transactions': { '0': { account: 'Daily', amount: '50', date: '2026-01-01', time: '10:00', category: 'Food', comment: '' } }
        },
        updatedAt: null
      });

      await service.loadTier1();

      expect(mockLocalStorage.saveData).toHaveBeenCalledWith(
        'transactions',
        expect.stringContaining('Daily')
      );
    });

    it('should save empty array for null data', async () => {
      const service = createService();
      mockDatabase.getBatchData.mockResolvedValue({
        data: { 'income/revenue/revenues': null },
        updatedAt: null
      });

      await service.loadTier1();

      expect(mockLocalStorage.saveData).toHaveBeenCalledWith('revenues', '[]');
    });
  });

  // ---- All 19 paths data application ----
  describe('applyPathData coverage for all data types', () => {
    let service: AppDataService;

    beforeEach(() => {
      service = createService();
    });

    it('should parse subscriptions with all fields', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'subscriptions': {
            '0': { title: 'Netflix', account: 'Daily', amount: '15', startDate: '2026-01-01', endDate: '', category: 'Entertainment', comment: '' }
          }
        },
        updatedAt: null
      });

      await service.loadTier1();

      expect(AppStateService.instance.allSubscriptions).toHaveLength(1);
      expect(AppStateService.instance.allSubscriptions[0].title).toBe('Netflix');
      expect(AppStateService.instance.allSubscriptions[0].amount).toBe(15);
    });

    it('should parse interests (tag/amount)', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: { 'income/revenue/interests': { '0': { tag: 'Savings', amount: '200' } } },
        updatedAt: null
      });
      await service.loadTier1();
      expect(AppStateService.instance.allIntrests[0].tag).toBe('Savings');
    });

    it('should parse properties (tag/amount)', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: { 'income/revenue/properties': { '0': { tag: 'Rental', amount: '1000' } } },
        updatedAt: null
      });
      await service.loadTier1();
      expect(AppStateService.instance.allProperties[0].tag).toBe('Rental');
    });

    it('should parse all 5 expense types', async () => {
      const expenseTypes = [
        { path: 'income/expenses/daily', field: 'dailyExpenses' },
        { path: 'income/expenses/splurge', field: 'splurgeExpenses' },
        { path: 'income/expenses/smile', field: 'smileExpenses' },
        { path: 'income/expenses/fire', field: 'fireExpenses' },
        { path: 'income/expenses/mojo', field: 'mojoExpenses' }
      ];

      for (const { path, field } of expenseTypes) {
        (AppStateService as any)._instance = undefined;
        jest.clearAllMocks();
        const svc = createService();
        mockDatabase.getBatchData.mockResolvedValue({
          data: { [path]: { '0': { tag: 'Test', amount: '42' } } },
          updatedAt: null
        });
        await svc.loadTier1();
        expect((AppStateService.instance as any)[field]).toHaveLength(1);
        expect((AppStateService.instance as any)[field][0].amount).toBe(42);
      }
    });

    it('should parse fire emergencies', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: { 'fire': { '0': { title: 'Emergency Fund', target: '10000', amount: '5000' } } },
        updatedAt: null
      });
      await service.loadTier2();
      expect(AppStateService.instance.allFireEmergencies[0].title).toBe('Emergency Fund');
    });

    it('should parse investments (tag/deposit/amount)', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: { 'balance/asset/investments': { '0': { tag: 'ETF', deposit: '500', amount: '10000' } } },
        updatedAt: null
      });
      await service.loadBalanceData();
      expect(AppStateService.instance.allInvestments[0].deposit).toBe(500);
    });

    it('should parse assets (tag/amount)', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: { 'balance/asset/assets': { '0': { tag: 'Car', amount: '15000' } } },
        updatedAt: null
      });
      await service.loadBalanceData();
      expect(AppStateService.instance.allAssets[0].tag).toBe('Car');
    });

    it('should parse grow project with nested share', async () => {
      mockDatabase.getBatchData.mockResolvedValue({
        data: {
          'grow': {
            '0': {
              title: 'Stock Portfolio', sub: 'Tech', status: 'Active',
              description: 'Growth', strategy: 'DCA', risks: 'Volatility',
              amount: '50000', cashflow: '0', isAsset: 'true',
              share: { tag: 'AAPL', price: '150', quantity: '10' },
              investment: null, liabilitie: null
            }
          }
        },
        updatedAt: null
      });
      await service.loadGrowData();
      expect(AppStateService.instance.allGrowProjects[0].share).toBeTruthy();
      expect(AppStateService.instance.allGrowProjects[0].share.tag).toBe('AAPL');
    });
  });

  // ==========================================================
  //  Tier flags on error — prevent permanent "not loaded" state
  // ==========================================================

  describe('tier flags set on error (data loss prevention)', () => {
    let service: AppDataService;

    beforeEach(() => {
      service = createService();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should set tier2Loaded=true even when loadTier2 throws', async () => {
      AppStateService.instance.tier2Loaded = false;
      mockDatabase.getBatchData.mockRejectedValue(new Error('Network error'));

      await service.loadTier2();

      expect(AppStateService.instance.tier2Loaded).toBe(true);
    });

    it('should set tier3GrowLoaded=true even when loadGrowData throws', async () => {
      AppStateService.instance.tier3GrowLoaded = false;
      mockDatabase.getBatchData.mockRejectedValue(new Error('Network error'));

      await service.loadGrowData();

      expect(AppStateService.instance.tier3GrowLoaded).toBe(true);
    });

    it('should set tier3BalanceLoaded=true even when loadBalanceData throws', async () => {
      AppStateService.instance.tier3BalanceLoaded = false;
      mockDatabase.getBatchData.mockRejectedValue(new Error('Network error'));

      await service.loadBalanceData();

      expect(AppStateService.instance.tier3BalanceLoaded).toBe(true);
    });

    it('should not corrupt existing data when loadTier2 fails', async () => {
      AppStateService.instance.allSmileProjects = [{ title: 'Vacation' }] as any;
      AppStateService.instance.allFireEmergencies = [{ title: 'Fund' }] as any;
      mockDatabase.getBatchData.mockRejectedValue(new Error('Timeout'));

      await service.loadTier2();

      // Data should be untouched — no empty overwrite
      expect(AppStateService.instance.allSmileProjects).toEqual([{ title: 'Vacation' }]);
      expect(AppStateService.instance.allFireEmergencies).toEqual([{ title: 'Fund' }]);
    });

    it('should not corrupt existing data when loadGrowData fails', async () => {
      AppStateService.instance.allGrowProjects = [{ title: 'Portfolio' }] as any;
      mockDatabase.getBatchData.mockRejectedValue(new Error('Timeout'));

      await service.loadGrowData();

      expect(AppStateService.instance.allGrowProjects).toEqual([{ title: 'Portfolio' }]);
    });

    it('should not corrupt existing data when loadBalanceData fails', async () => {
      AppStateService.instance.allAssets = [{ tag: 'Car', amount: 15000 }] as any;
      AppStateService.instance.liabilities = [{ tag: 'Mortgage', amount: 200000 }] as any;
      mockDatabase.getBatchData.mockRejectedValue(new Error('Timeout'));

      await service.loadBalanceData();

      expect(AppStateService.instance.allAssets).toEqual([{ tag: 'Car', amount: 15000 }]);
      expect(AppStateService.instance.liabilities).toEqual([{ tag: 'Mortgage', amount: 200000 }]);
    });
  });
});
