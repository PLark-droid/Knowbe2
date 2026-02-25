/**
 * LINE Rich Menu 設定 & アップロード
 *
 * B型就労支援事業所向けの4区画リッチメニューを定義し、
 * LINE Messaging API を通じて作成・デフォルト設定する。
 *
 * @module line/rich-menu
 */
import { messagingApi } from '@line/bot-sdk';

/** リッチメニューセットアップ設定 */
export interface RichMenuSetupConfig {
  /** LINE チャネルアクセストークン */
  channelAccessToken: string;
  /** LIFF ID (体調チェック画面遷移先) */
  liffId: string;
  /** リッチメニュー画像パス (PNG, 2500x1686) */
  imagePath?: string;
}

/**
 * B型就労支援事業所向けリッチメニュー定義を生成する
 *
 * 4区画構成:
 * - 左上: 出勤 (postback)
 * - 右上: 退勤 (postback)
 * - 左下: 体調チェック (LIFF URI)
 * - 右下: メニュー (postback)
 *
 * @returns RichMenuRequest オブジェクト
 */
export function createRichMenuObject(liffId: string): messagingApi.RichMenuRequest {
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'Knowbe2 メインメニュー',
    chatBarText: 'メニューを開く',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: 'postback', data: 'action=clock_in', displayText: '出勤' },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: 'postback', data: 'action=clock_out', displayText: '退勤' },
      },
      {
        bounds: { x: 0, y: 843, width: 1250, height: 843 },
        action: {
          type: 'uri',
          uri: `https://liff.line.me/${liffId}/health-check`,
        },
      },
      {
        bounds: { x: 1250, y: 843, width: 1250, height: 843 },
        action: { type: 'postback', data: 'action=menu', displayText: 'メニュー' },
      },
    ],
  };
}

/**
 * リッチメニューを作成し、画像をアップロードしてデフォルトに設定する
 *
 * @param config - セットアップ設定
 * @returns 作成されたリッチメニューID
 */
export async function setupRichMenu(config: RichMenuSetupConfig): Promise<string> {
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
  });
  const blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: config.channelAccessToken,
  });

  // 1. リッチメニュー作成
  const response = await client.createRichMenu(createRichMenuObject(config.liffId));
  const richMenuId = response.richMenuId;

  // 2. 画像アップロード (指定がある場合)
  if (config.imagePath) {
    const fs = await import('node:fs');
    const imageBuffer = fs.readFileSync(config.imagePath);
    await blobClient.setRichMenuImage(
      richMenuId,
      new Blob([imageBuffer], { type: 'image/png' }),
    );
  }

  // 3. デフォルトリッチメニューに設定
  await client.setDefaultRichMenu(richMenuId);

  return richMenuId;
}
