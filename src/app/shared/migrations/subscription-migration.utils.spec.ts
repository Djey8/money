import { 
  migrateSubscription, 
  migrateSubscriptionArray, 
  validateFrequency,
  getEffectiveValue
} from './subscription-migration.utils';
import { Subscription, SubscriptionFrequency } from '../../interfaces/subscription';

describe('Subscription Migration Utils', () => {
  
  describe('validateFrequency()', () => {
    it('should return valid frequency unchanged', () => {
      expect(validateFrequency('weekly')).toBe('weekly');
      expect(validateFrequency('biweekly')).toBe('biweekly');
      expect(validateFrequency('monthly')).toBe('monthly');
      expect(validateFrequency('quarterly')).toBe('quarterly');
      expect(validateFrequency('yearly')).toBe('yearly');
    });

    it('should default invalid frequency to monthly', () => {
      expect(validateFrequency('invalid')).toBe('monthly');
      expect(validateFrequency('')).toBe('monthly');
      expect(validateFrequency(null)).toBe('monthly');
      expect(validateFrequency(undefined)).toBe('monthly');
      expect(validateFrequency(123)).toBe('monthly');
      expect(validateFrequency({})).toBe('monthly');
    });
  });

  describe('migrateSubscription()', () => {
    it('should return modern subscription unchanged', () => {
      const modern: Subscription = {
        title: 'Netflix',
        account: 'Daily',
        amount: -15.99,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Entertainment',
        comment: 'Premium plan',
        frequency: 'monthly',
        changeHistory: []
      };

      const result = migrateSubscription(modern);
      
      expect(result.title).toBe('Netflix');
      expect(result.account).toBe('Daily');
      expect(result.amount).toBe(-15.99);
      expect(result.frequency).toBe('monthly');
      expect(result.changeHistory).toEqual([]);
    });

    it('should add default frequency to legacy subscription', () => {
      const legacy: any = {
        title: 'Spotify',
        account: 'Daily',
        amount: -9.99,
        startDate: '2023-01-01',
        endDate: '',
        category: '@Music',
        comment: ''
      };

      const result = migrateSubscription(legacy);
      
      expect(result.frequency).toBe('monthly');  // Default
      expect(result.changeHistory).toEqual([]);
      expect(result.title).toBe('Spotify');
    });

    it('should preserve existing frequency', () => {
      const withFrequency: any = {
        title: 'Gym',
        account: 'Daily',
        amount: -10,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Fitness',
        comment: '',
        frequency: 'weekly'
      };

      const result = migrateSubscription(withFrequency);
      expect(result.frequency).toBe('weekly');
    });

    it('should handle invalid frequency', () => {
      const invalid: any = {
        title: 'Test',
        account: 'Daily',
        amount: -5,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Test',
        comment: '',
        frequency: 'invalid-frequency'
      };

      const result = migrateSubscription(invalid);
      expect(result.frequency).toBe('monthly');  // Defaults to monthly
    });

    it('should handle null/undefined subscription', () => {
      const resultNull = migrateSubscription(null);
      expect(resultNull.title).toBe('');
      expect(resultNull.account).toBe('Daily');
      expect(resultNull.frequency).toBe('monthly');
      expect(resultNull.changeHistory).toEqual([]);

      const resultUndef = migrateSubscription(undefined);
      expect(resultUndef.frequency).toBe('monthly');
    });

    it('should handle missing fields with defaults', () => {
      const partial: any = {
        title: 'Partial'
      };

      const result = migrateSubscription(partial);
      
      expect(result.title).toBe('Partial');
      expect(result.account).toBe('Daily');  // Default
      expect(result.amount).toBe(0);  // Default
      expect(result.category).toBe('@');  // Default
      expect(result.frequency).toBe('monthly');  // Default
      expect(result.startDate).toBeTruthy();  // Today's date
    });

    it('should normalize amount to 2 decimal places', () => {
      const withAmount: any = {
        title: 'Test',
        account: 'Daily',
        amount: -15.999999,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Test',
        comment: ''
      };

      const result = migrateSubscription(withAmount);
      expect(result.amount).toBe(-16);  // Rounded
    });

    it('should parse string amounts', () => {
      const stringAmount: any = {
        title: 'Test',
        account: 'Daily',
        amount: '-25.50',
        startDate: '2024-01-01',
        endDate: '',
        category: '@Test',
        comment: ''
      };

      const result = migrateSubscription(stringAmount);
      expect(result.amount).toBe(-25.50);
    });

    it('should handle changeHistory migration', () => {
      const withHistory: any = {
        title: 'MVG',
        account: 'Daily',
        amount: -60.50,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Transport',
        comment: '',
        frequency: 'monthly',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'amount',
            oldValue: 50,
            newValue: 55,
            reason: '2025 price increase'
          },
          {
            effectiveDate: '2026-01-01',
            field: 'amount',
            oldValue: 55,
            newValue: 60.50,
            reason: '2026 price increase'
          }
        ]
      };

      const result = migrateSubscription(withHistory);
      
      expect(result.changeHistory).toHaveLength(2);
      expect(result.changeHistory![0].effectiveDate).toBe('2025-01-01');
      expect(result.changeHistory![0].field).toBe('amount');
      expect(result.changeHistory![0].oldValue).toBe(50);
      expect(result.changeHistory![0].newValue).toBe(55);
    });

    it('should handle missing changeHistory', () => {
      const noHistory: any = {
        title: 'Test',
        account: 'Daily',
        amount: -10,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Test',
        comment: ''
      };

      const result = migrateSubscription(noHistory);
      expect(result.changeHistory).toEqual([]);
    });

    it('should validate changeHistory fields', () => {
      const invalidHistory: any = {
        title: 'Test',
        account: 'Daily',
        amount: -10,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Test',
        comment: '',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'invalid-field',  // Invalid
            oldValue: 10,
            newValue: 20
          }
        ]
      };

      const result = migrateSubscription(invalidHistory);
      expect(result.changeHistory![0].field).toBe('amount');  // Defaults to 'amount'
    });
  });

  describe('migrateSubscriptionArray()', () => {
    it('should migrate array of subscriptions', () => {
      const array: any[] = [
        {
          title: 'Netflix',
          account: 'Daily',
          amount: -15.99,
          startDate: '2024-01-01',
          endDate: '',
          category: '@Entertainment',
          comment: ''
        },
        {
          title: 'Gym',
          account: 'Daily',
          amount: -10,
          startDate: '2024-01-01',
          endDate: '',
          category: '@Fitness',
          comment: '',
          frequency: 'weekly'
        }
      ];

      const result = migrateSubscriptionArray(array);
      
      expect(result).toHaveLength(2);
      expect(result[0].frequency).toBe('monthly');  // Default
      expect(result[1].frequency).toBe('weekly');  // Preserved
    });

    it('should handle empty array', () => {
      const result = migrateSubscriptionArray([]);
      expect(result).toEqual([]);
    });

    it('should handle null/undefined', () => {
      expect(migrateSubscriptionArray(null)).toEqual([]);
      expect(migrateSubscriptionArray(undefined)).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(migrateSubscriptionArray('not an array' as any)).toEqual([]);
      expect(migrateSubscriptionArray({} as any)).toEqual([]);
      expect(migrateSubscriptionArray(123 as any)).toEqual([]);
    });
  });

  describe('getEffectiveValue()', () => {
    it('should return current value when no change history', () => {
      const subscription: Subscription = {
        title: 'Netflix',
        account: 'Daily',
        amount: -15.99,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Entertainment',
        comment: '',
        frequency: 'monthly',
        changeHistory: []
      };

      expect(getEffectiveValue(subscription, 'amount', '2024-06-01')).toBe(-15.99);
      expect(getEffectiveValue(subscription, 'account', '2024-06-01')).toBe('Daily');
    });

    it('should return value before first change', () => {
      const subscription: Subscription = {
        title: 'MVG',
        account: 'Daily',
        amount: -60.50,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Transport',
        comment: '',
        frequency: 'monthly',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'amount',
            oldValue: -50,
            newValue: -55,
            reason: '2025 increase'
          }
        ]
      };

      // Before change date
      expect(getEffectiveValue(subscription, 'amount', '2024-06-01')).toBe(-50);
    });

    it('should return value after change takes effect', () => {
      const subscription: Subscription = {
        title: 'MVG',
        account: 'Daily',
        amount: -60.50,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Transport',
        comment: '',
        frequency: 'monthly',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'amount',
            oldValue: -50,
            newValue: -55,
            reason: '2025 increase'
          }
        ]
      };

      // On change date
      expect(getEffectiveValue(subscription, 'amount', '2025-01-01')).toBe(-55);
      
      // After change date
      expect(getEffectiveValue(subscription, 'amount', '2025-06-01')).toBe(-55);
    });

    it('should handle multiple changes', () => {
      const subscription: Subscription = {
        title: 'MVG',
        account: 'Daily',
        amount: -60.50,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Transport',
        comment: '',
        frequency: 'monthly',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'amount',
            oldValue: -50,
            newValue: -55,
            reason: '2025 increase'
          },
          {
            effectiveDate: '2026-01-01',
            field: 'amount',
            oldValue: -55,
            newValue: -60.50,
            reason: '2026 increase'
          }
        ]
      };

      expect(getEffectiveValue(subscription, 'amount', '2024-06-01')).toBe(-50);   // Before all changes
      expect(getEffectiveValue(subscription, 'amount', '2025-06-01')).toBe(-55);   // After first change
      expect(getEffectiveValue(subscription, 'amount', '2026-06-01')).toBe(-60.50); // After second change
    });

    it('should handle account changes', () => {
      const subscription: Subscription = {
        title: 'Spotify',
        account: 'Splurge',
        amount: -9.99,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Entertainment',
        comment: '',
        frequency: 'monthly',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'account',
            oldValue: 'Daily',
            newValue: 'Splurge'
          }
        ]
      };

      expect(getEffectiveValue(subscription, 'account', '2024-06-01')).toBe('Daily');
      expect(getEffectiveValue(subscription, 'account', '2025-06-01')).toBe('Splurge');
    });

    it('should ignore changes for different fields', () => {
      const subscription: Subscription = {
        title: 'Test',
        account: 'Daily',
        amount: -10,
        startDate: '2024-01-01',
        endDate: '',
        category: '@Test',
        comment: '',
        frequency: 'monthly',
        changeHistory: [
          {
            effectiveDate: '2025-01-01',
            field: 'category',
            oldValue: '@OldCategory',
            newValue: '@NewCategory'
          }
        ]
      };

      // Asking for amount should ignore category changes
      expect(getEffectiveValue(subscription, 'amount', '2025-06-01')).toBe(-10);
    });
  });
});
