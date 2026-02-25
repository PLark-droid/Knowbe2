/**
 * マルチテナント (事業所) コンテキスト管理
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  facilityId: string;
  facilityNumber?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** テナントコンテキスト内でコールバックを実行 */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

/** 現在のテナントコンテキストを取得 */
export function getCurrentTenant(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** 現在のテナントコンテキストを取得 (必須版 — 無ければ例外) */
export function requireTenant(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error('Tenant context is not set. Wrap the operation with runWithTenant().');
  }
  return ctx;
}
