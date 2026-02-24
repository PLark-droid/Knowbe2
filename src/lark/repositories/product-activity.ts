/**
 * ProductActivity Repository
 */

import type { ProductActivity } from '../../types/domain.js';
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

/**
 * Link型フィールド ('事業所') からは record_id を取得しドメインIDとして使用。
 * フィルタ検索にはテキスト型の '事業所ID' フィールドを使用。
 */
function toEntity(record: LarkBitableRecord): ProductActivity {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: getLinkId(f['事業所']),
    name: String(f['活動名'] ?? ''),
    description: f['説明'] ? String(f['説明']) : undefined,
    hourlyRate: Number(f['作業単価'] ?? 0),
    isActive: Boolean(f['有効']),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<ProductActivity>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所'] = toLinkValue(entity.facilityId);
    fields['事業所ID'] = entity.facilityId; // テキスト型 (フィルタ検索用)
  }
  if (entity.name !== undefined) fields['活動名'] = entity.name;
  if (entity.description !== undefined) fields['説明'] = entity.description;
  if (entity.hourlyRate !== undefined) fields['作業単価'] = entity.hourlyRate;
  if (entity.isActive !== undefined) fields['有効'] = entity.isActive;
  if (entity.createdAt !== undefined) fields['作成日時'] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields['更新日時'] = entity.updatedAt;
  return fields;
}

export class ProductActivityRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<ProductActivity[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<ProductActivity | null> {
    try {
      const record = await this.client.get(this.tableId, id);
      const entity = toEntity(record);
      return entity.facilityId === expectedFacilityId ? entity : null;
    } catch {
      return null;
    }
  }

  async create(data: Omit<ProductActivity, 'id'>): Promise<ProductActivity> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  async update(id: string, data: Partial<ProductActivity>): Promise<ProductActivity> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
