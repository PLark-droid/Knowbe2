/**
 * CSV出力前バリデーション
 * 必須項目チェック、合計値クロスチェック
 */

import type {
  KokuhoRenControlRecord,
  KokuhoRenDataRecord,
  KokuhoRenTrailerRecord,
  KokuhoRenRecord,
  CsvValidationError,
} from '../types/csv.js';

const NAME_KANA_PATTERN = /^[ァ-ンヴー 　]+$/u;
const MAX_MONTHLY_SERVICE_UNITS_PER_USER = 31000;

export interface CsvValidationResult {
  valid: boolean;
  errors: CsvValidationError[];
}

/** 国保連CSVレコード群をバリデーション */
export function validateKokuhoRenRecords(records: KokuhoRenRecord[]): CsvValidationResult {
  const errors: CsvValidationError[] = [];

  if (records.length === 0) {
    errors.push({ field: 'records', value: [], message: 'レコードが空です' });
    return { valid: false, errors };
  }

  // コントロールレコード
  const control = records[0];
  if (!control || control.recordType !== 'control') {
    errors.push({ field: 'recordType', value: control?.recordType, message: '最初のレコードはコントロールレコードである必要があります' });
  } else {
    validateControlRecord(control, errors);
  }

  // トレーラレコード
  const trailer = records[records.length - 1];
  if (!trailer || trailer.recordType !== 'trailer') {
    errors.push({ field: 'recordType', value: trailer?.recordType, message: '最後のレコードはトレーラレコードである必要があります' });
  }

  // データレコード
  const dataRecords = records.filter((r): r is KokuhoRenDataRecord => r.recordType === 'data');
  for (let i = 0; i < dataRecords.length; i++) {
    validateDataRecord(dataRecords[i]!, i, errors);
  }

  // クロスチェック: トレーラの件数・合計
  if (trailer?.recordType === 'trailer') {
    const t = trailer as KokuhoRenTrailerRecord;
    if (t.totalCount !== dataRecords.length) {
      errors.push({
        field: 'totalCount',
        value: t.totalCount,
        message: `トレーラ件数(${t.totalCount})とデータレコード数(${dataRecords.length})が不一致`,
      });
    }

    const calcTotalUnits = dataRecords.reduce((s, d) => s + d.totalServiceUnits, 0);
    if (t.totalUnits !== calcTotalUnits) {
      errors.push({
        field: 'totalUnits',
        value: t.totalUnits,
        message: `トレーラ合計単位数(${t.totalUnits})とデータ合計(${calcTotalUnits})が不一致`,
      });
    }

    const calcTotalAmount = dataRecords.reduce((s, d) => s + d.benefitClaimAmount, 0);
    if (t.totalClaimAmount !== calcTotalAmount) {
      errors.push({
        field: 'totalClaimAmount',
        value: t.totalClaimAmount,
        message: `トレーラ合計請求額(${t.totalClaimAmount})とデータ合計(${calcTotalAmount})が不一致`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateControlRecord(record: KokuhoRenControlRecord, errors: CsvValidationError[]): void {
  if (!/^\d{2}$/.test(record.prefectureCode)) {
    errors.push({ field: 'prefectureCode', value: record.prefectureCode, message: '都道府県番号は2桁の数字' });
  }
  if (!/^\d{10}$/.test(record.facilityNumber)) {
    errors.push({ field: 'facilityNumber', value: record.facilityNumber, message: '事業所番号は10桁の数字' });
  }
  if (!/^\d{8}$/.test(record.createdDate)) {
    errors.push({ field: 'createdDate', value: record.createdDate, message: '作成年月日はYYYYMMDD形式' });
  }
  if (!/^\d{6}$/.test(record.targetYearMonth)) {
    errors.push({ field: 'targetYearMonth', value: record.targetYearMonth, message: '対象年月はYYYYMM形式' });
  }
}

function validateDataRecord(record: KokuhoRenDataRecord, index: number, errors: CsvValidationError[]): void {
  if (!/^\d{10}$/.test(record.recipientNumber)) {
    errors.push({ field: 'recipientNumber', value: record.recipientNumber, message: '受給者証番号は10桁', recordIndex: index });
  }
  if (!NAME_KANA_PATTERN.test(record.nameKana)) {
    errors.push({
      field: 'nameKana',
      value: record.nameKana,
      message: '氏名カナは全角カタカナ(ア-ン・ヴ・ー・スペース)のみ',
      recordIndex: index,
    });
  }
  const birthDate = parseCompactDate(record.dateOfBirth);
  if (!birthDate) {
    errors.push({
      field: 'dateOfBirth',
      value: record.dateOfBirth,
      message: '生年月日は実在するYYYYMMDD形式',
      recordIndex: index,
    });
  } else {
    const minDate = new Date(1900, 0, 1);
    minDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (birthDate < minDate || birthDate > today) {
      errors.push({
        field: 'dateOfBirth',
        value: record.dateOfBirth,
        message: '生年月日は1900-01-01以降かつ未来日不可',
        recordIndex: index,
      });
    }
  }
  if (record.units <= 0) {
    errors.push({ field: 'units', value: record.units, message: '単位数は正の値', recordIndex: index });
  }
  if (record.days <= 0 || record.days > 31) {
    errors.push({ field: 'days', value: record.days, message: '日数は1〜31', recordIndex: index });
  }
  if (record.totalServiceUnits > MAX_MONTHLY_SERVICE_UNITS_PER_USER) {
    errors.push({
      field: 'totalServiceUnits',
      value: record.totalServiceUnits,
      message: `月間サービス単位数は${MAX_MONTHLY_SERVICE_UNITS_PER_USER}以下`,
      recordIndex: index,
    });
  }
  if (record.benefitClaimAmount < 0) {
    errors.push({ field: 'benefitClaimAmount', value: record.benefitClaimAmount, message: '給付費請求額は0以上', recordIndex: index });
  }
}

function parseCompactDate(value: string): Date | null {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}
