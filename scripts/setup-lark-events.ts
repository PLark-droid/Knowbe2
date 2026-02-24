/**
 * Lark Event Subscription セットアップガイド
 *
 * Lark Developer Console でのイベントサブスクリプション設定手順を出力する。
 * Lark のイベント設定は管理画面 (Developer Console) から行うのが標準的な方法のため、
 * このスクリプトは設定値と手順を案内するガイドとして機能する。
 *
 * Usage: npx tsx --env-file=.env scripts/setup-lark-events.ts
 */

const LARK_APP_ID = process.env['LARK_APP_ID'] ?? '';
const LARK_VERIFICATION_TOKEN = process.env['LARK_VERIFICATION_TOKEN'] ?? '';
const WEBHOOK_DOMAIN = process.env['WEBHOOK_DOMAIN'] ?? 'https://<YOUR_DOMAIN>';
const LARK_DOMAIN = process.env['LARK_DOMAIN'] ?? 'https://open.larksuite.com';

/** サブスクライブすべきイベントタイプ */
const REQUIRED_EVENTS = [
  {
    name: 'drive.file.bitable_record_changed_v1',
    description: 'Bitable レコード変更 (作成・更新・削除)',
    category: 'Drive',
  },
] as const;

/** オプションのイベント (将来拡張用) */
const OPTIONAL_EVENTS = [
  {
    name: 'bitable.record.created',
    description: 'Bitable レコード作成 (旧API, 非推奨)',
    category: 'Bitable',
  },
  {
    name: 'bitable.record.updated',
    description: 'Bitable レコード更新 (旧API, 非推奨)',
    category: 'Bitable',
  },
] as const;

function printSeparator(char = '=', length = 70): void {
  console.log(char.repeat(length));
}

function printSection(title: string): void {
  console.log('');
  printSeparator();
  console.log(`  ${title}`);
  printSeparator();
  console.log('');
}

function printStep(step: number, title: string): void {
  console.log(`  [Step ${step}] ${title}`);
  console.log('  ' + '-'.repeat(50));
}

function checkEnvironment(): { hasAppId: boolean; hasToken: boolean; hasDomain: boolean } {
  const hasAppId = LARK_APP_ID.length > 0;
  const hasToken = LARK_VERIFICATION_TOKEN.length > 0;
  const hasDomain = !WEBHOOK_DOMAIN.includes('<YOUR_DOMAIN>');

  console.log('  Environment Check:');
  console.log(`    LARK_APP_ID:              ${hasAppId ? LARK_APP_ID : '(未設定)'}`);
  console.log(`    LARK_VERIFICATION_TOKEN:  ${hasToken ? '(設定済み)' : '(未設定 - Step 3 で取得)'}`);
  console.log(`    WEBHOOK_DOMAIN:           ${hasDomain ? WEBHOOK_DOMAIN : '(未設定 - .env に WEBHOOK_DOMAIN を追加)'}`);
  console.log(`    LARK_DOMAIN:              ${LARK_DOMAIN}`);
  console.log('');

  if (!hasAppId) {
    console.log('  [WARNING] LARK_APP_ID が未設定です。');
    console.log('  .env ファイルに LARK_APP_ID を設定してからこのスクリプトを再実行してください。');
    console.log('');
  }

  return { hasAppId, hasToken, hasDomain };
}

