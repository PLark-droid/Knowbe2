/**
 * Webhookサーバー起動エントリーポイント
 * Usage: npm run webhook:server
 */

import type { Request, Response } from 'express';
import { createServer } from './server.js';
import { createLineWebhookHandler } from './handlers/line.js';
import { createLarkWebhookHandler } from './handlers/lark.js';
import { createAttendanceHandler } from './handlers/line-attendance.js';
import { LarkAuth } from '../lark/auth.js';
import { BitableClient } from '../lark/client.js';
import { UserRepository } from '../lark/repositories/user.js';
import { AttendanceRepository } from '../lark/repositories/attendance.js';
import { HealthCheckRepository } from '../lark/repositories/health-check.js';
import { LineMessagingService } from '../line/messaging.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const LINE_CHANNEL_SECRET = process.env['LINE_CHANNEL_SECRET'] ?? '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? '';
const LARK_VERIFICATION_TOKEN = process.env['LARK_VERIFICATION_TOKEN'] ?? '';

// Lark Base 接続情報
const LARK_APP_ID = process.env['LARK_APP_ID'] ?? '';
const LARK_APP_SECRET = process.env['LARK_APP_SECRET'] ?? '';
const LARK_BASE_APP_TOKEN = process.env['LARK_BASE_APP_TOKEN'] ?? '';
const LARK_TABLE_USER = process.env['LARK_TABLE_USER'] ?? '';
const LARK_TABLE_ATTENDANCE = process.env['LARK_TABLE_ATTENDANCE'] ?? '';
const LARK_TABLE_HEALTH_CHECK = process.env['LARK_TABLE_HEALTH_CHECK'] ?? '';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const isProduction = NODE_ENV === 'production';

// LINE_CHANNEL_SECRET: 本番では必須（空キーで署名生成できてしまうため）
if (!LINE_CHANNEL_SECRET) {
  if (isProduction) {
    console.error('LINE_CHANNEL_SECRET が未設定です。本番環境では必須です。');
    process.exit(1);
  }
  console.warn('⚠️  LINE_CHANNEL_SECRET が未設定です。LINE Webhookの署名検証が機能しません。');
}

// LARK_VERIFICATION_TOKEN: 現時点では warn 止まり（将来の Lark Webhook 署名検証に備える）
if (!LARK_VERIFICATION_TOKEN) {
  if (isProduction) {
    console.warn('⚠️  LARK_VERIFICATION_TOKEN が未設定です。本番環境では設定を推奨します。');
  }
}

// Lark Base 接続: 本番では必須
if (!LARK_APP_ID || !LARK_APP_SECRET || !LARK_BASE_APP_TOKEN) {
  if (isProduction) {
    console.error('LARK_APP_ID / LARK_APP_SECRET / LARK_BASE_APP_TOKEN が未設定です。');
    process.exit(1);
  }
  console.warn('⚠️  Lark Base 接続情報が未設定です。勤怠・体調チェック機能が動作しません。');
}

// ─── Lark Base クライアント初期化 ────────────────────────────
const larkAuth = new LarkAuth({ appId: LARK_APP_ID, appSecret: LARK_APP_SECRET });
const bitableClient = new BitableClient({ auth: larkAuth, appToken: LARK_BASE_APP_TOKEN });

const userRepo = new UserRepository(bitableClient, LARK_TABLE_USER);
const attendanceRepo = new AttendanceRepository(bitableClient, LARK_TABLE_ATTENDANCE);
const healthCheckRepo = new HealthCheckRepository(bitableClient, LARK_TABLE_HEALTH_CHECK);

// ─── LINE Messaging クライアント初期化 ──────────────────────
const lineMessaging = LINE_CHANNEL_ACCESS_TOKEN
  ? new LineMessagingService(LINE_CHANNEL_ACCESS_TOKEN)
  : null;

