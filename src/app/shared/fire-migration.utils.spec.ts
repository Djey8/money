import { migrateFire, migrateFireArray, generateBucketId } from './fire-migration.utils';
import { Fire } from '../interfaces/fire';

describe('Fire Migration Utils', () => {
  describe('generateBucketId()', () => {
    it('should generate unique IDs', () => {
      const id1 = generateBucketId();
      const id2 = generateBucketId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^bucket_/);
      expect(id2).toMatch(/^bucket_/);
    });
  });

  describe('migrateFire()', () => {
    it('should return modern Fire object unchanged', () => {
      const modern: Fire = {
        title: 'Emergency Fund',
        sub: 'General savings',
        phase: 'saving',
        description: 'For unexpected expenses',
        buckets: [
          { id: 'b1', title: 'Medical', target: 5000, amount: 1000, notes: '', links: [] },
          { id: 'b2', title: 'Car', target: 3000, amount: 500, notes: '', links: [] }
        ],
        links: [{ label: 'Blog', url: 'https://example.com' }],
        actionItems: [{ text: 'Review monthly', done: false, priority: 'medium' }],
        notes: [{ text: 'Created today', createdAt: '2024-01-01' }],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        targetDate: '2024-12-31',
        completionDate: ''
      };

      const result = migrateFire(modern);
      
      expect(result.title).toBe('Emergency Fund');
      expect(result.buckets).toHaveLength(2);
      expect(result.phase).toBe('saving');
      expect(result.links).toHaveLength(1);
    });

    it('should migrate legacy Fire with target and amount to bucket structure', () => {
      const legacy: any = {
        title: 'Car Repair',
        target: 5000,
        amount: 2000
      };

      const result = migrateFire(legacy);

      expect(result.title).toBe('Car Repair');
      expect(result.buckets).toHaveLength(1);
      expect(result.buckets[0].title).toBe('Car Repair'); // Default bucket uses fire emergency title
      expect(result.buckets[0].target).toBe(5000);
      expect(result.buckets[0].amount).toBe(2000);
      expect(result.phase).toBe('saving'); // 40% progress = saving phase
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should set phase to planning when amount is 0', () => {
      const legacy: any = {
        title: 'Future Fund',
        target: 10000,
        amount: 0
      };

      const result = migrateFire(legacy);
      expect(result.phase).toBe('planning');
    });

    it('should set phase to ready when amount >= 80% of target', () => {
      const legacy: any = {
        title: 'Almost There',
        target: 1000,
        amount: 850
      };

      const result = migrateFire(legacy);
      expect(result.phase).toBe('ready');
    });

    it('should set phase to completed when amount >= target', () => {
      const legacy: any = {
        title: 'Done Fund',
        target: 1000,
        amount: 1000
      };

      const result = migrateFire(legacy);
      expect(result.phase).toBe('completed');
      expect(result.completionDate).toBeDefined();
      expect(result.completionDate).not.toBe('');
    });

    it('should preserve existing fields during migration', () => {
      const legacy: any = {
        title: 'Medical',
        target: 3000,
        amount: 500,
        sub: 'Health expenses',
        description: 'For medical emergencies',
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = migrateFire(legacy);
      
      expect(result.sub).toBe('Health expenses');
      expect(result.description).toBe('For medical emergencies');
      expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
    });

    it('should initialize empty arrays for missing fields', () => {
      const legacy: any = {
        title: 'Simple',
        target: 1000,
        amount: 0
      };

      const result = migrateFire(legacy);
      
      expect(result.links).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.notes).toEqual([]);
    });

    it('should handle missing target gracefully', () => {
      const legacy: any = {
        title: 'No Target',
        amount: 100
      };

      const result = migrateFire(legacy);
      
      expect(result.buckets[0].target).toBe(0);
      expect(result.buckets[0].amount).toBe(100);
    });
  });

  describe('migrateFireArray()', () => {
    it('should migrate an array of Fire objects', () => {
      const legacyArray: any[] = [
        { title: 'Fund 1', target: 1000, amount: 100 },
        { title: 'Fund 2', target: 2000, amount: 500 },
        { title: 'Fund 3', target: 5000, amount: 5000 }
      ];

      const result = migrateFireArray(legacyArray);

      expect(result).toHaveLength(3);
      expect(result[0].buckets[0].target).toBe(1000);
      expect(result[1].phase).toBe('saving');
      expect(result[2].phase).toBe('completed');
    });

    it('should handle empty array', () => {
      const result = migrateFireArray([]);
      expect(result).toEqual([]);
    });

    it('should handle mixed legacy and modern objects', () => {
      const mixedArray: any[] = [
        { title: 'Legacy', target: 1000, amount: 100 },
        {
          title: 'Modern',
          phase: 'saving',
          buckets: [{ id: 'b1', title: 'Main', target: 2000, amount: 500, notes: '', links: [] }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          targetDate: '',
          completionDate: ''
        }
      ];

      const result = migrateFireArray(mixedArray);

      expect(result).toHaveLength(2);
      expect(result[0].buckets).toHaveLength(1);
      expect(result[1].buckets).toHaveLength(1);
    });

    it('should use last transaction date as completion date when buckets are full', () => {
      const fullyFundedFire = {
        title: 'Emergency Fund',
        target: 1000,
        amount: 1000
      };

      const transactions = [
        { date: '2024-01-15', category: '@Emergency Fund', amount: -500 },
        { date: '2024-03-20', category: '@Emergency Fund', amount: -300 },
        { date: '2024-05-10', category: '@Emergency Fund', amount: -200 }
      ];

      const result = migrateFire(fullyFundedFire, transactions);

      expect(result.phase).toBe('completed');
      expect(result.completionDate).toBe('2024-05-10');
    });

    it('should handle transaction dates with bucket-specific categories', () => {
      const fullyFundedFire = {
        title: 'Emergency Fund',
        buckets: [
          { id: 'b1', title: 'Medical', target: 500, amount: 500, notes: '', links: [] },
          { id: 'b2', title: 'Car', target: 500, amount: 500, notes: '', links: [] }
        ]
      };

      const transactions = [
        { date: '2024-01-15', category: '@Medical', amount: -500 },
        { date: '2024-06-30', category: '@Car', amount: -500 }
      ];

      const result = migrateFire(fullyFundedFire, transactions);

      expect(result.phase).toBe('completed');
      expect(result.completionDate).toBe('2024-06-30'); // Last transaction date
    });

    it('should not set completion date if buckets are not full', () => {
      const partialFire = {
        title: 'Emergency Fund',
        target: 1000,
        amount: 500
      };

      const transactions = [
        { date: '2024-01-15', category: '@Emergency Fund', amount: -500 }
      ];

      const result = migrateFire(partialFire, transactions);

      expect(result.phase).toBe('saving');
      expect(result.completionDate).toBe('');
    });
  });
});
