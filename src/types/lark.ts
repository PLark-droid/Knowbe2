/**
 * Lark Bitable 統合型定義
 */

export interface LarkAuthConfig {
  appId: string;
  appSecret: string;
}

export interface LarkTenantAccessToken {
  token: string;
  expiresAt: number;
}

export interface LarkBaseConfig {
  appToken: string;
  tableIds: LarkTableIds;
}

/** テーブルID一覧 */
export interface LarkTableIds {
  facility: string;
  user: string;
  staff: string;
  attendance: string;
  healthCheck: string;
  supportRecord: string;
  wageCalculation: string;
  invoice: string;
  serviceCode: string;
  productActivity: string;
  productOutput: string;
  workSchedule: string;
}

export interface LarkBitableRecord<T = Record<string, unknown>> {
  record_id: string;
  fields: T;
}

export interface LarkBitableListResponse<T = Record<string, unknown>> {
  items: LarkBitableRecord<T>[];
  has_more: boolean;
  page_token?: string;
  total: number;
}

export interface LarkBitableCreateResponse {
  record: LarkBitableRecord;
}

export interface LarkBitableUpdateResponse {
  record: LarkBitableRecord;
}

export interface LarkFieldMapping {
  /** Lark Bitable field name → entity property name */
  [fieldName: string]: string;
}

export interface LarkPaginationOptions {
  pageSize?: number;
  pageToken?: string;
}

export interface LarkFilterOptions {
  filter?: string;
  sort?: LarkSortOption[];
}

export interface LarkSortOption {
  field_name: string;
  desc?: boolean;
}

export interface LarkWebhookEvent {
  schema?: string;
  header?: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: Record<string, unknown>;
}

export interface LarkWebhookChallenge {
  challenge: string;
  token: string;
  type: 'url_verification';
}

/**
 * Lark Webhook受信ボディの判別用ユニオン型
 * url_verification (challenge) の場合は event プロパティが存在しない
 */
export type LarkWebhookBody = LarkWebhookEvent | LarkWebhookChallenge;

/** Lark API rate limit info */
export interface LarkRateLimitInfo {
  remaining: number;
  resetAt: number;
}
