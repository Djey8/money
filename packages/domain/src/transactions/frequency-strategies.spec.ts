import { calculateOccurrences } from './frequency-strategies';

describe('Frequency Strategies', () => {
  describe('weekly', () => {
    it('should generate weekly occurrences', () => {
      const dates = calculateOccurrences('weekly', '2026-04-05', new Date('2026-05-05'));
      expect(dates).toEqual(['2026-04-05', '2026-04-12', '2026-04-19', '2026-04-26', '2026-05-03']);
    });

    it('should preserve day-of-week', () => {
      // April 5, 2026 is a Sunday
      const dates = calculateOccurrences('weekly', '2026-04-05', new Date('2026-05-05'));
      dates.forEach((dateStr) => {
        const date = new Date(dateStr);
        expect(date.getDay()).toBe(0); // Sunday
      });
    });

    it('should handle year boundary', () => {
      const dates = calculateOccurrences('weekly', '2025-12-28', new Date('2026-01-15'));
      expect(dates).toContain('2025-12-28');
      expect(dates).toContain('2026-01-04');
      expect(dates).toContain('2026-01-11');
    });

    it('should handle single occurrence', () => {
      const dates = calculateOccurrences('weekly', '2026-04-05', new Date('2026-04-05'));
      expect(dates).toEqual(['2026-04-05']);
    });

    it('should handle future start date', () => {
      const dates = calculateOccurrences('weekly', '2027-01-01', new Date('2026-12-31'));
      expect(dates).toEqual([]);
    });

    it('should handle leap year week', () => {
      // Feb 29, 2024 is a leap day (Thursday)
      const dates = calculateOccurrences('weekly', '2024-02-29', new Date('2024-03-28'));
      expect(dates).toEqual(['2024-02-29', '2024-03-07', '2024-03-14', '2024-03-21', '2024-03-28']);
    });
  });

  describe('biweekly', () => {
    it('should generate biweekly occurrences (every 14 days)', () => {
      const dates = calculateOccurrences('biweekly', '2026-04-05', new Date('2026-06-05'));
      expect(dates).toEqual(['2026-04-05', '2026-04-19', '2026-05-03', '2026-05-17', '2026-05-31']);
    });

    it('should handle year boundary', () => {
      const dates = calculateOccurrences('biweekly', '2025-12-20', new Date('2026-01-25'));
      expect(dates).toContain('2025-12-20');
      expect(dates).toContain('2026-01-03');
      expect(dates).toContain('2026-01-17');
    });

    it('should handle single occurrence', () => {
      const dates = calculateOccurrences('biweekly', '2026-04-05', new Date('2026-04-10'));
      expect(dates).toEqual(['2026-04-05']);
    });

    it('should handle month boundary', () => {
      const dates = calculateOccurrences('biweekly', '2026-01-25', new Date('2026-03-10'));
      expect(dates).toContain('2026-01-25');
      expect(dates).toContain('2026-02-08');
      expect(dates).toContain('2026-02-22');
      expect(dates).toContain('2026-03-08');
    });

    it('should exactly be 14 days apart', () => {
      const dates = calculateOccurrences('biweekly', '2026-01-01', new Date('2026-03-01'));
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(14);
      }
    });
  });

  describe('monthly', () => {
    it('should generate monthly occurrences', () => {
      const dates = calculateOccurrences('monthly', '2026-01-15', new Date('2026-05-15'));
      expect(dates).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15']);
    });

    it('should handle month-end clamping (Jan 31 -> Feb 28)', () => {
      const dates = calculateOccurrences('monthly', '2026-01-31', new Date('2026-04-30'));
      expect(dates).toContain('2026-01-31');
      expect(dates).toContain('2026-02-28'); // 2026 is not a leap year
      expect(dates).toContain('2026-03-31');
      expect(dates).toContain('2026-04-30');
    });

    it('should handle leap year (Feb 29)', () => {
      const dates = calculateOccurrences('monthly', '2024-01-31', new Date('2024-04-30'));
      expect(dates).toContain('2024-01-31');
      expect(dates).toContain('2024-02-29'); // 2024 is a leap year
      expect(dates).toContain('2024-03-31');
      expect(dates).toContain('2024-04-30');
    });

    it('should preserve day-of-month when possible', () => {
      const dates = calculateOccurrences('monthly', '2024-02-29', new Date('2024-05-29'));
      expect(dates).toContain('2024-02-29');
      expect(dates).toContain('2024-03-29');
      expect(dates).toContain('2024-04-29');
      expect(dates).toContain('2024-05-29');
    });

    it('should handle year boundary', () => {
      const dates = calculateOccurrences('monthly', '2025-11-15', new Date('2026-02-15'));
      expect(dates).toEqual(['2025-11-15', '2025-12-15', '2026-01-15', '2026-02-15']);
    });

    it('should handle single occurrence', () => {
      const dates = calculateOccurrences('monthly', '2026-04-05', new Date('2026-04-30'));
      expect(dates).toEqual(['2026-04-05']);
    });

    it('should handle day 30 in February', () => {
      const dates = calculateOccurrences('monthly', '2026-01-30', new Date('2026-03-30'));
      expect(dates).toContain('2026-01-30');
      expect(dates).toContain('2026-02-28'); // clamped from 30 to 28
      expect(dates).toContain('2026-03-30');
    });

    it('does not "stick" to a clamped day — retries the original target day every cycle', () => {
      // Jan 31 clamps to Feb 28, but March (31 days) goes back to day 31, not 28.
      const dates = calculateOccurrences('monthly', '2026-01-31', new Date('2026-03-31'));
      expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    });
  });

  describe('quarterly', () => {
    it('should generate quarterly occurrences (every 3 months)', () => {
      const dates = calculateOccurrences('quarterly', '2026-01-15', new Date('2026-12-31'));
      expect(dates).toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
    });

    it('should handle month-end clamping', () => {
      const dates = calculateOccurrences('quarterly', '2026-01-31', new Date('2026-10-31'));
      expect(dates).toContain('2026-01-31');
      expect(dates).toContain('2026-04-30');
      expect(dates).toContain('2026-07-31');
      expect(dates).toContain('2026-10-31');
    });

    it('should handle leap year February', () => {
      const dates = calculateOccurrences('quarterly', '2023-11-30', new Date('2024-08-30'));
      expect(dates).toContain('2023-11-30');
      expect(dates).toContain('2024-02-29'); // clamped to Feb 29 (leap year)
      expect(dates).toContain('2024-05-30');
      expect(dates).toContain('2024-08-30');
    });

    it('should handle year boundary', () => {
      const dates = calculateOccurrences('quarterly', '2025-10-15', new Date('2026-07-15'));
      expect(dates).toEqual(['2025-10-15', '2026-01-15', '2026-04-15', '2026-07-15']);
    });

    it('should handle single occurrence', () => {
      const dates = calculateOccurrences('quarterly', '2026-04-05', new Date('2026-06-30'));
      expect(dates).toEqual(['2026-04-05']);
    });

    it('should exactly be 3 months apart', () => {
      const dates = calculateOccurrences('quarterly', '2026-01-01', new Date('2027-01-01'));
      expect(dates.length).toBe(5); // Jan, Apr, Jul, Oct 2026, Jan 2027
    });
  });

  describe('yearly', () => {
    it('should generate yearly occurrences', () => {
      const dates = calculateOccurrences('yearly', '2023-06-15', new Date('2027-06-15'));
      expect(dates).toEqual(['2023-06-15', '2024-06-15', '2025-06-15', '2026-06-15', '2027-06-15']);
    });

    it('should handle Feb 29 leap year edge case', () => {
      const dates = calculateOccurrences('yearly', '2024-02-29', new Date('2028-02-29'));
      expect(dates).toEqual([
        '2024-02-29', // leap year
        '2025-02-28', // clamped
        '2026-02-28', // clamped
        '2027-02-28', // clamped
        '2028-02-29', // leap year
      ]);
    });

    it('should handle year boundary', () => {
      const dates = calculateOccurrences('yearly', '2020-12-31', new Date('2024-12-31'));
      expect(dates).toEqual(['2020-12-31', '2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31']);
    });

    it('should handle single occurrence', () => {
      const dates = calculateOccurrences('yearly', '2026-04-05', new Date('2026-12-31'));
      expect(dates).toEqual(['2026-04-05']);
    });

    it('should handle future start date', () => {
      const dates = calculateOccurrences('yearly', '2027-01-01', new Date('2026-12-31'));
      expect(dates).toEqual([]);
    });

    it('should handle long time spans', () => {
      const dates = calculateOccurrences('yearly', '2020-01-15', new Date('2030-01-15'));
      expect(dates.length).toBe(11); // 2020 through 2030 inclusive
    });

    it('should preserve month and day across years', () => {
      const dates = calculateOccurrences('yearly', '2023-03-25', new Date('2027-03-25'));
      dates.forEach((dateStr) => {
        const date = new Date(dateStr);
        expect(date.getMonth()).toBe(2); // March (0-indexed)
        expect(date.getDate()).toBe(25);
      });
    });
  });

  describe('edge cases across all strategies', () => {
    const frequencies = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

    it('should handle empty range (start > boundary)', () => {
      frequencies.forEach((frequency) => {
        const dates = calculateOccurrences(frequency, '2027-01-01', new Date('2026-12-31'));
        expect(dates).toEqual([]);
      });
    });

    it('should handle same day boundary', () => {
      frequencies.forEach((frequency) => {
        const dates = calculateOccurrences(frequency, '2026-04-05', new Date('2026-04-05'));
        expect(dates).toEqual(['2026-04-05']);
      });
    });
  });

  describe('unrecognized frequency', () => {
    it('falls back to monthly, matching FrequencyCalculatorService.getStrategy()', () => {
      const dates = calculateOccurrences(
        'not-a-real-frequency' as never,
        '2026-01-15',
        new Date('2026-03-15'),
      );
      expect(dates).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    });
  });
});
