# Miyabi Pipeline Guide

コマンドパイプラインによる複数コマンドの連結実行。

## パイプライン演算子

| 演算子 | 意味 | 説明 |
|--------|------|------|
| `\|` | Pipe (順次) | 前のコマンドの出力を次に渡す |
| `&&` | AND | 前のコマンドが成功した場合のみ次を実行 |
| `\|\|` | OR | 前のコマンドが失敗した場合のみ次を実行 |
| `&` | Parallel | 並列実行 |

## プリセットパイプライン

### full-cycle

Issue作成から本番デプロイまでの完全サイクル:

```
/create-issue | /agent-run | /review | /test | /deploy | /verify
```

### quick-deploy

検証してデプロイ:

```
/verify && /deploy
```

### quality-gate

品質ゲートチェック:

```
/review && /test && /security-scan
```

### auto-fix

自動修正ループ:

```
/review --auto-fix | /test
```

## 使用方法

```bash
# パイプライン実行
npm run pipeline -- "/agent-run | /review | /deploy"

# プリセット実行
npm run pipeline -- --preset full-cycle --issue 123

# ドライラン
npm run pipeline -- --preset quality-gate --dry-run

# プリセット一覧
npm run pipeline -- --list-presets
```

## コンテキスト受け渡し

各コマンドの出力は次のコマンドにコンテキストとして渡されます:

```
/create-issue → { issueNumber: 123 }
    ↓
/agent-run → { prNumber: 45, branch: "feat/xxx" }
    ↓
/review → { score: 92, passed: true }
    ↓
/deploy → { url: "https://...", status: "healthy" }
```

## チェックポイント & リジューム

パイプラインの途中で失敗した場合、チェックポイントから再開可能:

```bash
# 失敗時に保存されたチェックポイントから再開
npm run pipeline -- --resume .ai/logs/pipeline-checkpoint-xxx.json
```

## リトライポリシー

- 最大リトライ: 3回
- バックオフ: 指数バックオフ (1s, 2s, 4s)
- リトライ対象: ネットワークエラー、タイムアウト
- リトライ対象外: バリデーションエラー、権限エラー
