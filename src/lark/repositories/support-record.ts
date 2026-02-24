/**
 * SupportRecordRepository
 * Lark Bitable CRUD for support records (支援記録)
 */

import type { SupportRecord, SupportType } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Lark field name constants ──────────────────────────
const FIELD = {
  FACILITY_ID: '事業所ID',
  USER_ID: '利用者ID',
  STAFF_ID: '職員ID',
  DATE: '日付',
  CONTENT: '支援内容',
  SUPPORT_TYPE: '支援区分',
  CREATED_AT: '作成日時',
  UPDATED_AT: '更新日時',
} as const;

// ─── Mapper: LarkRecord → SupportRecord ─────────────────

function toEntity(record: LarkBitableRecord): SupportRecord {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f[FIELD.FACILITY_ID] ?? ''),
    userId: String(f[FIELD.USER_ID] ?? ''),
    staffId: String(f[FIELD.STAFF_ID] ?? ''),
    date: String(f[FIELD.DATE] ?? ''),
    content: String(f[FIELD.CONTENT] ?? ''),
    supportType: String(f[FIELD.SUPPORT_TYPE] ?? 'daily') as SupportType,
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

// ─── Mapper: SupportRecord → Lark fields ────────────────

function toFields(entity: Partial<SupportRecord>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields[FIELD.FACILITY_ID] = entity.facilityId;
  if (entity.userId !== undefined) fields[FIELD.USER_ID] = entity.userId;
  if (entity.staffId !== undefined) fields[FIELD.STAFF_ID] = entity.staffId;
  if (entity.date !== undefined) fields[FIELD.DATE] = entity.date;
  if (entity.content !== undefined) fields[FIELD.CONTENT] = entity.content;
  if (entity.supportType !== undefined) fields[FIELD.SUPPORT_TYPE] = entity.supportType;
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields[FIELD.UPDATED_AT] = entity.updatedAt;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class SupportRecordRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /**
   * Retrieve all support records for a facility.
   */
  async findAll(facilityId: string): Promise<SupportRecord[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /**
   * Retrieve a single support record by ID.
   */
  async findById(id: string, expectedFacilityId: string): Promise<SupportRecord | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /**
   * Create a new support record.
   */
  async create(data: Omit<SupportRecord, 'id'>): Promise<SupportRecord> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /**
   * Update an existing support record.
   */
  async update(id: string, data: Partial<SupportRecord>): Promise<SupportRecord> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /**
   * Delete a support record by ID.
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
