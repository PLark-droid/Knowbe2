/**
 * B型就労支援事業所ドメイン型定義
 * 全エンティティに facilityId を持たせマルチテナント対応
 *
 * ## ID体系 (Lark Base Link フィールドとの関係)
 *
 * ドメインモデルの `facilityId` / `userId` / `staffId` は **業務ID** (テキスト型) を保持する。
 * Lark Base の Link 型フィールドには **record_id** (Lark 内部ID) を書き込むが、
 * ドメイン層にはリポジトリが変換した業務IDのみが露出する。
 *
 * リポジトリの責務:
 * - toEntity: テキスト型フィールド ('事業所ID', '利用者ID' 等) から業務IDを読み取る
 * - toFields: Link 型フィールドには record_id を書き込み、テキスト型フィールドには業務IDを書き込む
 * - フィルタ検索: テキスト型フィールドで業務IDによるフィルタを行う
 *
 * Link フィールド用の record_id はリポジトリ生成時に渡す LinkResolver が解決する。
 */

// ─── 事業所 (Facility) ─────────────────────────────────

export interface Facility {
  id: string;
  facilityId: string;
  name: string;
  corporateName: string;
  /** 事業所番号 (10桁) */
  facilityNumber: string;
  /** 所在地 */
  address: string;
  postalCode: string;
  phone: string;
  fax?: string;
  /** 地域区分 (1〜7級地) */
  areaGrade: AreaGrade;
  /** 報酬体系 (Ⅰ〜Ⅵ) */
  rewardStructure: RewardStructure;
  /** 定員 */
  capacity: number;
  /** 平均工賃月額 (円) */
  averageMonthlyWage?: number;
  /** サービス種別コード */
  serviceTypeCode: string;
  createdAt: string;
  updatedAt: string;
}

export type AreaGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RewardStructure = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

// ─── 利用者 (User / Service Recipient) ──────────────────

