/**
 * SupportRecordRepository
 *
 * Link型フィールド ('事業所', '利用者', '担当職員') には Lark record_id を書き込み、
 * ドメインモデルの facilityId / userId / staffId は テキスト型フィールドから読み取る。
 */

import type { SupportRecord, SupportType } from '../../types/domain.js';
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
  STAFF: '担当職員',
  STAFF_ID: '担当職員ID', // テキスト型 (フィルタ検索用 + 業務ID読み取り)
  DATE: '日付',
  CONTENT: '支援内容',
  SUPPORT_TYPE: '支援区分',
  CREATED_AT: '作成日時',
  UPDATED_AT: '更新日時',
} as const;

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
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールドから読み取る。
 */
function toEntity(record: LarkBitableRecord): SupportRecord {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f[FIELD.FACILITY_ID] ?? ''),
    userId: String(f[FIELD.USER_ID] ?? ''),
    staffId: String(f[FIELD.STAFF_ID] ?? ''),
    date: String(f[FIELD.DATE] ?? ''),
    content: String(f[FIELD.CONTENT] ?? ''),
    supportType: toSupportType(f[FIELD.SUPPORT_TYPE]),
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

function toBaseFields(entity: Partial<SupportRecord>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields[FIELD.FACILITY_ID] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
    fields[FIELD.USER_ID] = entity.userId;
  }
  if (entity.staffId !== undefined) {
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
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<SupportRecord>,
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
    if (entity.staffId !== undefined) {
      const recordId = await this.linkResolver.resolve('staff', entity.staffId);
      if (recordId) {
        fields[FIELD.STAFF] = toLinkValue(recordId);
      }
    }
  }

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
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<SupportRecord>): Promise<SupportRecord> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
