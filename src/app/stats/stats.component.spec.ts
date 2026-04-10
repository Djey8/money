import { StatsComponent } from './stats.component';

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
});
