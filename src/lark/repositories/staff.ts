/**
 * StaffRepository - 職員マスタ
 * LINE ID連携メソッド付き
 */

import type { Staff, StaffRole } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Field Mapping (Japanese ↔ Entity) ──────────────────

function toEntity(record: LarkBitableRecord): Staff {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    name: String(f['氏名'] ?? ''),
    nameKana: String(f['氏名カナ'] ?? ''),
    role: String(f['役職'] ?? 'other') as StaffRole,
    lineUserId: f['LINE_UID'] ? String(f['LINE_UID']) : undefined,
    email: f['メールアドレス'] ? String(f['メールアドレス']) : undefined,
    isActive: Boolean(f['有効']),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<Staff>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['事業所ID'] = entity.facilityId;
  if (entity.name !== undefined) fields['氏名'] = entity.name;
  if (entity.nameKana !== undefined) fields['氏名カナ'] = entity.nameKana;
  if (entity.role !== undefined) fields['役職'] = entity.role;
  if (entity.lineUserId !== undefined) fields['LINE_UID'] = entity.lineUserId;
  if (entity.email !== undefined) fields['メールアドレス'] = entity.email;
  if (entity.isActive !== undefined) fields['有効'] = entity.isActive;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class StaffRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /** 事業所IDで全職員取得 */
  async findAll(facilityId: string): Promise<Staff[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /** レコードIDで1件取得 */
  async findById(id: string, expectedFacilityId: string): Promise<Staff | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /** LINE User IDで職員を検索 */
  async findByLineUserId(lineUserId: string): Promise<Staff | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[LINE_UID] = "${sanitizeLarkFilterValue(lineUserId)}"`,
    });
    const first = records[0];
    return first ? toEntity(first) : null;
  }

  /** LINE IDを職員レコードに紐付け */
  async linkLineUserId(id: string, lineUserId: string): Promise<Staff> {
    return this.update(id, { lineUserId });
  }

  /** LINE ID紐付けを解除 */
  async unlinkLineUserId(id: string): Promise<Staff> {
    const fields: Record<string, unknown> = {
      LINE_UID: null,
      '更新日時': new Date().toISOString(),
    };
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  /** 新規作成 */
  async create(data: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): Promise<Staff> {
    const fields = toFields(data);
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  /** 更新 */
  async update(id: string, data: Partial<Staff>): Promise<Staff> {
    const fields = toFields(data);
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  /** 削除 */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
