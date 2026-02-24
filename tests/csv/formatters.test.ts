/**
 * CSV formatters unit tests
 */

import {
  zeroPad,
  spacePad,
  toFullWidthKana,
  toFullWidthNumber,
  formatDateCompact,
  formatYearMonthCompact,
  genderToCode,
  escapeCsvField,
} from '../../src/csv/formatters.js';

// ─── zeroPad ─────────────────────────────────────────────

describe('zeroPad', () => {
  it('should pad a number with leading zeros to the specified length', () => {
    expect(zeroPad(42, 6)).toBe('000042');
  });

  it('should pad a string number with leading zeros', () => {
    expect(zeroPad('7', 4)).toBe('0007');
  });

  it('should not truncate values longer than the specified length', () => {
    expect(zeroPad(123456, 4)).toBe('123456');
  });

  it('should return the same string when already at the target length', () => {
    expect(zeroPad('1234', 4)).toBe('1234');
  });

  it('should handle zero value', () => {
    expect(zeroPad(0, 3)).toBe('000');
  });
});

// ─── spacePad ────────────────────────────────────────────

describe('spacePad', () => {
  it('should pad a string with trailing spaces to the specified length', () => {
    expect(spacePad('abc', 8)).toBe('abc     ');
  });

  it('should not truncate values longer than the specified length', () => {
    expect(spacePad('abcdefgh', 4)).toBe('abcdefgh');
  });

  it('should return the same string when already at the target length', () => {
    expect(spacePad('abcd', 4)).toBe('abcd');
  });

  it('should handle empty string', () => {
    expect(spacePad('', 5)).toBe('     ');
  });
});

// ─── toFullWidthKana ─────────────────────────────────────

describe('toFullWidthKana', () => {
  it('should convert half-width katakana to full-width', () => {
    expect(toFullWidthKana('ｱｲｳ')).toBe('アイウ');
  });

  it('should convert dakuten (voiced) combinations', () => {
    expect(toFullWidthKana('ｶﾞ')).toBe('ガ');
    expect(toFullWidthKana('ｻﾞｼﾞｽﾞｾﾞｿﾞ')).toBe('ザジズゼゾ');
  });

  it('should convert handakuten (semi-voiced) combinations', () => {
    expect(toFullWidthKana('ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ')).toBe('パピプペポ');
  });

  it('should handle mixed content with ASCII characters', () => {
    expect(toFullWidthKana('ABC ｱｲｳ 123')).toBe('ABC アイウ 123');
  });

  it('should return already full-width katakana unchanged', () => {
    expect(toFullWidthKana('アイウ')).toBe('アイウ');
  });

  it('should convert vu (ｳﾞ) to vu (ヴ)', () => {
    expect(toFullWidthKana('ｳﾞ')).toBe('ヴ');
  });

  it('should handle empty string', () => {
    expect(toFullWidthKana('')).toBe('');
  });
});

// ─── toFullWidthNumber ───────────────────────────────────

describe('toFullWidthNumber', () => {
  it('should convert half-width digits to full-width', () => {
    expect(toFullWidthNumber('123')).toBe('\uFF11\uFF12\uFF13');
  });

  it('should leave non-digit characters unchanged', () => {
    expect(toFullWidthNumber('abc')).toBe('abc');
  });

  it('should convert digits within mixed content', () => {
    const result = toFullWidthNumber('Room 101');
    expect(result).toBe('Room \uFF11\uFF10\uFF11');
  });

  it('should handle empty string', () => {
    expect(toFullWidthNumber('')).toBe('');
  });

  it('should convert all single digits 0-9', () => {
    expect(toFullWidthNumber('0123456789')).toBe('\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19');
  });
});

// ─── formatDateCompact ───────────────────────────────────

describe('formatDateCompact', () => {
  it('should format a Date as YYYYMMDD', () => {
    // Note: months are 0-indexed in Date constructor
    expect(formatDateCompact(new Date(2026, 1, 15))).toBe('20260215');
  });

  it('should zero-pad single digit months and days', () => {
    expect(formatDateCompact(new Date(2026, 0, 5))).toBe('20260105');
  });

  it('should handle end-of-year dates', () => {
    expect(formatDateCompact(new Date(2026, 11, 31))).toBe('20261231');
  });
});

// ─── formatYearMonthCompact ──────────────────────────────

describe('formatYearMonthCompact', () => {
  it('should remove the hyphen from YYYY-MM format', () => {
    expect(formatYearMonthCompact('2026-02')).toBe('202602');
  });

  it('should handle year-month at year boundary', () => {
    expect(formatYearMonthCompact('2025-12')).toBe('202512');
  });
});

// ─── genderToCode ────────────────────────────────────────

describe('genderToCode', () => {
  it('should return "1" for male', () => {
    expect(genderToCode('male')).toBe('1');
  });

  it('should return "2" for female', () => {
    expect(genderToCode('female')).toBe('2');
  });

  it('should return "2" for other', () => {
    expect(genderToCode('other')).toBe('2');
  });
});

// ─── escapeCsvField ──────────────────────────────────────

describe('escapeCsvField', () => {
  it('should wrap field in double quotes when it contains a comma', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  it('should wrap field in double quotes when it contains a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('should escape double quotes by doubling them', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it('should return the value unchanged when no special characters are present', () => {
    expect(escapeCsvField('plain text')).toBe('plain text');
  });

  it('should handle empty string', () => {
    expect(escapeCsvField('')).toBe('');
  });

  it('should handle field with both comma and quotes', () => {
    expect(escapeCsvField('"price", 100')).toBe('"""price"", 100"');
  });
});
