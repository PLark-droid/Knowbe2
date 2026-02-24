/**
 * 月次請求オーケストレーション
 * DAGパターンで勤怠集計→請求計算→CSV生成をパイプライン実行
 */

import type {
  Facility,
  ServiceUser,
  Attendance,
  ProductActivity,
  ProductOutput,
} from '../types/domain.js';
import { BillingCalculator } from './calculator.js';
import type { MonthlyBillingResult } from './calculator.js';
import { WageCalculatorEngine } from './wage-calculator.js';
import type { MonthlyWageResult } from './wage-calculator.js';
import { validateBilling } from './validator.js';
import { buildKokuhoRenRecords, exportKokuhoRenCsv } from '../csv/kokuho-ren.js';
import { buildWageCsvRecords, exportWageCsv } from '../csv/wage-csv.js';
import type { CsvExportResult } from '../types/csv.js';
import { parseYearMonth, getBusinessDaysInMonth } from '../utils/datetime.js';

// ─── オーケストレーション結果型 ─────────────────────────

export interface MonthlyBillingPipelineResult {
  yearMonth: string;
  facilityId: string;
  billing: MonthlyBillingResult;
  wages: MonthlyWageResult;
  billingCsv: CsvExportResult;
  wageCsv: CsvExportResult;
  validationPassed: boolean;
}

// ─── データプロバイダーインターフェース ───────────────────

export interface MonthlyBillingDataProvider {
  getFacility(facilityId: string): Promise<Facility>;
  getActiveUsers(facilityId: string): Promise<ServiceUser[]>;
  getMonthlyAttendances(facilityId: string, yearMonth: string): Promise<Map<string, Attendance[]>>;
  getMonthlyOutputs(facilityId: string, yearMonth: string): Promise<Map<string, ProductOutput[]>>;
  getActivities(facilityId: string): Promise<ProductActivity[]>;
  getExistingInvoiceYearMonths(facilityId: string): Promise<string[]>;
}

// ─── オーケストレーター ─────────────────────────────────

export interface MonthlyBillingOptions {
  yearMonth: string;
  facilityId: string;
  outputDir: string;
  dryRun?: boolean;
}

/**
 * 月次請求パイプライン
 * 1. データ取得
 * 2. 請求計算
 * 3. 工賃計算
 * 4. バリデーション
 * 5. CSV生成
 */
export async function runMonthlyBilling(
  provider: MonthlyBillingDataProvider,
  options: MonthlyBillingOptions,
): Promise<MonthlyBillingPipelineResult> {
  const { yearMonth, facilityId, outputDir, dryRun } = options;
  const { year, month } = parseYearMonth(yearMonth);

  console.log(`\n🏢 月次請求パイプライン: ${yearMonth} (${facilityId})`);

  // Step 1: データ取得 (並列)
  console.log('  📥 データ取得中...');
  const [facility, users, attendanceMap, outputMap, activities, existingInvoices] =
    await Promise.all([
      provider.getFacility(facilityId),
      provider.getActiveUsers(facilityId),
      provider.getMonthlyAttendances(facilityId, yearMonth),
      provider.getMonthlyOutputs(facilityId, yearMonth),
      provider.getActivities(facilityId),
      provider.getExistingInvoiceYearMonths(facilityId),
    ]);

  console.log(`  👥 利用者数: ${users.length}`);

  // Step 2: 請求計算
  console.log('  🧮 請求計算中...');
  const calculator = new BillingCalculator();
  const billing = calculator.calculate(yearMonth, facility, users, attendanceMap);

  console.log(`  💰 合計請求額: ¥${billing.totalAmount.toLocaleString()}`);

  // Step 3: 工賃計算
  console.log('  👛 工賃計算中...');
  const wageCalculator = new WageCalculatorEngine();
  const expectedDays = getBusinessDaysInMonth(year, month);
  const wages = wageCalculator.calculate(
    facilityId, yearMonth, users, attendanceMap, outputMap, activities, expectedDays,
  );

  console.log(`  👛 平均工賃: ¥${wages.averageWage.toLocaleString()} (${wages.meetsMinimumThreshold ? '✅' : '⚠️'} 3,000円基準)`);

  // Step 4: バリデーション
  console.log('  ✅ バリデーション中...');
  const validation = validateBilling(billing, existingInvoices);
  if (!validation.valid) {
    console.log(`  ❌ バリデーションエラー: ${validation.errors.length}件`);
    for (const err of validation.errors) {
      console.log(`     - ${err.code}: ${err.message}`);
    }
  }
  for (const warn of validation.warnings) {
    console.log(`  ⚠️  ${warn.code}: ${warn.message}`);
  }

  // Step 5: CSV生成
  console.log('  📄 CSV生成中...');
  const userMap = new Map(users.map((u) => [u.id, u]));
  const kokuhoRecords = buildKokuhoRenRecords(facility, billing, userMap);
  const billingCsvPath = `${outputDir}/kokuho-ren_${yearMonth}_${facilityId}.csv`;
  const billingCsv = exportKokuhoRenCsv(kokuhoRecords, billingCsvPath, { dryRun });

  const wageRecords = buildWageCsvRecords(wages);
  const wageCsvPath = `${outputDir}/wage_${yearMonth}_${facilityId}.csv`;
  const wageCsv = exportWageCsv(wageRecords, wageCsvPath, { encoding: 'utf-8-bom', dryRun });

  console.log(`  📄 国保連CSV: ${billingCsv.success ? billingCsv.filePath ?? '(dry-run)' : '❌ エラー'}`);
  console.log(`  📄 工賃CSV: ${wageCsv.success ? wageCsv.filePath ?? '(dry-run)' : '❌ エラー'}`);
  console.log('  🏁 完了\n');

  return {
    yearMonth,
    facilityId,
    billing,
    wages,
    billingCsv,
    wageCsv,
    validationPassed: validation.valid,
  };
}