export interface ServiceUser {
  id: string;
  facilityId: string;
  name: string;
  nameKana: string;
  /** 受給者証番号 (10桁) */
  recipientNumber: string;
  /** 支給決定障害者番号 */
  disabilityNumber?: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  /** 障害支援区分 (1〜6 or 非該当) */
  supportCategory?: number;
  /** 契約支給量 (日/月) */
  contractDaysPerMonth: number;
  /** 利用開始日 */
  serviceStartDate: string;
  serviceEndDate?: string;
  /** 自己負担上限月額 */
  copaymentLimit: number;
  /** LINE user ID */
  lineUserId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 職員 (Staff) ───────────────────────────────────────

export interface Staff {
  id: string;
  facilityId: string;
  name: string;
  nameKana: string;
  role: StaffRole;
  /** LINE user ID */
  lineUserId?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StaffRole =
  | 'service_manager'      // サービス管理責任者
  | 'vocational_instructor' // 職業指導員
  | 'life_support_worker'  // 生活支援員
  | 'manager'              // 管理者
  | 'other';

// ─── 勤怠 (Attendance) ──────────────────────────────────

export interface Attendance {
  id: string;
  facilityId: string;
  userId: string;
  date: string;
  /** 出勤時刻 (HH:mm) */
  clockIn?: string;
  /** 退勤時刻 (HH:mm) */
  clockOut?: string;
  /** 実績時間 (分) — 自動計算 */
  actualMinutes?: number;
  /** 休憩時間 (分) */
  breakMinutes: number;
  /** 出席区分 */
  attendanceType: AttendanceType;
  /** 送迎 */
  pickupType: PickupType;
  /** 食事提供 */
  mealProvided: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceType =
  | 'present'        // 出席
  | 'absent'         // 欠席
  | 'absent_notified' // 欠席(連絡あり)
  | 'holiday'        // 祝日
  | 'leave';         // 休暇

export type PickupType =
  | 'none'          // なし
  | 'pickup_only'   // 迎えのみ
  | 'dropoff_only'  // 送りのみ
  | 'both';         // 送迎

// ─── 体調チェック (HealthCheck) ──────────────────────────

export interface HealthCheck {
  id: string;
  facilityId: string;
  userId: string;
  date: string;
  /** 体調スコア (1〜5) */
  score: 1 | 2 | 3 | 4 | 5;
  /** 睡眠時間 (時間) */
  sleepHours?: number;
  /** 食事 (朝/昼/夕) */
  meals: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  /** 気分 */
  mood?: string;
  note?: string;
  createdAt: string;
}

// ─── 支援記録 (SupportRecord) ────────────────────────────

export interface SupportRecord {
  id: string;
  facilityId: string;
  userId: string;
  staffId: string;
  date: string;
  /** 支援内容 */
  content: string;
  /** 支援区分 */
  supportType: SupportType;
  createdAt: string;
  updatedAt: string;
}

export type SupportType =
  | 'daily'           // 日常生活支援
  | 'vocational'      // 職業指導
  | 'counseling'      // 相談支援
  | 'health'          // 健康管理
  | 'social';         // 社会生活支援

// ─── 工賃 (WageCalculation) ──────────────────────────────

export interface WageCalculation {
  id: string;
  facilityId: string;
  userId: string;
  yearMonth: string;
  /** 作業時間合計 (分) */
  totalWorkMinutes: number;
  /** 出勤日数 */
  attendanceDays: number;
  /** 基本工賃 (円) */
  baseWage: number;
  /** 能力給 (円) */
  skillWage: number;
  /** 皆勤手当 (円) */
  attendanceBonus: number;
  /** 合計工賃 (円) */
  totalWage: number;
  /** 控除 (円) */
  deductions: number;
  /** 支給額 (円) */
  netWage: number;
  status: WageStatus;
  createdAt: string;
  updatedAt: string;
}

export type WageStatus = 'draft' | 'confirmed' | 'paid';

// ─── 請求 (Invoice) ──────────────────────────────────────

export interface Invoice {
  id: string;
  facilityId: string;
  yearMonth: string;
  /** 請求先 (国保連) */
  billingTarget: 'kokuho_ren';
  /** 合計単位数 */
  totalUnits: number;
  /** 合計金額 (円) */
  totalAmount: number;
  /** 利用者負担額合計 (円) */
  totalCopayment: number;
  /** ステータス */
  status: InvoiceStatus;
  /** CSV生成日 */
  csvGeneratedAt?: string;
  /** 提出日 */
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'calculated'
  | 'csv_generated'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'resubmitted';

// ─── サービスコードマスタ (ServiceCode) ──────────────────

export interface ServiceCode {
  id: string;
  /** サービスコード (6桁) */
  code: string;
  name: string;
  /** 単位数 */
  units: number;
  /** サービス種類 */
  serviceType: string;
  /** 有効期間 */
  validFrom: string;
  validTo?: string;
  /** 加算フラグ */
  isAddition: boolean;
  /** 適用条件 */
  conditions?: string;
}

// ─── 生産活動 (ProductActivity) ──────────────────────────

export interface ProductActivity {
  id: string;
  facilityId: string;
  name: string;
  description?: string;
  /** 作業単価 (円/時間) */
  hourlyRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 生産実績 (ProductOutput) ────────────────────────────

export interface ProductOutput {
  id: string;
  facilityId: string;
  userId: string;
  activityId: string;
  date: string;
  /** 作業時間 (分) */
  workMinutes: number;
  /** 生産数量 */
  quantity?: number;
  note?: string;
  createdAt: string;
}

// ─── 勤務予定 (WorkSchedule) ─────────────────────────────

export interface WorkSchedule {
  id: string;
  facilityId: string;
  userId: string;
  yearMonth: string;
  /** 予定出勤日 (1〜31 の配列) */
  scheduledDays: number[];
  /** 予定時間 (開始-終了) */
  scheduledTime?: {
    start: string;
    end: string;
  };
  createdAt: string;
  updatedAt: string;
}
