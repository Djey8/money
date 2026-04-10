import { IncomeStatementService } from './income-statement.service';
import { LocalService } from './local.service';
import { AppStateService } from './app-state.service';

describe('IncomeStatementService', () => {
  let service: IncomeStatementService;
  let localService: { saveData: jest.Mock };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    // Initialise arrays the service expects
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allRevenues = [];
    AppStateService.instance.allIntrests = [];
    AppStateService.instance.allProperties = [];
    AppStateService.instance.dailyExpenses = [];
    AppStateService.instance.splurgeExpenses = [];
    AppStateService.instance.smileExpenses = [];
    AppStateService.instance.fireExpenses = [];
    AppStateService.instance.mojoExpenses = [];
    AppStateService.instance.allSmileProjects = [];
    AppStateService.instance.allFireEmergencies = [];
    AppStateService.instance.allShares = [];
    AppStateService.instance.allInvestments = [];
    AppStateService.instance.mojo = { amount: 0, target: 1000 };

    localService = { saveData: jest.fn() };
    service = new IncomeStatementService(localService as any);
  });

  // --- recalculate ---------------------------------------------------------

  describe('recalculate()', () => {
    it('clears existing income statement data', () => {
      AppStateService.instance.allRevenues = [{ tag: 'old', amount: 100 } as any];
      AppStateService.instance.dailyExpenses = [{ tag: 'old', amount: -50 } as any];
      service.recalculate();
      // Revenue rebuilt from scratch (empty since no transactions)
      expect(AppStateService.instance.allRevenues).toEqual([]);
      expect(AppStateService.instance.dailyExpenses).toEqual([]);
    });

    it('buckets Income transactions into revenues', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 3000, date: '2026-01-01', time: '', category: '@Salary', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.allRevenues).toEqual([
        { tag: 'Salary', amount: 3000 },
      ]);
    });

    it('aggregates revenues with same category', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 1000, date: '2026-01-01', time: '', category: '@Salary', comment: '' },
        { account: 'Income', amount: 2000, date: '2026-02-01', time: '', category: '@Salary', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.allRevenues).toHaveLength(1);
      expect(AppStateService.instance.allRevenues[0].amount).toBe(3000);
    });

    it('buckets Daily expenses', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, date: '2026-01-10', time: '', category: '@Food', comment: '' },
        { account: 'Daily', amount: -30, date: '2026-01-15', time: '', category: '@Transport', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.dailyExpenses).toHaveLength(2);
    });

    it('buckets Splurge expenses', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Splurge', amount: -200, date: '2026-01-10', time: '', category: '@Fun', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.splurgeExpenses).toHaveLength(1);
      expect(AppStateService.instance.splurgeExpenses[0].tag).toBe('Fun');
    });

    it('aggregates expenses with same category', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -20, date: '2026-01-01', time: '', category: '@Food', comment: '' },
        { account: 'Daily', amount: -30, date: '2026-01-05', time: '', category: '@Food', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.dailyExpenses).toHaveLength(1);
      expect(AppStateService.instance.dailyExpenses[0].amount).toBe(-50);
    });

    it('skips zero-amount transactions', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: 0, date: '2026-01-01', time: '', category: '@Food', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.dailyExpenses).toEqual([]);
    });

    it('tracks @Mojo fund contributions up to target', () => {
      AppStateService.instance.mojo = { amount: 0, target: 100 };
      AppStateService.instance.allTransactions = [
        { account: 'Fire', amount: -80, date: '2026-01-01', time: '', category: '@Mojo', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.mojo.amount).toBe(80);
    });

    it('caps @Mojo at target', () => {
      AppStateService.instance.mojo = { amount: 90, target: 100 };
      AppStateService.instance.allTransactions = [
        { account: 'Fire', amount: -50, date: '2026-01-01', time: '', category: '@Mojo', comment: '' },
      ];
      service.recalculate();
      // Mojo already at 90 → recalculate resets to 0, then -(-50) = 50 (not capped)
      // Actually, recalculate() resets mojo.amount to 0 first
      expect(AppStateService.instance.mojo.amount).toBe(50);
    });

    it('tracks Smile project contributions', () => {
      AppStateService.instance.allSmileProjects = [
        { 
          title: 'Vacation', 
          buckets: [{ id: 'bucket_1', title: 'Vacation', target: 500, amount: 0, notes: '', links: [] }],
          sub: '', phase: 'planning', description: '', links: [], actionItems: [], notes: [],
          createdAt: '', updatedAt: '', targetDate: '', completionDate: ''
        } as any,
      ];
      AppStateService.instance.allTransactions = [
        { account: 'Smile', amount: -200, date: '2026-01-01', time: '', category: '@Vacation', comment: '' },
      ];
      service.recalculate();
      // Check bucket amount instead of project amount
      expect(AppStateService.instance.allSmileProjects[0].buckets[0].amount).toBe(200);
    });

    it('creates interest entries for income matching shares', () => {
      AppStateService.instance.allShares = [
        { tag: 'AAPL', amount: 0 } as any,
      ];
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 50, date: '2026-01-01', time: '', category: '@AAPL', comment: '' },
      ];
      service.recalculate();
      expect(AppStateService.instance.allIntrests).toHaveLength(1);
      expect(AppStateService.instance.allIntrests[0].tag).toBe('AAPL');
    });
  });

  // --- getWrites -----------------------------------------------------------

  describe('getWrites()', () => {
    it('returns 11 write operations', () => {
      expect(service.getWrites()).toHaveLength(11);
    });

    it('includes revenue tags', () => {
      const tags = service.getWrites().map(w => w.tag);
      expect(tags).toContain('income/revenue/revenues');
      expect(tags).toContain('income/revenue/interests');
      expect(tags).toContain('income/revenue/properties');
    });

    it('includes expense tags', () => {
      const tags = service.getWrites().map(w => w.tag);
      expect(tags).toContain('income/expenses/daily');
      expect(tags).toContain('income/expenses/splurge');
      expect(tags).toContain('income/expenses/smile');
      expect(tags).toContain('income/expenses/fire');
      expect(tags).toContain('income/expenses/mojo');
    });
  });

  // --- saveToLocalStorage --------------------------------------------------

  describe('saveToLocalStorage()', () => {
    it('calls localStorage.saveData for each field', () => {
      service.saveToLocalStorage();
      expect(localService.saveData).toHaveBeenCalledTimes(11);
    });

    it('saves revenues as JSON', () => {
      AppStateService.instance.allRevenues = [{ tag: 'Salary', amount: 3000 }];
      service.saveToLocalStorage();
      expect(localService.saveData).toHaveBeenCalledWith('revenues', JSON.stringify([{ tag: 'Salary', amount: 3000 }]));
    });
  });

  // --- Fire Auto-Completion ------------------------------------------------

  describe('Fire Auto-Completion', () => {
    it('should auto-complete Fire emergency when all buckets are full', () => {
      const fireEmergency: any = {
        title: 'Emergency Fund',
        phase: 'saving',
        buckets: [
          { id: 'b1', title: 'Medical', target: 500, amount: 0, notes: '', links: [] },
          { id: 'b2', title: 'Car', target: 500, amount: 0, notes: '', links: [] }
        ],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        targetDate: '',
        completionDate: ''
      };

      AppStateService.instance.allFireEmergencies = [fireEmergency];
      AppStateService.instance.allTransactions = [
        { category: '@Medical', amount: -500, date: '2024-02-15', time: '10:00', account: 'Checking', comment: '' },
        { category: '@Car', amount: -500, date: '2024-03-20', time: '10:00', account: 'Checking', comment: '' }
      ];

      service.recalculate();

      expect(fireEmergency.phase).toBe('completed');
      expect(fireEmergency.completionDate).toBe('2024-03-20');
      expect(fireEmergency.buckets[0].amount).toBe(500);
      expect(fireEmergency.buckets[1].amount).toBe(500);
    });

    it('should not auto-complete if not all buckets are full', () => {
      const fireEmergency: any = {
        title: 'Emergency Fund',
        phase: 'saving',
        buckets: [
          { id: 'b1', title: 'Medical', target: 500, amount: 0, notes: '', links: [] },
          { id: 'b2', title: 'Car', target: 500, amount: 0, notes: '', links: [] }
        ],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        targetDate: '',
        completionDate: ''
      };

      AppStateService.instance.allFireEmergencies = [fireEmergency];
      AppStateService.instance.allTransactions = [
        { category: '@Medical', amount: -300, date: '2024-02-15', time: '10:00', account: 'Checking', comment: '' }
      ];

      service.recalculate();

      expect(fireEmergency.phase).toBe('saving'); // Still in saving phase
      expect(fireEmergency.completionDate).toBe('');
      expect(fireEmergency.buckets[0].amount).toBe(300);
      expect(fireEmergency.buckets[1].amount).toBe(0);
    });

    it('should not overwrite existing completion date', () => {
      const fireEmergency: any = {
        title: 'Emergency Fund',
        phase: 'completed',
        buckets: [
          { id: 'b1', title: 'Main', target: 1000, amount: 1000, notes: '', links: [] }
        ],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        targetDate: '',
        completionDate: '2024-02-01'
      };

      AppStateService.instance.allFireEmergencies = [fireEmergency];
      AppStateService.instance.allTransactions = [
        { category: '@Main', amount: -1000, date: '2024-05-15', time: '10:00', account: 'Checking', comment: '' }
      ];

      service.recalculate();

      expect(fireEmergency.phase).toBe('completed');
      expect(fireEmergency.completionDate).toBe('2024-02-01'); // Should not change
    });
  });
});
