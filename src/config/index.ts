/**
 * 環境変数設定マネージャー
 * 起動時にバリデーションし、型安全な設定オブジェクトを提供
 */

export interface AppConfig {
  /** LINE Messaging API */
  line: {
    channelAccessToken: string;
    channelSecret: string;
    liffId: string;
  };
  /** Lark (Feishu) */
  lark: {
    appId: string;
    appSecret: string;
    baseAppToken: string;
    verificationToken: string;
  };
  /** サーバー設定 */
  server: {
    port: number;
    nodeEnv: 'development' | 'production' | 'test';
  };
  /** GitHub (Miyabi基盤) */
  github: {
    token: string;
    repository: string;
  };
}

class ConfigError extends Error {
  constructor(public readonly missingVars: string[]) {
    super(`Missing required environment variables: ${missingVars.join(', ')}`);
    this.name = 'ConfigError';
  }
}

let cachedConfig: AppConfig | null = null;

function parseNodeEnv(value: string | undefined): AppConfig['server']['nodeEnv'] {
  if (value === 'development' || value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

/**
 * 設定を読み込む。required=false の場合は空文字を許容 (テスト環境用)
 */
export function loadConfig(options?: { required?: boolean }): AppConfig {
  if (cachedConfig) return cachedConfig;

  const req = options?.required ?? (process.env['NODE_ENV'] === 'production');

  const missing: string[] = [];

  function getEnv(key: string): string {
    const value = process.env[key];
    if (!value && req) {
      missing.push(key);
      return '';
    }
    return value ?? '';
  }

  const config: AppConfig = {
    line: {
      channelAccessToken: getEnv('LINE_CHANNEL_ACCESS_TOKEN'),
      channelSecret: getEnv('LINE_CHANNEL_SECRET'),
      liffId: getEnv('LINE_LIFF_ID'),
    },
    lark: {
      appId: getEnv('LARK_APP_ID'),
      appSecret: getEnv('LARK_APP_SECRET'),
      baseAppToken: getEnv('LARK_BASE_APP_TOKEN'),
      verificationToken: getEnv('LARK_VERIFICATION_TOKEN'),
    },
    server: {
      port: parseInt(process.env['PORT'] ?? '3000', 10),
      nodeEnv: parseNodeEnv(process.env['NODE_ENV']),
    },
    github: {
      token: getEnv('GITHUB_TOKEN'),
      repository: process.env['REPOSITORY'] ?? 'PLark-droid/Knowbe2',
    },
  };

  if (missing.length > 0) {
    throw new ConfigError(missing);
  }

  cachedConfig = config;
  return config;
}

/** テスト用: キャッシュをリセット */
export function resetConfig(): void {
  cachedConfig = null;
}

export { ConfigError };
