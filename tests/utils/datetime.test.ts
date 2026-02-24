/**
 * datetime utility tests
 */

import {
  formatDate,
  formatDateCompact,
  formatYearMonth,
  nowJST,
  isBusinessDay,
  isHoliday,
  getBusinessDaysInMonth,
  getBusinessDaysArray,
  calculateWorkMinutes,
  parseYearMonth,
} from '../../src/utils/datetime.js';

// ─── formatDate ──────────────────────────────────────────

describe('formatDate', () => {
  it('should format a standard date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2025, 0, 15))).toBe('2025-01-15');
  });

  it('should zero-pad single-digit months and days', () => {
    expect(formatDate(new Date(2025, 2, 5))).toBe('2025-03-05');
  });

  it('should handle December 31', () => {
    expect(formatDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('should handle January 1', () => {
    expect(formatDate(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  it('should handle leap year date Feb 29', () => {
    expect(formatDate(new Date(2024, 1, 29))).toBe('2024-02-29');
  });
});

// ─── formatDateCompact ───────────────────────────────────

describe('formatDateCompact', () => {
  it('should format date as YYYYMMDD without hyphens', () => {
    expect(formatDateCompact(new Date(2025, 5, 10))).toBe('20250610');
  });

  it('should zero-pad month and day', () => {
    expect(formatDateCompact(new Date(2025, 0, 1))).toBe('20250101');
  });
});

// ─── formatYearMonth ────────────────────────────────────

describe('formatYearMonth', () => {
  it('should format as YYYYMM', () => {
    expect(formatYearMonth(new Date(2025, 0, 15))).toBe('202501');
  });

  it('should handle December', () => {
    expect(formatYearMonth(new Date(2025, 11, 1))).toBe('202512');
  });

  it('should zero-pad single-digit month', () => {
    expect(formatYearMonth(new Date(2025, 3, 1))).toBe('202504');
  });
});

// ─── nowJST ─────────────────────────────────────────────

describe('nowJST', () => {
  it('should return a Date object', () => {
    const result = nowJST();
    expect(result).toBeInstanceOf(Date);
  });

  it('should return a date that is reasonable (not NaN)', () => {
    const result = nowJST();
    expect(result.getTime()).not.toBeNaN();
  });
});

// ─── isBusinessDay ──────────────────────────────────────

describe('isBusinessDay', () => {
  it('should return true for a regular weekday (Wednesday)', () => {
    // 2025-06-04 is a Wednesday
    expect(isBusinessDay(new Date(2025, 5, 4))).toBe(true);
  });

  it('should return false for Saturday', () => {
    // 2025-06-07 is a Saturday
    expect(isBusinessDay(new Date(2025, 5, 7))).toBe(false);
  });

  it('should return false for Sunday', () => {
    // 2025-06-08 is a Sunday
    expect(isBusinessDay(new Date(2025, 5, 8))).toBe(false);
  });

  it('should return false for New Year (Jan 1)', () => {
    expect(isBusinessDay(new Date(2025, 0, 1))).toBe(false);
  });

  it('should return false for Constitution Memorial Day (May 3)', () => {
    // 2025-05-03 is a Saturday so it is already a weekend
    // Use 2026-05-03 which is a Sunday, also non-business
    // Use a year where May 3 falls on a weekday: 2027 May 3 is Monday
    expect(isBusinessDay(new Date(2027, 4, 3))).toBe(false);
  });

  it('should return true for a regular Monday that is not a holiday', () => {
    // 2025-06-02 is a Monday
    expect(isBusinessDay(new Date(2025, 5, 2))).toBe(true);
  });
});

// ─── isHoliday ──────────────────────────────────────────

describe('isHoliday', () => {
  it('should return true for New Year (Jan 1)', () => {
    expect(isHoliday(new Date(2025, 0, 1))).toBe(true);
  });

  it('should return true for National Foundation Day (Feb 11)', () => {
    expect(isHoliday(new Date(2025, 1, 11))).toBe(true);
  });

  it('should return true for Emperor Birthday (Feb 23)', () => {
    expect(isHoliday(new Date(2025, 1, 23))).toBe(true);
  });

  it('should return true for Showa Day (Apr 29)', () => {
    expect(isHoliday(new Date(2025, 3, 29))).toBe(true);
  });

  it('should return true for Constitution Memorial Day (May 3)', () => {
    expect(isHoliday(new Date(2025, 4, 3))).toBe(true);
  });

  it('should return true for Children Day (May 5)', () => {
    expect(isHoliday(new Date(2025, 4, 5))).toBe(true);
  });

  it('should return true for Mountain Day (Aug 11)', () => {
    expect(isHoliday(new Date(2025, 7, 11))).toBe(true);
  });

  it('should return true for Culture Day (Nov 3)', () => {
    expect(isHoliday(new Date(2025, 10, 3))).toBe(true);
  });

  it('should return false for a regular weekday', () => {
    // 2025-06-04 Wednesday
    expect(isHoliday(new Date(2025, 5, 4))).toBe(false);
  });

  it('should return false for a regular weekend (not a holiday)', () => {
    // 2025-06-07 Saturday — weekend but not a national holiday
    expect(isHoliday(new Date(2025, 5, 7))).toBe(false);
  });

  it('should detect Coming of Age Day (Happy Monday, Jan 2nd Mon)', () => {
    // 2025-01-13 is the 2nd Monday in January
    expect(isHoliday(new Date(2025, 0, 13))).toBe(true);
  });

  it('should detect Sports Day (Happy Monday, Oct 2nd Mon)', () => {
    // 2025-10-13 is the 2nd Monday in October
    expect(isHoliday(new Date(2025, 9, 13))).toBe(true);
  });
});

// ─── getBusinessDaysInMonth ─────────────────────────────

describe('getBusinessDaysInMonth', () => {
  it('should return a positive number for a normal month', () => {
    const days = getBusinessDaysInMonth(2025, 6); // June 2025
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(23); // max possible weekdays in a month
  });

  it('should return fewer business days than total calendar days', () => {
    // June 2025 has 30 calendar days; business days must be strictly less
    const junDays = getBusinessDaysInMonth(2025, 6);
    expect(junDays).toBeLessThan(30);
    expect(junDays).toBeGreaterThan(15); // at least half should be business days
  });

  it('should match getBusinessDaysArray length', () => {
    const count = getBusinessDaysInMonth(2025, 4);
    const arr = getBusinessDaysArray(2025, 4);
    expect(count).toBe(arr.length);
  });
});

// ─── getBusinessDaysArray ───────────────────────────────

describe('getBusinessDaysArray', () => {
  it('should return an array of Date objects', () => {
    const days = getBusinessDaysArray(2025, 6);
    expect(Array.isArray(days)).toBe(true);
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(d).toBeInstanceOf(Date);
    }
  });

  it('should only contain weekdays that are not holidays', () => {
    const days = getBusinessDaysArray(2025, 6);
    for (const d of days) {
      expect(isBusinessDay(d)).toBe(true);
    }
  });

  it('should return dates within the specified month', () => {
    const days = getBusinessDaysArray(2025, 3); // March
    for (const d of days) {
      expect(d.getMonth()).toBe(2); // 0-indexed: March = 2
      expect(d.getFullYear()).toBe(2025);
    }
  });
});

// ─── calculateWorkMinutes ───────────────────────────────

describe('calculateWorkMinutes', () => {
  it('should calculate simple work hours', () => {
    // 09:00 to 17:00 = 480 minutes
    expect(calculateWorkMinutes('09:00', '17:00')).toBe(480);
  });

  it('should subtract break minutes', () => {
    // 09:00 to 17:00 minus 60 min break = 420 minutes
    expect(calculateWorkMinutes('09:00', '17:00', 60)).toBe(420);
  });

  it('should handle short shifts', () => {
    // 10:00 to 12:00 = 120 minutes
    expect(calculateWorkMinutes('10:00', '12:00')).toBe(120);
  });

  it('should handle half-hour boundaries', () => {
    // 09:30 to 16:45 = 435 minutes
    expect(calculateWorkMinutes('09:30', '16:45')).toBe(435);
  });

  it('should return 0 when break exceeds work time', () => {
    // 10:00 to 11:00 = 60 minutes, break = 120
    expect(calculateWorkMinutes('10:00', '11:00', 120)).toBe(0);
  });

  it('should return 0 when clockIn equals clockOut', () => {
    expect(calculateWorkMinutes('09:00', '09:00')).toBe(0);
  });

  it('should default break to 0 when not specified', () => {
    expect(calculateWorkMinutes('09:00', '10:00')).toBe(60);
  });

  it('should handle midnight-adjacent times', () => {
    // 00:00 to 08:00 = 480 minutes (night shift)
    expect(calculateWorkMinutes('00:00', '08:00')).toBe(480);
  });
});

// ─── parseYearMonth ─────────────────────────────────────

describe('parseYearMonth', () => {
  it('should parse YYYY-MM format', () => {
    expect(parseYearMonth('2025-06')).toEqual({ year: 2025, month: 6 });
  });

  it('should parse January', () => {
    expect(parseYearMonth('2025-01')).toEqual({ year: 2025, month: 1 });
  });

  it('should parse December', () => {
    expect(parseYearMonth('2025-12')).toEqual({ year: 2025, month: 12 });
  });

  it('should handle a different year', () => {
    expect(parseYearMonth('2030-03')).toEqual({ year: 2030, month: 3 });
  });
});
