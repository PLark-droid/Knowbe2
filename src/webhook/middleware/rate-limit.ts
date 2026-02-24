/**
 * レート制限ミドルウェア
 * スライディングウィンドウ方式
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  /** ウィンドウ時間 (ミリ秒) */
  windowMs: number;
  /** 最大リクエスト数 */
  maxRequests: number;
  /** レスポンスメッセージ */
  message?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1分
  maxRequests: 100,
  message: 'Too many requests, please try again later.',
};

export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const store = new Map<string, RateLimitEntry>();

  // 定期クリーンアップ
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, opts.windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    entry.count++;

    if (entry.count > opts.maxRequests) {
      res.status(429).json({ error: opts.message });
      return;
    }

    next();
  };
}
