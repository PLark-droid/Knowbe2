# Knowbe2 - Claude Code Context (Miyabi v0.20.0)

## プロジェクト概要

**Knowbe2** - Miyabi Framework v0.20.0 で構築された自律型開発プラットフォーム

識学理論(Shikigaku Theory) + AI Agents + Pipeline Execution による完全自律開発環境。

## 🌸 Miyabi Framework v0.20.0

### 7つの Coding Agents

| # | Agent | キャラ名 | 役割 | カラー |
|---|-------|---------|------|--------|
| 1 | CoordinatorAgent | しきろーん | タスク統括・DAG分解 | 🔴 Leader |
| 2 | CodeGenAgent | つくろーん | AI コード生成 | 🟢 Executor |
| 3 | ReviewAgent | めだまん | 品質スコアリング (80点合格) | 🔵 Analyst |
| 4 | IssueAgent | みつけろーん | Issue分析・72ラベル体系 | 🔵 Analyst |
| 5 | PRAgent | まとめろーん | PR自動作成 (Conventional Commits) | 🟢 Executor |
| 6 | DeploymentAgent | はこぼーん | CI/CDデプロイ・自動Rollback | 🟢 Executor |
| 7 | TestAgent | つなぐん | テスト実行・カバレッジ80%+ | 🟢 Executor |

### GitHub as OS

```
Issue作成 → IssueAgent(ラベル分類)
  → CoordinatorAgent(DAG分解)
    → CodeGenAgent(実装) + TestAgent(テスト)
      → ReviewAgent(品質80点+)
        → PRAgent(Draft PR)
          → DeploymentAgent(自動デプロイ)
```

## 開発ガイドライン

### TypeScript (strict mode)

```json
{
  "strict": true,
  "module": "ESNext",
  "target": "ES2022",
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### テスト

```bash
npm test                    # 全テスト実行
npm run test:watch          # Watch mode
npm run test:coverage       # カバレッジレポート (閾値: 80%)
```

### Pipeline

```bash
npm run pipeline -- "/agent-run | /review | /deploy"
npm run pipeline -- --preset full-cycle --issue 123
npm run pipeline -- --preset quality-gate --dry-run
```

## スラッシュコマンド (14)

| コマンド | 説明 |
|---------|------|
| `/test` | テスト実行 |
| `/review` | Interactive Review Loop (6項目, 反復最大10回) |
| `/create-issue` | Issue対話作成 |
| `/agent-run` | Agent自動処理パイプライン |
| `/deploy` | デプロイ実行 |
| `/verify` | 環境・コンパイル・テスト全チェック |
| `/generate-docs` | ドキュメント自動生成 |
| `/security-scan` | セキュリティスキャン |
| `/miyabi-status` | ステータス確認 |
| `/miyabi-auto` | Water Spider全自動モード |
| `/miyabi-agent` | Agent手動実行 |
| `/miyabi-todos` | TODO検出 → Issue化 |
| `/miyabi-init` | 新規プロジェクト作成 |
| `/PIPELINE_GUIDE` | パイプラインガイド |

## Hooks (6)

| Hook | ファイル | 用途 |
|------|---------|------|
| UserPromptSubmit | log-commands.sh | LDDログ記録 |
| PreToolUse | validate-typescript.sh | TypeScript検証 |
| PostToolUse | auto-format.sh | ESLint自動フォーマット |
| Agent Event | agent-event.sh | ダッシュボード通知 |
| Session | session-continue.sh | tmux自動継続 |
| Webhook | webhook-fallback.js | キュー付きWebhook送信 |

## ラベル体系 (72ラベル, 識学理論準拠)

10カテゴリー:
- **type:** bug, feature, refactor, docs, test, chore, security
- **priority:** P0-Critical, P1-High, P2-Medium, P3-Low
- **state:** pending, analyzing, implementing, reviewing, testing, deploying, done, blocked, paused
- **agent:** codegen, review, deployment, test, coordinator, issue, pr
- **complexity:** small, medium, large, xlarge
- **phase:** planning, design, development, review, deployment
- **impact:** breaking, major, minor, patch
- **category:** frontend, backend, infra, dx, security
- **effort:** 1h, 4h, 1d, 3d, 1w, 2w
- **blocked:** waiting-review, waiting-deployment, waiting-feedback

## プロジェクト構造

```
Knowbe2/
├── .claude/
│   ├── agents/          # 7 Agent定義 + Characters + Protocol + Metrics
│   ├── commands/        # 14 コマンド + Pipeline Guide
│   ├── hooks/           # 6 hooks (logging, validation, formatting, events)
│   ├── skills/          # 11 skills (git, github, system, etc.)
│   ├── mcp-servers/     # 4 MCP servers
│   ├── mcp.json         # MCP設定
│   └── settings.json    # Claude Code設定
├── .github/workflows/   # 14 GitHub Actions
├── src/
│   ├── agents/          # Agent実装 (BaseAgent)
│   ├── types/           # 型定義
│   └── utils/           # DAG, Logger
├── tests/               # Vitest テスト
├── dist/                # ビルド出力
├── package.json         # v0.20.0
├── tsconfig.json        # strict mode
├── vitest.config.ts     # coverage 80% threshold
└── CLAUDE.md            # このファイル
```

## セキュリティ

- 機密情報は環境変数で管理: `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`
- `.env` は `.gitignore` に含まれている
- Webhook検証: HMAC-SHA256署名

## 環境変数

```bash
GITHUB_TOKEN=ghp_xxxxx         # GitHub PAT (必須)
ANTHROPIC_API_KEY=sk-ant-xxxxx # Anthropic API Key (Agent実行時)
MIYABI_WEBHOOK_URL=             # Webhook URL (オプション)
```

## 識学理論 5原則

1. **責任の明確化** - 各Agentが固有の責任範囲を持つ
2. **権限の委譲** - Leader → Executor/Analyst への権限委譲
3. **階層の設計** - Human → Coordinator → Specialist の3層構造
4. **結果の評価** - 品質スコア、カバレッジ、SLAで客観評価
5. **曖昧性の排除** - DAG依存関係明示、ラベルで状態可視化

## リンク

- **Framework**: [Miyabi](https://github.com/ShunsukeHayashi/Autonomous-Operations)
- **Repository**: [PLark-droid/Knowbe2](https://github.com/PLark-droid/Knowbe2)
