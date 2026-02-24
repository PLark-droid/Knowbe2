/**
 * ServiceCode Repository
 * サービスコードマスタの CRUD + LRU キャッシュ付き検索
 */

import { LRUCache } from 'lru-cache';
import type { ServiceCode } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

/** Lark レコード → ServiceCode エンティティ変換 */
function toEntity(record: LarkBitableRecord): ServiceCode {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    code: String(f['code'] ?? ''),
    name: String(f['name'] ?? ''),
    units: Number(f['units'] ?? 0),
    serviceType: String(f['service_type'] ?? ''),
    validFrom: String(f['valid_from'] ?? ''),
    validTo: f['valid_to'] ? String(f['valid_to']) : undefined,
    isAddition: Boolean(f['is_addition']),
    conditions: f['conditions'] ? String(f['conditions']) : undefined,
  };
}

/** ServiceCode エンティティ → Lark フィールド変換 */
function toFields(entity: Partial<ServiceCode>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.code !== undefined) fields['code'] = entity.code;
  if (entity.name !== undefined) fields['name'] = entity.name;
  if (entity.units !== undefined) fields['units'] = entity.units;
  if (entity.serviceType !== undefined) fields['service_type'] = entity.serviceType;
  if (entity.validFrom !== undefined) fields['valid_from'] = entity.validFrom;
  if (entity.validTo !== undefined) fields['valid_to'] = entity.validTo;
  if (entity.isAddition !== undefined) fields['is_addition'] = entity.isAddition;
  if (entity.conditions !== undefined) fields['conditions'] = entity.conditions;
  return fields;
}

export class ServiceCodeRepository {
  private readonly cache: LRUCache<string, ServiceCode>;

  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {
    this.cache = new LRUCache<string, ServiceCode>({
      max: 500,
      ttl: 1000 * 60 * 30,
    });
  }

  /** 全件取得 (ServiceCode はマスタデータのため facilityId フィルタなし) */
  async findAll(): Promise<ServiceCode[]> {
    const records = await this.client.listAll(this.tableId);
    return records.map(toEntity);
  }

  /** ID で取得 */
  async findById(id: string): Promise<ServiceCode | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    try {
      const record = await this.client.get(this.tableId, id);
      const entity = toEntity(record);
      this.cache.set(entity.id, entity);
      return entity;
    } catch {
      return null;
    }
  }

  /** サービスコード (6桁) で検索 — キャッシュ優先 */
  async findByCode(code: string): Promise<ServiceCode | null> {
    // キャッシュ内を検索
    for (const [, value] of Array.from(this.cache.entries())) {
      if (value.code === code) return value;
    }

    // Lark API で検索
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[code] = "${sanitizeLarkFilterValue(code)}"`,
    });
    if (records.length === 0) return null;

    const entity = toEntity(records[0]!);
    this.cache.set(entity.id, entity);
    return entity;
  }

  /** 指定日に有効なサービスコード一覧 */
  async findAllValid(date: string): Promise<ServiceCode[]> {
    const all = await this.findAll();
    return all.filter((sc) => {
      if (sc.validFrom > date) return false;
      if (sc.validTo && sc.validTo < date) return false;
      return true;
    });
  }

  /** レコード作成 */
  async create(data: Omit<ServiceCode, 'id'>): Promise<ServiceCode> {
    const record = await this.client.create(this.tableId, toFields(data));
    const entity = toEntity(record);
    this.cache.set(entity.id, entity);
    return entity;
  }

  /** レコード更新 */
  async update(id: string, data: Partial<ServiceCode>): Promise<ServiceCode> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    const entity = toEntity(record);
    this.cache.set(entity.id, entity);
    return entity;
  }

  /** レコード削除 */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
    this.cache.delete(id);
  }
}
