/**
 * 請求バリデーション
 * 二重請求チェック、提出期限チェック、データ整合性検証
 */

import type { MonthlyBillingResult, UserBillingResult } from './calculator.js';

export interface BillingValidationError {
  code: string;
  message: string;
  userId?: string;
  field?: string;
}

export interface BillingValidationResult {
  valid: boolean;
  errors: BillingValidationError[];
  warnings: BillingValidationError[];
}

/**
 * 月次請求データをバリデーション
 */
export function validateBilling(
  result: MonthlyBillingResult,
  existingInvoiceYearMonths: string[] = [],
): BillingValidationResult {
  const errors: BillingValidationError[] = [];
  const warnings: BillingValidationError[] = [];

  // 1. 二重請求チェック
  if (existingInvoiceYearMonths.includes(result.yearMonth)) {
    errors.push({
      code: 'DUPLICATE_INVOICE',
      message: `${result.yearMonth} の請求データはすでに存在します`,
    });
  }

  // 2. 提出期限チェック (翌月10日)
  const [yearStr, monthStr] = result.yearMonth.split('-');
  if (yearStr && monthStr) {
    const deadline = new Date(Number(yearStr), Number(monthStr), 10); // 翌月10日
    if (new Date() > deadline) {
      warnings.push({
        code: 'PAST_DEADLINE',
        message: `${result.yearMonth} の提出期限 (翌月10日) を過ぎています`,
      });
    }
  }

  // 3. 各利用者のバリデーション
  for (const billing of result.userBillings) {
    validateUserBilling(billing, errors, warnings);
  }

  // 4. 合計値クロスチェック
  const calculatedTotal = result.userBillings.reduce((s, b) => s + b.totalAmount, 0);
  if (calculatedTotal !== result.totalAmount) {
    errors.push({
      code: 'TOTAL_MISMATCH',
      message: `合計金額不一致: 計算値=${calculatedTotal}, 設定値=${result.totalAmount}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateUserBilling(
  billing: UserBillingResult,
  errors: BillingValidationError[],
  warnings: BillingValidationError[],
): void {
  // 受給者証番号チェック (10桁)
  if (!/^\d{10}$/.test(billing.recipientNumber)) {
    errors.push({
      code: 'INVALID_RECIPIENT_NUMBER',
      message: `受給者証番号が不正です: ${billing.recipientNumber}`,
      userId: billing.userId,
      field: 'recipientNumber',
    });
  }

  // 出席日数チェック (0〜31)
  if (billing.attendanceDays < 0 || billing.attendanceDays > 31) {
    errors.push({
      code: 'INVALID_ATTENDANCE_DAYS',
      message: `出席日数が不正です: ${billing.attendanceDays}`,
      userId: billing.userId,
      field: 'attendanceDays',
    });
  }

  // 単位数が0以下
  if (billing.totalUnits <= 0) {
    warnings.push({
      code: 'ZERO_UNITS',
      message: '単位数が0です',
      userId: billing.userId,
    });
  }

  // 利用者負担額が上限を超えていないか
  if (billing.copaymentAmount < 0) {
    errors.push({
      code: 'NEGATIVE_COPAYMENT',
      message: `利用者負担額が負数です: ${billing.copaymentAmount}`,
      userId: billing.userId,
      field: 'copaymentAmount',
    });
  }

  // サービス詳細の整合性
  const detailTotal = billing.serviceDetails.reduce((s, d) => s + d.subtotalUnits, 0);
  if (detailTotal !== billing.totalUnits) {
    errors.push({
      code: 'DETAIL_UNITS_MISMATCH',
      message: `サービス詳細の合計単位数が不一致: ${detailTotal} ≠ ${billing.totalUnits}`,
      userId: billing.userId,
    });
  }
}
