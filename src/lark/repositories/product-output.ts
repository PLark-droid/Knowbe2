/**
 * ProductOutput Repository
 */

import type { ProductOutput } from '../../types/domain.js';
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
 * Link型フィールド ('事業所', '利用者', '活動') からは record_id を取得しドメインIDとして使用。
 * フィルタ検索にはテキスト型の '事業所ID' / '利用者ID' フィールドを使用。
 */
function toEntity(record: LarkBitableRecord): ProductOutput {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: getLinkId(f['事業所']),
    userId: getLinkId(f['利用者']),
    activityId: getLinkId(f['活動']),
    date: String(f['日付'] ?? ''),
    workMinutes: Number(f['作業時間'] ?? 0),
    quantity: f['生産数量'] != null ? Number(f['生産数量']) : undefined,
    note: f['備考'] ? String(f['備考']) : undefined,
    createdAt: String(f['作成日時'] ?? ''),
  };
}

function toFields(entity: Partial<ProductOutput>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所'] = toLinkValue(entity.facilityId);
    fields['事業所ID'] = entity.facilityId; // テキスト型 (フィルタ検索用)
  }
  if (entity.userId !== undefined) {
    fields['利用者'] = toLinkValue(entity.userId);
    fields['利用者ID'] = entity.userId; // テキスト型 (フィルタ検索用)
  }
  if (entity.activityId !== undefined) {
    fields['活動'] = toLinkValue(entity.activityId);
    fields['活動ID'] = entity.activityId; // テキスト型 (フィルタ検索用)
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
  ) {}

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
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  async update(id: string, data: Partial<ProductOutput>): Promise<ProductOutput> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
