/**
 * Lark チャット一覧取得
 * Usage: npx tsx --env-file=.env scripts/list-lark-chats.ts
 */

const APP_ID = process.env['LARK_APP_ID'] ?? '';
const APP_SECRET = process.env['LARK_APP_SECRET'] ?? '';

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
  if (data.code !== 0) throw new Error(`Token失敗: ${data.msg}`);
  return data.tenant_access_token!;
}

async function listChats(token: string): Promise<void> {
  const res = await fetch(
    'https://open.larksuite.com/open-apis/im/v1/chats?page_size=50',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = (await res.json()) as {
    code: number;
    msg: string;
    data?: { items?: Array<{ chat_id: string; name: string; chat_mode: string }> };
  };
  if (data.code !== 0) {
    console.error(`❌ エラー: code=${data.code} msg=${data.msg}`);
    return;
  }
  const items = data.data?.items ?? [];
  if (items.length === 0) {
    console.log('⚠️ ボットが参加しているチャットがありません。');
    console.log('  → Larkでチャットグループにボットを招待してください。');
    return;
  }
  console.log(`✅ ボットが参加しているチャット (${items.length}件):\n`);
  for (const item of items) {
    console.log(`  chat_id: ${item.chat_id}`);
    console.log(`  名前:    ${item.name}`);
    console.log(`  種別:    ${item.chat_mode}`);
    console.log('');
  }
}

async function main(): Promise<void> {
  console.log('--- Lark チャット一覧 ---\n');
  const token = await getToken();
  await listChats(token);
}

main().catch((err) => {
  console.error('❌', (err as Error).message);
  process.exit(1);
});
