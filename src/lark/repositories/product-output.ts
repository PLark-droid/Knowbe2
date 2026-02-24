/**
 * ProductOutput Repository
 * 生産実績の CRUD + 利用者月別検索
 */

import type { ProductOutput } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

/** Lark レコード → ProductOutput エンティティ変換 */
function toEntity(record: LarkBitableRecord): ProductOutput {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['facility_id'] ?? ''),
    userId: String(f['user_id'] ?? ''),
    activityId: String(f['activity_id'] ?? ''),
    date: String(f['date'] ?? ''),
    workMinutes: Number(f['work_minutes'] ?? 0),
    quantity: f['quantity'] != null ? Number(f['quantity']) : undefined,
    note: f['note'] ? String(f['note']) : undefined,
    createdAt: String(f['created_at'] ?? ''),
  };
}

/** ProductOutput エンティティ → Lark フィールド変換 */
function toFields(entity: Partial<ProductOutput>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['facility_id'] = entity.facilityId;
  if (entity.userId !== undefined) fields['user_id'] = entity.userId;
  if (entity.activityId !== undefined) fields['activity_id'] = entity.activityId;
  if (entity.date !== undefined) fields['date'] = entity.date;
  if (entity.workMinutes !== undefined) fields['work_minutes'] = entity.workMinutes;
  if (entity.quantity !== undefined) fields['quantity'] = entity.quantity;
  if (entity.note !== undefined) fields['note'] = entity.note;
  if (entity.createdAt !== undefined) fields['created_at'] = entity.createdAt;
  return fields;
}

export class ProductOutputRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /** 事業所 ID で全件取得 */
  async findAll(facilityId: string): Promise<ProductOutput[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[facility_id] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /** ID で取得 */
  async findById(id: string, expectedFacilityId: string): Promise<ProductOutput | null> {
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

  /** 利用者 + 年月で検索 (date が YYYY-MM-DD 形式の前方一致) */
  async findByUserAndMonth(
    facilityId: string,
    userId: string,
    yearMonth: string,
  ): Promise<ProductOutput[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: [
        `CurrentValue.[facility_id] = "${sanitizeLarkFilterValue(facilityId)}"`,
        `CurrentValue.[user_id] = "${sanitizeLarkFilterValue(userId)}"`,
        `CurrentValue.[date] >= "${sanitizeLarkFilterValue(yearMonth)}-01"`,
        `CurrentValue.[date] <= "${sanitizeLarkFilterValue(yearMonth)}-31"`,
      ].join(' AND '),
    });
    return records.map(toEntity);
  }

  /** レコード作成 */
  async create(data: Omit<ProductOutput, 'id'>): Promise<ProductOutput> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /** レコード更新 */
  async update(id: string, data: Partial<ProductOutput>): Promise<ProductOutput> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /** レコード削除 */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
