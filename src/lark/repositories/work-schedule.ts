/**
 * WorkSchedule Repository
 */

import type { WorkSchedule } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

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

function parseScheduledTime(startRaw: unknown, endRaw: unknown): { start: string; end: string } | undefined {
  if (typeof startRaw === 'string' && typeof endRaw === 'string') {
    return { start: startRaw, end: endRaw };
  }
  return undefined;
}

function parseScheduledDays(raw: unknown): number[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
}

function serializeScheduledDays(days: number[] | undefined): string | undefined {
  if (!days) return undefined;
  return days.join(',');
}

/**
 * Link型フィールド ('事業所', '利用者') からは record_id を取得しドメインIDとして使用。
 * フィルタ検索にはテキスト型の '事業所ID' / '利用者ID' フィールドを使用。
 */
function toEntity(record: LarkBitableRecord): WorkSchedule {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: getLinkId(f['事業所']),
    userId: getLinkId(f['利用者']),
    yearMonth: String(f['対象年月'] ?? ''),
    scheduledDays: parseScheduledDays(f['予定出勤日']),
    scheduledTime: parseScheduledTime(f['開始時刻'], f['終了時刻']),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<WorkSchedule>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所'] = toLinkValue(entity.facilityId);
    fields['事業所ID'] = entity.facilityId; // テキスト型 (フィルタ検索用)
  }
  if (entity.userId !== undefined) {
    fields['利用者'] = toLinkValue(entity.userId);
    fields['利用者ID'] = entity.userId; // テキスト型 (フィルタ検索用)
  }
  if (entity.yearMonth !== undefined) fields['対象年月'] = entity.yearMonth;
  if (entity.scheduledDays !== undefined) fields['予定出勤日'] = serializeScheduledDays(entity.scheduledDays);
  if (entity.scheduledTime !== undefined) {
    fields['開始時刻'] = entity.scheduledTime.start;
    fields['終了時刻'] = entity.scheduledTime.end;
  }
  if (entity.createdAt !== undefined) fields['作成日時'] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields['更新日時'] = entity.updatedAt;

  // タイトル列: 予定キーを自動生成
  if (entity.yearMonth !== undefined || entity.userId !== undefined) {
    const yearMonth = entity.yearMonth ?? '';
    const userId = entity.userId ?? '';
    fields['予定キー'] = `${yearMonth}_${userId}`;
  }

  return fields;
}

export class WorkScheduleRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<WorkSchedule[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<WorkSchedule | null> {
    try {
      const record = await this.client.get(this.tableId, id);
      const entity = toEntity(record);
      return entity.facilityId === expectedFacilityId ? entity : null;
    } catch {
      return null;
    }
  }

  async findByUserAndMonth(
    facilityId: string,
    userId: string,
    yearMonth: string,
  ): Promise<WorkSchedule | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: [
        `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
        `CurrentValue.[利用者ID] = "${sanitizeLarkFilterValue(userId)}"`,
        `CurrentValue.[対象年月] = "${sanitizeLarkFilterValue(yearMonth)}"`,
      ].join(' AND '),
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async create(data: Omit<WorkSchedule, 'id'>): Promise<WorkSchedule> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  async update(id: string, data: Partial<WorkSchedule>): Promise<WorkSchedule> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
