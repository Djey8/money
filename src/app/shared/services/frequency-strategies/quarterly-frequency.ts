import { FrequencyStrategy } from './frequency-strategy.interface';

/**
 * Quarterly frequency strategy - generates occurrences every 3 months.
 * Handles month-end clamping like monthly frequency.
 * 
 * @example
 * startDate: 2026-01-31 → occurrences: Jan 31, Apr 30, Jul 31, Oct 31
 * startDate: 2026-02-28 → occurrences: Feb 28, May 28, Aug 28, Nov 28
 */
export class QuarterlyFrequency implements FrequencyStrategy {
  
  /**
   * Calculates quarterly occurrence dates.
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary date
   * @returns Array of dates occurring every 3 months
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
      
      // Increment by 3 months (handling year rollover)
      month += 3;
      if (month > 11) {
        year += Math.floor(month / 12);
        month = month % 12;
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
