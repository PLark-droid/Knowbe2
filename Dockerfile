# ============================================================
# Knowbe2 Webhook Server - Production Dockerfile
# Multi-stage build for Google Cloud Run
# ============================================================

# --- Stage 1: Build ---
FROM node:22-slim AS builder

WORKDIR /app

# 依存関係のインストール (キャッシュ効率のためpackage*.jsonのみ先にコピー)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ソースコードをコピーしてビルド
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Stage 2: Production ---
FROM node:22-slim AS production

# セキュリティ: メタデータ
LABEL maintainer="PLark-droid"
LABEL description="Knowbe2 Webhook Server - B型就労支援事業所向け業務支援システム"

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

# 本番依存関係のみインストール
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# セキュリティ: 非rootユーザーで実行
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/false --create-home appuser && \
    chown -R appuser:appgroup /app

# ビルド成果物をコピー
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER appuser

# Cloud Run はデフォルトで PORT=8080 を設定する
# アプリケーション側は process.env['PORT'] を読み取る
EXPOSE 8080

# ヘルスチェック (Cloud Run は /health を使用)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||8080;fetch('http://127.0.0.1:'+p+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# エントリーポイント
CMD ["node", "dist/webhook/start.js"]
