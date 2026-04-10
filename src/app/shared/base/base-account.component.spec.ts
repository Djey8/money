import { MatTableDataSource } from '@angular/material/table';
import { BaseAccountComponent } from './base-account.component';

describe('BaseAccountComponent', () => {
  describe('applyCustomSorting()', () => {
    let dataSource: MatTableDataSource<any>;
    let instance: any;

    beforeEach(() => {
      dataSource = new MatTableDataSource<any>();
      instance = Object.create(BaseAccountComponent.prototype);
      instance.applyCustomSorting(dataSource);
    });

    it('should sort by id as number', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ id: 42 }, 'id')).toBe(42);
    });

    it('should sort by amount as number', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ amount: -99.5 }, 'amount')).toBe(-99.5);
    });

    it('should sort by category as lowercase string', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ category: 'Food' }, 'category')).toBe('food');
    });

    it('should sort by date as timestamp', () => {
      const accessor = dataSource.sortingDataAccessor;
      const timestamp = accessor({ date: '2024-06-15' }, 'date');
      expect(timestamp).toBe(new Date('2024-06-15').getTime());
    });

    it('should fall back to raw property for unknown columns', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ account: 'Daily' }, 'account')).toBe('Daily');
    });
  });
});
