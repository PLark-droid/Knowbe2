/**
 * Tests for webhook secret validation (Issue #19)
 *
 * Verifies:
 * 1. validateWebhookSecrets() fail-fast behavior in production
 * 2. lineSignatureMiddleware rejects requests when secret is empty
 * 3. larkVerificationMiddleware rejects requests when token is empty
 */

import type { NextFunction, Request, Response } from 'express';
import { lineSignatureMiddleware } from '../../src/webhook/middleware/line-signature.js';
import { larkVerificationMiddleware } from '../../src/webhook/middleware/lark-verification.js';
import { validateWebhookSecrets } from '../../src/webhook/validate-secrets.js';

// ─── Mock Helpers ───────────────────────────────────────────

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

function createMockRequest(overrides?: {
  headers?: Record<string, string>;
  rawBody?: Buffer;
  body?: Record<string, unknown>;
}): Request & { rawBody?: Buffer } {
  return {
    headers: overrides?.headers ?? {},
    rawBody: overrides?.rawBody,
    body: overrides?.body ?? {},
  } as unknown as Request & { rawBody?: Buffer };
}

// ─── validateWebhookSecrets ─────────────────────────────────

describe('validateWebhookSecrets', () => {
  const allSecrets = {
    lineChannelSecret: 'secret',
    larkVerificationToken: 'token',
    larkAppId: 'app-id',
    larkAppSecret: 'app-secret',
    larkBaseAppToken: 'base-token',
  };

  describe('production mode', () => {
    it('should return no missing secrets when all are provided', () => {
      const result = validateWebhookSecrets({ ...allSecrets, isProduction: true });
      expect(result.missing).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should report LINE_CHANNEL_SECRET as missing when empty', () => {
      const result = validateWebhookSecrets({
        ...allSecrets,
        lineChannelSecret: '',
        isProduction: true,
      });
      expect(result.missing).toContain('LINE_CHANNEL_SECRET');
    });

    it('should report LARK_VERIFICATION_TOKEN as missing when empty', () => {
      const result = validateWebhookSecrets({
        ...allSecrets,
        larkVerificationToken: '',
        isProduction: true,
      });
      expect(result.missing).toContain('LARK_VERIFICATION_TOKEN');
    });

    it('should report all Lark Base secrets as missing when empty', () => {
      const result = validateWebhookSecrets({
        ...allSecrets,
        larkAppId: '',
        larkAppSecret: '',
        larkBaseAppToken: '',
        isProduction: true,
      });
      expect(result.missing).toContain('LARK_APP_ID');
      expect(result.missing).toContain('LARK_APP_SECRET');
      expect(result.missing).toContain('LARK_BASE_APP_TOKEN');
    });

    it('should report all missing secrets at once', () => {
      const result = validateWebhookSecrets({
        lineChannelSecret: '',
        larkVerificationToken: '',
        larkAppId: '',
        larkAppSecret: '',
        larkBaseAppToken: '',
        isProduction: true,
      });
      expect(result.missing).toHaveLength(5);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('development mode', () => {
    it('should return warnings instead of missing when secrets are empty', () => {
      const result = validateWebhookSecrets({
        lineChannelSecret: '',
        larkVerificationToken: '',
        larkAppId: '',
        larkAppSecret: '',
        larkBaseAppToken: '',
        isProduction: false,
      });
      expect(result.missing).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about LINE_CHANNEL_SECRET', () => {
      const result = validateWebhookSecrets({
        ...allSecrets,
        lineChannelSecret: '',
        isProduction: false,
      });
      expect(result.missing).toHaveLength(0);
      expect(result.warnings.some(w => w.includes('LINE_CHANNEL_SECRET'))).toBe(true);
    });

    it('should warn about LARK_VERIFICATION_TOKEN', () => {
      const result = validateWebhookSecrets({
        ...allSecrets,
        larkVerificationToken: '',
        isProduction: false,
      });
      expect(result.missing).toHaveLength(0);
      expect(result.warnings.some(w => w.includes('LARK_VERIFICATION_TOKEN'))).toBe(true);
    });

    it('should return no warnings when all secrets are provided', () => {
      const result = validateWebhookSecrets({ ...allSecrets, isProduction: false });
      expect(result.missing).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

// ─── Middleware defense-in-depth: empty secret ──────────────

describe('lineSignatureMiddleware (empty secret)', () => {
  it('should return 503 when channelSecret is empty', () => {
    const middleware = lineSignatureMiddleware('');
    const req = createMockRequest({
      headers: { 'x-line-signature': 'any-signature' },
      rawBody: Buffer.from('{}'),
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Webhook authentication not configured' });
  });

  it('should still work normally when channelSecret is provided', async () => {
    const secret = 'test-secret';
    const middleware = lineSignatureMiddleware(secret);
    const body = Buffer.from('{}');
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('SHA256', secret).update(body).digest('base64');

    const req = createMockRequest({
      headers: { 'x-line-signature': signature },
      rawBody: body,
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(true);
  });
});

describe('larkVerificationMiddleware (empty token)', () => {
  it('should return 503 when verificationToken is empty', () => {
    const middleware = larkVerificationMiddleware('');
    const req = createMockRequest({
      body: { header: { token: '' }, event: {} },
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Webhook authentication not configured' });
  });

  it('should return 503 for url_verification when token is empty', () => {
    const middleware = larkVerificationMiddleware('');
    const req = createMockRequest({
      body: {
        type: 'url_verification',
        token: '',
        challenge: 'challenge-value',
      },
    });
    const res = createMockResponse();

    middleware(req as unknown as Request, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Webhook authentication not configured' });
  });

  it('should still work normally when verificationToken is provided', () => {
    const token = 'test-token';
    const middleware = larkVerificationMiddleware(token);
    const req = createMockRequest({
      body: { header: { token }, event: {} },
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(true);
  });
});
