/**
 * Base interface for frequency calculation strategies.
 * Each frequency type (weekly, biweekly, monthly, quarterly, yearly) 
 * implements this interface to calculate occurrence dates.
 */
export interface FrequencyStrategy {
  /**
   * Calculates all occurrence dates for a subscription between start and boundary dates.
   * 
   * @param startDate - The start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - The end boundary date (usually today or subscription end date)
   * @returns Array of occurrence dates in ISO format (YYYY-MM-DD), sorted chronologically
   * 
   * @example
   * // Weekly strategy
   * calculateOccurrences('2026-04-05', new Date('2026-05-05'))
   * // Returns: ['2026-04-05', '2026-04-12', '2026-04-19', '2026-04-26', '2026-05-03']
   */
  calculateOccurrences(startDate: string, boundaryDate: Date): string[];
}
