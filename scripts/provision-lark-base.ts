/**
 * Lark Base プロビジョニングスクリプト
 *
 * 1. 既存テーブル削除
 * 2. 新テーブル作成 (マスタ -> 明細)
 * 3. Link フィールド追加
 * 4. フォーム再作成 + 共有有効化
 * 5. 権限付与
 * 6. .env 自動更新
 *
 * Usage: npx tsx --env-file=.env scripts/provision-lark-base.ts
 */

import { readFile, writeFile } from 'node:fs/promises';

const LARK_DOMAIN = process.env['LARK_DOMAIN'] || 'https://open.larksuite.com';
const APP_ID = process.env['LARK_APP_ID'] ?? '';
const APP_SECRET = process.env['LARK_APP_SECRET'] ?? '';
const APP_TOKEN = process.env['LARK_BASE_APP_TOKEN'] ?? '';
const ENV_PATH = '.env';

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('❌ LARK_APP_ID / LARK_APP_SECRET / LARK_BASE_APP_TOKEN が未設定です');
  process.exit(1);
}

const ADMIN_EMAIL = 'hiroki.matsui@sei-san-sei.com';

const FT = {
  TEXT: 1,
  NUMBER: 2,
  SINGLE_SELECT: 3,
  DATE_TIME: 5,
  CHECKBOX: 7,
  PHONE: 13,
  LINK: 18,
} as const;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type TableKey =
  | 'FACILITY'
  | 'USER'
  | 'STAFF'
  | 'SERVICE_CODE'
  | 'PRODUCT_ACTIVITY'
  | 'ATTENDANCE'
  | 'HEALTH_CHECK'
  | 'SUPPORT_RECORD'
  | 'WAGE'
  | 'INVOICE'
  | 'PRODUCT_OUTPUT'
  | 'WORK_SCHEDULE';

interface BitableField {
  field_name: string;
  type: number;
  property?: Record<string, unknown>;
  description?: { text: string };
}

interface TableDef {
  key: TableKey;
  name: string;
  fields: BitableField[];
}

interface LinkFieldDef {
  tableKey: TableKey;
  fieldName: string;
  targetTableKey: TableKey;
}

interface FormDef {
  tableKey: Extract<TableKey, 'ATTENDANCE' | 'HEALTH_CHECK' | 'SUPPORT_RECORD'>;
  formName: string;
  envKey: 'LARK_FORM_ATTENDANCE' | 'LARK_FORM_HEALTH_CHECK' | 'LARK_FORM_SUPPORT_RECORD';
}

interface LarkResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

const TABLE_ENV_KEYS: Record<TableKey, string> = {
  FACILITY: 'LARK_TABLE_FACILITY',
  USER: 'LARK_TABLE_USER',
  STAFF: 'LARK_TABLE_STAFF',
  SERVICE_CODE: 'LARK_TABLE_SERVICE_CODE',
  PRODUCT_ACTIVITY: 'LARK_TABLE_PRODUCT_ACTIVITY',
  ATTENDANCE: 'LARK_TABLE_ATTENDANCE',
  HEALTH_CHECK: 'LARK_TABLE_HEALTH_CHECK',
  SUPPORT_RECORD: 'LARK_TABLE_SUPPORT_RECORD',
  WAGE: 'LARK_TABLE_WAGE',
  INVOICE: 'LARK_TABLE_INVOICE',
  PRODUCT_OUTPUT: 'LARK_TABLE_PRODUCT_OUTPUT',
  WORK_SCHEDULE: 'LARK_TABLE_WORK_SCHEDULE',
};

