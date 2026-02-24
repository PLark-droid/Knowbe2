/**
 * LINE Webhook署名検証ミドルウェア
 * HMAC-SHA256を使用してX-Line-Signatureヘッダーを検証する
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function lineSignatureMiddleware(channelSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-line-signature'] as string;
    if (!signature) {
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    const body = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!body) {
      res.status(400).json({ error: 'Missing body' });
      return;
    }

    const expected = createHmac('SHA256', channelSecret)
      .update(body)
      .digest('base64');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  };
}
