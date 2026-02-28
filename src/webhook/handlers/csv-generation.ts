/**
 * CSV生成ハンドラー
 *
 * Lark Base Invoice テーブルのステータス変更 ("CSV生成依頼") をトリガーに、
 * インタラクティブカードによる確認フローを経てCSVを生成する。
 *
 * フロー:
 * 1. Invoice ステータス = "CSV生成依頼" 検出 (onRecordUpdated)
 * 2. 事業所情報・利用者数を取得してカード送信 → ステータス = "確認待ち"
 * 3. スタッフが [生成する] ボタン押下
 * 4. 国保連CSV + 工賃CSV を生成 → チャットに送信 → ステータス = "生成完了"
 */

import type { Invoice, Facility, ServiceUser, Attendance, ProductOutput, ProductActivity } from '../../types/domain.js';
import type { InvoiceRepository } from '../../lark/repositories/invoice.js';
import type { FacilityRepository } from '../../lark/repositories/facility.js';
import type { UserRepository } from '../../lark/repositories/user.js';
import type { AttendanceRepository } from '../../lark/repositories/attendance.js';
import type { LarkBotMessaging } from '../../lark/bot-messaging.js';
import {
  buildCsvGenerationCard,
  buildCsvCompletionCard,
  buildCsvCancellationCard,
} from '../../lark/bot-messaging.js';
import { BillingCalculator } from '../../billing/calculator.js';
import { WageCalculatorEngine } from '../../billing/wage-calculator.js';
import { buildKokuhoRenRecords, encodeRecords } from '../../csv/kokuho-ren.js';
import { buildWageCsvRecords, encodeWageRecords } from '../../csv/wage-csv.js';

/** CSV生成ハンドラーの依存 */
export interface CsvGenerationDeps {
  invoiceRepo: InvoiceRepository;
  facilityRepo: FacilityRepository;
  userRepo: UserRepository;
  attendanceRepo: AttendanceRepository;
  botMessaging: LarkBotMessaging;
  chatId: string;
  /** 勤怠データ取得 (facilityId, yearMonth) */
  getAttendances: (facilityId: string, yearMonth: string) => Promise<Map<string, Attendance[]>>;
  /** 生産実績データ取得 */
  getProductOutputs?: (facilityId: string, yearMonth: string) => Promise<Map<string, ProductOutput[]>>;
  /** 作業種目取得 */
  getActivities?: (facilityId: string) => Promise<ProductActivity[]>;
  /** 月営業日数 */
  expectedDays?: number;
}

/** カードアクションのペイロード */
export interface CardActionPayload {
  action: 'confirm' | 'cancel';
  invoice_id: string;
  facility_id: string;
  year_month: string;
}

/** CSV生成結果 */
export interface CsvGenerationResult {
  kokuhoRenCsv: string;
  kokuhoRenRecordCount: number;
  wageCsv: string;
  wageRecordCount: number;
  totalAmount: number;
}

/**
 * CSV生成依頼を処理する
 *
 * Invoice テーブルのステータスが "CSV生成依頼" に変更された際に呼ばれる。
 * 事業所情報・利用者数を取得し、確認カードを送信してステータスを "確認待ち" に更新する。
 */
export async function handleCsvGenerationRequest(
  deps: CsvGenerationDeps,
  invoice: Invoice,
): Promise<void> {
  const { invoiceRepo, facilityRepo, userRepo, botMessaging, chatId } = deps;

  // 事業所情報取得
  const facilities = await facilityRepo.findAll(invoice.facilityId);
  const facility = facilities[0];
  if (!facility) {
    console.error(`[CsvGeneration] Facility not found: ${invoice.facilityId}`);
    return;
  }

  // 対象月のアクティブ利用者数を取得
  const users = await userRepo.findAll(invoice.facilityId);
  const activeUsers = users.filter((u) => u.isActive);

  // 確認カードを送信
  const card = buildCsvGenerationCard({
    invoiceId: invoice.id,
    facilityId: invoice.facilityId,
    yearMonth: invoice.yearMonth,
    facilityName: facility.name,
    userCount: activeUsers.length,
    totalAmount: invoice.totalAmount > 0 ? invoice.totalAmount : undefined,
  });

  await botMessaging.sendInteractiveCard(chatId, card);

  // ステータスを "確認待ち" に更新
  await invoiceRepo.updateStatus(invoice.id, 'confirming');

  console.log(
    `[CsvGeneration] Sent confirmation card for invoice=${invoice.id} ` +
      `facility=${facility.name} yearMonth=${invoice.yearMonth} users=${activeUsers.length}`,
  );
}

/**
 * カードアクション (ボタンクリック) を処理する
 */
export async function handleCardAction(
  deps: CsvGenerationDeps,
  payload: CardActionPayload,
): Promise<void> {
  if (payload.action === 'cancel') {
    await handleCancelAction(deps, payload);
    return;
  }

  if (payload.action === 'confirm') {
    await handleConfirmAction(deps, payload);
    return;
  }

  console.warn(`[CsvGeneration] Unknown card action: ${payload.action}`);
}

/**
 * キャンセルアクション処理
 */
