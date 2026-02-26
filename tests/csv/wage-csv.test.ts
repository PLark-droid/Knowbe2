/**
 * Tests for wage CSV generator
 * @module tests/csv/wage-csv
 */

import {
  buildWageCsvRecords,
  encodeWageRecords,
  exportWageCsv,
} from '../../src/csv/wage-csv.js';
import type { MonthlyWageResult, UserWageResult } from '../../src/billing/wage-calculator.js';
import type { WageCsvRecord } from '../../src/types/csv.js';

// ─── Test Fixtures ──────────────────────────────────────

function createUserWageResult(overrides?: Partial<UserWageResult>): UserWageResult {
  return {
    userId: 'user-001',
    name: '山田太郎',
    attendanceDays: 20,
    totalWorkMinutes: 6000, // 100 hours
    baseWage: 10000,
    skillWage: 2000,
    attendanceBonus: 1000,
    totalWage: 13000,
    deductions: 500,
    netWage: 12500,
    ...overrides,
  };
}

function createMonthlyWageResult(overrides?: Partial<MonthlyWageResult>): MonthlyWageResult {
  return {
    facilityId: 'fac-001',
    yearMonth: '2025-06',
    userWages: [createUserWageResult()],
    totalWage: 12500,
    averageWage: 12500,
    meetsMinimumThreshold: true,
    ...overrides,
  };
}

function createWageCsvRecord(overrides?: Partial<WageCsvRecord>): WageCsvRecord {
  return {
    userNumber: 'user-001',
    name: '山田太郎',
    yearMonth: '2025-06',
    attendanceDays: 20,
    totalWorkHours: 100,
    baseWage: 10000,
    skillWage: 2000,
    attendanceBonus: 1000,
    totalWage: 13000,
    deductions: 500,
    netWage: 12500,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('buildWageCsvRecords', () => {
  it('should convert wage result to CSV records', () => {
    const result = createMonthlyWageResult();
    const records = buildWageCsvRecords(result);

    expect(records).toHaveLength(1);
    expect(records[0]!.userNumber).toBe('user-001');
    expect(records[0]!.name).toBe('山田太郎');
    expect(records[0]!.yearMonth).toBe('2025-06');
    expect(records[0]!.attendanceDays).toBe(20);
    expect(records[0]!.baseWage).toBe(10000);
    expect(records[0]!.skillWage).toBe(2000);
    expect(records[0]!.attendanceBonus).toBe(1000);
    expect(records[0]!.totalWage).toBe(13000);
    expect(records[0]!.deductions).toBe(500);
    expect(records[0]!.netWage).toBe(12500);
  });

  it('should convert totalWorkMinutes to hours with 2 decimal places', () => {
    const result = createMonthlyWageResult({
      userWages: [createUserWageResult({ totalWorkMinutes: 125 })], // 2.08333... hours
    });

    const records = buildWageCsvRecords(result);

    // Math.round((125 / 60) * 100) / 100 = Math.round(208.33) / 100 = 2.08
    expect(records[0]!.totalWorkHours).toBe(2.08);
  });

  it('should handle multiple users', () => {
    const user1 = createUserWageResult({ userId: 'user-001', name: '山田太郎', netWage: 12500 });
    const user2 = createUserWageResult({ userId: 'user-002', name: '鈴木花子', netWage: 15000 });
    const result = createMonthlyWageResult({ userWages: [user1, user2] });

    const records = buildWageCsvRecords(result);

    expect(records).toHaveLength(2);
    expect(records[0]!.userNumber).toBe('user-001');
    expect(records[1]!.userNumber).toBe('user-002');
  });

  it('should use yearMonth from the result for all records', () => {
    const user1 = createUserWageResult({ userId: 'user-001' });
    const user2 = createUserWageResult({ userId: 'user-002' });
    const result = createMonthlyWageResult({ yearMonth: '2025-12', userWages: [user1, user2] });

    const records = buildWageCsvRecords(result);

    expect(records[0]!.yearMonth).toBe('2025-12');
    expect(records[1]!.yearMonth).toBe('2025-12');
  });

  it('should return empty array when there are no user wages', () => {
    const result = createMonthlyWageResult({ userWages: [] });

    const records = buildWageCsvRecords(result);

    expect(records).toHaveLength(0);
  });

  it('should warn when average wage is below 3000 yen', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = createMonthlyWageResult({ averageWage: 2999 });

    buildWageCsvRecords(result);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('3,000円未満'));
    warnSpy.mockRestore();
  });
});

