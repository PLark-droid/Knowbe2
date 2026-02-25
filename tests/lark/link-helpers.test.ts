/**
 * link-helpers テスト
 */
import { describe, expect, it } from 'vitest';
import { getLinkRecordId, toLinkValue } from '../../src/lark/link-helpers.js';

describe('getLinkRecordId', () => {
  it('should extract record_id from array format', () => {
    expect(getLinkRecordId(['recABC123'])).toBe('recABC123');
  });

  it('should return first element from multi-element array', () => {
    expect(getLinkRecordId(['recFirst', 'recSecond'])).toBe('recFirst');
  });

  it('should return empty string for empty array', () => {
    expect(getLinkRecordId([])).toBe('');
  });

  it('should return empty string for array with null', () => {
    expect(getLinkRecordId([null])).toBe('');
  });

  it('should return string value for non-array string input', () => {
    expect(getLinkRecordId('recDirect')).toBe('recDirect');
  });

  it('should return empty string for null', () => {
    expect(getLinkRecordId(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(getLinkRecordId(undefined)).toBe('');
  });

  it('should convert number to string', () => {
    expect(getLinkRecordId(42)).toBe('42');
  });
});

describe('toLinkValue', () => {
  it('should wrap record_id in array', () => {
    expect(toLinkValue('recABC123')).toEqual(['recABC123']);
  });

  it('should return undefined for empty string', () => {
    expect(toLinkValue('')).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(toLinkValue(undefined)).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(toLinkValue(null)).toBeUndefined();
  });
});