async function handleCancelAction(
  deps: CsvGenerationDeps,
  payload: CardActionPayload,
): Promise<void> {
  const { invoiceRepo, facilityRepo, botMessaging, chatId } = deps;

  // ステータスを "キャンセル" に更新
  await invoiceRepo.updateStatus(payload.invoice_id, 'cancelled');

  // 事業所名を取得
  const facilities = await facilityRepo.findAll(payload.facility_id);
  const facilityName = facilities[0]?.name ?? payload.facility_id;

  // キャンセル通知カード送信
  const card = buildCsvCancellationCard({
    yearMonth: payload.year_month,
    facilityName,
  });
  await botMessaging.sendInteractiveCard(chatId, card);

  console.log(
    `[CsvGeneration] Cancelled CSV generation for invoice=${payload.invoice_id}`,
  );
}

/**
 * 確認 (CSV生成実行) アクション処理
 */
async function handleConfirmAction(
  deps: CsvGenerationDeps,
  payload: CardActionPayload,
): Promise<void> {
  const { invoiceRepo, facilityRepo, userRepo, botMessaging, chatId } = deps;

  // ステータスを "生成中" に更新
  await invoiceRepo.updateStatus(payload.invoice_id, 'generating');

  try {
    // 事業所情報取得
    const facilities = await facilityRepo.findAll(payload.facility_id);
    const facility = facilities[0];
    if (!facility) {
      throw new Error(`Facility not found: ${payload.facility_id}`);
    }

    // 利用者取得
    const users = await userRepo.findAll(payload.facility_id);
    const activeUsers = users.filter((u) => u.isActive);

    // CSV生成
    const result = await generateCsvData(deps, facility, activeUsers, payload.year_month);

    // 完了通知カード送信
    const completionCard = buildCsvCompletionCard({
      yearMonth: payload.year_month,
      facilityName: facility.name,
      kokuhoRenRecordCount: result.kokuhoRenRecordCount,
      wageRecordCount: result.wageRecordCount,
      totalAmount: result.totalAmount,
    });
    await botMessaging.sendInteractiveCard(chatId, completionCard);

    // CSVテキストをテキストメッセージとして送信 (ファイルアップロードAPI未実装の場合のフォールバック)
    await botMessaging.sendText(
      chatId,
      `[国保連CSV] ${result.kokuhoRenRecordCount}件\n---\n${result.kokuhoRenCsv.slice(0, 2000)}`,
    );
    await botMessaging.sendText(
      chatId,
      `[工賃CSV] ${result.wageRecordCount}件\n---\n${result.wageCsv.slice(0, 2000)}`,
    );

    // ステータスを "CSV生成済み" に更新
    await invoiceRepo.updateStatus(payload.invoice_id, 'csv_generated');

    console.log(
      `[CsvGeneration] Completed CSV generation for invoice=${payload.invoice_id} ` +
        `kokuhoRen=${result.kokuhoRenRecordCount} wage=${result.wageRecordCount}`,
    );
  } catch (error) {
    console.error('[CsvGeneration] CSV generation failed:', error);

    // エラー通知
    await botMessaging.sendText(
      chatId,
      `CSV生成エラー: ${(error as Error).message}`,
    );

    // ステータスを "確認待ち" に戻す (リトライ可能)
    await invoiceRepo.updateStatus(payload.invoice_id, 'confirming');
  }
}

/**
 * 国保連CSV + 工賃CSV データを生成する
 */
async function generateCsvData(
  deps: CsvGenerationDeps,
  facility: Facility,
  users: ServiceUser[],
  yearMonth: string,
): Promise<CsvGenerationResult> {
  // 勤怠データ取得
  const attendanceMap = await deps.getAttendances(facility.facilityId, yearMonth);

  // 国保連CSV生成
  const billingCalculator = new BillingCalculator();
  const billingResult = billingCalculator.calculate(yearMonth, facility, users, attendanceMap);
  const usersMap = new Map(users.map((u) => [u.id, u]));
  const kokuhoRenRecords = buildKokuhoRenRecords(facility, billingResult, usersMap);
  const kokuhoRenCsv = encodeRecords(kokuhoRenRecords);

  // 工賃CSV生成
  const productOutputMap = deps.getProductOutputs
    ? await deps.getProductOutputs(facility.facilityId, yearMonth)
    : new Map<string, ProductOutput[]>();
  const activities = deps.getActivities
    ? await deps.getActivities(facility.facilityId)
    : [];
  const expectedDays = deps.expectedDays ?? 20;

  const wageCalculator = new WageCalculatorEngine();
  const wageResult = wageCalculator.calculate(
    facility.facilityId,
    yearMonth,
    users,
    attendanceMap,
    productOutputMap,
    activities,
    expectedDays,
  );
  const wageRecords = buildWageCsvRecords(wageResult);
  const wageCsv = encodeWageRecords(wageRecords);

  return {
    kokuhoRenCsv,
    kokuhoRenRecordCount: kokuhoRenRecords.filter((r) => r.recordType === 'data').length,
    wageCsv,
    wageRecordCount: wageRecords.length,
    totalAmount: billingResult.totalAmount,
  };
}
