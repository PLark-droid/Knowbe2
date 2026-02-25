/**
 * ServiceCode Repository
 */

import { LRUCache } from 'lru-cache';
import type { ServiceCode } from '../../types/domain.js';
import type { BitableClient } from '../client.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

function toEntity(record: LarkBitableRecord): ServiceCode {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    code: String(f['サービスコード'] ?? ''),
    name: String(f['名称'] ?? ''),
    units: Number(f['単位数'] ?? 0),
    serviceType: String(f['サービス種類'] ?? ''),
    validFrom: String(f['有効開始日'] ?? ''),
    validTo: f['有効終了日'] ? String(f['有効終了日']) : undefined,
    isAddition: Boolean(f['加算フラグ']),
    conditions: f['適用条件'] ? String(f['適用条件']) : undefined,
  };
}

function toFields(entity: Partial<ServiceCode>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.code !== undefined) fields['サービスコード'] = entity.code;
  if (entity.name !== undefined) fields['名称'] = entity.name;
  if (entity.units !== undefined) fields['単位数'] = entity.units;
  if (entity.serviceType !== undefined) fields['サービス種類'] = entity.serviceType;
  if (entity.validFrom !== undefined) fields['有効開始日'] = entity.validFrom;
  if (entity.validTo !== undefined) fields['有効終了日'] = entity.validTo;
  if (entity.isAddition !== undefined) fields['加算フラグ'] = entity.isAddition;
  if (entity.conditions !== undefined) fields['適用条件'] = entity.conditions;
  return fields;
}

export class ServiceCodeRepository {
  private readonly cache: LRUCache<string, ServiceCode>;

  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {
    this.cache = new LRUCache<string, ServiceCode>({ max: 500, ttl: 1000 * 60 * 30 });
  }

  async findAll(): Promise<ServiceCode[]> {
    const records = await this.client.listAll(this.tableId);
    return records.map(toEntity);
  }

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

  async findByCode(code: string): Promise<ServiceCode | null> {
    for (const [, value] of this.cache.entries()) {
      if (value.code === code) return value;
    }

    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[サービスコード] = "${sanitizeLarkFilterValue(code)}"`,
    });
    if (records.length === 0) return null;

    const entity = toEntity(records[0]!);
    this.cache.set(entity.id, entity);
    return entity;
  }

  async findAllValid(date: string): Promise<ServiceCode[]> {
    const all = await this.findAll();
    return all.filter((sc) => {
      if (sc.validFrom > date) return false;
      if (sc.validTo && sc.validTo < date) return false;
      return true;
    });
  }

  async create(data: Omit<ServiceCode, 'id'>): Promise<ServiceCode> {
    const record = await this.client.create(this.tableId, toFields(data));
    const entity = toEntity(record);
    this.cache.set(entity.id, entity);
    return entity;
  }

  async update(id: string, data: Partial<ServiceCode>): Promise<ServiceCode> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    const entity = toEntity(record);
    this.cache.set(entity.id, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
    this.cache.delete(id);
  }
}
