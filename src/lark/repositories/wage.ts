/**
 * WageCalculationRepository
 * Lark Bitable CRUD for wage calculation records (工賃計算)
 */

import type { WageCalculation, WageStatus } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Lark field name constants ──────────────────────────
const FIELD = {
  FACILITY_ID: '事業所ID',
  USER_ID: '利用者ID',
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

// ─── Mapper: LarkRecord → WageCalculation ───────────────

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
    status: (String(f[FIELD.STATUS]) || 'draft') as WageStatus,
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

// ─── Mapper: WageCalculation → Lark fields ──────────────

function toFields(entity: Partial<WageCalculation>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields[FIELD.FACILITY_ID] = entity.facilityId;
  if (entity.userId !== undefined) fields[FIELD.USER_ID] = entity.userId;
  if (entity.yearMonth !== undefined) fields[FIELD.YEAR_MONTH] = entity.yearMonth;
  if (entity.totalWorkMinutes !== undefined) fields[FIELD.TOTAL_WORK_MINUTES] = entity.totalWorkMinutes;
  if (entity.attendanceDays !== undefined) fields[FIELD.ATTENDANCE_DAYS] = entity.attendanceDays;
  if (entity.baseWage !== undefined) fields[FIELD.BASE_WAGE] = entity.baseWage;
  if (entity.skillWage !== undefined) fields[FIELD.SKILL_WAGE] = entity.skillWage;
  if (entity.attendanceBonus !== undefined) fields[FIELD.ATTENDANCE_BONUS] = entity.attendanceBonus;
  if (entity.totalWage !== undefined) fields[FIELD.TOTAL_WAGE] = entity.totalWage;
  if (entity.deductions !== undefined) fields[FIELD.DEDUCTIONS] = entity.deductions;
  if (entity.netWage !== undefined) fields[FIELD.NET_WAGE] = entity.netWage;
  if (entity.status !== undefined) fields[FIELD.STATUS] = entity.status;
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields[FIELD.UPDATED_AT] = entity.updatedAt;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class WageCalculationRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /**
   * Retrieve all wage calculation records for a facility.
   */
  async findAll(facilityId: string): Promise<WageCalculation[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /**
   * Retrieve a single wage calculation record by ID.
   */
  async findById(id: string, expectedFacilityId: string): Promise<WageCalculation | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /**
   * Create a new wage calculation record.
   */
  async create(data: Omit<WageCalculation, 'id'>): Promise<WageCalculation> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /**
   * Update an existing wage calculation record.
   */
  async update(id: string, data: Partial<WageCalculation>): Promise<WageCalculation> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /**
   * Delete a wage calculation record by ID.
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
