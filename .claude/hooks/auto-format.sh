#!/bin/bash
# auto-format.sh - ESLint/Prettier 自動フォーマット (pre-commit)
#
# ステージされたファイルに対して ESLint --fix を実行し再ステージ

set -e

# ステージされたJS/TSファイルを取得
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

echo "🎨 Auto-formatting staged files..."

for FILE in $STAGED_FILES; do
  if [ -f "$FILE" ]; then
    # ESLint --fix (エラーは無視してフォーマットのみ適用)
    npx eslint --fix "$FILE" 2>/dev/null || true
    # 再ステージ
    git add "$FILE"
  fi
done

echo "✅ Auto-format complete"
