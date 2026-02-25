/**
 * Knowbe2 Express Webhookサーバー
 * LINE / Lark Webhook受信 + API エンドポイント
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { lineSignatureMiddleware } from './middleware/line-signature.js';
import { larkVerificationMiddleware } from './middleware/lark-verification.js';

export interface ServerDeps {
  port: number;
  lineChannelSecret: string;
  larkVerificationToken: string;
  lineWebhookHandler: (req: Request, res: Response) => Promise<void>;
  larkWebhookHandler: (req: Request, res: Response) => Promise<void>;
  healthCheckApiHandler?: (req: Request, res: Response) => Promise<void>;
  csvDownloadHandler?: (req: Request, res: Response) => Promise<void>;
}

/** Request extended with rawBody for signature verification */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function createServer(deps: ServerDeps) {
  const app = express();

  // JSON parsing with rawBody capture for LINE signature verification
  app.use(
    express.json({
      verify: (req: RawBodyRequest, _res: Response, buf: Buffer) => {
        req.rawBody = buf;
      },
    } as Parameters<typeof express.json>[0]),
  );

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // LINE webhook
  app.post(
    '/webhook/line',
    lineSignatureMiddleware(deps.lineChannelSecret),
    deps.lineWebhookHandler,
  );

  // Lark webhook
  app.post(
    '/webhook/lark',
    larkVerificationMiddleware(deps.larkVerificationToken),
    deps.larkWebhookHandler,
  );

  // Health check API
  if (deps.healthCheckApiHandler) {
    app.post('/api/health-check', deps.healthCheckApiHandler);
  }

  // CSV download (placeholder)
  if (deps.csvDownloadHandler) {
    app.get('/api/csv/kokuho-ren', deps.csvDownloadHandler);
  }

  // Error handler
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    },
  );

  return {
    app,
    start: () => {
      return app.listen(deps.port, () => {
        console.log(`Knowbe2 server listening on port ${deps.port}`);
      });
    },
  };
}
