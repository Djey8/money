import { FrequencyStrategy } from './frequency-strategy.interface';

/**
 * Weekly frequency strategy - generates occurrences every 7 days.
 * Preserves the day-of-week from the start date.
 * 
 * @example
 * If startDate is Monday (2026-04-05), all occurrences will be on Mondays.
 */
export class WeeklyFrequency implements FrequencyStrategy {
  
  /**
   * Calculates weekly occurrence dates.
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary date
   * @returns Array of dates occurring every 7 days
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
      
      // Add 7 days
      current.setDate(current.getDate() + 7);
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
