import { FrequencyStrategy } from './frequency-strategy.interface';

/**
 * Biweekly frequency strategy - generates occurrences every 14 days (every 2 weeks).
 * This is true biweekly (every 14 days), not twice-per-month.
 * 
 * @example
 * If startDate is 2026-04-05, next occurrence is 2026-04-19 (14 days later).
 */
export class BiweeklyFrequency implements FrequencyStrategy {
  
  /**
   * Calculates biweekly occurrence dates.
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary date
   * @returns Array of dates occurring every 14 days
   */
  calculateOccurrences(startDate: string, boundaryDate: Date): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const boundary = new Date(boundaryDate);
    
    // Reset time to midnight for accurate comparison
    current.setHours(0, 0, 0, 0);
    boundary.setHours(23, 59, 59, 999);
    
    while (current <= boundary) {
      dates.push(this.formatDate(current));
      
      // Add 14 days
      current.setDate(current.getDate() + 14);
    }
    
    return dates;
  }
  
  /**
   * Formats a Date object to ISO date string (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
