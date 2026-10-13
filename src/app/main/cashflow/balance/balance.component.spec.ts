import { BalanceComponent } from './balance.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { LocalService } from '../../../shared/services/local.service';
import { cashflowByLocation } from '../../../shared/location-balance';

describe('BalanceComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  describe('getShares()', () => {
    it('should sum quantity × price for all shares', () => {
      AppStateService.instance.allShares = [
        { tag: 'AAPL', quantity: 10, price: 150 },
        { tag: 'MSFT', quantity: 5, price: 300 },
      ] as any;
      // 10*150 + 5*300 = 1500 + 1500 = 3000
      expect(BalanceComponent.getShares()).toBe(3000);
    });

    it('should return 0 for empty shares', () => {
      AppStateService.instance.allShares = [];
      expect(BalanceComponent.getShares()).toBe(0);
    });
  });

  describe('getInvestments()', () => {
    it('should sum amount + deposit for all investments', () => {
      AppStateService.instance.allInvestments = [
        { tag: 'Fund A', amount: 10000, deposit: 500 },
        { tag: 'Fund B', amount: 5000, deposit: 200 },
      ] as any;
      // (10000+500) + (5000+200) = 15700
      expect(BalanceComponent.getInvestments()).toBe(15700);
    });

    it('should return 0 for empty investments', () => {
      AppStateService.instance.allInvestments = [];
      expect(BalanceComponent.getInvestments()).toBe(0);
    });
  });

  describe('getAssets()', () => {
    it('should sum amounts for all assets', () => {
      AppStateService.instance.allAssets = [
        { tag: 'Car', amount: 15000 },
        { tag: 'House', amount: 200000 },
      ] as any;
      expect(BalanceComponent.getAssets()).toBe(215000);
    });

    it('should return 0 for empty assets', () => {
      AppStateService.instance.allAssets = [];
      expect(BalanceComponent.getAssets()).toBe(0);
    });
  });

  describe('getLiabilities()', () => {
    it('should sum amount + credit for all liabilities', () => {
      AppStateService.instance.liabilities = [
        { tag: 'Mortgage', amount: 150000, credit: 5000 },
        { tag: 'Car Loan', amount: 10000, credit: 200 },
      ] as any;
      // (150000+5000) + (10000+200) = 165200
      expect(BalanceComponent.getLiabilities()).toBe(165200);
    });

    it('should return 0 for empty liabilities', () => {
      AppStateService.instance.liabilities = [];
      expect(BalanceComponent.getLiabilities()).toBe(0);
    });
  });

  describe('static getter/setter delegates to AppStateService', () => {
    it('should read allAssets from AppStateService', () => {
      AppStateService.instance.allAssets = [{ tag: 'X', amount: 1 }] as any;
      expect(BalanceComponent.allAssets).toEqual([{ tag: 'X', amount: 1 }]);
    });

    it('should write allShares to AppStateService', () => {
      BalanceComponent.allShares = [{ tag: 'Y', quantity: 1, price: 1 }] as any;
      expect(AppStateService.instance.allShares).toEqual([{ tag: 'Y', quantity: 1, price: 1 }]);
    });
  });

  describe('Cashflow by location', () => {
    it('lists every location and what the locations do not account for', () => {
      AppStateService.instance.allLocations = [
        { id: 'a', name: 'N26', subName: 'Main', amount: 2400 },
        { id: 'b', name: 'Cash', amount: 100 },
      ];
      const { rows, total, unassigned } = cashflowByLocation(
        2600,
        AppStateService.instance.allLocations,
      );
      expect(rows.map((l) => l.id)).toEqual(['a', 'b']);
      expect(total).toBe(2500);
      expect(unassigned).toBe(100);
    });

    it('is balanced (nothing unassigned) when the locations add up to the Cashflow', () => {
      const locations = [
        { id: 'a', name: 'A', amount: 0.1 },
        { id: 'b', name: 'B', amount: 0.2 },
      ];
      expect(cashflowByLocation(0.3, locations).unassigned).toBe(0);
    });

    it('a negative difference means the locations hold more than the Cashflow shows', () => {
      expect(cashflowByLocation(100, [{ id: 'a', name: 'A', amount: 150 }]).unassigned).toBe(-50);
    });

    it('with no locations everything is unassigned (the row then shows the setup hint instead)', () => {
      expect(cashflowByLocation(500, [])).toEqual({ rows: [], total: 0, unassigned: 500 });
    });
  });
});
