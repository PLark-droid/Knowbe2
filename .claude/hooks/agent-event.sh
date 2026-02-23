#!/bin/bash
# agent-event.sh - Agent ライフサイクルイベント送信
#
# Usage: agent-event.sh <event_type> <agent_name> [data_json]
#
# Events: started, progress, completed, error
# ダッシュボードへの通知 + ローカルログ記録

set -e

EVENT_TYPE="${1:-unknown}"
AGENT_NAME="${2:-unknown}"
DATA_JSON="${3:-{}}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ログディレクトリ
LOG_DIR=".ai/logs/events"
mkdir -p "$LOG_DIR"

# イベントJSON構築
EVENT_JSON=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "event": "$EVENT_TYPE",
  "agent": "$AGENT_NAME",
  "project": "knowbe2",
  "data": $DATA_JSON
}
EOF
)

# ローカルログ記録
echo "$EVENT_JSON" >> "$LOG_DIR/$(date +%Y-%m-%d)-events.jsonl"

# Webhook送信 (設定されている場合)
WEBHOOK_URL="${MIYABI_WEBHOOK_URL:-}"
if [ -n "$WEBHOOK_URL" ]; then
  # webhook-fallback.js 経由で送信 (タイムアウト5秒)
  if [ -f ".claude/hooks/webhook-fallback.js" ]; then
    echo "$EVENT_JSON" | node .claude/hooks/webhook-fallback.js 2>/dev/null || true
  else
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "$EVENT_JSON" \
      --max-time 5 2>/dev/null || true
  fi
fi

# コンソール出力
case "$EVENT_TYPE" in
  started)   echo "🚀 [$AGENT_NAME] Started" ;;
  progress)  echo "⏳ [$AGENT_NAME] In progress" ;;
  completed) echo "✅ [$AGENT_NAME] Completed" ;;
  error)     echo "❌ [$AGENT_NAME] Error" ;;
  *)         echo "📡 [$AGENT_NAME] $EVENT_TYPE" ;;
esac
