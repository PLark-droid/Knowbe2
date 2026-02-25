/**
 * Lark Base Link フィールドヘルパー
 *
 * Link 型フィールドの読み書きに使う共通ユーティリティ。
 * 各リポジトリで重複していた getLinkId / toLinkValue を一元化。
 */

/**
 * Link 型フィールドの値から record_id を取り出す。
 * Lark Base の Link フィールドは配列形式 (例: ["recXXX"]) で返る。
 */
export function getLinkRecordId(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return first != null ? String(first) : '';
  }
  return value != null ? String(value) : '';
}

/**
 * record_id を Link 型フィールドの書き込み形式 (配列) に変換する。
 * id が空/undefined の場合は undefined を返し、フィールドを書き込まない。
 */
export function toLinkValue(recordId: string | undefined | null): string[] | undefined {
  if (!recordId) return undefined;
  return [recordId];
}
