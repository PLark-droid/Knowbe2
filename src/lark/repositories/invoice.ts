/**
 * InvoiceRepository
 *
 * Link型フィールド ('事業所') には Lark record_id を書き込み、
 * ドメインモデルの facilityId は テキスト型フィールドから読み取る。
 */

import type { Invoice, InvoiceStatus } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';
import { toLinkValue } from '../link-helpers.js';
import type { LinkResolver } from '../link-resolver.js';

const FIELD = {
  FACILITY: '事業所',
  FACILITY_ID: '事業所ID', // テキスト型 (フィルタ検索用 + 業務ID読み取り)
  YEAR_MONTH: '対象年月',
  BILLING_TARGET: '請求先',
  TOTAL_UNITS: '合計単位数',
  TOTAL_AMOUNT: '合計金額',
  TOTAL_COPAYMENT: '利用者負担額合計',
  STATUS: 'ステータス',
  CSV_GENERATED_AT: 'CSV生成日時',
  SUBMITTED_AT: '提出日',
  CREATED_AT: '作成日時',
  UPDATED_AT: '更新日時',
} as const;

function toStatus(raw: unknown): InvoiceStatus {
  const s = String(raw ?? '下書き');
  const map: Record<string, InvoiceStatus> = {
    下書き: 'draft',
    計算済み: 'calculated',
    CSV生成済み: 'csv_generated',
    提出済み: 'submitted',
    受理: 'accepted',
    返戻: 'rejected',
    再提出: 'resubmitted',
    draft: 'draft',
    calculated: 'calculated',
    csv_generated: 'csv_generated',
    submitted: 'submitted',
    accepted: 'accepted',
    rejected: 'rejected',
    resubmitted: 'resubmitted',
  };
  return map[s] ?? 'draft';
}

function toStatusLabel(value: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    draft: '下書き',
    calculated: '計算済み',
    csv_generated: 'CSV生成済み',
    submitted: '提出済み',
    accepted: '受理',
    rejected: '返戻',
    resubmitted: '再提出',
  };
  return map[value];
}

/**
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールドから読み取る。
 */
function toEntity(record: LarkBitableRecord): Invoice {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f[FIELD.FACILITY_ID] ?? ''),
    yearMonth: String(f[FIELD.YEAR_MONTH] ?? ''),
    billingTarget: 'kokuho_ren',
    totalUnits: Number(f[FIELD.TOTAL_UNITS]) || 0,
    totalAmount: Number(f[FIELD.TOTAL_AMOUNT]) || 0,
    totalCopayment: Number(f[FIELD.TOTAL_COPAYMENT]) || 0,
    status: toStatus(f[FIELD.STATUS]),
    csvGeneratedAt: f[FIELD.CSV_GENERATED_AT] != null ? String(f[FIELD.CSV_GENERATED_AT]) : undefined,
    submittedAt: f[FIELD.SUBMITTED_AT] != null ? String(f[FIELD.SUBMITTED_AT]) : undefined,
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

function toBaseFields(entity: Partial<Invoice>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields[FIELD.FACILITY_ID] = entity.facilityId;
  }
  if (entity.yearMonth !== undefined) fields[FIELD.YEAR_MONTH] = entity.yearMonth;
  if (entity.billingTarget !== undefined) fields[FIELD.BILLING_TARGET] = '国保連';
  if (entity.totalUnits !== undefined) fields[FIELD.TOTAL_UNITS] = entity.totalUnits;
  if (entity.totalAmount !== undefined) fields[FIELD.TOTAL_AMOUNT] = entity.totalAmount;
  if (entity.totalCopayment !== undefined) fields[FIELD.TOTAL_COPAYMENT] = entity.totalCopayment;
  if (entity.status !== undefined) fields[FIELD.STATUS] = toStatusLabel(entity.status);
  if (entity.csvGeneratedAt !== undefined) fields[FIELD.CSV_GENERATED_AT] = entity.csvGeneratedAt;
  if (entity.submittedAt !== undefined) fields[FIELD.SUBMITTED_AT] = entity.submittedAt;
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields[FIELD.UPDATED_AT] = entity.updatedAt;

  // タイトル列: 請求キーを自動生成
  if (entity.yearMonth !== undefined || entity.facilityId !== undefined) {
    const yearMonth = entity.yearMonth ?? '';
    const facilityId = entity.facilityId ?? '';
    fields['請求キー'] = `${yearMonth}_${facilityId}`;
  }

  return fields;
}

export class InvoiceRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<Invoice>,
  ): Promise<void> {
    if (!this.linkResolver) return;

    if (entity.facilityId !== undefined) {
      const recordId = await this.linkResolver.resolve('facility', entity.facilityId);
      if (recordId) {
        fields[FIELD.FACILITY] = toLinkValue(recordId);
      }
    }
  }

  async findAll(facilityId: string): Promise<Invoice[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<Invoice | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async findByYearMonth(facilityId: string, yearMonth: string): Promise<Invoice[]> {
    const records = await this.client.listAll(this.tableId, {
      filter:
        `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"` +
        ` AND CurrentValue.[${FIELD.YEAR_MONTH}]="${sanitizeLarkFilterValue(yearMonth)}"`,
    });
    return records.map(toEntity);
  }

  async create(data: Omit<Invoice, 'id'>): Promise<Invoice> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      [FIELD.STATUS]: toStatusLabel(status),
      [FIELD.UPDATED_AT]: now,
    };

    if (status === 'csv_generated') fields[FIELD.CSV_GENERATED_AT] = now;
    if (status === 'submitted' || status === 'resubmitted') fields[FIELD.SUBMITTED_AT] = now;

    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