const MASTER_TABLES: TableDef[] = [
  {
    key: 'FACILITY',
    name: '事業所マスタ',
    fields: [
      { field_name: '事業所名', type: FT.TEXT },
      { field_name: '事業所ID', type: FT.TEXT },
      { field_name: '法人名', type: FT.TEXT },
      { field_name: '事業所番号', type: FT.TEXT, description: { text: '10桁' } },
      { field_name: '所在地', type: FT.TEXT },
      { field_name: '郵便番号', type: FT.TEXT },
      { field_name: '電話番号', type: FT.PHONE },
      { field_name: 'FAX番号', type: FT.PHONE },
      { field_name: '地域区分', type: FT.SINGLE_SELECT, property: { options: ['1級地', '2級地', '3級地', '4級地', '5級地', '6級地', '7級地'].map((name) => ({ name })) } },
      { field_name: '報酬体系', type: FT.SINGLE_SELECT, property: { options: ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'].map((name) => ({ name })) } },
      { field_name: '定員', type: FT.NUMBER },
      { field_name: '平均工賃月額', type: FT.NUMBER, description: { text: '円' } },
      { field_name: 'サービス種別コード', type: FT.TEXT },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'USER',
    name: '利用者マスタ',
    fields: [
      { field_name: '表示名', type: FT.TEXT, description: { text: '氏名 (受給者証番号下4桁)' } },
      { field_name: '事業所ID', type: FT.TEXT },
      { field_name: '氏名', type: FT.TEXT },
      { field_name: '氏名カナ', type: FT.TEXT },
      { field_name: '受給者証番号', type: FT.TEXT, description: { text: '10桁' } },
      { field_name: '支給決定障害者番号', type: FT.TEXT },
      { field_name: '生年月日', type: FT.DATE_TIME },
      { field_name: '性別', type: FT.SINGLE_SELECT, property: { options: ['男性', '女性', 'その他'].map((name) => ({ name })) } },
      { field_name: '障害支援区分', type: FT.SINGLE_SELECT, property: { options: ['非該当', '1', '2', '3', '4', '5', '6'].map((name) => ({ name })) } },
      { field_name: '契約支給量', type: FT.NUMBER, description: { text: '日/月' } },
      { field_name: '利用開始日', type: FT.DATE_TIME },
      { field_name: '利用終了日', type: FT.DATE_TIME },
      { field_name: '自己負担上限月額', type: FT.NUMBER, description: { text: '円' } },
      { field_name: 'LINE User ID', type: FT.TEXT },
      { field_name: '有効', type: FT.CHECKBOX },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'STAFF',
    name: '職員マスタ',
    fields: [
      { field_name: '表示名', type: FT.TEXT, description: { text: '氏名 (役職)' } },
      { field_name: '事業所ID', type: FT.TEXT },
      { field_name: '氏名', type: FT.TEXT },
      { field_name: '氏名カナ', type: FT.TEXT },
      { field_name: '役職', type: FT.SINGLE_SELECT, property: { options: ['サービス管理責任者', '職業指導員', '生活支援員', '管理者', 'その他'].map((name) => ({ name })) } },
      { field_name: 'LINE User ID', type: FT.TEXT },
      { field_name: 'メールアドレス', type: FT.TEXT },
      { field_name: '有効', type: FT.CHECKBOX },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'SERVICE_CODE',
    name: 'サービスコードマスタ',
    fields: [
      { field_name: 'サービスコード', type: FT.TEXT, description: { text: '6桁' } },
      { field_name: '名称', type: FT.TEXT },
      { field_name: '単位数', type: FT.NUMBER },
      { field_name: 'サービス種類', type: FT.TEXT },
      { field_name: '有効開始日', type: FT.DATE_TIME },
      { field_name: '有効終了日', type: FT.DATE_TIME },
      { field_name: '加算フラグ', type: FT.CHECKBOX },
      { field_name: '適用条件', type: FT.TEXT },
    ],
  },
  {
    key: 'PRODUCT_ACTIVITY',
    name: '生産活動',
    fields: [
      { field_name: '活動名', type: FT.TEXT },
      { field_name: '説明', type: FT.TEXT },
      { field_name: '作業単価', type: FT.NUMBER, description: { text: '円/時間' } },
      { field_name: '有効', type: FT.CHECKBOX },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
];

const DETAIL_TABLES: TableDef[] = [
  {
    key: 'ATTENDANCE',
    name: '勤怠記録',
    fields: [
      { field_name: '勤怠キー', type: FT.TEXT, description: { text: 'YYYY-MM-DD_利用者表示名' } },
      { field_name: '日付', type: FT.DATE_TIME },
      { field_name: '出勤時刻', type: FT.TEXT, description: { text: 'HH:mm' } },
      { field_name: '退勤時刻', type: FT.TEXT, description: { text: 'HH:mm' } },
      { field_name: '実績時間', type: FT.NUMBER, description: { text: '分' } },
      { field_name: '休憩時間', type: FT.NUMBER, description: { text: '分' } },
      { field_name: '出席区分', type: FT.SINGLE_SELECT, property: { options: ['出席', '欠席', '欠席(連絡あり)', '祝日', '休暇'].map((name) => ({ name })) } },
      { field_name: '送迎', type: FT.SINGLE_SELECT, property: { options: ['なし', '迎えのみ', '送りのみ', '送迎'].map((name) => ({ name })) } },
      { field_name: '食事提供', type: FT.CHECKBOX },
      { field_name: '備考', type: FT.TEXT },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'HEALTH_CHECK',
    name: '体調チェック',
    fields: [
      { field_name: '体調キー', type: FT.TEXT, description: { text: 'YYYY-MM-DD_利用者表示名' } },
      { field_name: '日付', type: FT.DATE_TIME },
      { field_name: '体調スコア', type: FT.SINGLE_SELECT, property: { options: ['1 (とても悪い)', '2 (悪い)', '3 (普通)', '4 (良い)', '5 (とても良い)'].map((name) => ({ name })) } },
      { field_name: '睡眠時間', type: FT.NUMBER, description: { text: '時間' } },
      { field_name: '朝食', type: FT.CHECKBOX },
      { field_name: '昼食', type: FT.CHECKBOX },
      { field_name: '夕食', type: FT.CHECKBOX },
      { field_name: '気分', type: FT.SINGLE_SELECT, property: { options: ['良い', '普通', '憂鬱', '不安', 'イライラ'].map((name) => ({ name })) } },
      { field_name: '備考', type: FT.TEXT },
      { field_name: '作成日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'SUPPORT_RECORD',
    name: '支援記録',
    fields: [
      { field_name: '支援キー', type: FT.TEXT, description: { text: 'YYYY-MM-DD_利用者表示名' } },
      { field_name: '日付', type: FT.DATE_TIME },
      { field_name: '支援内容', type: FT.TEXT },
      { field_name: '支援区分', type: FT.SINGLE_SELECT, property: { options: ['日常生活支援', '職業指導', '相談支援', '健康管理', '社会生活支援'].map((name) => ({ name })) } },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'WAGE',
    name: '工賃計算',
    fields: [
      { field_name: '工賃キー', type: FT.TEXT, description: { text: 'YYYY-MM_利用者表示名' } },
      { field_name: '対象年月', type: FT.TEXT, description: { text: 'YYYY-MM' } },
      { field_name: '作業時間合計', type: FT.NUMBER, description: { text: '分' } },
      { field_name: '出勤日数', type: FT.NUMBER },
      { field_name: '基本工賃', type: FT.NUMBER, description: { text: '円' } },
      { field_name: '能力給', type: FT.NUMBER, description: { text: '円' } },
      { field_name: '皆勤手当', type: FT.NUMBER, description: { text: '円' } },
      { field_name: '合計工賃', type: FT.NUMBER, description: { text: '円' } },
      { field_name: '控除', type: FT.NUMBER, description: { text: '円' } },
      { field_name: '支給額', type: FT.NUMBER, description: { text: '円' } },
      { field_name: 'ステータス', type: FT.SINGLE_SELECT, property: { options: ['下書き', '確定', '支給済み'].map((name) => ({ name })) } },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'INVOICE',
    name: '請求',
    fields: [
      { field_name: '請求キー', type: FT.TEXT, description: { text: 'YYYY-MM_事業所名' } },
      { field_name: '対象年月', type: FT.TEXT, description: { text: 'YYYY-MM' } },
      { field_name: '請求先', type: FT.SINGLE_SELECT, property: { options: ['国保連'].map((name) => ({ name })) } },
      { field_name: '合計単位数', type: FT.NUMBER },
      { field_name: '合計金額', type: FT.NUMBER, description: { text: '円' } },
      { field_name: '利用者負担額合計', type: FT.NUMBER, description: { text: '円' } },
      { field_name: 'ステータス', type: FT.SINGLE_SELECT, property: { options: ['下書き', '計算済み', 'CSV生成済み', '提出済み', '受理', '返戻', '再提出'].map((name) => ({ name })) } },
      { field_name: 'CSV生成日時', type: FT.DATE_TIME },
      { field_name: '提出日', type: FT.DATE_TIME },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'PRODUCT_OUTPUT',
    name: '生産実績',
    fields: [
      { field_name: '実績キー', type: FT.TEXT, description: { text: 'YYYY-MM-DD_利用者表示名_活動名' } },
      { field_name: '日付', type: FT.DATE_TIME },
      { field_name: '作業時間', type: FT.NUMBER, description: { text: '分' } },
      { field_name: '生産数量', type: FT.NUMBER },
      { field_name: '備考', type: FT.TEXT },
      { field_name: '作成日時', type: FT.DATE_TIME },
    ],
  },
  {
    key: 'WORK_SCHEDULE',
    name: '勤務予定',
    fields: [
      { field_name: '予定キー', type: FT.TEXT, description: { text: 'YYYY-MM_利用者表示名' } },
      { field_name: '対象年月', type: FT.TEXT, description: { text: 'YYYY-MM' } },
      { field_name: '予定出勤日', type: FT.TEXT, description: { text: 'カンマ区切り: 1,2,5,8,...' } },
      { field_name: '開始時刻', type: FT.TEXT, description: { text: 'HH:mm' } },
      { field_name: '終了時刻', type: FT.TEXT, description: { text: 'HH:mm' } },
      { field_name: '作成日時', type: FT.DATE_TIME },
      { field_name: '更新日時', type: FT.DATE_TIME },
    ],
  },
];

const LINK_FIELDS: LinkFieldDef[] = [
  { tableKey: 'ATTENDANCE', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'ATTENDANCE', fieldName: '利用者', targetTableKey: 'USER' },
  { tableKey: 'HEALTH_CHECK', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'HEALTH_CHECK', fieldName: '利用者', targetTableKey: 'USER' },
  { tableKey: 'SUPPORT_RECORD', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'SUPPORT_RECORD', fieldName: '利用者', targetTableKey: 'USER' },
  { tableKey: 'SUPPORT_RECORD', fieldName: '担当職員', targetTableKey: 'STAFF' },
  { tableKey: 'WAGE', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'WAGE', fieldName: '利用者', targetTableKey: 'USER' },
  { tableKey: 'INVOICE', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'PRODUCT_ACTIVITY', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'PRODUCT_OUTPUT', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'PRODUCT_OUTPUT', fieldName: '利用者', targetTableKey: 'USER' },
  { tableKey: 'PRODUCT_OUTPUT', fieldName: '活動', targetTableKey: 'PRODUCT_ACTIVITY' },
  { tableKey: 'WORK_SCHEDULE', fieldName: '事業所', targetTableKey: 'FACILITY' },
  { tableKey: 'WORK_SCHEDULE', fieldName: '利用者', targetTableKey: 'USER' },
];

const FORMS: FormDef[] = [
  { tableKey: 'ATTENDANCE', formName: '勤怠入力フォーム', envKey: 'LARK_FORM_ATTENDANCE' },
  { tableKey: 'HEALTH_CHECK', formName: '体調チェックフォーム', envKey: 'LARK_FORM_HEALTH_CHECK' },
  { tableKey: 'SUPPORT_RECORD', formName: '支援記録フォーム', envKey: 'LARK_FORM_SUPPORT_RECORD' },
];

let tenantToken = '';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractData<T>(json: LarkResponse<T>, path: string): T {
  if (json.code !== 0) {
    throw new Error(`Lark API error [${path}]: code=${json.code} msg=${json.msg ?? ''}`);
  }
  if (json.data === undefined) {
    throw new Error(`Lark API error [${path}]: data is missing`);
  }
  return json.data;
}

async function larkFetch<T = unknown>(
  path: string,
  method: HttpMethod,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (tenantToken) {
    headers['Authorization'] = `Bearer ${tenantToken}`;
  }

  const res = await fetch(`${LARK_DOMAIN}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as LarkResponse<T>;
  return extractData(json, path);
}

async function authenticate(): Promise<void> {
  const url = `${LARK_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });

  const json = (await res.json()) as {
    code: number;
    msg?: string;
    tenant_access_token?: string;
    expire?: number;
  };
  if (json.code !== 0 || !json.tenant_access_token) {
    throw new Error(`Auth failed: code=${json.code} msg=${json.msg ?? ''}`);
  }
  tenantToken = json.tenant_access_token;
  console.log(`✅ 認証成功 (expires in ${json.expire ?? 0}s)`);
}

function setEnvVar(content: string, key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  return `${normalized}${line}\n`;
}

async function deleteExistingTables(): Promise<void> {
  const envTableIds = Object.entries(TABLE_ENV_KEYS)
    .map(([key, envKey]) => ({ key: key as TableKey, tableId: process.env[envKey] ?? '' }))
    .filter((x) => x.tableId);

  if (envTableIds.length === 0) {
    console.log('ℹ️ .env に既存テーブルIDが見つからないため削除をスキップします');
    return;
  }

  console.log(`\n🧹 既存テーブル削除 (${envTableIds.length}件)`);
  for (const item of envTableIds) {
    try {
      await sleep(300);
      await larkFetch(`/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${item.tableId}`, 'DELETE');
      console.log(`  ✓ ${item.key}: ${item.tableId}`);
    } catch (error) {
      console.warn(`  ⚠ ${item.key}: ${item.tableId} の削除に失敗 (${(error as Error).message})`);
    }
  }
}

async function createTable(tableDef: TableDef): Promise<string> {
  await sleep(300);
  const data = await larkFetch<{ table_id: string }>(
    `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables`,
    'POST',
    {
      table: {
        name: tableDef.name,
        default_view_name: `${tableDef.name}一覧`,
        fields: tableDef.fields,
      },
    },
  );
  return data.table_id;
}

async function addLinkField(tableId: string, fieldName: string, targetTableId: string): Promise<void> {
  await sleep(300);
  await larkFetch(
    `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/fields`,
    'POST',
    {
      field_name: fieldName,
      type: FT.LINK,
      property: { table_id: targetTableId },
    },
  );
}

async function createAndShareForm(tableId: string, formName: string): Promise<string> {
  await sleep(300);
  const viewData = await larkFetch<{ view: { view_id: string; view_name: string } }>(
    `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/views`,
    'POST',
    {
      view_name: formName,
      view_type: 'form',
    },
  );

  await sleep(300);
  const formData = await larkFetch<{ form: { shared_url?: string } }>(
    `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/forms/${viewData.view.view_id}`,
    'PATCH',
    {
      name: viewData.view.view_name,
      shared: true,
    },
  );

  return formData.form.shared_url ?? '';
}

async function grantAdminPermission(): Promise<void> {
  await sleep(300);
  await larkFetch(
    `/open-apis/drive/v1/permissions/${APP_TOKEN}/members?type=bitable`,
    'POST',
    {
      member_type: 'email',
      member_id: ADMIN_EMAIL,
      perm: 'full_access',
    },
  );
}

async function updateEnv(tableMap: Record<TableKey, string>, formUrls: Record<FormDef['envKey'], string>): Promise<void> {
  let content = await readFile(ENV_PATH, 'utf-8');
  content = setEnvVar(content, 'LARK_BASE_APP_TOKEN', APP_TOKEN);

  for (const [key, envKey] of Object.entries(TABLE_ENV_KEYS)) {
    const tableId = tableMap[key as TableKey];
    if (tableId) {
      content = setEnvVar(content, envKey, tableId);
    }
  }

  for (const form of FORMS) {
    const url = formUrls[form.envKey] ?? '';
    content = setEnvVar(content, form.envKey, url);
  }

  await writeFile(ENV_PATH, content, 'utf-8');
}

async function main(): Promise<void> {
  console.log('\n🏗️  Knowbe2 Lark Base 再プロビジョニング\n');

  await authenticate();
  await deleteExistingTables();

  const tableMap = {} as Record<TableKey, string>;

  console.log('\n📚 マスタテーブル作成');
  for (const tableDef of MASTER_TABLES) {
    const tableId = await createTable(tableDef);
    tableMap[tableDef.key] = tableId;
    console.log(`  ✓ ${tableDef.name}: ${tableId}`);
  }

  console.log('\n🧾 明細テーブル作成');
  for (const tableDef of DETAIL_TABLES) {
    const tableId = await createTable(tableDef);
    tableMap[tableDef.key] = tableId;
    console.log(`  ✓ ${tableDef.name}: ${tableId}`);
  }

  console.log('\n🔗 Linkフィールド追加');
  for (const link of LINK_FIELDS) {
    const tableId = tableMap[link.tableKey];
    const targetTableId = tableMap[link.targetTableKey];
    if (!tableId || !targetTableId) {
      throw new Error(`table_id not found: ${link.tableKey} -> ${link.targetTableKey}`);
    }
    await addLinkField(tableId, link.fieldName, targetTableId);
    console.log(`  ✓ ${link.tableKey}.${link.fieldName} -> ${link.targetTableKey}`);
  }

  const formUrls = {} as Record<FormDef['envKey'], string>;
  console.log('\n📝 フォーム作成・共有有効化');
  for (const form of FORMS) {
    const tableId = tableMap[form.tableKey];
    if (!tableId) {
      throw new Error(`table_id not found for form: ${form.tableKey}`);
    }
    const sharedUrl = await createAndShareForm(tableId, form.formName);
    formUrls[form.envKey] = sharedUrl;
    console.log(`  ✓ ${form.formName}: ${sharedUrl || '(shared_url未取得)'}`);
  }

  console.log('\n👤 管理者権限付与');
  try {
    await grantAdminPermission();
    console.log(`  ✓ ${ADMIN_EMAIL} に full_access を付与`);
  } catch (error) {
    console.warn(`  ⚠ 権限付与失敗: ${(error as Error).message}`);
  }

  await updateEnv(tableMap, formUrls);

  console.log('\n✅ 完了: .env を更新しました');
  console.log('\nテーブルID:');
  for (const [key, tableId] of Object.entries(tableMap)) {
    console.log(`  ${key}: ${tableId}`);
  }
  console.log('\nフォームURL:');
  for (const form of FORMS) {
    console.log(`  ${form.envKey}: ${formUrls[form.envKey] ?? ''}`);
  }
}

main().catch((error) => {
  console.error('❌ Fatal:', error);
  process.exit(1);
});
