/**
 * UserRepository - 利用者 (ServiceUser) マスタ
 * 受給者証番号検索メソッド付き
 */

import type { ServiceUser } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Field Mapping (Japanese ↔ Entity) ──────────────────

function toEntity(record: LarkBitableRecord): ServiceUser {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    name: String(f['氏名'] ?? ''),
    nameKana: String(f['氏名カナ'] ?? ''),
    recipientNumber: String(f['受給者証番号'] ?? ''),
    disabilityNumber: f['障害者番号'] ? String(f['障害者番号']) : undefined,
    dateOfBirth: String(f['生年月日'] ?? ''),
    gender: String(f['性別'] ?? 'other') as ServiceUser['gender'],
    supportCategory: f['障害支援区分'] != null ? Number(f['障害支援区分']) : undefined,
    contractDaysPerMonth: Number(f['契約支給量'] ?? 0),
    serviceStartDate: String(f['利用開始日'] ?? ''),
    serviceEndDate: f['利用終了日'] ? String(f['利用終了日']) : undefined,
    copaymentLimit: Number(f['自己負担上限月額'] ?? 0),
    lineUserId: f['LINE_UID'] ? String(f['LINE_UID']) : undefined,
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
  if (entity.disabilityNumber !== undefined) fields['障害者番号'] = entity.disabilityNumber;
  if (entity.dateOfBirth !== undefined) fields['生年月日'] = entity.dateOfBirth;
  if (entity.gender !== undefined) fields['性別'] = entity.gender;
  if (entity.supportCategory !== undefined) fields['障害支援区分'] = entity.supportCategory;
  if (entity.contractDaysPerMonth !== undefined) fields['契約支給量'] = entity.contractDaysPerMonth;
  if (entity.serviceStartDate !== undefined) fields['利用開始日'] = entity.serviceStartDate;
  if (entity.serviceEndDate !== undefined) fields['利用終了日'] = entity.serviceEndDate;
  if (entity.copaymentLimit !== undefined) fields['自己負担上限月額'] = entity.copaymentLimit;
  if (entity.lineUserId !== undefined) fields['LINE_UID'] = entity.lineUserId;
  if (entity.isActive !== undefined) fields['有効'] = entity.isActive;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class UserRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /** 事業所IDで全利用者取得 */
  async findAll(facilityId: string): Promise<ServiceUser[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /** レコードIDで1件取得 */
  async findById(id: string, expectedFacilityId: string): Promise<ServiceUser | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /** 受給者証番号で検索 */
  async findByRecipientNumber(recipientNumber: string): Promise<ServiceUser | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[受給者証番号] = "${sanitizeLarkFilterValue(recipientNumber)}"`,
    });
    const first = records[0];
    return first ? toEntity(first) : null;
  }

  /** 新規作成 */
  async create(data: Omit<ServiceUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceUser> {
    const fields = toFields(data);
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  /** 更新 */
  async update(id: string, data: Partial<ServiceUser>): Promise<ServiceUser> {
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
