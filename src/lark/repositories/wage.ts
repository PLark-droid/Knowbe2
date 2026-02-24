/**
 * WageCalculationRepository
 */

import type { WageCalculation, WageStatus } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

const FIELD = {
  FACILITY: '事業所',
  FACILITY_ID: '事業所ID', // テキスト型 (フィルタ検索用)
  USER: '利用者',
  USER_ID: '利用者ID', // テキスト型 (フィルタ検索用)
  YEAR_MONTH: '対象年月',
  TOTAL_WORK_MINUTES: '作業時間合計',
  ATTENDANCE_DAYS: '出勤日数',
  BASE_WAGE: '基本工賃',
  SKILL_WAGE: '能力給',
  ATTENDANCE_BONUS: '皆勤手当',
  TOTAL_WAGE: '合計工賃',
  DEDUCTIONS: '控除',
  NET_WAGE: '支給額',
  STATUS: 'ステータス',
  CREATED_AT: '作成日時',
  UPDATED_AT: '更新日時',
} as const;

function getLinkId(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return first != null ? String(first) : '';
  }
  return value != null ? String(value) : '';
}

function toLinkValue(id: string | undefined): string[] | undefined {
  if (!id) return undefined;
  return [id];
}

function toStatus(raw: unknown): WageStatus {
  const s = String(raw ?? '下書き');
  const map: Record<string, WageStatus> = {
    下書き: 'draft',
    確定: 'confirmed',
    支給済み: 'paid',
    draft: 'draft',
    confirmed: 'confirmed',
    paid: 'paid',
  };
  return map[s] ?? 'draft';
}

function toStatusLabel(value: WageStatus): string {
  const map: Record<WageStatus, string> = {
    draft: '下書き',
    confirmed: '確定',
    paid: '支給済み',
  };
  return map[value];
}

/**
 * Link型フィールド ('事業所', '利用者') からは record_id を取得しドメインIDとして使用。
 * フィルタ検索にはテキスト型の '事業所ID' / '利用者ID' フィールドを使用。
 */
function toEntity(record: LarkBitableRecord): WageCalculation {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: getLinkId(f[FIELD.FACILITY]),
    userId: getLinkId(f[FIELD.USER]),
    yearMonth: String(f[FIELD.YEAR_MONTH] ?? ''),
    totalWorkMinutes: Number(f[FIELD.TOTAL_WORK_MINUTES]) || 0,
    attendanceDays: Number(f[FIELD.ATTENDANCE_DAYS]) || 0,
    baseWage: Number(f[FIELD.BASE_WAGE]) || 0,
    skillWage: Number(f[FIELD.SKILL_WAGE]) || 0,
    attendanceBonus: Number(f[FIELD.ATTENDANCE_BONUS]) || 0,
    totalWage: Number(f[FIELD.TOTAL_WAGE]) || 0,
    deductions: Number(f[FIELD.DEDUCTIONS]) || 0,
    netWage: Number(f[FIELD.NET_WAGE]) || 0,
    status: toStatus(f[FIELD.STATUS]),
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

function toFields(entity: Partial<WageCalculation>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields[FIELD.FACILITY] = toLinkValue(entity.facilityId);
    fields[FIELD.FACILITY_ID] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
    fields[FIELD.USER] = toLinkValue(entity.userId);
    fields[FIELD.USER_ID] = entity.userId;
  }
  if (entity.yearMonth !== undefined) fields[FIELD.YEAR_MONTH] = entity.yearMonth;
  if (entity.totalWorkMinutes !== undefined) fields[FIELD.TOTAL_WORK_MINUTES] = entity.totalWorkMinutes;
  if (entity.attendanceDays !== undefined) fields[FIELD.ATTENDANCE_DAYS] = entity.attendanceDays;
  if (entity.baseWage !== undefined) fields[FIELD.BASE_WAGE] = entity.baseWage;
  if (entity.skillWage !== undefined) fields[FIELD.SKILL_WAGE] = entity.skillWage;
  if (entity.attendanceBonus !== undefined) fields[FIELD.ATTENDANCE_BONUS] = entity.attendanceBonus;
  if (entity.totalWage !== undefined) fields[FIELD.TOTAL_WAGE] = entity.totalWage;
  if (entity.deductions !== undefined) fields[FIELD.DEDUCTIONS] = entity.deductions;
  if (entity.netWage !== undefined) fields[FIELD.NET_WAGE] = entity.netWage;
  if (entity.status !== undefined) fields[FIELD.STATUS] = toStatusLabel(entity.status);
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields[FIELD.UPDATED_AT] = entity.updatedAt;

  // タイトル列: 工賃キーを自動生成
  if (entity.yearMonth !== undefined || entity.userId !== undefined) {
    const yearMonth = entity.yearMonth ?? '';
    const userId = entity.userId ?? '';
    fields['工賃キー'] = `${yearMonth}_${userId}`;
  }

  return fields;
}

export class WageCalculationRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<WageCalculation[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<WageCalculation | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async create(data: Omit<WageCalculation, 'id'>): Promise<WageCalculation> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  async update(id: string, data: Partial<WageCalculation>): Promise<WageCalculation> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
