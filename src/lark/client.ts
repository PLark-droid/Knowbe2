/**
 * Lark Bitable 汎用CRUDクライアント
 * ページネーション、レート制限リトライ対応
 */

import pRetry, { AbortError } from 'p-retry';
import type {
  LarkBitableRecord,
  LarkBitableListResponse,
  LarkFilterOptions,
  LarkPaginationOptions,
} from '../types/lark.js';
import type { LarkAuth } from './auth.js';

const BASE_URL = 'https://open.larksuite.com/open-apis/bitable/v1';
const DEFAULT_PAGE_SIZE = 100;
const MAX_RETRIES = 3;

/** Lark API 共通レスポンスエンベロープ */
interface LarkApiResponse<D = unknown> {
  code: number;
  msg: string;
  data: D;
}

/** リトライ可能な Bitable エラーコード (一時的ロック・競合) */
const RETRYABLE_BITABLE_CODES = new Set([
  1254007, // record locked
  1254008, // table locked
  1254043, // too many concurrent writes
]);

/** レスポンスの code からリトライ可否を判定する */
function isRetryableApiError(code: number): boolean {
  // Bitable 範囲内でリトライ対象のコード
  if (RETRYABLE_BITABLE_CODES.has(code)) {
    return true;
  }
  // サーバー内部エラー系 (99991xxx) はリトライ可
  if (code >= 99991000 && code < 99992000) {
    return true;
  }
  return false;
}

export interface BitableClientConfig {
  auth: LarkAuth;
  appToken: string;
}

export class BitableClient {
  constructor(private readonly config: BitableClientConfig) {}

  /** レコード一覧取得 (全ページ自動取得) */
  async listAll<T = Record<string, unknown>>(
    tableId: string,
    options?: LarkFilterOptions,
  ): Promise<LarkBitableRecord<T>[]> {
    const allRecords: LarkBitableRecord<T>[] = [];
    let pageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await this.list<T>(tableId, {
        pageSize: DEFAULT_PAGE_SIZE,
        pageToken,
        ...options,
      });
      allRecords.push(...page.items);
      hasMore = page.has_more;
      pageToken = page.page_token;
    }

    return allRecords;
  }

  /** レコード一覧取得 (1ページ) */
  async list<T = Record<string, unknown>>(
    tableId: string,
    options?: LarkPaginationOptions & LarkFilterOptions,
  ): Promise<LarkBitableListResponse<T>> {
    const params = new URLSearchParams();
    if (options?.pageSize) params.set('page_size', String(options.pageSize));
    if (options?.pageToken) params.set('page_token', options.pageToken);
    if (options?.filter) params.set('filter', options.filter);

    const url = `${BASE_URL}/apps/${this.config.appToken}/tables/${tableId}/records?${params}`;
    const data = await this.request<{
      data: { items: LarkBitableRecord<T>[]; has_more: boolean; page_token?: string; total: number };
    }>('GET', url);

    return data.data;
  }

  /** 単一レコード取得 */
  async get<T = Record<string, unknown>>(
    tableId: string,
    recordId: string,
  ): Promise<LarkBitableRecord<T>> {
    const url = `${BASE_URL}/apps/${this.config.appToken}/tables/${tableId}/records/${recordId}`;
    const data = await this.request<{ data: { record: LarkBitableRecord<T> } }>('GET', url);
    return data.data.record;
  }

  /** レコード作成 */
  async create<T = Record<string, unknown>>(
    tableId: string,
    fields: Record<string, unknown>,
  ): Promise<LarkBitableRecord<T>> {
    const url = `${BASE_URL}/apps/${this.config.appToken}/tables/${tableId}/records`;
    const data = await this.request<{ data: { record: LarkBitableRecord<T> } }>('POST', url, {
      fields,
    });
    return data.data.record;
  }

  /** レコード更新 */
  async update<T = Record<string, unknown>>(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<LarkBitableRecord<T>> {
    const url = `${BASE_URL}/apps/${this.config.appToken}/tables/${tableId}/records/${recordId}`;
    const data = await this.request<{ data: { record: LarkBitableRecord<T> } }>('PUT', url, {
      fields,
    });
    return data.data.record;
  }

  /** レコード削除 */
  async delete(tableId: string, recordId: string): Promise<void> {
    const url = `${BASE_URL}/apps/${this.config.appToken}/tables/${tableId}/records/${recordId}`;
    await this.request('DELETE', url);
  }

  /** HTTP リクエスト (レート制限リトライ付き) */
  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const path = url.replace(BASE_URL, '');

    return pRetry(
      async () => {
        const token = await this.config.auth.getToken();
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        // レート制限 → リトライ
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('x-ogw-ratelimit-reset') ?? '1', 10);
          await sleep(retryAfter * 1000);
          throw new Error('Rate limited');
        }

        if (!res.ok) {
          throw new AbortError(`Lark API error: ${res.status} ${res.statusText}`);
        }

        const json = (await res.json()) as LarkApiResponse;

        // Lark は HTTP 200 でも code != 0 でエラーを返す
        if (json.code !== 0) {
          const message = `Lark API error [${path}]: code=${json.code} msg=${json.msg}`;

          if (isRetryableApiError(json.code)) {
            // リトライ可能なエラー → 通常の Error で p-retry がリトライする
            throw new Error(message);
          }

          // リトライ不可 → AbortError で即座に失敗させる
          throw new AbortError(message);
        }

        return json as unknown as T;
      },
      { retries: MAX_RETRIES },
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
