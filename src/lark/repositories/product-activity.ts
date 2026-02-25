/**
 * ProductActivity Repository
 *
 * Link型フィールド ('事業所') には Lark record_id を書き込み、
 * ドメインモデルの facilityId は テキスト型フィールドから読み取る。
 */

import type { ProductActivity } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';
import { toLinkValue } from '../link-helpers.js';
import type { LinkResolver } from '../link-resolver.js';

/**
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールド '事業所ID' から読み取る。
 */
function toEntity(record: LarkBitableRecord): ProductActivity {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    name: String(f['活動名'] ?? ''),
    description: f['説明'] ? String(f['説明']) : undefined,
    hourlyRate: Number(f['作業単価'] ?? 0),
    isActive: Boolean(f['有効']),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toBaseFields(entity: Partial<ProductActivity>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所ID'] = entity.facilityId;
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
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<ProductActivity>,
  ): Promise<void> {
    if (!this.linkResolver) return;

    if (entity.facilityId !== undefined) {
      const recordId = await this.linkResolver.resolve('facility', entity.facilityId);
      if (recordId) {
        fields['事業所'] = toLinkValue(recordId);
      }
    }
  }

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
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<ProductActivity>): Promise<ProductActivity> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
