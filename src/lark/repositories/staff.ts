/**
 * StaffRepository - 職員マスタ
 */

import type { Staff, StaffRole } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

function toRole(raw: unknown): StaffRole {
  const s = String(raw ?? 'その他');
  const map: Record<string, StaffRole> = {
    サービス管理責任者: 'service_manager',
    職業指導員: 'vocational_instructor',
    生活支援員: 'life_support_worker',
    管理者: 'manager',
    その他: 'other',
    service_manager: 'service_manager',
    vocational_instructor: 'vocational_instructor',
    life_support_worker: 'life_support_worker',
    manager: 'manager',
    other: 'other',
  };
  return map[s] ?? 'other';
}

function toRoleLabel(role: StaffRole): string {
  const map: Record<StaffRole, string> = {
    service_manager: 'サービス管理責任者',
    vocational_instructor: '職業指導員',
    life_support_worker: '生活支援員',
    manager: '管理者',
    other: 'その他',
  };
  return map[role];
}

function toEntity(record: LarkBitableRecord): Staff {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    name: String(f['氏名'] ?? ''),
    nameKana: String(f['氏名カナ'] ?? ''),
    role: toRole(f['役職']),
    lineUserId: f['LINE User ID'] ? String(f['LINE User ID']) : undefined,
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
  if (entity.role !== undefined) fields['役職'] = toRoleLabel(entity.role);
  if (entity.lineUserId !== undefined) fields['LINE User ID'] = entity.lineUserId;
  if (entity.email !== undefined) fields['メールアドレス'] = entity.email;
  if (entity.isActive !== undefined) fields['有効'] = entity.isActive;

  // タイトル列: 表示名を自動生成
  if (entity.name !== undefined || entity.role !== undefined) {
    const name = entity.name ?? '';
    const roleLabel = entity.role !== undefined ? toRoleLabel(entity.role) : '';
    fields['表示名'] = `${name} (${roleLabel})`;
  }

  return fields;
}

export class StaffRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<Staff[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<Staff | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async findByLineUserId(lineUserId: string): Promise<Staff | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[LINE User ID] = "${sanitizeLarkFilterValue(lineUserId)}"`,
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async linkLineUserId(id: string, lineUserId: string): Promise<Staff> {
    return this.update(id, { lineUserId });
  }

  async unlinkLineUserId(id: string): Promise<Staff> {
    const fields: Record<string, unknown> = {
      'LINE User ID': null,
      更新日時: new Date().toISOString(),
    };
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async create(data: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): Promise<Staff> {
    const fields = toFields(data);
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<Staff>): Promise<Staff> {
    const fields = toFields(data);
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
