/**
 * Lark OAuth2 tenant_access_token 管理
 * トークンの自動リフレッシュ対応
 */

import type { LarkAuthConfig, LarkTenantAccessToken } from '../types/lark.js';

const TOKEN_URL = 'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5分前にリフレッシュ

export class LarkAuth {
  private token: LarkTenantAccessToken | null = null;

  constructor(private readonly config: LarkAuthConfig) {}

  /** tenant_access_token を取得 (期限切れなら自動リフレッシュ) */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - REFRESH_MARGIN_MS) {
      return this.token.token;
    }
    await this.refresh();
    if (!this.token) {
      throw new Error('Lark auth token refresh did not return a token');
    }
    return this.token.token;
  }

  /** トークンをリフレッシュ */
  private async refresh(): Promise<void> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Lark auth failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as {
      code?: number;
      msg?: string;
      tenant_access_token?: string;
      expire?: number;
    };

    if (data.code !== 0) {
      throw new Error(`Lark auth error: ${data.code} ${data.msg}`);
    }

    if (
      typeof data.tenant_access_token !== 'string' ||
      data.tenant_access_token === '' ||
      typeof data.expire !== 'number' ||
      !Number.isFinite(data.expire) ||
      data.expire <= 0
    ) {
      throw new Error('Lark auth payload is invalid');
    }

    this.token = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + data.expire * 1000,
    };
  }

  /** テスト用: トークンを直接設定 */
  setTokenForTest(token: string, expiresAt: number): void {
    this.token = { token, expiresAt };
  }
}
