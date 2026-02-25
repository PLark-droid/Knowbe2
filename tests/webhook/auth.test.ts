import type { NextFunction, Request, Response } from 'express';
import { authMiddleware } from '../../src/webhook/middleware/auth.js';

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

function createMockRequest(header?: string): Request {
  return {
    headers: header ? { authorization: header } : {},
  } as unknown as Request;
}

describe('authMiddleware', () => {
  const config = {
    liffChannelIds: ['liff-channel-1'],
    apiTokens: ['api-token-1'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject when authorization header is missing', async () => {
    const middleware = authMiddleware(config);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    await middleware(req as unknown as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authorization header required' });
  });

  it('should reject malformed bearer format', async () => {
    const middleware = authMiddleware(config);
    const req = createMockRequest('Basic abc');
    const res = createMockResponse();

    await middleware(req as unknown as Request, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid authorization format' });
  });

  it('should authenticate configured API bearer token without calling LINE APIs', async () => {
    const middleware = authMiddleware(config);
    const req = createMockRequest('Bearer api-token-1') as Request & {
      auth?: { type: 'bearer' | 'liff'; token: string; userId?: string };
    };
    const res = createMockResponse();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const next = vi.fn() as NextFunction;

    await middleware(req as unknown as Request, res as unknown as Response, next);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual({ type: 'bearer', token: 'api-token-1' });
  });

  it('should authenticate LIFF token when verify/profile endpoints are valid', async () => {
    const middleware = authMiddleware(config);
    const req = createMockRequest('Bearer liff-valid-token') as Request & {
      auth?: { type: 'bearer' | 'liff'; token: string; userId?: string };
    };
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ client_id: 'liff-channel-1', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userId: 'U1234567890' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await middleware(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual({
      type: 'liff',
      userId: 'U1234567890',
      token: 'liff-valid-token',
    });
  });

  it('should reject token when LIFF verify response is invalid', async () => {
    const middleware = authMiddleware(config);
    const req = createMockRequest('Bearer liff-invalid-token');
    const res = createMockResponse();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ client_id: 'other-channel', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await middleware(req as unknown as Request, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('should reject when LINE verification fetch throws', async () => {
    const middleware = authMiddleware(config);
    const req = createMockRequest('Bearer liff-timeout-token');
    const res = createMockResponse();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network timeout'));

    await middleware(req as unknown as Request, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });
});
