/**
 * Lark Bot メッセージ送信テスト
 * Usage: npx tsx --env-file=.env scripts/test-lark-message.ts
 */

const APP_ID = process.env['LARK_APP_ID'] ?? '';
const APP_SECRET = process.env['LARK_APP_SECRET'] ?? '';
const CHAT_ID = process.env['LARK_CSV_CHAT_ID'] ?? '';

async function getToken(): Promise<string> {
  const res = await fetch(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    },
  );
  const data = (await res.json()) as { code: number; msg: string; tenant_access_token?: string };
  if (data.code !== 0) {
    throw new Error(`Token取得失敗: code=${data.code} msg=${data.msg}`);
  }
  console.log('✅ トークン取得成功');
  return data.tenant_access_token!;
}

async function sendTestMessage(token: string): Promise<void> {
  const res = await fetch(
    `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: CHAT_ID,
        msg_type: 'text',
        content: JSON.stringify({ text: '🧪 Knowbe2 Bot テスト送信 — 接続確認OK' }),
      }),
    },
  );
  const data = (await res.json()) as { code: number; msg: string };
  if (data.code !== 0) {
    throw new Error(`送信失敗: code=${data.code} msg=${data.msg}`);
  }
  console.log('✅ メッセージ送信成功');
}

async function main(): Promise<void> {
  console.log('--- Lark Bot 送信テスト ---');
  console.log(`APP_ID: ${APP_ID.slice(0, 8)}...`);
  console.log(`CHAT_ID: ${CHAT_ID}`);

  if (!APP_ID || !APP_SECRET) {
    console.error('❌ LARK_APP_ID / LARK_APP_SECRET が未設定です');
    process.exit(1);
  }
  if (!CHAT_ID) {
    console.error('❌ LARK_CSV_CHAT_ID が未設定です');
    process.exit(1);
  }

  const token = await getToken();
  await sendTestMessage(token);
  console.log('--- 完了 ---');
}

main().catch((err) => {
  console.error('❌ エラー:', (err as Error).message);
  process.exit(1);
});
