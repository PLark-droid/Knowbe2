/**
 * LinkResolver - Lark Base Link フィールド用 "業務ID <-> record_id" 変換層
 *
 * Lark Base の Link 型フィールドに書き込むには record_id が必要だが、
 * ドメイン層は業務ID (事業所ID, 利用者ID 等) で操作する。
 * このモジュールはその変換を担う。
 *
 * 解決方法:
 *   - 事業所: 事業所テーブルの '事業所ID' テキストフィールドで検索し record_id を取得
 *   - 利用者: 利用者テーブルの同様のテキストフィールドで検索
 *   - 担当職員: 職員テーブルで検索
 *
 * キャッシュにより同一セッション内の重複APIコールを抑制する。
 */

import type { BitableClient } from './client.js';
import { sanitizeLarkFilterValue } from './sanitize.js';

/** Link 解決対象のテーブル種別 */
export type LinkTargetType = 'facility' | 'user' | 'staff' | 'activity';

/** テーブル種別ごとの設定 */
interface LinkTargetConfig {
  tableId: string;
  /** 業務IDが格納されるテキスト型フィールド名 */
  businessIdField: string;
}

export interface LinkResolverConfig {
  client: BitableClient;
  targets: Partial<Record<LinkTargetType, LinkTargetConfig>>;
}

/**
 * 業務ID -> record_id のキャッシュ付き解決器
 */
export class LinkResolver {
  private readonly client: BitableClient;
  private readonly targets: Partial<Record<LinkTargetType, LinkTargetConfig>>;
  /** target:businessId -> record_id */
  private readonly cache = new Map<string, string>();

  constructor(config: LinkResolverConfig) {
    this.client = config.client;
    this.targets = config.targets;
  }

  /**
   * 業務IDから Lark record_id を解決する。
   * 見つからない場合は null を返す。
   */
  async resolve(type: LinkTargetType, businessId: string): Promise<string | null> {
    if (!businessId) return null;

    const cacheKey = `${type}:${businessId}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const target = this.targets[type];
    if (!target) return null;

    const records = await this.client.listAll(target.tableId, {
      filter: `CurrentValue.[${target.businessIdField}] = "${sanitizeLarkFilterValue(businessId)}"`,
    });

    const record = records[0];
    if (!record) return null;

    const recordId = record.record_id;
    this.cache.set(cacheKey, recordId);
    return recordId;
  }

  /**
   * 業務IDから Lark record_id を解決する。見つからない場合はエラー。
   */
  async resolveOrThrow(type: LinkTargetType, businessId: string): Promise<string> {
    const recordId = await this.resolve(type, businessId);
    if (recordId === null) {
      throw new Error(
        `LinkResolver: ${type} record not found for businessId="${businessId}"`,
      );
    }
    return recordId;
  }

  /**
   * キャッシュを手動でセットする (テスト用、または事前解決済みの場合)
   */
  setCache(type: LinkTargetType, businessId: string, recordId: string): void {
    this.cache.set(`${type}:${businessId}`, recordId);
  }

  /**
   * キャッシュをクリアする
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * LinkResolver なしで動作するダミー実装。
 * Link フィールドへの書き込みは行わず、テキスト型フィールドのみ使用。
 * テストや Link フィールド未使用環境で利用。
 */
export class NullLinkResolver extends LinkResolver {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super({ client: null as any, targets: {} });
  }

  override async resolve(_type: LinkTargetType, _businessId: string): Promise<string | null> {
    return null;
  }

  override async resolveOrThrow(_type: LinkTargetType, _businessId: string): Promise<string> {
    throw new Error('NullLinkResolver: Link resolution is not available');
  }
}
