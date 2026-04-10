import { SubscriptionComponent } from './subscription.component';
import { AppStateService } from '../../shared/services/app-state.service';
import { MatTableDataSource } from '@angular/material/table';

describe('SubscriptionComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  describe('isPeriodPaid()', () => {
    let component: SubscriptionComponent;
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    beforeEach(() => {
      AppStateService.instance.allSubscriptions = [];
      AppStateService.instance.allTransactions = [];
      // Create minimal instance without TestBed to test pure logic
      component = Object.create(SubscriptionComponent.prototype);
    });

    it('should return true for weekly subscription when current week is paid', () => {
      const subscription = {
        title: 'Gym',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: '',
        frequency: 'weekly',
        startDate: '2026-01-01'
      };

      // Add transaction for current week
      AppStateService.instance.allTransactions = [{
        date: todayISO,
        time: '',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: 'Gym'
      }];

      expect(component.isPeriodPaid(subscription)).toBe(true);
    });

    it('should return false for weekly subscription when current week is not paid', () => {
      const subscription = {
        title: 'Gym',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: '',
        frequency: 'weekly',
        startDate: '2026-01-01'
      };

      // No transactions
      AppStateService.instance.allTransactions = [];

      expect(component.isPeriodPaid(subscription)).toBe(false);
    });

    it('should return true for monthly subscription when current month is paid', () => {
      const subscription = {
        title: 'Netflix',
        account: 'Daily',
        amount: -15,
        category: '@Entertainment',
        comment: '',
        frequency: 'monthly',
        startDate: '2026-01-01'
      };

      // Add transaction for current month
      AppStateService.instance.allTransactions = [{
        date: todayISO,
        time: '',
        account: 'Daily',
        amount: -15,
        category: '@Entertainment',
        comment: 'Netflix'
      }];

      expect(component.isPeriodPaid(subscription)).toBe(true);
    });

    it('should return false for monthly subscription when current month is not paid', () => {
      const subscription = {
        title: 'Netflix',
        account: 'Daily',
        amount: -15,
        category: '@Entertainment',
        comment: '',
        frequency: 'monthly',
        startDate: '2026-01-01'
      };

      // No transactions
      AppStateService.instance.allTransactions = [];

      expect(component.isPeriodPaid(subscription)).toBe(false);
    });

    it('should return true for quarterly subscription when current quarter is paid', () => {
      const subscription = {
        title: 'Insurance',
        account: 'Daily',
        amount: -300,
        category: '@Insurance',
        comment: '',
        frequency: 'quarterly',
        startDate: '2026-01-01'
      };

      // Add transaction for current quarter
      AppStateService.instance.allTransactions = [{
        date: todayISO,
        time: '',
        account: 'Daily',
        amount: -300,
        category: '@Insurance',
        comment: 'Insurance'
      }];

      expect(component.isPeriodPaid(subscription)).toBe(true);
    });

    it('should return false for subscription with comment when transaction does not match comment', () => {
      const subscription = {
        title: 'Gym',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: 'Premium',
        frequency: 'monthly',
        startDate: '2026-01-01'
      };

      // Transaction without comment match
      AppStateService.instance.allTransactions = [{
        date: todayISO,
        time: '',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: 'Gym'  // Should be 'Gym + Premium'
      }];

      expect(component.isPeriodPaid(subscription)).toBe(false);
    });

    it('should return true for subscription with comment when transaction matches correctly', () => {
      const subscription = {
        title: 'Gym',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: 'Premium',
        frequency: 'monthly',
        startDate: '2026-01-01'
      };

      // Transaction with correct comment match
      AppStateService.instance.allTransactions = [{
        date: todayISO,
        time: '',
        account: 'Daily',
        amount: -50,
        category: '@Fitness',
        comment: 'Gym + Premium'
      }];

      expect(component.isPeriodPaid(subscription)).toBe(true);
    });
  });

  describe('applyCustomSorting()', () => {
    let component: SubscriptionComponent;
    let dataSource: MatTableDataSource<any>;

    beforeEach(() => {
      AppStateService.instance.allSubscriptions = [];
      component = Object.create(SubscriptionComponent.prototype);
      component.isChecked = true;
      dataSource = new MatTableDataSource<any>();
      component.applyCustomSorting(dataSource);
    });

    it('should sort by id as number', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ id: 5 }, 'id')).toBe(5);
    });

    it('should sort by amount as number', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ amount: -29.99 }, 'amount')).toBe(-29.99);
    });

    it('should sort by title case-insensitively', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ title: 'Netflix' }, 'title')).toBe('netflix');
    });

    it('should sort startDate by day-of-month when isChecked', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ startDate: '2024-03-15' }, 'startDate')).toBe(new Date('2024-03-15').getDate());
    });

    it('should sort startDate by timestamp when not isChecked', () => {
      component.isChecked = false;
      component.applyCustomSorting(dataSource);
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ startDate: '2024-03-15' }, 'startDate')).toBe(new Date('2024-03-15').getTime());
    });
  });
});
