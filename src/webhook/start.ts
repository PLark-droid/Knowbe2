/**
 * Webhookサーバー起動エントリーポイント
 * Usage: npm run webhook:server
 */

import type { Request, Response } from 'express';
import { createServer } from './server.js';
import { createLineWebhookHandler } from './handlers/line.js';
import { createLarkWebhookHandler } from './handlers/lark.js';
import { createLarkCardHandler } from './handlers/lark-card.js';
import { createAttendanceHandler } from './handlers/line-attendance.js';
import { handleCsvGenerationRequest } from './handlers/csv-generation.js';
import { validateWebhookSecrets } from './validate-secrets.js';
import { LarkAuth } from '../lark/auth.js';
import { BitableClient } from '../lark/client.js';
import { LarkBotMessaging } from '../lark/bot-messaging.js';
import { UserRepository } from '../lark/repositories/user.js';
import { AttendanceRepository } from '../lark/repositories/attendance.js';
import { HealthCheckRepository } from '../lark/repositories/health-check.js';
import { FacilityRepository } from '../lark/repositories/facility.js';
import { InvoiceRepository } from '../lark/repositories/invoice.js';
import { LineMessagingService } from '../line/messaging.js';
import type { CsvGenerationDeps } from './handlers/csv-generation.js';

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
const LARK_TABLE_FACILITY = process.env['LARK_TABLE_FACILITY'] ?? '';
const LARK_TABLE_INVOICE = process.env['LARK_TABLE_INVOICE'] ?? '';
const LARK_CSV_CHAT_ID = process.env['LARK_CSV_CHAT_ID'] ?? '';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const isProduction = NODE_ENV === 'production';

function normalizeScore(value: unknown): 1 | 2 | 3 | 4 | 5 {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value as 1 | 2 | 3 | 4 | 5;
  }
  return 3;
}

function normalizeMeals(value: unknown): { breakfast: boolean; lunch: boolean; dinner: boolean } {
  if (!value || typeof value !== 'object') {
    return { breakfast: false, lunch: false, dinner: false };
  }
  const meals = value as Record<string, unknown>;
  return {
    breakfast: meals['breakfast'] === true,
    lunch: meals['lunch'] === true,
    dinner: meals['dinner'] === true,
  };
}

// ─── Webhook シークレット検証 (fail-fast) ────────────────────
// セキュリティ: 空のシークレットではHMAC署名/トークン検証が実質無効化される。
// 本番環境ではWebhook認証に必要な全シークレットを必須とし、未設定時は即座に終了する。

const { missing, warnings } = validateWebhookSecrets({
  lineChannelSecret: LINE_CHANNEL_SECRET,
  larkVerificationToken: LARK_VERIFICATION_TOKEN,
  larkAppId: LARK_APP_ID,
  larkAppSecret: LARK_APP_SECRET,
  larkBaseAppToken: LARK_BASE_APP_TOKEN,
  isProduction,
});

if (missing.length > 0) {
  console.error(
    `FATAL: 必須環境変数が未設定です: ${missing.join(', ')}\n` +
    '本番環境ではWebhook認証に必要な全シークレットを設定してください。',
  );
  process.exit(1);
}

for (const w of warnings) {
  console.warn(`WARNING: ${w}`);
}

// ─── Lark Base クライアント初期化 ────────────────────────────
const larkAuth = new LarkAuth({ appId: LARK_APP_ID, appSecret: LARK_APP_SECRET });
const bitableClient = new BitableClient({ auth: larkAuth, appToken: LARK_BASE_APP_TOKEN });

const userRepo = new UserRepository(bitableClient, LARK_TABLE_USER);
const attendanceRepo = new AttendanceRepository(bitableClient, LARK_TABLE_ATTENDANCE);
const healthCheckRepo = new HealthCheckRepository(bitableClient, LARK_TABLE_HEALTH_CHECK);
const facilityRepo = new FacilityRepository(bitableClient, LARK_TABLE_FACILITY);
const invoiceRepo = new InvoiceRepository(bitableClient, LARK_TABLE_INVOICE);

