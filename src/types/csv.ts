/**
 * CSV生成型定義 — 国保連請求CSV & 工賃データCSV
 */

// ─── 国保連請求CSV構造 ──────────────────────────────────

/** CSVレコード種別 */
export type CsvRecordType = 'control' | 'data' | 'trailer';

/** コントロールレコード (1行目) */
export interface KokuhoRenControlRecord {
  recordType: 'control';
  /** 交換情報識別番号 */
  exchangeInfoId: string;
  /** 媒体区分 (1: 磁気テープ, 2: フロッピーディスク, 5: 電送) */
  mediaType: '1' | '2' | '5';
  /** 都道府県番号 (2桁) */
  prefectureCode: string;
  /** 保険者番号 */
  insurerNumber: string;
  /** 事業所番号 (10桁) */
  facilityNumber: string;
  /** 作成年月日 (YYYYMMDD) */
  createdDate: string;
  /** 対象年月 (YYYYMM) */
  targetYearMonth: string;
}

/** データレコード (利用者ごと) */
export interface KokuhoRenDataRecord {
  recordType: 'data';
  /** 事業所番号 */
  facilityNumber: string;
  /** サービス種類コード */
  serviceTypeCode: string;
  /** 受給者証番号 */
  recipientNumber: string;
  /** 氏名 (全角カナ) */
  nameKana: string;
  /** 生年月日 (YYYYMMDD) */
  dateOfBirth: string;
  /** 性別 (1:男, 2:女) */
  gender: '1' | '2';
  /** サービスコード */
  serviceCode: string;
  /** 単位数 */
  units: number;
  /** 日数/回数 */
  days: number;
  /** サービス単位数合計 */
  totalServiceUnits: number;
  /** 給付費請求額 */
  benefitClaimAmount: number;
  /** 利用者負担額 */
  copaymentAmount: number;
  /** 地域区分単価 */
  areaUnitPrice: number;
}

/** トレーラレコード (最終行) */
export interface KokuhoRenTrailerRecord {
  recordType: 'trailer';
  /** 合計件数 */
  totalCount: number;
  /** 合計単位数 */
  totalUnits: number;
  /** 合計請求額 */
  totalClaimAmount: number;
}

export type KokuhoRenRecord =
  | KokuhoRenControlRecord
  | KokuhoRenDataRecord
  | KokuhoRenTrailerRecord;

// ─── 工賃データCSV構造 ──────────────────────────────────

export interface WageCsvRecord {
  /** 利用者番号 */
  userNumber: string;
  /** 氏名 */
  name: string;
  /** 対象年月 */
  yearMonth: string;
  /** 出勤日数 */
  attendanceDays: number;
  /** 作業時間合計 (時間) */
  totalWorkHours: number;
  /** 基本工賃 */
  baseWage: number;
  /** 能力給 */
  skillWage: number;
  /** 皆勤手当 */
  attendanceBonus: number;
  /** 合計工賃 */
  totalWage: number;
  /** 控除 */
  deductions: number;
  /** 支給額 */
  netWage: number;
}

// ─── CSV生成オプション ──────────────────────────────────

export interface CsvExportOptions {
  /** 出力先ディレクトリ */
  outputDir: string;
  /** 対象年月 (YYYY-MM) */
  yearMonth: string;
  /** 事業所ID */
  facilityId: string;
  /** エンコーディング */
  encoding: 'shift-jis' | 'utf-8' | 'utf-8-bom';
  /** 改行コード */
  lineEnding: 'crlf' | 'lf';
  /** ドライラン (ファイル出力せずバリデーションのみ) */
  dryRun?: boolean;
}

export interface CsvValidationError {
  field: string;
  value: unknown;
  message: string;
  recordIndex?: number;
}

export interface CsvExportResult {
  success: boolean;
  filePath?: string;
  recordCount: number;
  errors: CsvValidationError[];
  totalAmount?: number;
}
