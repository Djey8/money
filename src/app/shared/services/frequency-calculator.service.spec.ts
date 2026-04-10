import { FrequencyCalculatorService } from './frequency-calculator.service';
import { WeeklyFrequency, MonthlyFrequency } from './frequency-strategies';

describe('FrequencyCalculatorService', () => {
  let service: FrequencyCalculatorService;

  beforeEach(() => {
    service = FrequencyCalculatorService.instance;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return singleton instance', () => {
    const instance1 = FrequencyCalculatorService.instance;
    const instance2 = FrequencyCalculatorService.instance;
    expect(instance1).toBe(instance2);
  });

  describe('getStrategy', () => {
    it('should return WeeklyFrequency for weekly', () => {
      const strategy = service.getStrategy('weekly');
      expect(strategy).toBeInstanceOf(WeeklyFrequency);
    });

    it('should return MonthlyFrequency for monthly', () => {
      const strategy = service.getStrategy('monthly');
      expect(strategy).toBeInstanceOf(MonthlyFrequency);
    });

    it('should return same instance for repeated calls (caching)', () => {
      const strategy1 = service.getStrategy('weekly');
      const strategy2 = service.getStrategy('weekly');
      expect(strategy1).toBe(strategy2);
    });

    it('should return different instances for different frequencies', () => {
      const weeklyStrategy = service.getStrategy('weekly');
      const monthlyStrategy = service.getStrategy('monthly');
      expect(weeklyStrategy).not.toBe(monthlyStrategy);
    });
  });

  describe('calculateOccurrences', () => {
    it('should calculate weekly occurrences', () => {
      const dates = service.calculateOccurrences(
        'weekly',
        '2026-04-05',
        new Date('2026-05-05')
      );
      expect(dates).toEqual([
        '2026-04-05',
        '2026-04-12',
        '2026-04-19',
        '2026-04-26',
        '2026-05-03'
      ]);
    });

    it('should calculate monthly occurrences', () => {
      const dates = service.calculateOccurrences(
        'monthly',
        '2026-01-15',
        new Date('2026-04-15')
      );
      expect(dates).toEqual([
        '2026-01-15',
        '2026-02-15',
        '2026-03-15',
        '2026-04-15'
      ]);
    });

    it('should calculate biweekly occurrences', () => {
      const dates = service.calculateOccurrences(
        'biweekly',
        '2026-04-05',
        new Date('2026-05-05')
      );
      expect(dates).toEqual([
        '2026-04-05',
        '2026-04-19',
        '2026-05-03'
      ]);
    });

    it('should calculate quarterly occurrences', () => {
      const dates = service.calculateOccurrences(
        'quarterly',
        '2026-01-15',
        new Date('2026-12-31')
      );
      expect(dates).toEqual([
        '2026-01-15',
        '2026-04-15',
        '2026-07-15',
        '2026-10-15'
      ]);
    });

    it('should calculate yearly occurrences', () => {
      const dates = service.calculateOccurrences(
        'yearly',
        '2023-06-15',
        new Date('2026-06-15')
      );
      expect(dates).toEqual([
        '2023-06-15',
        '2024-06-15',
        '2025-06-15',
        '2026-06-15'
      ]);
    });
  });
});