// ─── Lark Bot Messaging 初期化 ─────────────────────────────
const botMessaging = new LarkBotMessaging(larkAuth);

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

// ─── CSV生成ハンドラー依存 ──────────────────────────────────
const csvGenerationDeps: CsvGenerationDeps = {
  invoiceRepo,
  facilityRepo,
  userRepo,
  attendanceRepo,
  botMessaging,
  chatId: LARK_CSV_CHAT_ID,
  getAttendances: async (facilityId, yearMonth) => {
    const allAttendances = await attendanceRepo.findAll(facilityId);
    const filtered = allAttendances.filter((a) => a.date.startsWith(yearMonth));
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const existing = map.get(a.userId) ?? [];
      existing.push(a);
      map.set(a.userId, existing);
    }
    return map;
  },
};

// ─── Lark Webhookハンドラー (レコード作成・更新イベント) ─────
const larkHandler = createLarkWebhookHandler({
  onRecordCreated: async (tableId, recordId, fields) => {
    console.log(`[Lark] Record created: table=${tableId} record=${recordId}`, fields);
    // 勤怠テーブルへの新規レコード → LINE通知（将来拡張ポイント）
  },
  onRecordUpdated: async (tableId, recordId, fields) => {
    console.log(`[Lark] Record updated: table=${tableId} record=${recordId}`, fields);
  },
  invoiceTableId: LARK_TABLE_INVOICE,
  onCsvGenerationRequested: async (recordId, fields) => {
    console.log(`[Lark] CSV generation requested: record=${recordId}`, fields);
    // Invoice レコードを取得して CSV 生成フローを開始
    const invoice = await invoiceRepo.findById(recordId, String(fields['事業所ID'] ?? ''));
    if (invoice) {
      await handleCsvGenerationRequest(csvGenerationDeps, invoice);
    } else {
      console.error(`[Lark] Invoice not found for CSV generation: ${recordId}`);
    }
  },
});

// ─── Lark カードコールバックハンドラー ──────────────────────
const larkCardHandler = createLarkCardHandler({
  csvGenerationDeps,
  verificationToken: LARK_VERIFICATION_TOKEN || undefined,
});

// ─── 体調チェックAPIハンドラー ────────────────────────────────
async function healthCheckApiHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as {
      lineUserId?: unknown;
      score?: unknown;
      sleepHours?: number;
      meals?: unknown;
      mood?: string;
      note?: string;
    };

    if (typeof body.lineUserId !== 'string' || body.lineUserId.trim() === '') {
      res.status(400).json({ error: 'lineUserId is required' });
      return;
    }

    const lineUserId = body.lineUserId.trim();

    const user = await userRepo.findByLineUserId(lineUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const score = normalizeScore(body.score);

    const healthCheck = await healthCheckRepo.create({
      facilityId: user.facilityId,
      userId: user.id,
      date: today,
      score,
      sleepHours: body.sleepHours,
      meals: normalizeMeals(body.meals),
      mood: body.mood,
      note: body.note,
      createdAt: new Date().toISOString(),
    });

    // LINE返信（アクセストークンがある場合）
    if (lineMessaging) {
      try {
        const flexMsg = lineMessaging.buildHealthCheckResult(user.name, score);
        await lineMessaging.pushMessage(lineUserId, [flexMsg]);
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
  larkCardHandler,
  healthCheckApiHandler,
});

server.start();

console.log(`
🚀 Knowbe2 Webhook Server
   http://localhost:${PORT}/health        ← ヘルスチェック
   POST /webhook/line                     ← LINE Webhook
   POST /webhook/lark                     ← Lark Webhook
   POST /webhook/lark/card                ← Lark Card Callback
   POST /api/health-check                 ← 体調チェックAPI
   Lark Base: ${LARK_BASE_APP_TOKEN ? '接続済み' : '未接続'}
   LINE Messaging: ${LINE_CHANNEL_ACCESS_TOKEN ? '有効' : '無効'}
   CSV Chat ID: ${LARK_CSV_CHAT_ID ? '設定済み' : '未設定'}
`);
