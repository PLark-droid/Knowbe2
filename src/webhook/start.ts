/**
 * Webhookサーバー起動エントリーポイント
 * Usage: npm run webhook:server
 */

import type { Request, Response } from 'express';
import { createServer } from './server.js';
import { createLineWebhookHandler } from './handlers/line.js';
import { createLarkWebhookHandler } from './handlers/lark.js';
import { createAttendanceHandler } from './handlers/line-attendance.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const LINE_CHANNEL_SECRET = process.env['LINE_CHANNEL_SECRET'] ?? '';
const LARK_VERIFICATION_TOKEN = process.env['LARK_VERIFICATION_TOKEN'] ?? '';

if (!LINE_CHANNEL_SECRET) {
  console.warn('⚠️  LINE_CHANNEL_SECRET が未設定です。LINE Webhookの署名検証が機能しません。');
}

// 勤怠ハンドラー (スタブ — Lark Base接続後に実装を差し替え)
const attendanceHandler = createAttendanceHandler({
  findUserByLineId: async () => null,
  findAttendance: async () => null,
  createAttendance: async (data) => ({ ...data, id: 'stub', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  updateAttendance: async (id, data) => ({ id, facilityId: '', userId: '', date: '', breakMinutes: 0, attendanceType: 'present', pickupType: 'none', mealProvided: false, createdAt: '', updatedAt: '', ...data }),
  replyMessage: async (replyToken, messages) => {
    console.log(`[Reply] token=${replyToken.slice(0, 8)}... messages=`, JSON.stringify(messages).slice(0, 200));
  },
});

// LINE Webhookハンドラー
const lineHandler = createLineWebhookHandler({
  handleAttendancePostback: attendanceHandler,
  handleMessage: async (userId, message, replyToken) => {
    console.log(`[LINE Message] user=${userId} type=${message.type} text=${message.text ?? ''} reply=${replyToken.slice(0, 8)}...`);
  },
});

// Lark Webhookハンドラー
const larkHandler = createLarkWebhookHandler({
  onRecordCreated: async (tableId, recordId, fields) => {
    console.log(`[Lark] Record created: table=${tableId} record=${recordId}`, fields);
  },
});

// サーバー起動
const server = createServer({
  port: PORT,
  lineChannelSecret: LINE_CHANNEL_SECRET,
  larkVerificationToken: LARK_VERIFICATION_TOKEN,
  lineWebhookHandler: lineHandler,
  larkWebhookHandler: larkHandler,
  healthCheckApiHandler: async (_req: Request, res: Response) => {
    // TODO: Lark Base接続後に実装
    res.json({ status: 'ok', message: 'Health check API placeholder' });
  },
});

server.start();

console.log(`
🚀 Knowbe2 Webhook Server
   http://localhost:${PORT}/health        ← ヘルスチェック
   POST /webhook/line                     ← LINE Webhook
   POST /webhook/lark                     ← Lark Webhook
   POST /api/health-check                 ← 体調チェックAPI
`);