// ─── 勤怠ハンドラー (実Lark Base接続) ───────────────────────
const attendanceHandler = createAttendanceHandler({
  findUserByLineId: async (lineUserId) => {
    const user = await userRepo.findByLineUserId(lineUserId);
    if (!user) return null;
    return { id: user.id, facilityId: user.facilityId, name: user.name };
  },
  findAttendance: (userId, date) => attendanceRepo.findByUserAndDate(userId, date),
  createAttendance: (data) => attendanceRepo.create(data),
  updateAttendance: (id, data) => attendanceRepo.update(id, data),
  replyMessage: async (replyToken, messages) => {
    if (lineMessaging) {
      await lineMessaging.replyMessage(replyToken, messages as Parameters<LineMessagingService['replyMessage']>[1]);
    } else {
      console.log(`[Reply stub] token=${replyToken.slice(0, 8)}... messages=`, JSON.stringify(messages).slice(0, 200));
    }
  },
});

// LINE Webhookハンドラー
const lineHandler = createLineWebhookHandler({
  handleAttendancePostback: attendanceHandler,
  handleMessage: async (userId, message, replyToken) => {
    console.log(`[LINE Message] user=${userId} type=${message.type} text=${message.text ?? ''} reply=${replyToken.slice(0, 8)}...`);
  },
});

// ─── Lark Webhookハンドラー (レコード作成・更新イベント) ─────
const larkHandler = createLarkWebhookHandler({
  onRecordCreated: async (tableId, recordId, fields) => {
    console.log(`[Lark] Record created: table=${tableId} record=${recordId}`, fields);
    // 勤怠テーブルへの新規レコード → LINE通知（将来拡張ポイント）
  },
  onRecordUpdated: async (tableId, recordId, fields) => {
    console.log(`[Lark] Record updated: table=${tableId} record=${recordId}`, fields);
  },
});

// ─── 体調チェックAPIハンドラー ────────────────────────────────
async function healthCheckApiHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as {
      lineUserId?: string;
      score?: number;
      sleepHours?: number;
      meals?: { breakfast: boolean; lunch: boolean; dinner: boolean };
      mood?: string;
      note?: string;
    };

    if (!body.lineUserId) {
      res.status(400).json({ error: 'lineUserId is required' });
      return;
    }

    const user = await userRepo.findByLineUserId(body.lineUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const score = (body.score ?? 3) as 1 | 2 | 3 | 4 | 5;

    const healthCheck = await healthCheckRepo.create({
      facilityId: user.facilityId,
      userId: user.id,
      date: today,
      score,
      sleepHours: body.sleepHours,
      meals: body.meals ?? { breakfast: false, lunch: false, dinner: false },
      mood: body.mood,
      note: body.note,
      createdAt: new Date().toISOString(),
    });

    // LINE返信（アクセストークンがある場合）
    if (lineMessaging) {
      try {
        const flexMsg = lineMessaging.buildHealthCheckResult(user.name, score);
        await lineMessaging.pushMessage(body.lineUserId, [flexMsg]);
      } catch (lineErr) {
        console.error('LINE push message failed:', lineErr);
      }
    }

    res.status(201).json({ status: 'ok', healthCheck });
  } catch (err) {
    console.error('Health check API error:', err);
    res.status(500).json({ error: 'Health check processing failed' });
  }
}

// ─── サーバー起動 ────────────────────────────────────────────
const server = createServer({
  port: PORT,
  lineChannelSecret: LINE_CHANNEL_SECRET,
  larkVerificationToken: LARK_VERIFICATION_TOKEN,
  lineWebhookHandler: lineHandler,
  larkWebhookHandler: larkHandler,
  healthCheckApiHandler,
});

server.start();

console.log(`
🚀 Knowbe2 Webhook Server
   http://localhost:${PORT}/health        ← ヘルスチェック
   POST /webhook/line                     ← LINE Webhook
   POST /webhook/lark                     ← Lark Webhook
   POST /api/health-check                 ← 体調チェックAPI
   Lark Base: ${LARK_BASE_APP_TOKEN ? '接続済み' : '未接続'}
   LINE Messaging: ${LINE_CHANNEL_ACCESS_TOKEN ? '有効' : '無効'}
`);
