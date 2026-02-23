# Agent Communication Protocol - エージェント間通信プロトコル

## メッセージバス

イベント駆動型のメッセージルーティングシステム。

```typescript
interface AgentMessage {
  id: string;                    // UUID
  correlationId?: string;        // リクエスト-レスポンス追跡用
  from: AgentType;               // 送信元
  to: AgentType | 'broadcast';   // 送信先
  type: MessageType;
  priority: Priority;
  payload: unknown;
  ttl?: number;                  // Time-to-Live (ms)
  timestamp: string;             // ISO 8601
}
```

## メッセージタイプ

| タイプ | 説明 | 方向 |
|--------|------|------|
| `TASK_ASSIGNMENT` | タスク割り当て | Coordinator → Agent |
| `STATUS_UPDATE` | 進捗更新 | Agent → Coordinator |
| `RESULT_REPORT` | 結果報告 | Agent → Coordinator |
| `ERROR_REPORT` | エラー報告 | Agent → Coordinator |
| `ESCALATION` | エスカレーション | Agent → Human |
| `HEARTBEAT` | 生存確認 | Agent ↔ Coordinator |
| `CAPABILITY_QUERY` | 能力照会 | Coordinator → Agent |
| `CAPABILITY_RESPONSE` | 能力応答 | Agent → Coordinator |

## 優先度レベル

| レベル | 値 | 用途 |
|--------|---|------|
| CRITICAL | 0 | セキュリティ問題、本番障害 |
| HIGH | 1 | ブロッキングタスク |
| MEDIUM | 2 | 通常タスク |
| LOW | 3 | バックグラウンド処理 |

## 通信パターン

### 1. Request-Response

```
Coordinator --[TASK_ASSIGNMENT]--> CodeGenAgent
CodeGenAgent --[RESULT_REPORT]---> Coordinator
```

### 2. Event Broadcasting

```
DeploymentAgent --[STATUS_UPDATE(broadcast)]--> All Agents
```

### 3. Escalation Chain

```
CodeGenAgent --[ERROR_REPORT]--> Coordinator --[ESCALATION]--> Human
```

## メッセージフロー例

### Issue処理

```
1. IssueAgent    → Coordinator:  RESULT_REPORT (分析完了, labels付与)
2. Coordinator   → CodeGenAgent: TASK_ASSIGNMENT (実装タスク)
3. CodeGenAgent  → Coordinator:  STATUS_UPDATE (実装中)
4. CodeGenAgent  → Coordinator:  RESULT_REPORT (実装完了)
5. Coordinator   → ReviewAgent:  TASK_ASSIGNMENT (レビュー)
6. ReviewAgent   → Coordinator:  RESULT_REPORT (スコア: 85)
7. Coordinator   → TestAgent:    TASK_ASSIGNMENT (テスト実行)
8. TestAgent     → Coordinator:  RESULT_REPORT (全テストパス)
9. Coordinator   → PRAgent:      TASK_ASSIGNMENT (PR作成)
10. PRAgent      → Coordinator:  RESULT_REPORT (PR #45 作成)
```

## TTL (Time-to-Live)

| メッセージタイプ | デフォルトTTL |
|----------------|-------------|
| TASK_ASSIGNMENT | 5分 |
| STATUS_UPDATE | 1分 |
| HEARTBEAT | 30秒 |
| ESCALATION | 制限なし |
