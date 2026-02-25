/**
 * 工賃データCSV生成
 * UTF-8 BOM or Shift-JIS 選択可能
 */

import * as iconv from 'iconv-lite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WageCsvRecord, CsvExportResult } from '../types/csv.js';
import type { MonthlyWageResult } from '../billing/wage-calculator.js';
import { escapeCsvField } from './formatters.js';

const CRLF = '\r\n';
const UTF8_BOM = '\uFEFF';

const HEADERS = [
  '利用者番号',
  '氏名',
  '対象年月',
  '出勤日数',
  '作業時間(h)',
  '基本工賃',
  '能力給',
  '皆勤手当',
  '合計工賃',
  '控除',
  '支給額',
];

/** 工賃計算結果からCSVレコードを生成 */
export function buildWageCsvRecords(result: MonthlyWageResult): WageCsvRecord[] {
  return result.userWages.map((w) => ({
    userNumber: w.userId,
    name: w.name,
    yearMonth: result.yearMonth,
    attendanceDays: w.attendanceDays,
    totalWorkHours: Math.round((w.totalWorkMinutes / 60) * 100) / 100,
    baseWage: w.baseWage,
    skillWage: w.skillWage,
    attendanceBonus: w.attendanceBonus,
    totalWage: w.totalWage,
    deductions: w.deductions,
    netWage: w.netWage,
  }));
}

/** レコード群をCSV文字列に変換 */
export function encodeWageRecords(records: WageCsvRecord[], includeBom: boolean = true): string {
  const lines: string[] = [];

  // ヘッダー行
  lines.push(HEADERS.join(','));

  // データ行
  for (const r of records) {
    lines.push([
      escapeCsvField(r.userNumber),
      escapeCsvField(r.name),
      r.yearMonth,
      String(r.attendanceDays),
      String(r.totalWorkHours),
      String(r.baseWage),
      String(r.skillWage),
      String(r.attendanceBonus),
      String(r.totalWage),
      String(r.deductions),
      String(r.netWage),
    ].join(','));
  }

  const csv = lines.join(CRLF) + CRLF;
  return includeBom ? UTF8_BOM + csv : csv;
}

/** 工賃CSVをファイル出力 */
export function exportWageCsv(
  records: WageCsvRecord[],
  outputPath: string,
  options?: { encoding?: 'utf-8' | 'utf-8-bom' | 'shift-jis'; dryRun?: boolean },
): CsvExportResult {
  if (records.length === 0) {
    return {
      success: false,
      recordCount: 0,
      errors: [{ field: 'records', value: [], message: '工賃データが空です' }],
    };
  }

  const totalAmount = records.reduce((s, r) => s + r.netWage, 0);
  const encoding = options?.encoding ?? 'utf-8-bom';

  if (options?.dryRun) {
    return {
      success: true,
      recordCount: records.length,
      errors: [],
      totalAmount,
    };
  }

  const csvText = encodeWageRecords(records, encoding === 'utf-8-bom');

  mkdirSync(dirname(outputPath), { recursive: true });

  if (encoding === 'shift-jis') {
    const encoded = iconv.encode(csvText, 'Shift_JIS');
    writeFileSync(outputPath, encoded);
  } else {
    writeFileSync(outputPath, csvText, 'utf-8');
  }

  return {
    success: true,
    filePath: outputPath,
    recordCount: records.length,
    errors: [],
    totalAmount,
  };
}
