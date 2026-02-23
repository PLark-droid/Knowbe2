#!/bin/bash
# session-continue.sh - tmux セッション自動継続
#
# Water Spider Agent用: アイドル状態のtmuxペインを検出し
# "continue" シグナルを送信して処理を継続させる

set -e

SESSION_NAME="${1:-miyabi}"
CHECK_INTERVAL="${2:-30}"

# tmuxセッションが存在するか確認
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "⚠️ tmux session '$SESSION_NAME' not found"
  exit 0
fi

# 全ペインを確認
PANES=$(tmux list-panes -t "$SESSION_NAME" -F '#{pane_id}:#{pane_current_command}' 2>/dev/null || true)

if [ -z "$PANES" ]; then
  exit 0
fi

CONTINUED=0

for PANE_INFO in $PANES; do
  PANE_ID=$(echo "$PANE_INFO" | cut -d: -f1)
  PANE_CMD=$(echo "$PANE_INFO" | cut -d: -f2)

  # アイドル状態 (シェルプロンプトが表示されている) を検出
  if [ "$PANE_CMD" = "zsh" ] || [ "$PANE_CMD" = "bash" ]; then
    # ペインの最終行を確認
    LAST_LINE=$(tmux capture-pane -t "$PANE_ID" -p | tail -1 | tr -d '[:space:]')

    # プロンプトまたは空行なら "continue" を送信
    if [ -z "$LAST_LINE" ] || echo "$LAST_LINE" | grep -qE '[\$#>%]$'; then
      echo "🔄 Sending continue to pane $PANE_ID"
      tmux send-keys -t "$PANE_ID" "continue" Enter
      CONTINUED=$((CONTINUED + 1))
    fi
  fi
done

if [ "$CONTINUED" -gt 0 ]; then
  echo "✅ Continued $CONTINUED pane(s)"
else
  echo "💤 All panes busy or no idle detected"
fi
