#!/usr/bin/env node
/**
 * webhook-fallback.js - Webhook キュー & フォールバック
 *
 * 特徴:
 * - 5秒タイムアウト付きWebhook送信
 * - 失敗時はローカルキューにバッファ
 * - 最大3回リトライ (指数バックオフ)
 * - バッチフラッシュ対応
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const QUEUE_DIR = '.ai/logs/webhook-queue';
const QUEUE_FILE = `${QUEUE_DIR}/pending.jsonl`;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

function ensureQueueDir() {
  if (!existsSync(QUEUE_DIR)) {
    mkdirSync(QUEUE_DIR, { recursive: true });
  }
}

async function sendWebhook(url, payload, retries = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return sendWebhook(url, payload, retries + 1);
    }

    return response.ok;
  } catch {
    clearTimeout(timeout);

    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return sendWebhook(url, payload, retries + 1);
    }

    return false;
  }
}

function queuePayload(payload) {
  ensureQueueDir();
  const line = JSON.stringify({ ...payload, _queuedAt: new Date().toISOString() });
  writeFileSync(QUEUE_FILE, line + '\n', { flag: 'a' });
}

async function flushQueue(url) {
  if (!existsSync(QUEUE_FILE)) return;

  const content = readFileSync(QUEUE_FILE, 'utf-8').trim();
  if (!content) return;

  const lines = content.split('\n').filter(Boolean);
  const failed = [];

  for (const line of lines) {
    const payload = JSON.parse(line);
    delete payload._queuedAt;
    const success = await sendWebhook(url, payload);
    if (!success) {
      failed.push(line);
    }
  }

  writeFileSync(QUEUE_FILE, failed.join('\n') + (failed.length ? '\n' : ''));
}

// メイン: stdin からJSONを読み取り送信
async function main() {
  const webhookUrl = process.env.MIYABI_WEBHOOK_URL;
  if (!webhookUrl) {
    process.exit(0);
  }

  // まずキューをフラッシュ
  await flushQueue(webhookUrl);

  // stdinからペイロードを読み取り
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    process.exit(0);
  }

  const payload = JSON.parse(input.trim());
  const success = await sendWebhook(webhookUrl, payload);

  if (!success) {
    queuePayload(payload);
    console.error('⚠️ Webhook failed, queued for retry');
    process.exit(1);
  }
}

main().catch(() => process.exit(1));
