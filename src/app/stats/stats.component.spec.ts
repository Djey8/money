import { StatsComponent } from './stats.component';
import { AppStateService } from '../shared/services/app-state.service';

// StatsComponent uses deferred imports (setTimeout + dynamic import) for
// MenuComponent, SettingsComponent, etc. Constructor accesses these before
// they resolve, so createComponent crashes. Test static methods only.
describe('StatsComponent', () => {
  it('should exist as a class', () => {
    expect(StatsComponent).toBeTruthy();
  });

  describe('static state management', () => {
    it('should track modus state', () => {
      StatsComponent.modus = 'home';
      expect(StatsComponent.modus).toBe('home');
    });

    it('should track isKPI state', () => {
      StatsComponent.isKPI = true;
      expect(StatsComponent.isKPI).toBe(true);
      StatsComponent.isKPI = false;
      expect(StatsComponent.isKPI).toBe(false);
    });

    it('should track isBIDashboard state', () => {
      StatsComponent.isBIDashboard = true;
      expect(StatsComponent.isBIDashboard).toBe(true);
    });
  });

  describe('redraws when the Cashflow game changes the data', () => {
    afterEach(() => jest.useRealTimers());

    it('redraws the account charts once for a burst of transaction/subscription updates, and stops after destroy', () => {
      jest.useFakeTimers();
      StatsComponent.isBIDashboard = false;
      const stats: any = Object.create(StatsComponent.prototype);
      stats.callCharts = jest.fn();
      const state = AppStateService.instance;

      stats.ngOnInit();
      state.transactionsUpdated$.next();
      state.subscriptionsUpdated$.next(); // a Payday fires both
      jest.advanceTimersByTime(300);
      expect(stats.callCharts).toHaveBeenCalledTimes(1);

      stats.ngOnDestroy();
      state.transactionsUpdated$.next();
      jest.advanceTimersByTime(300);
      expect(stats.callCharts).toHaveBeenCalledTimes(1);
    });

    it('rebuilds the open BI dashboard instead when one is showing', () => {
      jest.useFakeTimers();
      StatsComponent.isBIDashboard = true;
      const build = jest.spyOn(StatsComponent as any, 'createBIDashboard').mockImplementation();
      const stats: any = Object.create(StatsComponent.prototype);
      stats.callCharts = jest.fn();

      stats.ngOnInit();
      AppStateService.instance.transactionsUpdated$.next();
      jest.advanceTimersByTime(300);

      expect(build).toHaveBeenCalledTimes(1);
      expect(stats.callCharts).not.toHaveBeenCalled();
      stats.ngOnDestroy();
      build.mockRestore();
      StatsComponent.isBIDashboard = false;
    });
  });
});
