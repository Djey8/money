import { GrowComponent } from './grow.component';
import { AppStateService } from '../../shared/services/app-state.service';
import { MatTableDataSource } from '@angular/material/table';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';

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

  describe('sellOffer() and isAffected() (a Harvest card’s offer)', () => {
    let component: any;

    beforeEach(() => {
      component = Object.create(GrowComponent.prototype);
      jest.spyOn(CashflowGameService, 'isCashflowGame').mockReturnValue(true);
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        turn: { count: 5 } as any,
        holdings: [{ title: 'WORLD', cardId: 'S10', units: 4 }] as any,
        marketOffers: [
          {
            title: 'WORLD',
            cardId: 'H107',
            label: 'Year-End Rally',
            salePriceMinor: 0,
            pricePerShareMinor: 10700,
            offeredAtRoll: 4,
            validRolls: 3,
          },
        ],
      } as any;
    });

    afterEach(() => jest.restoreAllMocks());

    it('tells what the offer pays for everything held and how many turns are left', () => {
      expect(component.sellOffer({ title: 'WORLD' })).toEqual({ price: 428, left: 2 });
      expect(component.isAffected({ title: 'WORLD' })).toBe(true);
    });

    it('has nothing to tell once the offer has run out, or for another project', () => {
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        turn: { count: 7 } as any,
      } as any;
      expect(component.sellOffer({ title: 'WORLD' })).toBeNull();
      expect(component.isAffected({ title: 'WORLD' })).toBe(false);
      expect(component.sellOffer({ title: 'BTC' })).toBeNull();
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
