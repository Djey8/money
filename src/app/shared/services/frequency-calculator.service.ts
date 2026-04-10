import { Injectable } from '@angular/core';
import { SubscriptionFrequency } from '../../interfaces/subscription';
import {
  FrequencyStrategy,
  WeeklyFrequency,
  BiweeklyFrequency,
  MonthlyFrequency,
  QuarterlyFrequency,
  YearlyFrequency
} from './frequency-strategies';

/**
 * Service for calculating subscription occurrence dates based on frequency.
 * Uses the Strategy pattern to delegate calculation to frequency-specific implementations.
 * 
 * @example
 * const calculator = FrequencyCalculatorService.instance;
 * const strategy = calculator.getStrategy('weekly');
 * const dates = strategy.calculateOccurrences('2026-04-05', new Date('2026-05-05'));
 */
@Injectable({
  providedIn: 'root'
})
export class FrequencyCalculatorService {
  private static _instance: FrequencyCalculatorService;

  // Cache strategy instances to avoid repeated instantiation
  private readonly strategies: Map<SubscriptionFrequency, FrequencyStrategy> = new Map<SubscriptionFrequency, FrequencyStrategy>([
    ['weekly', new WeeklyFrequency()],
    ['biweekly', new BiweeklyFrequency()],
    ['monthly', new MonthlyFrequency()],
    ['quarterly', new QuarterlyFrequency()],
    ['yearly', new YearlyFrequency()]
  ]);

  /**
   * Singleton instance accessor.
   * Maintains single instance across application for consistent strategy access.
   */
  static get instance(): FrequencyCalculatorService {
    if (!FrequencyCalculatorService._instance) {
      FrequencyCalculatorService._instance = new FrequencyCalculatorService();
    }
    return FrequencyCalculatorService._instance;
  }

  /**
   * Gets the appropriate frequency strategy for the given frequency type.
   * 
   * @param frequency - The subscription frequency type
   * @returns FrequencyStrategy implementation for the given frequency
   * @throws Error if frequency is not recognized (should never happen with TypeScript typing)
   * 
   * @example
   * const strategy = calculator.getStrategy('monthly');
   * const dates = strategy.calculateOccurrences(startDate, boundary);
   */
  getStrategy(frequency: SubscriptionFrequency): FrequencyStrategy {
    const strategy = this.strategies.get(frequency);
    
    if (!strategy) {
      // Defensive: should never happen with proper typing, but handle gracefully
      console.error(`Unknown frequency: ${frequency}, defaulting to monthly`);
      return this.strategies.get('monthly')!;
    }
    
    return strategy;
  }

  /**
   * Convenience method to calculate occurrences directly without getting strategy first.
   * 
   * @param frequency - The subscription frequency type
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary date
   * @returns Array of occurrence dates in ISO format
   * 
   * @example
   * const dates = calculator.calculateOccurrences('weekly', '2026-04-05', new Date());
   */
  calculateOccurrences(
    frequency: SubscriptionFrequency,
    startDate: string,
    boundaryDate: Date
  ): string[] {
    const strategy = this.getStrategy(frequency);
    return strategy.calculateOccurrences(startDate, boundaryDate);
  }
}
