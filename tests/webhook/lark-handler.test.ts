import type { Request, Response } from 'express';
import { createLarkWebhookHandler, type LarkWebhookDeps } from '../../src/webhook/handlers/lark.js';

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

describe('createLarkWebhookHandler', () => {
  describe('URL verification (challenge-response)', () => {
    it('should echo back challenge for url_verification request', async () => {
      const handler = createLarkWebhookHandler({});
      const req = createMockRequest({
        type: 'url_verification',
        token: 'some-token',
        challenge: 'test-challenge-value',
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ challenge: 'test-challenge-value' });
    });

    it('should not call event handlers for url_verification', async () => {
      const onRecordCreated = vi.fn();
      const onRecordUpdated = vi.fn();
      const handler = createLarkWebhookHandler({ onRecordCreated, onRecordUpdated });
      const req = createMockRequest({
        type: 'url_verification',
        token: 'some-token',
        challenge: 'abc123',
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(onRecordUpdated).not.toHaveBeenCalled();
    });
  });

  describe('event handling - bitable.record.created', () => {
    it('should call onRecordCreated for bitable.record.created events', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const deps: LarkWebhookDeps = { onRecordCreated };
      const handler = createLarkWebhookHandler(deps);

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_001',
          event_type: 'bitable.record.created',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
          record_id: 'rec_123',
          fields: { name: 'test' },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).toHaveBeenCalledWith('tbl_abc', 'rec_123', { name: 'test' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });
  });

  describe('event handling - bitable.record.updated', () => {
    it('should call onRecordUpdated for bitable.record.updated events', async () => {
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const deps: LarkWebhookDeps = { onRecordUpdated };
      const handler = createLarkWebhookHandler(deps);

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_002',
          event_type: 'bitable.record.updated',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
          record_id: 'rec_456',
          fields: { status: 'updated' },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordUpdated).toHaveBeenCalledWith('tbl_abc', 'rec_456', { status: 'updated' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('event handling - drive.file.bitable_record_changed_v1', () => {
    it('should call onRecordUpdated for drive.file.bitable_record_changed_v1 events', async () => {
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const deps: LarkWebhookDeps = { onRecordUpdated };
      const handler = createLarkWebhookHandler(deps);

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_003',
          event_type: 'drive.file.bitable_record_changed_v1',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
          record_id: 'rec_789',
          fields: { score: 5 },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordUpdated).toHaveBeenCalledWith('tbl_abc', 'rec_789', { score: 5 });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('should handle missing event property gracefully', async () => {
      const handler = createLarkWebhookHandler({});
      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_004',
          event_type: 'unknown.event',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should handle event with missing fields gracefully', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const handler = createLarkWebhookHandler({ onRecordCreated });
      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_005',
          event_type: 'bitable.record.created',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
          record_id: 'rec_nof',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).toHaveBeenCalledWith('tbl_abc', 'rec_nof', {});
      expect(res.statusCode).toBe(200);
    });

    it('should handle unknown event type without calling handlers', async () => {
      const onRecordCreated = vi.fn();
      const onRecordUpdated = vi.fn();
      const handler = createLarkWebhookHandler({ onRecordCreated, onRecordUpdated });
      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_006',
          event_type: 'some.unknown.event',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
          record_id: 'rec_unk',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(onRecordUpdated).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('should return 500 when handler throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const onRecordCreated = vi.fn().mockRejectedValue(new Error('DB error'));
      const handler = createLarkWebhookHandler({ onRecordCreated });
      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_007',
          event_type: 'bitable.record.created',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
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

    it('should handle deps with no callbacks defined', async () => {
      const handler = createLarkWebhookHandler({});
      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_008',
          event_type: 'bitable.record.created',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_abc',
          record_id: 'rec_no_cb',
          fields: { x: 1 },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });
  });

  describe('updated branch routing (Issue #20)', () => {
    it('should call onRecordUpdated but NOT onRecordCreated for bitable.record.updated', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const handler = createLarkWebhookHandler({ onRecordCreated, onRecordUpdated });

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_upd_001',
          event_type: 'bitable.record.updated',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_upd',
          record_id: 'rec_upd_001',
          fields: { status: 'modified' },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(onRecordUpdated).toHaveBeenCalledWith('tbl_upd', 'rec_upd_001', { status: 'modified' });
      expect(res.statusCode).toBe(200);
    });

    it('should call onRecordUpdated but NOT onRecordCreated for drive.file.bitable_record_changed_v1', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const onRecordUpdated = vi.fn().mockResolvedValue(undefined);
      const handler = createLarkWebhookHandler({ onRecordCreated, onRecordUpdated });

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_chg_001',
          event_type: 'drive.file.bitable_record_changed_v1',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_chg',
          record_id: 'rec_chg_001',
          fields: { name: 'changed' },
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(onRecordUpdated).toHaveBeenCalledWith('tbl_chg', 'rec_chg_001', { name: 'changed' });
    });

    it('should handle bitable.record.updated when only onRecordCreated is defined', async () => {
      const onRecordCreated = vi.fn().mockResolvedValue(undefined);
      const handler = createLarkWebhookHandler({ onRecordCreated });

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_upd_nohandler',
          event_type: 'bitable.record.updated',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_upd',
          record_id: 'rec_upd_no',
          fields: {},
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(onRecordCreated).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should return 500 when onRecordUpdated throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const onRecordUpdated = vi.fn().mockRejectedValue(new Error('Update handler failed'));
      const handler = createLarkWebhookHandler({ onRecordUpdated });

      const req = createMockRequest({
        schema: '2.0',
        header: {
          event_id: 'evt_upd_err',
          event_type: 'bitable.record.updated',
          create_time: '1234567890',
          token: 'tok',
          app_id: 'cli_xxx',
          tenant_key: 'tenant_xxx',
        },
        event: {
          table_id: 'tbl_err',
          record_id: 'rec_err',
          fields: { x: 1 },
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
