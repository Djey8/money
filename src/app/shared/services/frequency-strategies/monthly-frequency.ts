import { FrequencyStrategy } from './frequency-strategy.interface';

/**
 * Monthly frequency strategy - generates occurrences on the same day each month.
 * Handles month-end clamping (e.g., Jan 31 → Feb 28 in non-leap years).
 * 
 * @example
 * startDate: 2026-01-31 → occurrences: Jan 31, Feb 28, Mar 31, Apr 30, May 31, ...
 * startDate: 2024-02-29 → occurrences: Feb 29, Mar 29, Apr 29, ... (preserves day 29)
 */
export class MonthlyFrequency implements FrequencyStrategy {
  
  /**
   * Calculates monthly occurrence dates.
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary date
   * @returns Array of dates occurring monthly, with day clamped to valid range
   */
  calculateOccurrences(startDate: string, boundaryDate: Date): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const boundary = new Date(boundaryDate);
    
    // Reset time to midnight for accurate comparison
    start.setHours(0, 0, 0, 0);
    boundary.setHours(23, 59, 59, 999);
    
    // Remember the original day-of-month from start date
    const targetDay = start.getDate();
    
    let year = start.getFullYear();
    let month = start.getMonth();
    
    while (true) {
      // Clamp day to valid range for current month
      const daysInMonth = this.getDaysInMonth(year, month);
      const clampedDay = Math.min(targetDay, daysInMonth);
      
      const occurrence = new Date(year, month, clampedDay);
      
      // Check if we've exceeded the boundary
      if (occurrence > boundary) {
        break;
      }
      
      dates.push(this.formatDate(occurrence));
      
      // Increment month (handling year rollover)
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
    
    return dates;
  }
  
  /**
   * Gets the number of days in a given month.
   * Handles leap years correctly.
   * 
   * @param year - Full year (e.g., 2026)
   * @param month - Month (0-11, where 0 = January)
   * @returns Number of days in the month (28-31)
   */
  private getDaysInMonth(year: number, month: number): number {
    // Creating date with day=0 of next month gives last day of current month
    return new Date(year, month + 1, 0).getDate();
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
