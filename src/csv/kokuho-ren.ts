/**
 * 国保連請求CSVエンコーダー
 * Shift-JIS, CRLF, コントロール/データ/トレーラレコード
 */

import * as iconv from 'iconv-lite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  KokuhoRenControlRecord,
  KokuhoRenDataRecord,
  KokuhoRenTrailerRecord,
  KokuhoRenRecord,
  CsvExportResult,
} from '../types/csv.js';
import type { MonthlyBillingResult } from '../billing/calculator.js';
import type { Facility, ServiceUser } from '../types/domain.js';
import { ServiceCodeEngine } from '../billing/service-codes.js';
import { zeroPad, genderToCode, formatDateCompact, formatYearMonthCompact } from './formatters.js';
import { validateKokuhoRenRecords } from './validator.js';

const CRLF = '\r\n';

/** 請求計算結果から国保連CSVレコードを生成 */
export function buildKokuhoRenRecords(
  facility: Facility,
  billing: MonthlyBillingResult,
  users: Map<string, ServiceUser>,
): KokuhoRenRecord[] {
  const records: KokuhoRenRecord[] = [];
  const now = new Date();

  // コントロールレコード
  const control: KokuhoRenControlRecord = {
    recordType: 'control',
    exchangeInfoId: '7121',
    mediaType: '5',
    prefectureCode: facility.facilityNumber.slice(0, 2),
    insurerNumber: '',
    facilityNumber: facility.facilityNumber,
    createdDate: formatDateCompact(now),
    targetYearMonth: formatYearMonthCompact(billing.yearMonth),
  };
  records.push(control);

  // データレコード (利用者ごと)
  let totalDataUnits = 0;
  let totalClaimAmount = 0;
  const areaUnitPrice = ServiceCodeEngine.getAreaUnitPrice(facility.areaGrade);

  for (const userBilling of billing.userBillings) {
    const user = users.get(userBilling.userId);
    if (!user) continue;
    const totalServiceUnits = userBilling.serviceDetails.reduce(
      (sum, detail) => sum + detail.subtotalUnits,
      0,
    );

    const dataRecord: KokuhoRenDataRecord = {
      recordType: 'data',
      facilityNumber: facility.facilityNumber,
      serviceTypeCode: facility.serviceTypeCode,
      recipientNumber: user.recipientNumber,
      nameKana: user.nameKana,
      dateOfBirth: user.dateOfBirth.replace(/-/g, ''),
      gender: genderToCode(user.gender),
      serviceCode: facility.serviceTypeCode,
      units: totalServiceUnits,
      days: userBilling.attendanceDays,
      totalServiceUnits,
      benefitClaimAmount: userBilling.benefitAmount,
      copaymentAmount: userBilling.copaymentAmount,
      areaUnitPrice,
    };
    records.push(dataRecord);
    totalDataUnits += totalServiceUnits;
    totalClaimAmount += userBilling.benefitAmount;
  }

  // トレーラレコード
  const trailer: KokuhoRenTrailerRecord = {
    recordType: 'trailer',
    totalCount: records.filter((r) => r.recordType === 'data').length,
    totalUnits: totalDataUnits,
    totalClaimAmount,
  };
  records.push(trailer);

  return records;
}

/** レコードをCSV行に変換 */
function encodeControlRecord(r: KokuhoRenControlRecord): string {
  return [
    r.exchangeInfoId,
    r.mediaType,
    r.prefectureCode,
    r.insurerNumber,
    r.facilityNumber,
    r.createdDate,
    r.targetYearMonth,
  ].join(',');
}

function encodeDataRecord(r: KokuhoRenDataRecord): string {
  return [
    r.facilityNumber,
    r.serviceTypeCode,
    r.recipientNumber,
    r.nameKana,
    r.dateOfBirth,
    r.gender,
    r.serviceCode,
    zeroPad(r.units, 6),
    zeroPad(r.days, 2),
    zeroPad(r.totalServiceUnits, 8),
    zeroPad(r.benefitClaimAmount, 10),
    zeroPad(r.copaymentAmount, 10),
    String(r.areaUnitPrice),
  ].join(',');
}

function encodeTrailerRecord(r: KokuhoRenTrailerRecord): string {
  return [
    zeroPad(r.totalCount, 6),
    zeroPad(r.totalUnits, 10),
    zeroPad(r.totalClaimAmount, 12),
  ].join(',');
}

/** レコード群をCSV文字列に変換 */
export function encodeRecords(records: KokuhoRenRecord[]): string {
  const lines: string[] = [];

  for (const record of records) {
    switch (record.recordType) {
      case 'control':
        lines.push(encodeControlRecord(record));
        break;
      case 'data':
        lines.push(encodeDataRecord(record));
        break;
      case 'trailer':
        lines.push(encodeTrailerRecord(record));
        break;
    }
  }

  return lines.join(CRLF) + CRLF;
}

/** CSVをShift-JISでファイル出力 */
export function exportKokuhoRenCsv(
  records: KokuhoRenRecord[],
  outputPath: string,
  options?: { dryRun?: boolean },
): CsvExportResult {
  // バリデーション
  const validation = validateKokuhoRenRecords(records);
  if (!validation.valid) {
    return {
      success: false,
      recordCount: records.length,
      errors: validation.errors,
    };
  }

  const csvText = encodeRecords(records);
  const dataRecords = records.filter((r) => r.recordType === 'data') as KokuhoRenDataRecord[];
  const totalAmount = dataRecords.reduce((s, d) => s + d.benefitClaimAmount, 0);

  if (options?.dryRun) {
    return {
      success: true,
      recordCount: records.length,
      errors: [],
      totalAmount,
    };
  }

  // Shift-JIS エンコード & ファイル出力
  const encoded = iconv.encode(csvText, 'Shift_JIS');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encoded);

  return {
    success: true,
    filePath: outputPath,
    recordCount: records.length,
    errors: [],
    totalAmount,
  };
}
