/**
 * 監査ログ — 5年保管対応
 * 障害福祉サービスの記録保管義務に準拠
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type AuditAction =
  | 'attendance.create'
  | 'attendance.update'
  | 'attendance.delete'
  | 'billing.calculate'
  | 'billing.validate'
  | 'csv.generate'
  | 'csv.export'
  | 'invoice.create'
  | 'invoice.submit'
  | 'wage.calculate'
  | 'user.register'
  | 'user.update'
  | 'auth.login'
  | 'auth.logout';

export interface AuditEntry {
  timestamp: string;
  action: AuditAction;
  facilityId: string;
  userId?: string;
  staffId?: string;
  details: Record<string, unknown>;
  ip?: string;
}

const DEFAULT_LOG_DIR = './logs/audit';

export class AuditLogger {
  private readonly logDir: string;

  constructor(logDir?: string) {
    this.logDir = logDir ?? DEFAULT_LOG_DIR;
    mkdirSync(this.logDir, { recursive: true });
  }

  /** 監査ログを記録 */
  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(fullEntry) + '\n';
    const fileName = `audit-${fullEntry.timestamp.slice(0, 7)}.jsonl`;
    const filePath = join(this.logDir, fileName);

    appendFileSync(filePath, line, 'utf-8');
  }

  /** 勤怠操作を記録 */
  logAttendance(
    action: 'attendance.create' | 'attendance.update' | 'attendance.delete',
    facilityId: string,
    userId: string,
    details: Record<string, unknown>,
  ): void {
    this.log({ action, facilityId, userId, details });
  }

  /** 請求操作を記録 */
  logBilling(
    action: 'billing.calculate' | 'billing.validate' | 'invoice.create' | 'invoice.submit',
    facilityId: string,
    details: Record<string, unknown>,
  ): void {
    this.log({ action, facilityId, details });
  }

  /** CSV操作を記録 */
  logCsv(
    action: 'csv.generate' | 'csv.export',
    facilityId: string,
    details: Record<string, unknown>,
  ): void {
    this.log({ action, facilityId, details });
  }
}
