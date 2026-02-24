/**
 * Tests for webhook middleware
 * - LINE signature verification middleware
 * - Rate limit middleware
 * @module tests/webhook/middleware
 */

import { createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { lineSignatureMiddleware } from '../../src/webhook/middleware/line-signature.js';
import { rateLimitMiddleware } from '../../src/webhook/middleware/rate-limit.js';

// ─── Mock Helpers ───────────────────────────────────────

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
  ip?: string;
  socket?: { remoteAddress?: string };
}): Request & { rawBody?: Buffer } {
  return {
    headers: overrides?.headers ?? {},
    rawBody: overrides?.rawBody,
    ip: overrides?.ip ?? '127.0.0.1',
    socket: overrides?.socket ?? { remoteAddress: '127.0.0.1' },
  } as unknown as Request & { rawBody?: Buffer };
}

// ─── LINE Signature Middleware Tests ────────────────────

describe('lineSignatureMiddleware', () => {
  const channelSecret = 'test-channel-secret-key';

  function computeSignature(secret: string, body: Buffer): string {
    return createHmac('SHA256', secret).update(body).digest('base64');
  }

  it('should call next() when signature is valid', () => {
    const middleware = lineSignatureMiddleware(channelSecret);
    const body = Buffer.from(JSON.stringify({ events: [] }));
    const signature = computeSignature(channelSecret, body);

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

  it('should return 401 when x-line-signature header is missing', () => {
    const middleware = lineSignatureMiddleware(channelSecret);
    const body = Buffer.from(JSON.stringify({ events: [] }));

    const req = createMockRequest({
      headers: {},
      rawBody: body,
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Missing signature' });
  });

  it('should return 401 when signature is invalid', () => {
    const middleware = lineSignatureMiddleware(channelSecret);
    const body = Buffer.from(JSON.stringify({ events: [] }));

    const req = createMockRequest({
      headers: { 'x-line-signature': 'invalid-signature-value' },
      rawBody: body,
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid signature' });
  });

  it('should return 400 when rawBody is missing', () => {
    const middleware = lineSignatureMiddleware(channelSecret);

    const req = createMockRequest({
      headers: { 'x-line-signature': 'some-signature' },
      rawBody: undefined,
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Missing body' });
  });

  it('should reject a signature computed with a different secret', () => {
    const middleware = lineSignatureMiddleware(channelSecret);
    const body = Buffer.from(JSON.stringify({ events: [{ type: 'message' }] }));
    const wrongSignature = computeSignature('wrong-secret-key', body);

    const req = createMockRequest({
      headers: { 'x-line-signature': wrongSignature },
      rawBody: body,
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid signature' });
  });
});

// ─── Rate Limit Middleware Tests ────────────────────────

describe('rateLimitMiddleware', () => {
  afterEach(() => {
    // Clear any pending timers from setInterval in rateLimitMiddleware
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within the limit', () => {
    const middleware = rateLimitMiddleware({ maxRequests: 5, windowMs: 60000 });

    const req = createMockRequest({ ip: '10.0.0.1' });
    const res = createMockResponse();
    let nextCallCount = 0;
    const next: NextFunction = () => { nextCallCount++; };

    // Make 5 requests - all should pass
    for (let i = 0; i < 5; i++) {
      middleware(req as unknown as Request, res as unknown as Response, next);
    }

    expect(nextCallCount).toBe(5);
  });

  it('should return 429 when requests exceed the limit', () => {
    const middleware = rateLimitMiddleware({ maxRequests: 3, windowMs: 60000 });

    const req = createMockRequest({ ip: '10.0.0.2' });
    const res = createMockResponse();
    let nextCallCount = 0;
    const next: NextFunction = () => { nextCallCount++; };

    // Make 3 requests within limit
    for (let i = 0; i < 3; i++) {
      middleware(req as unknown as Request, res as unknown as Response, next);
    }
    expect(nextCallCount).toBe(3);

    // 4th request should be blocked
    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCallCount).toBe(3); // still 3, not incremented
    expect(res.statusCode).toBe(429);
  });

  it('should track different IPs separately', () => {
    const middleware = rateLimitMiddleware({ maxRequests: 2, windowMs: 60000 });

    const req1 = createMockRequest({ ip: '10.0.0.10' });
    const req2 = createMockRequest({ ip: '10.0.0.20' });
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    let nextCount1 = 0;
    let nextCount2 = 0;
    const next1: NextFunction = () => { nextCount1++; };
    const next2: NextFunction = () => { nextCount2++; };

    // Exhaust limit for IP 10.0.0.10
    middleware(req1 as unknown as Request, res1 as unknown as Response, next1);
    middleware(req1 as unknown as Request, res1 as unknown as Response, next1);
    middleware(req1 as unknown as Request, res1 as unknown as Response, next1); // should be blocked

    expect(nextCount1).toBe(2);
    expect(res1.statusCode).toBe(429);

    // IP 10.0.0.20 should still be allowed
    middleware(req2 as unknown as Request, res2 as unknown as Response, next2);

    expect(nextCount2).toBe(1);
  });

  it('should reset the counter after the time window expires', () => {
    const windowMs = 10000;
    const middleware = rateLimitMiddleware({ maxRequests: 2, windowMs });

    const req = createMockRequest({ ip: '10.0.0.30' });
    const res = createMockResponse();
    let nextCallCount = 0;
    const next: NextFunction = () => { nextCallCount++; };

    // Use up the limit
    middleware(req as unknown as Request, res as unknown as Response, next);
    middleware(req as unknown as Request, res as unknown as Response, next);
    expect(nextCallCount).toBe(2);

    // 3rd request blocked
    middleware(req as unknown as Request, res as unknown as Response, next);
    expect(nextCallCount).toBe(2);
    expect(res.statusCode).toBe(429);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Reset the response mock
    const res2 = createMockResponse();

    // Should be allowed again
    middleware(req as unknown as Request, res2 as unknown as Response, next);
    expect(nextCallCount).toBe(3);
  });

  it('should use default config when no config provided', () => {
    const middleware = rateLimitMiddleware();

    const req = createMockRequest({ ip: '10.0.0.40' });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    // Default allows 100 requests per minute - at least 1 should pass
    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(nextCalled).toBe(true);
  });

  it('should use custom error message', () => {
    const customMessage = 'Rate limit exceeded!';
    const middleware = rateLimitMiddleware({
      maxRequests: 1,
      windowMs: 60000,
      message: customMessage,
    });

    const req = createMockRequest({ ip: '10.0.0.50' });
    const res = createMockResponse();
    const next: NextFunction = () => {};

    // Use up the limit
    middleware(req as unknown as Request, res as unknown as Response, next);

    // 2nd request should be blocked with custom message
    middleware(req as unknown as Request, res as unknown as Response, next);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: customMessage });
  });

  it('should fall back to socket.remoteAddress when ip is undefined', () => {
    const middleware = rateLimitMiddleware({ maxRequests: 1, windowMs: 60000 });

    const req = createMockRequest({
      ip: undefined,
      socket: { remoteAddress: '192.168.1.1' },
    });
    // Override ip to be undefined (createMockRequest sets a default)
    (req as Record<string, unknown>).ip = undefined;

    const res = createMockResponse();
    let nextCallCount = 0;
    const next: NextFunction = () => { nextCallCount++; };

    middleware(req as unknown as Request, res as unknown as Response, next);
    expect(nextCallCount).toBe(1);

    // 2nd request should be blocked (same remote address)
    middleware(req as unknown as Request, res as unknown as Response, next);
    expect(nextCallCount).toBe(1);
    expect(res.statusCode).toBe(429);
  });
});
