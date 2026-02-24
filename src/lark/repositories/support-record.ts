/**
 * SupportRecordRepository
 */

import type { SupportRecord, SupportType } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

const FIELD = {
  FACILITY: '事業所',
  FACILITY_ID: '事業所ID', // テキスト型 (フィルタ検索用)
  USER: '利用者',
  USER_ID: '利用者ID', // テキスト型 (フィルタ検索用)
  STAFF: '担当職員',
  STAFF_ID: '担当職員ID', // テキスト型 (フィルタ検索用)
  DATE: '日付',
  CONTENT: '支援内容',
  SUPPORT_TYPE: '支援区分',
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

function toSupportType(raw: unknown): SupportType {
  const s = String(raw ?? '日常生活支援');
  const map: Record<string, SupportType> = {
    日常生活支援: 'daily',
    職業指導: 'vocational',
    相談支援: 'counseling',
    健康管理: 'health',
    社会生活支援: 'social',
    daily: 'daily',
    vocational: 'vocational',
    counseling: 'counseling',
    health: 'health',
    social: 'social',
  };
  return map[s] ?? 'daily';
}

function toSupportTypeLabel(value: SupportType): string {
  const map: Record<SupportType, string> = {
    daily: '日常生活支援',
    vocational: '職業指導',
    counseling: '相談支援',
    health: '健康管理',
    social: '社会生活支援',
  };
  return map[value];
}

/**
 * Link型フィールド ('事業所', '利用者', '担当職員') からは record_id を取得しドメインIDとして使用。
 * フィルタ検索にはテキスト型の '事業所ID' 等のフィールドを使用。
 */
function toEntity(record: LarkBitableRecord): SupportRecord {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: getLinkId(f[FIELD.FACILITY]),
    userId: getLinkId(f[FIELD.USER]),
    staffId: getLinkId(f[FIELD.STAFF]),
    date: String(f[FIELD.DATE] ?? ''),
    content: String(f[FIELD.CONTENT] ?? ''),
    supportType: toSupportType(f[FIELD.SUPPORT_TYPE]),
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

function toFields(entity: Partial<SupportRecord>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields[FIELD.FACILITY] = toLinkValue(entity.facilityId);
    fields[FIELD.FACILITY_ID] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
    fields[FIELD.USER] = toLinkValue(entity.userId);
    fields[FIELD.USER_ID] = entity.userId;
  }
  if (entity.staffId !== undefined) {
    fields[FIELD.STAFF] = toLinkValue(entity.staffId);
    fields[FIELD.STAFF_ID] = entity.staffId;
  }
  if (entity.date !== undefined) fields[FIELD.DATE] = entity.date;
  if (entity.content !== undefined) fields[FIELD.CONTENT] = entity.content;
  if (entity.supportType !== undefined) fields[FIELD.SUPPORT_TYPE] = toSupportTypeLabel(entity.supportType);
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields[FIELD.UPDATED_AT] = entity.updatedAt;

  // タイトル列: 支援キーを自動生成
  if (entity.date !== undefined || entity.userId !== undefined) {
    const date = entity.date ?? '';
    const userId = entity.userId ?? '';
    fields['支援キー'] = `${date}_${userId}`;
  }

  return fields;
}

export class SupportRecordRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<SupportRecord[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<SupportRecord | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async create(data: Omit<SupportRecord, 'id'>): Promise<SupportRecord> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  async update(id: string, data: Partial<SupportRecord>): Promise<SupportRecord> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
