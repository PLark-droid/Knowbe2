/**
 * InvoiceRepository
 * Lark Bitable CRUD for invoice records (請求) with status management
 */

import type { Invoice, InvoiceStatus } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Lark field name constants ──────────────────────────
const FIELD = {
  FACILITY_ID: '事業所ID',
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

// ─── Mapper: LarkRecord → Invoice ───────────────────────

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
    status: (String(f[FIELD.STATUS]) || 'draft') as InvoiceStatus,
    csvGeneratedAt: f[FIELD.CSV_GENERATED_AT] != null ? String(f[FIELD.CSV_GENERATED_AT]) : undefined,
    submittedAt: f[FIELD.SUBMITTED_AT] != null ? String(f[FIELD.SUBMITTED_AT]) : undefined,
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
    updatedAt: String(f[FIELD.UPDATED_AT] ?? ''),
  };
}

// ─── Mapper: Invoice → Lark fields ──────────────────────

function toFields(entity: Partial<Invoice>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields[FIELD.FACILITY_ID] = entity.facilityId;
  if (entity.yearMonth !== undefined) fields[FIELD.YEAR_MONTH] = entity.yearMonth;
  if (entity.billingTarget !== undefined) fields[FIELD.BILLING_TARGET] = entity.billingTarget;
  if (entity.totalUnits !== undefined) fields[FIELD.TOTAL_UNITS] = entity.totalUnits;
  if (entity.totalAmount !== undefined) fields[FIELD.TOTAL_AMOUNT] = entity.totalAmount;
  if (entity.totalCopayment !== undefined) fields[FIELD.TOTAL_COPAYMENT] = entity.totalCopayment;
  if (entity.status !== undefined) fields[FIELD.STATUS] = entity.status;
  if (entity.csvGeneratedAt !== undefined) fields[FIELD.CSV_GENERATED_AT] = entity.csvGeneratedAt;
  if (entity.submittedAt !== undefined) fields[FIELD.SUBMITTED_AT] = entity.submittedAt;
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;
  if (entity.updatedAt !== undefined) fields[FIELD.UPDATED_AT] = entity.updatedAt;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class InvoiceRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /**
   * Retrieve all invoice records for a facility.
   */
  async findAll(facilityId: string): Promise<Invoice[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /**
   * Retrieve a single invoice record by ID.
   */
  async findById(id: string, expectedFacilityId: string): Promise<Invoice | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /**
   * Find invoices for a facility filtered by year-month (e.g. "2026-02").
   */
  async findByYearMonth(facilityId: string, yearMonth: string): Promise<Invoice[]> {
    const records = await this.client.listAll(this.tableId, {
      filter:
        `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"` +
        ` AND CurrentValue.[${FIELD.YEAR_MONTH}]="${sanitizeLarkFilterValue(yearMonth)}"`,
    });
    return records.map(toEntity);
  }

  /**
   * Create a new invoice record.
   */
  async create(data: Omit<Invoice, 'id'>): Promise<Invoice> {
    const record = await this.client.create(this.tableId, toFields(data));
    return toEntity(record);
  }

  /**
   * Update an existing invoice record.
   */
  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const record = await this.client.update(this.tableId, id, toFields(data));
    return toEntity(record);
  }

  /**
   * Transition the invoice to a new status.
   * Also sets csvGeneratedAt / submittedAt timestamps when appropriate.
   */
  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      [FIELD.STATUS]: status,
      [FIELD.UPDATED_AT]: now,
    };

    if (status === 'csv_generated') {
      fields[FIELD.CSV_GENERATED_AT] = now;
    }
    if (status === 'submitted' || status === 'resubmitted') {
      fields[FIELD.SUBMITTED_AT] = now;
    }

    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  /**
   * Delete an invoice record by ID.
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
