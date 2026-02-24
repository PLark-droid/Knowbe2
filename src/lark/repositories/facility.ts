/**
 * FacilityRepository - 事業所マスタ
 */

import type { AreaGrade, Facility, RewardStructure } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

function parseAreaGrade(raw: unknown): AreaGrade {
  const s = String(raw ?? '1').trim();
  const n = Number(s.replace(/[^0-9]/g, ''));
  if (n >= 1 && n <= 7) return n as AreaGrade;
  return 1;
}

function parseRewardStructure(raw: unknown): RewardStructure {
  const s = String(raw ?? 'Ⅰ');
  const map: Record<string, RewardStructure> = {
    'Ⅰ': 'I',
    'Ⅱ': 'II',
    'Ⅲ': 'III',
    'Ⅳ': 'IV',
    'Ⅴ': 'V',
    'Ⅵ': 'VI',
    I: 'I',
    II: 'II',
    III: 'III',
    IV: 'IV',
    V: 'V',
    VI: 'VI',
  };
  return map[s] ?? 'I';
}

function toAreaGradeLabel(value: AreaGrade): string {
  return `${value}級地`;
}

function toRewardLabel(value: RewardStructure): string {
  const map: Record<RewardStructure, string> = {
    I: 'Ⅰ',
    II: 'Ⅱ',
    III: 'Ⅲ',
    IV: 'Ⅳ',
    V: 'Ⅴ',
    VI: 'Ⅵ',
  };
  return map[value];
}

function toEntity(record: LarkBitableRecord): Facility {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    name: String(f['事業所名'] ?? ''),
    corporateName: String(f['法人名'] ?? ''),
    facilityNumber: String(f['事業所番号'] ?? ''),
    address: String(f['所在地'] ?? ''),
    postalCode: String(f['郵便番号'] ?? ''),
    phone: String(f['電話番号'] ?? ''),
    fax: f['FAX番号'] != null ? String(f['FAX番号']) : undefined,
    areaGrade: parseAreaGrade(f['地域区分']),
    rewardStructure: parseRewardStructure(f['報酬体系']),
    capacity: Number(f['定員'] ?? 0),
    averageMonthlyWage: f['平均工賃月額'] != null ? Number(f['平均工賃月額']) : undefined,
    serviceTypeCode: String(f['サービス種別コード'] ?? ''),
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<Facility>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['事業所ID'] = entity.facilityId;
  if (entity.name !== undefined) fields['事業所名'] = entity.name;
  if (entity.corporateName !== undefined) fields['法人名'] = entity.corporateName;
  if (entity.facilityNumber !== undefined) fields['事業所番号'] = entity.facilityNumber;
  if (entity.address !== undefined) fields['所在地'] = entity.address;
  if (entity.postalCode !== undefined) fields['郵便番号'] = entity.postalCode;
  if (entity.phone !== undefined) fields['電話番号'] = entity.phone;
  if (entity.fax !== undefined) fields['FAX番号'] = entity.fax;
  if (entity.areaGrade !== undefined) fields['地域区分'] = toAreaGradeLabel(entity.areaGrade);
  if (entity.rewardStructure !== undefined) fields['報酬体系'] = toRewardLabel(entity.rewardStructure);
  if (entity.capacity !== undefined) fields['定員'] = entity.capacity;
  if (entity.averageMonthlyWage !== undefined) fields['平均工賃月額'] = entity.averageMonthlyWage;
  if (entity.serviceTypeCode !== undefined) fields['サービス種別コード'] = entity.serviceTypeCode;
  return fields;
}

export class FacilityRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<Facility[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<Facility | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async create(data: Omit<Facility, 'id' | 'createdAt' | 'updatedAt'>): Promise<Facility> {
    const fields = toFields(data);
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<Facility>): Promise<Facility> {
    const fields = toFields(data);
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
