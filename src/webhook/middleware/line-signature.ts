/**
 * LINE Webhook署名検証ミドルウェア
 * HMAC-SHA256を使用してX-Line-Signatureヘッダーを検証する
 *
 * Security: channelSecretが空文字の場合、全リクエストを拒否する。
 * 空キーでHMAC署名が計算できてしまい認証が実質無効化されるため。
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function lineSignatureMiddleware(channelSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Defense-in-depth: 空のシークレットでは署名検証が無意味になるため拒否
    if (!channelSecret) {
      res.status(503).json({ error: 'Webhook authentication not configured' });
      return;
    }

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
