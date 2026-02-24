/**
 * WorkSchedule Repository
 * 勤務予定の CRUD + 利用者月別検索
 */

import type { WorkSchedule } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

/** scheduledTime を JSON 文字列からパース */
function parseScheduledTime(
  raw: unknown,
): { start: string; end: string } | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj['start'] === 'string' && typeof obj['end'] === 'string') {
      return { start: obj['start'], end: obj['end'] };
    }
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed['start'] === 'string' && typeof parsed['end'] === 'string') {
        return { start: parsed['start'], end: parsed['end'] };
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** scheduledDays を配列にパース */
function parseScheduledDays(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      return [];
    }
  }
  return [];
}

/** Lark レコード → WorkSchedule エンティティ変換 */
function toEntity(record: LarkBitableRecord): WorkSchedule {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['facility_id'] ?? ''),
    userId: String(f['user_id'] ?? ''),
    yearMonth: String(f['year_month'] ?? ''),
    scheduledDays: parseScheduledDays(f['scheduled_days']),
    scheduledTime: parseScheduledTime(f['scheduled_time']),
    createdAt: String(f['created_at'] ?? ''),
    updatedAt: String(f['updated_at'] ?? ''),
  };
}

/** WorkSchedule エンティティ → Lark フィールド変換 */
function toFields(entity: Partial<WorkSchedule>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['facility_id'] = entity.facilityId;
  if (entity.userId !== undefined) fields['user_id'] = entity.userId;
  if (entity.yearMonth !== undefined) fields['year_month'] = entity.yearMonth;
  if (entity.scheduledDays !== undefined) fields['scheduled_days'] = JSON.stringify(entity.scheduledDays);
  if (entity.scheduledTime !== undefined) fields['scheduled_time'] = JSON.stringify(entity.scheduledTime);
  if (entity.createdAt !== undefined) fields['created_at'] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields['updated_at'] = entity.updatedAt;
  return fields;
}

export class WorkScheduleRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /** 事業所 ID で全件取得 */
  async findAll(facilityId: string): Promise<WorkSchedule[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[facility_id] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /** ID で取得 */
  async findById(id: string, expectedFacilityId: string): Promise<WorkSchedule | null> {
    try {
      const record = await this.client.get(this.tableId, id);
      const entity = toEntity(record);
      if (entity.facilityId !== expectedFacilityId) {
        return null;
      }
      return entity;
    } catch {
      return null;
    }
  }

  /** 利用者 + 年月で検索 */
  async findByUserAndMonth(
    facilityId: string,
    userId: string,
    yearMonth: string,
  ): Promise<WorkSchedule | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: [
        `CurrentValue.[facility_id] = "${sanitizeLarkFilterValue(facilityId)}"`,
        `CurrentValue.[user_id] = "${sanitizeLarkFilterValue(userId)}"`,
        `CurrentValue.[year_month] = "${sanitizeLarkFilterValue(yearMonth)}"`,
      ].join(' AND '),
    });
    if (records.length === 0) return null;
    return toEntity(records[0]!);
  }

  /** レコード作成 */
  async create(data: Omit<WorkSchedule, 'id'>): Promise<WorkSchedule> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /** レコード更新 */
  async update(id: string, data: Partial<WorkSchedule>): Promise<WorkSchedule> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /** レコード削除 */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
