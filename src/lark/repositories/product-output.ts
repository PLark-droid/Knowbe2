/**
 * ProductOutput Repository
 *
 * Link型フィールド ('事業所', '利用者', '活動') には Lark record_id を書き込み、
 * ドメインモデルの facilityId / userId / activityId は テキスト型フィールドから読み取る。
 */

import type { ProductOutput } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';
import { toLinkValue } from '../link-helpers.js';
import type { LinkResolver } from '../link-resolver.js';

/**
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールドから読み取る。
 */
function toEntity(record: LarkBitableRecord): ProductOutput {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    userId: String(f['利用者ID'] ?? ''),
    activityId: String(f['活動ID'] ?? ''),
    date: String(f['日付'] ?? ''),
    workMinutes: Number(f['作業時間'] ?? 0),
    quantity: f['生産数量'] != null ? Number(f['生産数量']) : undefined,
    note: f['備考'] ? String(f['備考']) : undefined,
    createdAt: String(f['作成日時'] ?? ''),
  };
}

function toBaseFields(entity: Partial<ProductOutput>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所ID'] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
    fields['利用者ID'] = entity.userId;
  }
  if (entity.activityId !== undefined) {
    fields['活動ID'] = entity.activityId;
  }
  if (entity.date !== undefined) fields['日付'] = entity.date;
  if (entity.workMinutes !== undefined) fields['作業時間'] = entity.workMinutes;
  if (entity.quantity !== undefined) fields['生産数量'] = entity.quantity;
  if (entity.note !== undefined) fields['備考'] = entity.note;
  if (entity.createdAt !== undefined) fields['作成日時'] = entity.createdAt;

  // タイトル列: 実績キーを自動生成
  if (entity.date !== undefined || entity.userId !== undefined || entity.activityId !== undefined) {
    const date = entity.date ?? '';
    const userId = entity.userId ?? '';
    const activityId = entity.activityId ?? '';
    fields['実績キー'] = `${date}_${userId}_${activityId}`;
  }

  return fields;
}

export class ProductOutputRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<ProductOutput>,
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
    if (entity.activityId !== undefined) {
      const recordId = await this.linkResolver.resolve('activity', entity.activityId);
      if (recordId) {
        fields['活動'] = toLinkValue(recordId);
      }
    }
  }

  async findAll(facilityId: string): Promise<ProductOutput[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<ProductOutput | null> {
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
  ): Promise<ProductOutput[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: [
        `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
        `CurrentValue.[利用者ID] = "${sanitizeLarkFilterValue(userId)}"`,
        `CurrentValue.[日付] >= "${sanitizeLarkFilterValue(yearMonth)}-01"`,
        `CurrentValue.[日付] <= "${sanitizeLarkFilterValue(yearMonth)}-31"`,
      ].join(' AND '),
    });
    return records.map(toEntity);
  }

  async create(data: Omit<ProductOutput, 'id'>): Promise<ProductOutput> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<ProductOutput>): Promise<ProductOutput> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
