/**
 * WageCalculationRepository
 *
 * Link型フィールド ('事業所', '利用者') には Lark record_id を書き込み、
 * ドメインモデルの facilityId / userId は テキスト型フィールドから読み取る。
 */

import type { WageCalculation, WageStatus } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';
import { toLinkValue } from '../link-helpers.js';
import type { LinkResolver } from '../link-resolver.js';

const FIELD = {
  FACILITY: '事業所',
  FACILITY_ID: '事業所ID', // テキスト型 (フィルタ検索用 + 業務ID読み取り)
  USER: '利用者',
  USER_ID: '利用者ID', // テキスト型 (フィルタ検索用 + 業務ID読み取り)
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
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールドから読み取る。
 */
function toEntity(record: LarkBitableRecord): WageCalculation {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f[FIELD.FACILITY_ID] ?? ''),
    userId: String(f[FIELD.USER_ID] ?? ''),
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

function toBaseFields(entity: Partial<WageCalculation>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields[FIELD.FACILITY_ID] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
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
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<WageCalculation>,
  ): Promise<void> {
    if (!this.linkResolver) return;

    if (entity.facilityId !== undefined) {
      const recordId = await this.linkResolver.resolve('facility', entity.facilityId);
      if (recordId) {
        fields[FIELD.FACILITY] = toLinkValue(recordId);
      }
    }
    if (entity.userId !== undefined) {
      const recordId = await this.linkResolver.resolve('user', entity.userId);
      if (recordId) {
        fields[FIELD.USER] = toLinkValue(recordId);
      }
    }
  }

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
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<WageCalculation>): Promise<WageCalculation> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
