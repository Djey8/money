import { GrowComponent } from './grow.component';
import { AppStateService } from '../../shared/services/app-state.service';
import { MatTableDataSource } from '@angular/material/table';

describe('GrowComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  describe('static allGrowProjects getter/setter', () => {
    it('should read from AppStateService', () => {
      AppStateService.instance.allGrowProjects = [{ title: 'Real Estate' }] as any;
      expect(GrowComponent.allGrowProjects).toEqual([{ title: 'Real Estate' }]);
    });

    it('should write to AppStateService', () => {
      GrowComponent.allGrowProjects = [{ title: 'Stocks' }] as any;
      expect(AppStateService.instance.allGrowProjects).toEqual([{ title: 'Stocks' }]);
    });
  });

  describe('applyCustomSorting()', () => {
    let component: any;
    let dataSource: MatTableDataSource<any>;

    beforeEach(() => {
      component = Object.create(GrowComponent.prototype);
      dataSource = new MatTableDataSource<any>();
      component.applyCustomSorting(dataSource);
    });

    it('should sort by id as number', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ id: 3 }, 'id')).toBe(3);
    });

    it('should sort by amount as number', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ amount: 5000 }, 'amount')).toBe(5000);
    });

    it('should sort by date as timestamp', () => {
      const accessor = dataSource.sortingDataAccessor;
      expect(accessor({ date: '2024-06-15' }, 'date')).toBe(new Date('2024-06-15').getTime());
    });
  });
});
