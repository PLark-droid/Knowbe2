#!/usr/bin/env bash
# ============================================================
# Knowbe2 Webhook Server - Cloud Run デプロイスクリプト
#
# 使い方:
#   ./scripts/deploy-cloud-run.sh <PROJECT_ID> [SERVICE_NAME]
#
# 例:
#   ./scripts/deploy-cloud-run.sh my-gcp-project
#   ./scripts/deploy-cloud-run.sh my-gcp-project knowbe2-webhook-staging
#
# 前提条件:
#   - gcloud CLI がインストール・認証済みであること
#   - Docker がインストール済みであること
#   - Secret Manager にシークレットが登録済みであること
# ============================================================

set -euo pipefail

REQUIRED_SECRETS=(
  LINE_CHANNEL_SECRET
  LINE_CHANNEL_ACCESS_TOKEN
  LARK_APP_ID
  LARK_APP_SECRET
  LARK_VERIFICATION_TOKEN
  LARK_BASE_APP_TOKEN
  LARK_TABLE_USER
  LARK_TABLE_ATTENDANCE
  LARK_TABLE_HEALTH_CHECK
)

# ─── 引数チェック ─────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "エラー: PROJECT_ID が指定されていません"
  echo ""
  echo "使い方: $0 <PROJECT_ID> [SERVICE_NAME]"
  echo "  PROJECT_ID  : GCP プロジェクトID (必須)"
  echo "  SERVICE_NAME: Cloud Run サービス名 (デフォルト: knowbe2-webhook)"
  exit 1
fi

PROJECT_ID="$1"
SERVICE_NAME="${2:-knowbe2-webhook}"

# ─── 定数 ─────────────────────────────────────────────────────
REGION="asia-northeast1"
REPOSITORY="knowbe2"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"
TAG="$(date +%Y%m%d-%H%M%S)"

# ─── 必須コマンドのチェック ───────────────────────────────────
for cmd in gcloud docker; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "エラー: ${cmd} が見つかりません。インストール後に再実行してください。"
    exit 1
  fi
done

# ─── gcloud プロジェクト設定 ──────────────────────────────────
echo "===================================="
echo "Knowbe2 Cloud Run デプロイ"
echo "===================================="
echo "  プロジェクト : ${PROJECT_ID}"
echo "  サービス名   : ${SERVICE_NAME}"
echo "  リージョン   : ${REGION}"
echo "  イメージ     : ${IMAGE_NAME}:${TAG}"
echo "===================================="
echo ""

gcloud config set project "${PROJECT_ID}"

# ─── gcloud 認証状態チェック ───────────────────────────────────
if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q '.'; then
  echo "エラー: gcloud の有効な認証アカウントがありません。"
  echo "  gcloud auth login を実行してから再試行してください。"
  exit 1
fi

# ─── Artifact Registry リポジトリの確認・作成 ─────────────────
# 初回デプロイ時にリポジトリが存在しない場合は自動作成する
echo "Artifact Registry リポジトリを確認中..."
if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "リポジトリが存在しません。作成します..."
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Knowbe2 Docker images" \
    --project="${PROJECT_ID}"
  echo "リポジトリを作成しました: ${REPOSITORY}"
fi

# ─── Secret Manager の必須シークレット確認 ────────────────────
echo "必須シークレットを確認中..."
for secret in "${REQUIRED_SECRETS[@]}"; do
  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "エラー: Secret Manager に ${secret} が存在しません。"
    exit 1
  fi
done

# ─── Docker 認証設定 ──────────────────────────────────────────
# Artifact Registry に push するための認証を設定する
echo "Docker 認証を設定中..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ─── Docker イメージのビルド ──────────────────────────────────
echo "Docker イメージをビルド中..."
docker build \
  --pull \
  -t "${IMAGE_NAME}:${TAG}" \
  -t "${IMAGE_NAME}:latest" \
  .

# ─── Artifact Registry にプッシュ ─────────────────────────────
echo "Artifact Registry にプッシュ中..."
docker push "${IMAGE_NAME}:${TAG}"
docker push "${IMAGE_NAME}:latest"

# ─── Cloud Run にデプロイ ─────────────────────────────────────
# メモリ: 256Mi (Webhook処理には十分)
# インスタンス: 最小0 (コスト最適化) / 最大10 (スパイク対応)
# ポート: 8080 (Cloud Run デフォルト、アプリは PORT 環境変数を参照)
# 認証: 未認証リクエスト許可 (LINE/Lark Webhook は自前でHMAC署名検証を行う)
echo "Cloud Run にデプロイ中..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}:${TAG}" \
  --region "${REGION}" \
  --platform managed \
  --execution-environment gen2 \
  --allow-unauthenticated \
  --ingress all \
  --memory 256Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,PORT=8080" \
  --set-secrets "\
LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest,\
LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest,\
LARK_APP_ID=LARK_APP_ID:latest,\
LARK_APP_SECRET=LARK_APP_SECRET:latest,\
LARK_VERIFICATION_TOKEN=LARK_VERIFICATION_TOKEN:latest,\
LARK_BASE_APP_TOKEN=LARK_BASE_APP_TOKEN:latest,\
LARK_TABLE_USER=LARK_TABLE_USER:latest,\
LARK_TABLE_ATTENDANCE=LARK_TABLE_ATTENDANCE:latest,\
LARK_TABLE_HEALTH_CHECK=LARK_TABLE_HEALTH_CHECK:latest" \
  --project "${PROJECT_ID}"

# ─── デプロイ結果の確認 ───────────────────────────────────────
echo ""
echo "===================================="
echo "デプロイ完了"
echo "===================================="

# デプロイされたサービスの URL を取得して表示する
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format="value(status.url)")

echo "  サービス URL : ${SERVICE_URL}"
echo ""
echo "エンドポイント:"
echo "  ヘルスチェック : ${SERVICE_URL}/health"
echo "  LINE Webhook   : ${SERVICE_URL}/webhook/line"
echo "  Lark Webhook   : ${SERVICE_URL}/webhook/lark"
echo "  体調チェック   : ${SERVICE_URL}/api/health-check"
echo ""
echo "ヘルスチェック確認:"
echo "  curl ${SERVICE_URL}/health"
echo ""
echo "LINE Webhook URL 設定:"
echo "  LINE Developers Console で以下を設定してください:"
echo "  ${SERVICE_URL}/webhook/line"