describe('encodeWageRecords', () => {
  it('should include header row as the first line', () => {
    const records = [createWageCsvRecord()];
    const csv = encodeWageRecords(records, false);

    const lines = csv.split('\r\n');
    const headerLine = lines[0]!;

    expect(headerLine).toContain('利用者番号');
    expect(headerLine).toContain('氏名');
    expect(headerLine).toContain('対象年月');
    expect(headerLine).toContain('出勤日数');
    expect(headerLine).toContain('作業時間(h)');
    expect(headerLine).toContain('基本工賃');
    expect(headerLine).toContain('能力給');
    expect(headerLine).toContain('皆勤手当');
    expect(headerLine).toContain('合計工賃');
    expect(headerLine).toContain('控除');
    expect(headerLine).toContain('支給額');
  });

  it('should include data rows after header', () => {
    const records = [
      createWageCsvRecord({ userNumber: 'user-001', name: '山田太郎' }),
      createWageCsvRecord({ userNumber: 'user-002', name: '鈴木花子' }),
    ];
    const csv = encodeWageRecords(records, false);

    const lines = csv.split('\r\n').filter((l) => l.length > 0);

    // 1 header + 2 data rows
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('user-001');
    expect(lines[2]).toContain('user-002');
  });

  it('should use CRLF line endings', () => {
    const records = [createWageCsvRecord()];
    const csv = encodeWageRecords(records, false);

    expect(csv).toContain('\r\n');
    // Remove CRLF, then check no bare LF
    const stripped = csv.replace(/\r\n/g, '');
    expect(stripped).not.toContain('\n');
  });

  it('should include BOM when includeBom is true', () => {
    const records = [createWageCsvRecord()];
    const csv = encodeWageRecords(records, true);

    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('should not include BOM when includeBom is false', () => {
    const records = [createWageCsvRecord()];
    const csv = encodeWageRecords(records, false);

    expect(csv.charCodeAt(0)).not.toBe(0xFEFF);
  });

  it('should include BOM by default (no second argument)', () => {
    const records = [createWageCsvRecord()];
    const csv = encodeWageRecords(records);

    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('should produce correct data field values', () => {
    const records = [createWageCsvRecord({
      userNumber: 'user-099',
      name: 'テスト',
      yearMonth: '2025-06',
      attendanceDays: 15,
      totalWorkHours: 75.5,
      baseWage: 8000,
      skillWage: 1500,
      attendanceBonus: 0,
      totalWage: 9500,
      deductions: 200,
      netWage: 9300,
    })];
    const csv = encodeWageRecords(records, false);
    const lines = csv.split('\r\n');
    const dataLine = lines[1]!;
    const fields = dataLine.split(',');

    expect(fields[0]).toBe('user-099');
    expect(fields[1]).toBe('テスト');
    expect(fields[2]).toBe('2025-06');
    expect(fields[3]).toBe('15');
    expect(fields[4]).toBe('75.5');
    expect(fields[5]).toBe('8000');
    expect(fields[6]).toBe('1500');
    expect(fields[7]).toBe('0');
    expect(fields[8]).toBe('9500');
    expect(fields[9]).toBe('200');
    expect(fields[10]).toBe('9300');
  });
});

describe('exportWageCsv', () => {
  it('should succeed with dryRun=true', () => {
    const records = [createWageCsvRecord({ netWage: 12500 })];

    const result = exportWageCsv(records, '/tmp/test-wage.csv', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.totalAmount).toBe(12500);
    expect(result.filePath).toBeUndefined();
  });

  it('should return correct totalAmount as sum of netWage on dryRun', () => {
    const records = [
      createWageCsvRecord({ netWage: 12500 }),
      createWageCsvRecord({ netWage: 15000 }),
    ];

    const result = exportWageCsv(records, '/tmp/test-wage2.csv', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(12500 + 15000);
  });

  it('should return error when records are empty', () => {
    const result = exportWageCsv([], '/tmp/empty-wage.csv', { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.recordCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('空');
  });

  it('should return error for empty records even without dryRun', () => {
    const result = exportWageCsv([], '/tmp/empty-wage.csv');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should set recordCount correctly', () => {
    const records = [
      createWageCsvRecord(),
      createWageCsvRecord(),
      createWageCsvRecord(),
    ];

    const result = exportWageCsv(records, '/tmp/test-wage3.csv', { dryRun: true });

    expect(result.recordCount).toBe(3);
  });
});
