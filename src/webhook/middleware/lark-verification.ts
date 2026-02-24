/**
 * Lark Webhook検証ミドルウェア
 * Challenge-responseによるURL検証 + イベントトークン検証
 */
import type { Request, Response, NextFunction } from 'express';
import type { LarkWebhookChallenge } from '../../types/lark.js';

export function larkVerificationMiddleware(verificationToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown>;

    // Challenge-response for URL verification
    if (body.type === 'url_verification') {
      const challenge = body as unknown as LarkWebhookChallenge;
      if (challenge.token !== verificationToken) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      res.json({ challenge: challenge.challenge });
      return;
    }

    // Normal event - verify token in header
    const header = body.header as Record<string, unknown> | undefined;
    if (!header || header.token !== verificationToken) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    next();
  };
}
