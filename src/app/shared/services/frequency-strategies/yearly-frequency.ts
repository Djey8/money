import { FrequencyStrategy } from './frequency-strategy.interface';

/**
 * Yearly frequency strategy - generates occurrences on the same date each year.
 * Handles leap year edge case: Feb 29 → Feb 28 in non-leap years.
 * 
 * @example
 * startDate: 2024-02-29 → occurrences: 2024-02-29, 2025-02-28, 2026-02-28, 2027-02-28, 2028-02-29
 * startDate: 2026-06-15 → occurrences: 2026-06-15, 2027-06-15, 2028-06-15, ...
 */
export class YearlyFrequency implements FrequencyStrategy {
  
  /**
   * Calculates yearly occurrence dates.
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary date
   * @returns Array of dates occurring yearly, with Feb 29 clamped to Feb 28 in non-leap years
   */
  calculateOccurrences(startDate: string, boundaryDate: Date): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const boundary = new Date(boundaryDate);
    
    // Reset time to midnight for accurate comparison
    start.setHours(0, 0, 0, 0);
    boundary.setHours(23, 59, 59, 999);
    
    // Remember the original month and day from start date
    const targetMonth = start.getMonth();
    const targetDay = start.getDate();
    
    let currentYear = start.getFullYear();
    
    while (true) {
      // Handle Feb 29 in non-leap years
      let day = targetDay;
      if (targetMonth === 1 && targetDay === 29 && !this.isLeapYear(currentYear)) {
        day = 28;  // Clamp to Feb 28
      }
      
      const occurrence = new Date(currentYear, targetMonth, day);
      
      // Check if we've exceeded the boundary
      if (occurrence > boundary) {
        break;
      }
      
      dates.push(this.formatDate(occurrence));
      
      // Increment year
      currentYear++;
    }
    
    return dates;
  }
  
  /**
   * Checks if a year is a leap year.
   * Leap years are divisible by 4, except for years divisible by 100 (unless also divisible by 400).
   * 
   * @param year - Full year (e.g., 2024)
   * @returns true if leap year, false otherwise
   */
  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
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
