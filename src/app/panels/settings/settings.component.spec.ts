import { SettingsComponent } from './settings.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('SettingsComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    SettingsComponent.isSettings = true;
    SettingsComponent.isLanguages = false;
    SettingsComponent.isAllocation = false;
    SettingsComponent.isEncryption = false;
    SettingsComponent.isCurrency = false;
    SettingsComponent.isNumberFormat = false;
    SettingsComponent.isDateFormat = false;
    SettingsComponent.isBackup = false;
    SettingsComponent.isRestore = false;
    SettingsComponent.isEng = true;
    SettingsComponent.isDe = false;
    SettingsComponent.isEs = false;
    SettingsComponent.isFr = false;
    SettingsComponent.isCn = false;
    SettingsComponent.isAr = false;
  });

  it('should delegate username getter/setter to AppStateService', () => {
    AppStateService.instance.username = 'Alice';
    expect(SettingsComponent.username).toBe('Alice');
    SettingsComponent.username = 'Bob';
    expect(AppStateService.instance.username).toBe('Bob');
  });

  it('should delegate email getter/setter to AppStateService', () => {
    AppStateService.instance.email = 'a@b.com';
    expect(SettingsComponent.email).toBe('a@b.com');
    SettingsComponent.email = 'c@d.com';
    expect(AppStateService.instance.email).toBe('c@d.com');
  });

  it('should delegate currency getter/setter to AppStateService', () => {
    AppStateService.instance.currency = '$';
    expect(SettingsComponent.currency).toBe('$');
    SettingsComponent.currency = '£';
    expect(AppStateService.instance.currency).toBe('£');
  });

  it('should delegate dateFormat getter/setter to AppStateService', () => {
    AppStateService.instance.dateFormat = 'yyyy-MM-dd';
    expect(SettingsComponent.dateFormat).toBe('yyyy-MM-dd');
    SettingsComponent.dateFormat = 'dd/MM/yyyy';
    expect(AppStateService.instance.dateFormat).toBe('dd/MM/yyyy');
  });

  it('should delegate allocation getters/setters to AppStateService', () => {
    AppStateService.instance.daily = 60;
    AppStateService.instance.splurge = 10;
    AppStateService.instance.smile = 10;
    AppStateService.instance.fire = 20;
    expect(SettingsComponent.daily).toBe(60);
    expect(SettingsComponent.splurge).toBe(10);
    expect(SettingsComponent.smile).toBe(10);
    expect(SettingsComponent.fire).toBe(20);
  });

  it('should delegate key, isLocal, isDatabase, isEuropeanFormat to AppStateService', () => {
    AppStateService.instance.key = 'myKey';
    AppStateService.instance.isLocal = true;
    AppStateService.instance.isDatabase = false;
    AppStateService.instance.isEuropeanFormat = true;
    expect(SettingsComponent.key).toBe('myKey');
    expect(SettingsComponent.isLocal).toBe(true);
    expect(SettingsComponent.isDatabase).toBe(false);
    expect(SettingsComponent.isEuropeanFormat).toBe(true);
  });

  it('setSettingsComponent should set username, email and reset panel flags', () => {
    SettingsComponent.isLanguages = true;
    SettingsComponent.isCurrency = true;
    SettingsComponent.isAllocation = true;
    SettingsComponent.isEncryption = true;
    SettingsComponent.isNumberFormat = true;
    SettingsComponent.isDateFormat = true;
    SettingsComponent.isBackup = true;
    SettingsComponent.isRestore = true;

    SettingsComponent.setSettingsComponent('TestUser', 'test@example.com');

    expect(AppStateService.instance.username).toBe('TestUser');
    expect(AppStateService.instance.email).toBe('test@example.com');
    expect(SettingsComponent.isInfo).toBe(true);
    expect(SettingsComponent.isSettings).toBe(true);
    expect(SettingsComponent.isLanguages).toBe(false);
    expect(SettingsComponent.isCurrency).toBe(false);
    expect(SettingsComponent.isAllocation).toBe(false);
    expect(SettingsComponent.isEncryption).toBe(false);
    expect(SettingsComponent.isNumberFormat).toBe(false);
    expect(SettingsComponent.isDateFormat).toBe(false);
    expect(SettingsComponent.isBackup).toBe(false);
    expect(SettingsComponent.isRestore).toBe(false);
    expect(SettingsComponent.isError).toBe(false);
  });

  describe('exportMigrationData', () => {
    let component: any;
    let createdBlobContent: string;
    let downloadFilename: string;
    let originalBlob: typeof Blob;

    beforeEach(() => {
      createdBlobContent = '';
      downloadFilename = '';
      originalBlob = window.Blob;

      // Minimal mock to bypass constructor side effects
      const mockLocalService = { getData: jest.fn().mockReturnValue(''), saveData: jest.fn() };
      const mockCryptic = { getKey: jest.fn().mockReturnValue('default'), getDefaultKey: jest.fn().mockReturnValue('default'), getEncryptionLocalEnabled: jest.fn().mockReturnValue(false), getEncryptionDatabaseEnabled: jest.fn().mockReturnValue(false) };
      const mockTranslate = { setDefaultLang: jest.fn(), use: jest.fn() };

      // Create instance bypassing constructor
      component = Object.create(SettingsComponent.prototype);
      component.localStorage = mockLocalService;
      component.cryptic = mockCryptic;
      component.translate = mockTranslate;
      component.classReference = SettingsComponent;

      // Stub DOM / URL methods
      (window.URL as any).createObjectURL = jest.fn().mockReturnValue('blob:mock');
      (window.URL as any).revokeObjectURL = jest.fn();
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el: any = { click: jest.fn() };
        Object.defineProperty(el, 'href', { set: () => {}, get: () => '' });
        Object.defineProperty(el, 'download', {
          set: (v: string) => { downloadFilename = v; },
          get: () => downloadFilename,
        });
        return el;
      });

      // Capture blob content
      (window as any).Blob = class MockBlob {
        constructor(content: any[]) {
          createdBlobContent = content[0];
        }
      };

      // Seed AppStateService with test data
      AppStateService.instance.allTransactions = [{ id: 1, account: 'Daily', amount: 42 }] as any;
      AppStateService.instance.allSubscriptions = [];
      AppStateService.instance.allBudgets = [];
      AppStateService.instance.allSmileProjects = [];
      AppStateService.instance.allFireEmergencies = [];
      AppStateService.instance.mojo = { amount: 100, target: 500 };
      AppStateService.instance.allGrowProjects = [];
      AppStateService.instance.allRevenues = [];
      AppStateService.instance.allIntrests = [];
      AppStateService.instance.allProperties = [];
      AppStateService.instance.dailyExpenses = [];
      AppStateService.instance.splurgeExpenses = [];
      AppStateService.instance.smileExpenses = [];
      AppStateService.instance.fireExpenses = [];
      AppStateService.instance.mojoExpenses = [];
      AppStateService.instance.allAssets = [];
      AppStateService.instance.allShares = [];
      AppStateService.instance.allInvestments = [];
      AppStateService.instance.liabilities = [];
      AppStateService.instance.currency = '$';
      AppStateService.instance.daily = 60;
      AppStateService.instance.splurge = 10;
      AppStateService.instance.smile = 10;
      AppStateService.instance.fire = 20;
      AppStateService.instance.dateFormat = 'yyyy-MM-dd';
      AppStateService.instance.isEuropeanFormat = false;
    });

    afterEach(() => {
      jest.restoreAllMocks();
      (window as any).Blob = originalBlob;
      localStorage.clear();
    });

    it('should produce a single JSON file with version 2', () => {
      localStorage.setItem('encryptKey', 'my-secret');
      localStorage.setItem('encryptLocal', 'true');
      localStorage.setItem('encryptDatabase', 'true');

      component.exportMigrationData();

      const parsed = JSON.parse(createdBlobContent);
      expect(parsed.version).toBe(2);
      expect(parsed.data).toBeDefined();
      expect(parsed.exportDate).toBeDefined();
    });

    it('should include language, dateFormat, isEuropeanFormat, and encryption in settings', () => {
      SettingsComponent.isEng = false;
      SettingsComponent.isDe = true;
      localStorage.setItem('encryptKey', 'my-secret');
      localStorage.setItem('encryptLocal', 'true');
      localStorage.setItem('encryptDatabase', 'true');

      component.exportMigrationData();

      const parsed = JSON.parse(createdBlobContent);
      const settings = parsed.data.settings;
      expect(settings.language).toBe('de');
      expect(settings.dateFormat).toBe('yyyy-MM-dd');
      expect(settings.isEuropeanFormat).toBe(false);
      expect(settings.encryption).toEqual({
        encryptKey: 'my-secret',
        encryptLocal: 'true',
        encryptDatabase: 'true',
      });
    });

    it('should include all data collections', () => {
      component.exportMigrationData();

      const parsed = JSON.parse(createdBlobContent);
      expect(parsed.data.transactions).toEqual([{ id: 1, account: 'Daily', amount: 42 }]);
      expect(parsed.data.mojo).toEqual({ amount: 100, target: 500 });
      expect(parsed.data.settings.currency).toBe('$');
      expect(parsed.data.settings.dailyR).toBe(60);
    });

    it('should use filename with date postfix migration-data-YYYY-MM-DD.json', () => {
      component.exportMigrationData();

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      expect(downloadFilename).toBe(`migration-data-${yyyy}-${mm}-${dd}.json`);
    });

    it('should detect each language correctly', () => {
      const langMap: { flag: string; expected: string }[] = [
        { flag: 'isEng', expected: 'en' },
        { flag: 'isDe', expected: 'de' },
        { flag: 'isEs', expected: 'es' },
        { flag: 'isFr', expected: 'fr' },
        { flag: 'isCn', expected: 'cn' },
        { flag: 'isAr', expected: 'ar' },
      ];
      for (const { flag, expected } of langMap) {
        SettingsComponent.isEng = false;
        SettingsComponent.isDe = false;
        SettingsComponent.isEs = false;
        SettingsComponent.isFr = false;
        SettingsComponent.isCn = false;
        SettingsComponent.isAr = false;
        (SettingsComponent as any)[flag] = true;

        component.exportMigrationData();

        const parsed = JSON.parse(createdBlobContent);
        expect(parsed.data.settings.language).toBe(expected);
      }
    });

    it('should default encryption values when localStorage is empty', () => {
      component.exportMigrationData();

      const parsed = JSON.parse(createdBlobContent);
      expect(parsed.data.settings.encryption).toEqual({
        encryptKey: 'default',
        encryptLocal: 'false',
        encryptDatabase: 'false',
      });
    });
  });

  describe('writeMigrationData (restore)', () => {
    let component: any;
    let savedData: Record<string, string>;
    let batchWriteCalled: boolean;

    beforeEach(() => {
      savedData = {};
      batchWriteCalled = false;

      const mockLocalService = {
        getData: jest.fn((key: string) => savedData[key] || ''),
        saveData: jest.fn((key: string, val: string) => { savedData[key] = val; }),
      };
      const mockCryptic = {
        updateConfig: jest.fn(),
        getKey: jest.fn().mockReturnValue('default'),
        getDefaultKey: jest.fn().mockReturnValue('default'),
        getEncryptionLocalEnabled: jest.fn().mockReturnValue(false),
        getEncryptionDatabaseEnabled: jest.fn().mockReturnValue(false),
      };
      const mockDatabase = {
        batchWrite: jest.fn().mockReturnValue({
          subscribe: (handlers: any) => { handlers.next(); },
        }),
      };
      const mockTranslate = { setDefaultLang: jest.fn(), use: jest.fn() };

      component = Object.create(SettingsComponent.prototype);
      component.localStorage = mockLocalService;
      component.cryptic = mockCryptic;
      component.database = mockDatabase;
      component.translate = mockTranslate;
      component.classReference = SettingsComponent;
      component.importStatus = '';
      component.isImporting = false;

      // Prevent reload
      Object.defineProperty(window, 'location', {
        value: { reload: jest.fn() },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      localStorage.clear();
    });

    it('should restore language settings from migration data', () => {
      const data = {
        transactions: [],
        settings: {
          currency: '€',
          dailyR: 60,
          splurgeR: 10,
          smileR: 10,
          fireR: 20,
          language: 'fr',
          dateFormat: 'dd/MM/yyyy',
          isEuropeanFormat: true,
        },
      };

      component.writeMigrationData(data, null);

      expect(savedData['isFr']).toBe('true');
      expect(savedData['isEng']).toBe('false');
      expect(savedData['isDe']).toBe('false');
    });

    it('should restore dateFormat and isEuropeanFormat', () => {
      const data = {
        transactions: [],
        settings: {
          dateFormat: 'MM/dd/yyyy',
          isEuropeanFormat: false,
        },
      };

      component.writeMigrationData(data, null);

      expect(localStorage.getItem('dateFormat')).toBe('MM/dd/yyyy');
      expect(AppStateService.instance.dateFormat).toBe('MM/dd/yyyy');
      expect(localStorage.getItem('isEuropeanFormat')).toBe('false');
      expect(AppStateService.instance.isEuropeanFormat).toBe(false);
    });

    it('should apply encryption config from embedded settings', () => {
      const data = {
        transactions: [],
        settings: {
          encryption: {
            encryptKey: 'my-key',
            encryptLocal: 'true',
            encryptDatabase: 'true',
          },
        },
      };

      component.writeMigrationData(data, data.settings.encryption);

      expect(component.cryptic.updateConfig).toHaveBeenCalledWith('my-key', true, true);
    });

    it('should restore data collections via batchWrite', () => {
      const data = {
        transactions: [{ id: 1 }],
        subscriptions: [{ id: 2 }],
        budget: [{ id: 3 }],
        settings: {},
      };

      component.writeMigrationData(data, null);

      expect(component.database.batchWrite).toHaveBeenCalled();
      const writes = component.database.batchWrite.mock.calls[0][0];
      expect(writes.find((w: any) => w.tag === 'transactions')).toBeTruthy();
      expect(writes.find((w: any) => w.tag === 'subscriptions')).toBeTruthy();
      expect(writes.find((w: any) => w.tag === 'budget')).toBeTruthy();
    });

    it('should set importStatus to success after writing', () => {
      const data = { transactions: [], settings: {} };

      component.writeMigrationData(data, null);

      expect(component.importStatus).toContain('successful');
    });
  });

});
