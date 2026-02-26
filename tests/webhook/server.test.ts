import type { Request, Response, NextFunction } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const lineMiddlewareImpl = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());
  const larkMiddlewareImpl = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());
  const lineSignatureMiddlewareFactory = vi.fn(() => lineMiddlewareImpl);
  const larkVerificationMiddlewareFactory = vi.fn(() => larkMiddlewareImpl);
  return {
    lineMiddlewareImpl,
    larkMiddlewareImpl,
    lineSignatureMiddlewareFactory,
    larkVerificationMiddlewareFactory,
  };
});

vi.mock('../../src/webhook/middleware/line-signature.js', () => ({
  lineSignatureMiddleware: mocks.lineSignatureMiddlewareFactory,
}));

vi.mock('../../src/webhook/middleware/lark-verification.js', () => ({
  larkVerificationMiddleware: mocks.larkVerificationMiddlewareFactory,
}));

import { createServer } from '../../src/webhook/server.js';

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

function getRouteLayer(app: unknown, path: string): { route: { stack: Array<{ handle: Function }>; methods: Record<string, boolean> } } {
  const stack =
    ((app as { router?: { stack?: Array<{ route?: { path?: string } }> }; _router?: { stack?: Array<{ route?: { path?: string } }> } }).router?.stack ??
      (app as { _router?: { stack?: Array<{ route?: { path?: string } }> } })._router?.stack ??
      []) as Array<{ route?: { path?: string } }>;
  const layer = stack.find((entry) => entry.route?.path === path);
  if (!layer) throw new Error(`Route not found: ${path}`);
  return layer as { route: { stack: Array<{ handle: Function }>; methods: Record<string, boolean> } };
}

function hasRoute(app: unknown, path: string): boolean {
  const stack =
    ((app as { router?: { stack?: Array<{ route?: { path?: string } }> }; _router?: { stack?: Array<{ route?: { path?: string } }> } }).router?.stack ??
      (app as { _router?: { stack?: Array<{ route?: { path?: string } }> } })._router?.stack ??
      []) as Array<{ route?: { path?: string } }>;
  return stack.some((entry) => entry.route?.path === path);
}

describe('createServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register health and webhook routes with expected middleware/handlers', async () => {
    const lineWebhookHandler = vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ ok: 'line' });
    });
    const larkWebhookHandler = vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ ok: 'lark' });
    });

    const { app } = createServer({
      port: 3000,
      lineChannelSecret: 'line-secret',
      larkVerificationToken: 'lark-token',
      lineWebhookHandler,
      larkWebhookHandler,
    });

    const healthLayer = getRouteLayer(app, '/health');
    const healthRes = createMockResponse();
    healthLayer.route.stack[0]!.handle({} as Request, healthRes as unknown as Response);
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.body).toEqual({ status: 'ok', timestamp: expect.any(String) });

    const lineLayer = getRouteLayer(app, '/webhook/line');
    expect(lineLayer.route.methods.post).toBe(true);
    expect(lineLayer.route.stack[0]!.handle).toBe(mocks.lineMiddlewareImpl);
    expect(lineLayer.route.stack[1]!.handle).toBe(lineWebhookHandler);

    const larkLayer = getRouteLayer(app, '/webhook/lark');
    expect(larkLayer.route.methods.post).toBe(true);
    expect(larkLayer.route.stack[0]!.handle).toBe(mocks.larkMiddlewareImpl);
    expect(larkLayer.route.stack[1]!.handle).toBe(larkWebhookHandler);

    expect(mocks.lineSignatureMiddlewareFactory).toHaveBeenCalledWith('line-secret');
    expect(mocks.larkVerificationMiddlewareFactory).toHaveBeenCalledWith('lark-token');
  });

  it('should mount optional API routes only when handlers are provided', () => {
    const lineWebhookHandler = vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });
    const larkWebhookHandler = vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });
    const healthCheckApiHandler = vi.fn(async (_req: Request, res: Response) => {
      res.status(201).json({ status: 'created' });
    });
    const csvDownloadHandler = vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ csv: 'ok' });
    });

    const { app: withOptional } = createServer({
      port: 3000,
      lineChannelSecret: 'line-secret',
      larkVerificationToken: 'lark-token',
      lineWebhookHandler,
      larkWebhookHandler,
      healthCheckApiHandler,
      csvDownloadHandler,
    });

    expect(hasRoute(withOptional, '/api/health-check')).toBe(true);
    expect(hasRoute(withOptional, '/api/csv/kokuho-ren')).toBe(true);

    const { app: withoutOptional } = createServer({
      port: 3000,
      lineChannelSecret: 'line-secret',
      larkVerificationToken: 'lark-token',
      lineWebhookHandler,
      larkWebhookHandler,
    });

    expect(hasRoute(withoutOptional, '/api/health-check')).toBe(false);
    expect(hasRoute(withoutOptional, '/api/csv/kokuho-ren')).toBe(false);
  });

  it('error middleware should return 500 JSON', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { app } = createServer({
      port: 3000,
      lineChannelSecret: 'line-secret',
      larkVerificationToken: 'lark-token',
      lineWebhookHandler: vi.fn(async (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      }),
      larkWebhookHandler: vi.fn(async (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      }),
    });

    const stack =
      ((app as { router?: { stack?: Array<{ handle: Function }> }; _router?: { stack?: Array<{ handle: Function }> } }).router?.stack ??
        (app as { _router?: { stack?: Array<{ handle: Function }> } })._router?.stack ??
        []) as Array<{ handle: Function }>;
    const errorLayer = stack.find((entry) => entry.handle.length === 4);
    expect(errorLayer).toBeDefined();

    const res = createMockResponse();
    errorLayer!.handle(new Error('boom'), {} as Request, res as unknown as Response, (() => undefined) as NextFunction);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

});
