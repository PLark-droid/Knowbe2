# Miyabi Agent Characters - エージェントキャラクター一覧

## Coding Agents (7体)

| # | キャラ名 | 技術名 | 役割 | ロールカラー |
|---|---------|--------|------|------------|
| 1 | しきろーん | CoordinatorAgent | タスク統括・DAG分解 | 🔴 Leader |
| 2 | つくろーん | CodeGenAgent | AI コード生成 | 🟢 Executor |
| 3 | めだまん | ReviewAgent | 品質スコアリング | 🔵 Analyst |
| 4 | みつけろーん | IssueAgent | Issue分析・ラベル管理 | 🔵 Analyst |
| 5 | まとめろーん | PRAgent | PR自動作成 | 🟢 Executor |
| 6 | はこぼーん | DeploymentAgent | CI/CDデプロイ | 🟢 Executor |
| 7 | つなぐん | TestAgent | テスト実行・カバレッジ | 🟢 Executor |

## ロールカラー定義

| カラー | 役割 | 実行制約 |
|--------|------|---------|
| 🔴 Leader (赤) | 統括・意思決定 | 順次実行のみ |
| 🟢 Executor (緑) | 実装・実行 | 並列実行可 |
| 🔵 Analyst (青) | 分析・評価 | 並列実行可 |
| 🟡 Support (黄) | サポート・補助 | 条件付き実行 |

## 階層構造

```
Human (意思決定者)
  └── しきろーん (CoordinatorAgent) 🔴
        ├── つくろーん (CodeGenAgent) 🟢
        ├── めだまん (ReviewAgent) 🔵
        ├── みつけろーん (IssueAgent) 🔵
        ├── まとめろーん (PRAgent) 🟢
        ├── はこぼーん (DeploymentAgent) 🟢
        └── つなぐん (TestAgent) 🟢
```

## 識学理論との対応

1. **責任の明確化**: 各キャラクターが固有の責任範囲を持つ
2. **権限の委譲**: Leader → Executor/Analyst への権限委譲
3. **階層の設計**: Human → Leader → Specialist の3層構造
4. **結果の評価**: 品質スコア、カバレッジ、実行時間で客観評価
5. **曖昧性の排除**: DAGによる依存関係明示、ラベルによる状態可視化
