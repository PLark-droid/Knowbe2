/**
 * E2E Flow Test: Lark Webhook
 *
 * Lark Base -> Webhook -> createLarkWebhookHandler のフローを検証する。
 * mock Request / Response を渡して以下の4パターンを網羅:
 *   1. URL verification (challenge echo-back)
 *   2. bitable.record.created イベント
 *   3. drive.file.bitable_record_changed_v1 イベント
 *   4. 不明なイベントタイプ
 */
import type { Request, Response } from 'express';
import {
  createLarkWebhookHandler,
  type LarkWebhookDeps,
} from '../../src/webhook/handlers/lark.js';

// ─── Mock Helpers ────────────────────────────────────────

interface MockResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function createMockRequest(body: Record<string, unknown>): Request {
  return { body } as Request;
}

/** 標準的な Lark イベントヘッダーを生成する */
function makeLarkHeader(eventType: string, eventId = 'evt_e2e_001') {
  return {
    event_id: eventId,
    event_type: eventType,
    create_time: '1740441600',
    token: 'verification-token',
    app_id: 'cli_app_e2e',
    tenant_key: 'tenant_e2e',
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('E2E: Lark Webhook Flow', () => {
  // ── 1. URL verification (challenge) ────────────────────
  describe('URL verification (challenge-response)', () => {
    it('should echo back the challenge value', async () => {
      const handler = createLarkWebhookHandler({});
      const req = createMockRequest({
        type: 'url_verification',
        token: 'verification-token',
        challenge: 'e2e-challenge-abc123',
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ challenge: 'e2e-challenge-abc123' });
    });

    it('should not invoke any event callbacks for challenge requests', async () => {
      const onRecordCreated = vi.fn();
      const onRecordUpdated = vi.fn();
      const handler = createLarkWebhookHandler({ onRecordCreated, onRecordUpdated });
      const req = createMockRequest({
        type: 'url_verification',
        token: 'tok',
        challenge: 'test-val',
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(onRecordUpdated).not.toHaveBeenCalled();
    });
  });

  // ── 2. bitable.record.created ──────────────────────────
  describe('bitable.record.created event', () => {
    it('should dispatch to onRecordCreated with table/record/fields', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const deps: LarkWebhookDeps = { onRecordCreated, onRecordUpdated };
      const handler = createLarkWebhookHandler(deps);

      const fields = {
        name: 'E2E User',
        date: '2026-02-25',
        clockIn: '09:00',
      };

      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('bitable.record.created'),
        event: {
          table_id: 'tbl_attendance',
          record_id: 'rec_e2e_001',
          fields,
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).toHaveBeenCalledWith(
        'tbl_attendance',
        'rec_e2e_001',
        fields,
      );
      expect(onRecordUpdated).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should handle missing fields gracefully (defaults to empty object)', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const handler = createLarkWebhookHandler({ onRecordCreated });

      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('bitable.record.created'),
        event: {
          table_id: 'tbl_health',
          record_id: 'rec_nof',
          // fields intentionally omitted
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).toHaveBeenCalledWith('tbl_health', 'rec_nof', {});
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 3. drive.file.bitable_record_changed_v1 ───────────
  describe('drive.file.bitable_record_changed_v1 event', () => {
    it('should dispatch to onRecordUpdated for record change events', async () => {
      const onRecordCreated = vi.fn();
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const deps: LarkWebhookDeps = { onRecordCreated, onRecordUpdated };
      const handler = createLarkWebhookHandler(deps);

      const fields = { score: 4, mood: 'good' };

      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('drive.file.bitable_record_changed_v1'),
        event: {
          table_id: 'tbl_health_check',
          record_id: 'rec_e2e_upd',
          fields,
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordUpdated).toHaveBeenCalledWith(
        'tbl_health_check',
        'rec_e2e_upd',
        fields,
      );
      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should also handle bitable.record.updated via onRecordUpdated', async () => {
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const handler = createLarkWebhookHandler({ onRecordUpdated });

      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('bitable.record.updated'),
        event: {
          table_id: 'tbl_attendance',
          record_id: 'rec_upd_002',
          fields: { clockOut: '17:30' },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordUpdated).toHaveBeenCalledWith(
        'tbl_attendance',
        'rec_upd_002',
        { clockOut: '17:30' },
      );
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 4. 不明なイベントタイプ ────────────────────────────
  describe('unknown event type', () => {
    it('should return 200 and not invoke any callbacks', async () => {
      const onRecordCreated = vi.fn();
      const onRecordUpdated = vi.fn();
      const deps: LarkWebhookDeps = { onRecordCreated, onRecordUpdated };
      const handler = createLarkWebhookHandler(deps);

      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('some.unknown.event.type'),
        event: {
          table_id: 'tbl_unknown',
          record_id: 'rec_unknown',
          fields: { x: 1 },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(onRecordUpdated).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should return 200 for events without event property', async () => {
      const handler = createLarkWebhookHandler({});
      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('some.event'),
        // no event property
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });
  });

  // ── 5. エラーハンドリング ──────────────────────────────
  describe('error handling', () => {
    it('should return 500 when callback throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const onRecordCreated = vi.fn().mockRejectedValue(new Error('Lark API timeout'));
      const handler = createLarkWebhookHandler({ onRecordCreated });

      const req = createMockRequest({
        schema: '2.0',
        header: makeLarkHeader('bitable.record.created'),
        event: {
          table_id: 'tbl_err',
          record_id: 'rec_err',
          fields: {},
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Lark webhook processing failed' });

      consoleSpy.mockRestore();
    });
  });
});
