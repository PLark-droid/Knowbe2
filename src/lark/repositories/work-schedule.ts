/**
 * WorkSchedule Repository
 *
 * Link型フィールド ('事業所', '利用者') には Lark record_id を書き込み、
 * ドメインモデルの facilityId / userId は テキスト型フィールドから読み取る。
 */

import type { WorkSchedule } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';
import { toLinkValue } from '../link-helpers.js';
import type { LinkResolver } from '../link-resolver.js';

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
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールドから読み取る。
 */
function toEntity(record: LarkBitableRecord): WorkSchedule {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    userId: String(f['利用者ID'] ?? ''),
    yearMonth: String(f['対象年月'] ?? ''),
    scheduledDays: parseScheduledDays(f['予定出勤日']),
    scheduledTime: parseScheduledTime(f['開始時刻'], f['終了時刻']),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toBaseFields(entity: Partial<WorkSchedule>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所ID'] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
    fields['利用者ID'] = entity.userId;
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
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<WorkSchedule>,
  ): Promise<void> {
    if (!this.linkResolver) return;

    if (entity.facilityId !== undefined) {
      const recordId = await this.linkResolver.resolve('facility', entity.facilityId);
      if (recordId) {
        fields['事業所'] = toLinkValue(recordId);
      }
    }
    if (entity.userId !== undefined) {
      const recordId = await this.linkResolver.resolve('user', entity.userId);
      if (recordId) {
        fields['利用者'] = toLinkValue(recordId);
      }
    }
  }

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
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<WorkSchedule>): Promise<WorkSchedule> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
