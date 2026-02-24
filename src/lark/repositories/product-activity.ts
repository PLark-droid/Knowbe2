/**
 * ProductActivity Repository
 * 生産活動マスタの CRUD
 */

import type { ProductActivity } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

/** Lark レコード → ProductActivity エンティティ変換 */
function toEntity(record: LarkBitableRecord): ProductActivity {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['facility_id'] ?? ''),
    name: String(f['name'] ?? ''),
    description: f['description'] ? String(f['description']) : undefined,
    hourlyRate: Number(f['hourly_rate'] ?? 0),
    isActive: Boolean(f['is_active']),
    createdAt: String(f['created_at'] ?? ''),
    updatedAt: String(f['updated_at'] ?? ''),
  };
}

/** ProductActivity エンティティ → Lark フィールド変換 */
function toFields(entity: Partial<ProductActivity>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['facility_id'] = entity.facilityId;
  if (entity.name !== undefined) fields['name'] = entity.name;
  if (entity.description !== undefined) fields['description'] = entity.description;
  if (entity.hourlyRate !== undefined) fields['hourly_rate'] = entity.hourlyRate;
  if (entity.isActive !== undefined) fields['is_active'] = entity.isActive;
  if (entity.createdAt !== undefined) fields['created_at'] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields['updated_at'] = entity.updatedAt;
  return fields;
}

export class ProductActivityRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /** 事業所 ID で全件取得 */
  async findAll(facilityId: string): Promise<ProductActivity[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[facility_id] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /** ID で取得 */
  async findById(id: string, expectedFacilityId: string): Promise<ProductActivity | null> {
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

  /** レコード作成 */
  async create(data: Omit<ProductActivity, 'id'>): Promise<ProductActivity> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /** レコード更新 */
  async update(id: string, data: Partial<ProductActivity>): Promise<ProductActivity> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /** レコード削除 */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
