/**
 * Escape user-provided values for use in Lark Bitable filter string literals.
 */
export function sanitizeLarkFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
