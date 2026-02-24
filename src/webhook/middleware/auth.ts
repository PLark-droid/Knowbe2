/**
 * 職員認証ミドルウェア (Bearer / LIFFトークン)
 */

import type { Request, Response, NextFunction } from 'express';

export interface AuthConfig {
  /** LIFFチャネルIDリスト (検証用) */
  liffChannelIds: string[];
  /** Bearer トークンリスト (API認証用) */
  apiTokens: string[];
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    type: 'bearer' | 'liff';
    userId?: string;
    token: string;
  };
}

export function authMiddleware(config: AuthConfig) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (!token) {
      res.status(401).json({ error: 'Invalid authorization format' });
      return;
    }

    if (scheme === 'Bearer') {
      // Bearer トークン認証
      if (config.apiTokens.includes(token)) {
        req.auth = { type: 'bearer', token };
        next();
        return;
      }

      // LIFFアクセストークンの簡易検証
      // 本番ではLINE API で verify する
      try {
        const verifyRes = await fetch(
          `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`,
        );
        if (verifyRes.ok) {
          const data = (await verifyRes.json()) as { client_id: string; expires_in: number };
          if (config.liffChannelIds.includes(data.client_id) && data.expires_in > 0) {
            // プロフィール取得でuserIdを得る
            const profileRes = await fetch('https://api.line.me/v2/profile', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (profileRes.ok) {
              const profile = (await profileRes.json()) as { userId: string };
              req.auth = { type: 'liff', userId: profile.userId, token };
              next();
              return;
            }
          }
        }
      } catch {
        // verification failed — fall through
      }
    }

    res.status(401).json({ error: 'Invalid or expired token' });
  };
}
