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

const VERIFY_TIMEOUT_MS = 5000;
const MAX_BEARER_TOKEN_LENGTH = 4096;

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function authMiddleware(config: AuthConfig) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }
    const token = parseBearerToken(authHeader);
    if (!token) {
      res.status(401).json({ error: 'Invalid authorization format' });
      return;
    }

    if (token.length > MAX_BEARER_TOKEN_LENGTH) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Bearer トークン認証
    if (config.apiTokens.includes(token)) {
      req.auth = { type: 'bearer', token };
      next();
      return;
    }

    // LIFFアクセストークンの簡易検証
    try {
      const verifyRes = await fetchWithTimeout(
        `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`,
      );
      if (verifyRes.ok) {
        const data = (await verifyRes.json()) as { client_id?: string; expires_in?: number };
        const isValidChannel =
          typeof data.client_id === 'string' && config.liffChannelIds.includes(data.client_id);
        const isNotExpired = typeof data.expires_in === 'number' && data.expires_in > 0;

        if (isValidChannel && isNotExpired) {
          const profileRes = await fetchWithTimeout('https://api.line.me/v2/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (profileRes.ok) {
            const profile = (await profileRes.json()) as { userId?: string };
            if (typeof profile.userId === 'string' && profile.userId) {
              req.auth = { type: 'liff', userId: profile.userId, token };
              next();
              return;
            }
          }
        }
      }
    } catch {
      // verification failed — fall through
    }

    res.status(401).json({ error: 'Invalid or expired token' });
  };
}
