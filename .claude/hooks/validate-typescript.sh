#!/bin/bash
# validate-typescript.sh - TypeScript バリデーション (pre-commit)
#
# ステージされた .ts/.tsx ファイルに対して tsc --noEmit を実行
# エラーがあればコミットをブロック

set -e

# ステージされたTypeScriptファイルを取得
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -z "$STAGED_TS" ]; then
  exit 0
fi

echo "🔍 TypeScript validation on staged files..."

# tsc --noEmit で型チェック
if npx tsc --noEmit 2>&1; then
  echo "✅ TypeScript validation passed"
else
  echo "❌ TypeScript errors found. Fix them before committing."
  exit 1
fi
