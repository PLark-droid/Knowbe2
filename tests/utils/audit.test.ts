import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuditLogger } from '../../src/utils/audit.js';

describe('AuditLogger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'knowbe2-audit-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should write a JSONL audit entry', () => {
    const logger = new AuditLogger(tempDir);
    logger.log({
      action: 'billing.calculate',
      facilityId: 'FAC001',
      details: { yearMonth: '2025-06' },
    });

    const month = new Date().toISOString().slice(0, 7);
    const content = readFileSync(join(tempDir, `audit-${month}.jsonl`), 'utf-8').trim();
    const entry = JSON.parse(content) as {
      action: string;
      facilityId: string;
      details: Record<string, unknown>;
      timestamp: string;
    };

    expect(entry.action).toBe('billing.calculate');
    expect(entry.facilityId).toBe('FAC001');
    expect(entry.details).toEqual({ yearMonth: '2025-06' });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should support helper methods', () => {
    const logger = new AuditLogger(tempDir);

    logger.logAttendance('attendance.create', 'FAC001', 'USR001', { date: '2025-06-01' });
    logger.logBilling('billing.validate', 'FAC001', { errors: 0 });
    logger.logCsv('csv.export', 'FAC001', { file: 'kokuho.csv' });

    const month = new Date().toISOString().slice(0, 7);
    const lines = readFileSync(join(tempDir, `audit-${month}.jsonl`), 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { action: string });

    expect(lines).toHaveLength(3);
    expect(lines[0]?.action).toBe('attendance.create');
    expect(lines[1]?.action).toBe('billing.validate');
    expect(lines[2]?.action).toBe('csv.export');
  });
});
