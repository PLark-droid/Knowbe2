/**
 * UserRepository - 利用者マスタ
 */

import type { ServiceUser } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

function toGender(raw: unknown): ServiceUser['gender'] {
  const s = String(raw ?? 'その他');
  if (s === '男性' || s === 'male') return 'male';
  if (s === '女性' || s === 'female') return 'female';
  return 'other';
}

function toGenderLabel(gender: ServiceUser['gender']): string {
  if (gender === 'male') return '男性';
  if (gender === 'female') return '女性';
  return 'その他';
}

function toEntity(record: LarkBitableRecord): ServiceUser {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    name: String(f['氏名'] ?? ''),
    nameKana: String(f['氏名カナ'] ?? ''),
    recipientNumber: String(f['受給者証番号'] ?? ''),
    disabilityNumber: f['支給決定障害者番号'] ? String(f['支給決定障害者番号']) : undefined,
    dateOfBirth: String(f['生年月日'] ?? ''),
    gender: toGender(f['性別']),
    supportCategory: f['障害支援区分'] != null ? Number(f['障害支援区分']) || undefined : undefined,
    contractDaysPerMonth: Number(f['契約支給量'] ?? 0),
    serviceStartDate: String(f['利用開始日'] ?? ''),
    serviceEndDate: f['利用終了日'] ? String(f['利用終了日']) : undefined,
    copaymentLimit: Number(f['自己負担上限月額'] ?? 0),
    lineUserId: f['LINE User ID'] ? String(f['LINE User ID']) : undefined,
    isActive: Boolean(f['有効']),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<ServiceUser>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['事業所ID'] = entity.facilityId;
  if (entity.name !== undefined) fields['氏名'] = entity.name;
  if (entity.nameKana !== undefined) fields['氏名カナ'] = entity.nameKana;
  if (entity.recipientNumber !== undefined) fields['受給者証番号'] = entity.recipientNumber;
  if (entity.disabilityNumber !== undefined) fields['支給決定障害者番号'] = entity.disabilityNumber;
  if (entity.dateOfBirth !== undefined) fields['生年月日'] = entity.dateOfBirth;
  if (entity.gender !== undefined) fields['性別'] = toGenderLabel(entity.gender);
  if (entity.supportCategory !== undefined) fields['障害支援区分'] = String(entity.supportCategory);
  if (entity.contractDaysPerMonth !== undefined) fields['契約支給量'] = entity.contractDaysPerMonth;
  if (entity.serviceStartDate !== undefined) fields['利用開始日'] = entity.serviceStartDate;
  if (entity.serviceEndDate !== undefined) fields['利用終了日'] = entity.serviceEndDate;
  if (entity.copaymentLimit !== undefined) fields['自己負担上限月額'] = entity.copaymentLimit;
  if (entity.lineUserId !== undefined) fields['LINE User ID'] = entity.lineUserId;
  if (entity.isActive !== undefined) fields['有効'] = entity.isActive;

  // タイトル列: 表示名を自動生成
  if (entity.name !== undefined || entity.recipientNumber !== undefined) {
    const name = entity.name ?? '';
    const rcpt = entity.recipientNumber ?? '';
    const suffix = rcpt.length >= 4 ? rcpt.slice(-4) : rcpt;
    fields['表示名'] = `${name} (${suffix})`;
  }

  return fields;
}

export class UserRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<ServiceUser[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<ServiceUser | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async findByLineUserId(lineUserId: string): Promise<ServiceUser | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[LINE User ID] = "${sanitizeLarkFilterValue(lineUserId)}"`,
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async findByRecipientNumber(recipientNumber: string): Promise<ServiceUser | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[受給者証番号] = "${sanitizeLarkFilterValue(recipientNumber)}"`,
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async create(data: Omit<ServiceUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceUser> {
    const fields = toFields(data);
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<ServiceUser>): Promise<ServiceUser> {
    const fields = toFields(data);
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
