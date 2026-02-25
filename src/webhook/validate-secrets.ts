/**
 * Webhook シークレット検証ユーティリティ
 *
 * セキュリティ: 空のシークレットではHMAC署名/トークン検証が実質無効化されるため、
 * 本番環境ではWebhook認証に必要な全シークレットを必須とし、未設定時は即座に終了する。
 */

export interface WebhookSecretsInput {
  lineChannelSecret: string;
  larkVerificationToken: string;
  larkAppId: string;
  larkAppSecret: string;
  larkBaseAppToken: string;
  isProduction: boolean;
}

export interface WebhookSecretsResult {
  missing: string[];
  warnings: string[];
}

/**
 * 必須のWebhookシークレットを検証する。
 * 本番環境では未設定の変数名を `missing` 配列に格納する。
 * 開発環境では `warnings` 配列に警告メッセージを格納する。
 *
 * @returns missing が空でなければ呼び出し側で process.exit(1) すべき
 */
export function validateWebhookSecrets(env: WebhookSecretsInput): WebhookSecretsResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Webhook認証シークレット: 空キーで署名生成/トークン照合ができてしまう
  if (!env.lineChannelSecret) {
    if (env.isProduction) {
      missing.push('LINE_CHANNEL_SECRET');
    } else {
      warnings.push('LINE_CHANNEL_SECRET が未設定です。LINE Webhookの署名検証が機能しません。');
    }
  }

  if (!env.larkVerificationToken) {
    if (env.isProduction) {
      missing.push('LARK_VERIFICATION_TOKEN');
    } else {
      warnings.push('LARK_VERIFICATION_TOKEN が未設定です。Lark Webhookのトークン検証が機能しません。');
    }
  }

  // Lark Base 接続情報: データ操作に必須
  if (!env.larkAppId) {
    if (env.isProduction) missing.push('LARK_APP_ID');
    else warnings.push('LARK_APP_ID が未設定です。');
  }
  if (!env.larkAppSecret) {
    if (env.isProduction) missing.push('LARK_APP_SECRET');
    else warnings.push('LARK_APP_SECRET が未設定です。');
  }
  if (!env.larkBaseAppToken) {
    if (env.isProduction) missing.push('LARK_BASE_APP_TOKEN');
    else warnings.push('LARK_BASE_APP_TOKEN が未設定です。');
  }

  return { missing, warnings };
}
