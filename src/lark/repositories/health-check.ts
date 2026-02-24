/**
 * HealthCheckRepository
 * Lark Bitable CRUD for health check records (体調チェック)
 */

import type { HealthCheck } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Lark field name constants ──────────────────────────
const FIELD = {
  FACILITY_ID: '事業所ID',
  USER_ID: '利用者ID',
  DATE: '日付',
  SCORE: '体調スコア',
  SLEEP_HOURS: '睡眠時間',
  BREAKFAST: '朝食',
  LUNCH: '昼食',
  DINNER: '夕食',
  MOOD: '気分',
  NOTE: '備考',
  CREATED_AT: '作成日時',
} as const;

// ─── Mapper: LarkRecord → HealthCheck ───────────────────

function toEntity(record: LarkBitableRecord): HealthCheck {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f[FIELD.FACILITY_ID] ?? ''),
    userId: String(f[FIELD.USER_ID] ?? ''),
    date: String(f[FIELD.DATE] ?? ''),
    score: (Number(f[FIELD.SCORE]) || 3) as HealthCheck['score'],
    sleepHours: f[FIELD.SLEEP_HOURS] != null ? Number(f[FIELD.SLEEP_HOURS]) : undefined,
    meals: {
      breakfast: Boolean(f[FIELD.BREAKFAST]),
      lunch: Boolean(f[FIELD.LUNCH]),
      dinner: Boolean(f[FIELD.DINNER]),
    },
    mood: f[FIELD.MOOD] != null ? String(f[FIELD.MOOD]) : undefined,
    note: f[FIELD.NOTE] != null ? String(f[FIELD.NOTE]) : undefined,
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
  };
}

// ─── Mapper: HealthCheck → Lark fields ──────────────────

function toFields(entity: Partial<HealthCheck>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields[FIELD.FACILITY_ID] = entity.facilityId;
  if (entity.userId !== undefined) fields[FIELD.USER_ID] = entity.userId;
  if (entity.date !== undefined) fields[FIELD.DATE] = entity.date;
  if (entity.score !== undefined) fields[FIELD.SCORE] = entity.score;
  if (entity.sleepHours !== undefined) fields[FIELD.SLEEP_HOURS] = entity.sleepHours;
  if (entity.meals !== undefined) {
    fields[FIELD.BREAKFAST] = entity.meals.breakfast;
    fields[FIELD.LUNCH] = entity.meals.lunch;
    fields[FIELD.DINNER] = entity.meals.dinner;
  }
  if (entity.mood !== undefined) fields[FIELD.MOOD] = entity.mood;
  if (entity.note !== undefined) fields[FIELD.NOTE] = entity.note;
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class HealthCheckRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /**
   * Retrieve all health check records for a facility.
   */
  async findAll(facilityId: string): Promise<HealthCheck[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /**
   * Retrieve a single health check record by ID.
   */
  async findById(id: string, expectedFacilityId: string): Promise<HealthCheck | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /**
   * Create a new health check record.
   */
  async create(data: Omit<HealthCheck, 'id'>): Promise<HealthCheck> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /**
   * Update an existing health check record.
   */
  async update(id: string, data: Partial<HealthCheck>): Promise<HealthCheck> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /**
   * Delete a health check record by ID.
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