function main(): void {
  printSection('Knowbe2 - Lark Event Subscription Setup Guide');

  console.log('  このスクリプトは Lark Developer Console でイベントサブスクリプションを');
  console.log('  設定するための手順をガイドします。');
  console.log('');
  console.log('  Webhook URL: POST /webhook/lark');
  console.log('  対象: Lark Base (Bitable) レコード変更イベント');
  console.log('');

  const env = checkEnvironment();

  // ─── Step 1: Developer Console を開く ─────────────────────────
  printSection('Step 1: Lark Developer Console を開く');
  printStep(1, 'Lark Developer Console にアクセス');
  console.log('');
  console.log('  URL: https://open.larksuite.com/app');
  console.log('');
  console.log('  1. 上記URLにアクセスし、Larkアカウントでログイン');
  console.log(`  2. アプリ一覧から対象アプリを選択 (App ID: ${LARK_APP_ID || '<未設定>'})`);
  console.log('  3. 左メニューの "Event Subscriptions" をクリック');
  console.log('');

  // ─── Step 2: Request URL を設定 ───────────────────────────────
  printSection('Step 2: Request URL (Webhook URL) を設定');
  printStep(2, 'Request URL の設定');
  console.log('');

  const webhookUrl = `${WEBHOOK_DOMAIN}/webhook/lark`;
  console.log('  Request URL に以下を入力:');
  console.log('');
  console.log(`    ${webhookUrl}`);
  console.log('');
  console.log('  [重要] URL設定時に Lark が Challenge リクエストを送信します。');
  console.log('  Knowbe2 の Webhook サーバーが起動していることを確認してください:');
  console.log('');
  console.log('    npm run webhook:server');
  console.log('');
  console.log('  Challenge-Response の流れ:');
  console.log('    1. Lark が POST リクエストを送信:');
  console.log('       { "challenge": "xxxx", "token": "yyyy", "type": "url_verification" }');
  console.log('    2. サーバーが challenge をエコーバック:');
  console.log('       { "challenge": "xxxx" }');
  console.log('    3. Lark が URL を検証済みとしてマーク');
  console.log('');

  if (!env.hasDomain) {
    console.log('  [NOTE] ローカル開発環境の場合、ngrok 等でトンネリングが必要です:');
    console.log('    ngrok http 3000');
    console.log('    -> Forwarding https://xxxx.ngrok-free.app -> http://localhost:3000');
    console.log('    -> Request URL: https://xxxx.ngrok-free.app/webhook/lark');
    console.log('');
  }

  // ─── Step 3: Verification Token を取得 ────────────────────────
  printSection('Step 3: Verification Token を取得して .env に設定');
  printStep(3, 'Verification Token の設定');
  console.log('');
  console.log('  Developer Console の "Event Subscriptions" ページに');
  console.log('  "Verification Token" が表示されています。');
  console.log('');
  console.log('  この値を .env ファイルに設定:');
  console.log('');
  console.log('    LARK_VERIFICATION_TOKEN=<ここにトークンを貼り付け>');
  console.log('');

  if (env.hasToken) {
    console.log('  [OK] LARK_VERIFICATION_TOKEN は既に設定済みです。');
  } else {
    console.log('  [ACTION REQUIRED] LARK_VERIFICATION_TOKEN が未設定です。');
    console.log('  Developer Console からトークンを取得して .env に追加してください。');
  }
  console.log('');
  console.log('  [NOTE] Encrypt Key (任意) も同画面で確認できます。');
  console.log('  暗号化を有効にする場合は LARK_ENCRYPT_KEY も .env に追加してください。');
  console.log('');

  // ─── Step 4: イベントタイプを追加 ─────────────────────────────
  printSection('Step 4: イベントタイプを追加');
  printStep(4, 'サブスクライブするイベントの追加');
  console.log('');
  console.log('  "Add Events" ボタンをクリックし、以下のイベントを追加:');
  console.log('');
  console.log('  --- 必須イベント ---');
  for (const evt of REQUIRED_EVENTS) {
    console.log(`  [*] ${evt.name}`);
    console.log(`      Category: ${evt.category}`);
    console.log(`      ${evt.description}`);
    console.log('');
  }
  console.log('  --- オプション (旧API, 非推奨) ---');
  for (const evt of OPTIONAL_EVENTS) {
    console.log(`  [ ] ${evt.name}`);
    console.log(`      Category: ${evt.category}`);
    console.log(`      ${evt.description}`);
    console.log('');
  }
  console.log('  [NOTE] drive.file.bitable_record_changed_v1 は新しいAPI v2 のイベントです。');
  console.log('  bitable.record.created / bitable.record.updated は旧APIで将来廃止される');
  console.log('  可能性があります。両方登録しておくことを推奨します。');
  console.log('');

  // ─── Step 5: アプリ権限の確認 ─────────────────────────────────
  printSection('Step 5: アプリ権限 (Scopes) の確認');
  printStep(5, '必要な権限の確認');
  console.log('');
  console.log('  左メニューの "Permissions & Scopes" で以下の権限が付与されていることを確認:');
  console.log('');
  console.log('  [*] bitable:app             - Bitable アプリへのアクセス');
  console.log('  [*] bitable:app:readonly    - Bitable アプリの読み取り');
  console.log('  [*] drive:drive             - Drive へのアクセス (イベント受信に必要)');
  console.log('  [*] drive:drive:readonly    - Drive の読み取り');
  console.log('');
  console.log('  権限を追加した場合、テナント管理者の承認が必要です。');
  console.log('');

  // ─── Step 6: 動作確認 ─────────────────────────────────────────
  printSection('Step 6: 動作確認');
  printStep(6, 'イベント受信のテスト');
  console.log('');
  console.log('  1. Webhook サーバーを起動:');
  console.log('     npm run webhook:server');
  console.log('');
  console.log('  2. Lark Base で対象テーブルにレコードを追加/編集');
  console.log('');
  console.log('  3. サーバーログで以下のようなメッセージを確認:');
  console.log('     [Lark] Record created: table=tblXXX record=recYYY {...}');
  console.log('     [Lark] Record updated: table=tblXXX record=recYYY {...}');
  console.log('');
  console.log('  [TROUBLESHOOTING]');
  console.log('  - イベントが届かない場合:');
  console.log('    -> Developer Console の "Event Subscriptions" でステータスを確認');
  console.log('    -> Request URL が正しいか確認');
  console.log('    -> サーバーが起動しているか確認');
  console.log('  - 401 エラーの場合:');
  console.log('    -> LARK_VERIFICATION_TOKEN が正しいか確認');
  console.log('  - Challenge が失敗する場合:');
  console.log('    -> サーバーが外部からアクセス可能か確認 (ngrok 等)');
  console.log('');

  // ─── Summary ──────────────────────────────────────────────────
  printSection('Summary - .env に必要な設定');
  console.log('  # Lark Event Subscription');
  console.log(`  LARK_APP_ID=${LARK_APP_ID || '<Developer Console から取得>'}`);
  console.log(`  LARK_VERIFICATION_TOKEN=${LARK_VERIFICATION_TOKEN || '<Developer Console から取得>'}`);
  console.log(`  WEBHOOK_DOMAIN=${env.hasDomain ? WEBHOOK_DOMAIN : '<デプロイ先のドメイン or ngrok URL>'}`);
  console.log('');
  console.log('  # Webhook URL (Developer Console に設定する値)');
  console.log(`  ${webhookUrl}`);
  console.log('');
  printSeparator();
  console.log('  Setup guide complete.');
  printSeparator();
  console.log('');
}

main();
