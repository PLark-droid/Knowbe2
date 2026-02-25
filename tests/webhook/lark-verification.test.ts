import type { NextFunction, Request, Response } from 'express';
import { larkVerificationMiddleware } from '../../src/webhook/middleware/lark-verification.js';

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

describe('larkVerificationMiddleware', () => {
  const token = 'test-token';

  it('should return challenge for valid url verification request', () => {
    const middleware = larkVerificationMiddleware(token);
    const req = createMockRequest({
      type: 'url_verification',
      token,
      challenge: 'challenge-value',
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req, res as unknown as Response, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ challenge: 'challenge-value' });
  });

  it('should reject url verification request with invalid token', () => {
    const middleware = larkVerificationMiddleware(token);
    const req = createMockRequest({
      type: 'url_verification',
      token: 'wrong-token',
      challenge: 'challenge-value',
    });
    const res = createMockResponse();

    middleware(req, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('should call next for normal event with valid header token', () => {
    const middleware = larkVerificationMiddleware(token);
    const req = createMockRequest({
      header: { token },
      event: {},
    });
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req, res as unknown as Response, next);

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('should reject normal event when header token is missing', () => {
    const middleware = larkVerificationMiddleware(token);
    const req = createMockRequest({ event: {} });
    const res = createMockResponse();

    middleware(req, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });
});
