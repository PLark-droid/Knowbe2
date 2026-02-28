import type { Request, Response } from 'express';
import { createLarkCardHandler } from '../../src/webhook/handlers/lark-card.js';
import type { LarkCardHandlerDeps } from '../../src/webhook/handlers/lark-card.js';
import type { CsvGenerationDeps } from '../../src/webhook/handlers/csv-generation.js';
import type { InvoiceRepository } from '../../src/lark/repositories/invoice.js';
import type { FacilityRepository } from '../../src/lark/repositories/facility.js';
import type { UserRepository } from '../../src/lark/repositories/user.js';
import type { AttendanceRepository } from '../../src/lark/repositories/attendance.js';
import type { LarkBotMessaging } from '../../src/lark/bot-messaging.js';

// ─── Helpers ─────────────────────────────────────────────

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

function createMockCsvGenerationDeps(): CsvGenerationDeps {
  return {
    invoiceRepo: {
      updateStatus: vi.fn().mockResolvedValue({}),
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as InvoiceRepository,
    facilityRepo: {
      findAll: vi.fn().mockResolvedValue([
        { name: 'テスト事業所', facilityId: 'FAC001' },
      ]),
    } as unknown as FacilityRepository,
    userRepo: {
      findAll: vi.fn().mockResolvedValue([]),
    } as unknown as UserRepository,
    attendanceRepo: {} as unknown as AttendanceRepository,
    botMessaging: {
      sendInteractiveCard: vi.fn().mockResolvedValue('msg_001'),
      sendText: vi.fn().mockResolvedValue('msg_002'),
    } as unknown as LarkBotMessaging,
    chatId: 'chat_test',
    getAttendances: vi.fn().mockResolvedValue(new Map()),
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('createLarkCardHandler', () => {
  let handlerDeps: LarkCardHandlerDeps;

  beforeEach(() => {
    handlerDeps = {
      csvGenerationDeps: createMockCsvGenerationDeps(),
      verificationToken: 'test-verify-token',
    };
  });

  describe('token verification', () => {
    it('should reject requests with invalid token', async () => {
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'invalid-token',
        action: { value: { action: 'confirm' }, tag: 'button' },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });

    it('should accept requests with valid token', async () => {
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: {
          value: {
            action: 'cancel',
            invoice_id: 'rec_inv_001',
            facility_id: 'FAC001',
            year_month: '2026-01',
          },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
    });

    it('should skip token verification when verificationToken is not set', async () => {
      const deps: LarkCardHandlerDeps = {
        csvGenerationDeps: createMockCsvGenerationDeps(),
      };
      const handler = createLarkCardHandler(deps);
      const req = createMockRequest({
        token: 'any-token',
        action: {
          value: {
            action: 'cancel',
            invoice_id: 'rec_inv_001',
            facility_id: 'FAC001',
            year_month: '2026-01',
          },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('action routing', () => {
    it('should handle confirm action and return 200 immediately', async () => {
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: {
          value: {
            action: 'confirm',
            invoice_id: 'rec_inv_001',
            facility_id: 'FAC001',
            year_month: '2026-01',
          },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should handle cancel action and return 200 immediately', async () => {
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: {
          value: {
            action: 'cancel',
            invoice_id: 'rec_inv_001',
            facility_id: 'FAC001',
            year_month: '2026-01',
          },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should handle missing action value gracefully', async () => {
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: { tag: 'button' },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should handle missing action object gracefully', async () => {
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ msg: 'ok' });
    });

    it('should handle unknown action type', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: {
          value: { action: 'unknown_action' },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action type'),
      );
      consoleSpy.mockRestore();
    });

    it('should warn on missing required fields in action value', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: {
          value: {
            action: 'confirm',
            // missing invoice_id, facility_id, year_month
          },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required fields'),
        expect.anything(),
      );
      consoleSpy.mockRestore();
    });

    it('should handle missing action type in value', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const handler = createLarkCardHandler(handlerDeps);
      const req = createMockRequest({
        token: 'test-verify-token',
        action: {
          value: { some_other_key: 'value' },
          tag: 'button',
        },
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No action type'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should return 500 on unexpected error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const handler = createLarkCardHandler(handlerDeps);
      // Force an error by using a body that causes issues in processing
      const req = {
        get body(): never {
          throw new Error('Request body error');
        },
      } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Card callback processing failed' });
      consoleSpy.mockRestore();
    });
  });
});
