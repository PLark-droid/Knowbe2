/**
 * LINE Messaging Service
 * Flex Message対応のメッセージ送信サービス
 *
 * @module line/messaging
 */
import { messagingApi } from '@line/bot-sdk';

/**
 * LINE Messaging APIクライアントラッパー
 *
 * リプライ/プッシュメッセージの送信、および
 * B型就労支援事業所向けのFlex Messageテンプレートを提供する。
 */
export class LineMessagingService {
  private readonly client: messagingApi.MessagingApiClient;

  constructor(channelAccessToken: string) {
    this.client = new messagingApi.MessagingApiClient({ channelAccessToken });
  }

  /**
   * リプライメッセージ送信
   * @param replyToken - Webhook イベントの replyToken
   * @param messages   - 送信するメッセージ配列 (最大5件)
   */
  async replyMessage(replyToken: string, messages: messagingApi.Message[]): Promise<void> {
    await this.client.replyMessage({ replyToken, messages });
  }

  /**
   * プッシュメッセージ送信
   * @param to       - 送信先 userId / groupId / roomId
   * @param messages - 送信するメッセージ配列 (最大5件)
   */
  async pushMessage(to: string, messages: messagingApi.Message[]): Promise<void> {
    await this.client.pushMessage({ to, messages });
  }

  /**
   * テキストメッセージをリプライ送信するショートカット
   * @param replyToken - Webhook イベントの replyToken
   * @param text       - 送信テキスト
   */
  async replyText(replyToken: string, text: string): Promise<void> {
    await this.replyMessage(replyToken, [{ type: 'text', text }]);
  }

  /**
   * 勤怠確認 Flex Message を構築する
   *
   * 出勤/退勤の打刻結果を利用者に通知するための Flex Bubble。
   *
   * @param name   - 利用者名
   * @param action - 'clock_in' (出勤) | 'clock_out' (退勤)
   * @param time   - 打刻時刻 (例: "09:30")
   * @returns Flex Message オブジェクト
   */
  buildAttendanceConfirmation(
    name: string,
    action: 'clock_in' | 'clock_out',
    time: string,
  ): messagingApi.FlexMessage {
    const isClockIn = action === 'clock_in';
    return {
      type: 'flex',
      altText: isClockIn ? `${name}さん、出勤しました` : `${name}さん、退勤しました`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: isClockIn ? '出勤' : '退勤',
              weight: 'bold',
              size: 'xl',
              color: isClockIn ? '#1DB446' : '#FF6B6B',
            },
            {
              type: 'text',
              text: `${name}さん`,
              size: 'md',
              margin: 'md',
            },
            {
              type: 'text',
              text: time,
              size: 'xxl',
              weight: 'bold',
              margin: 'md',
            },
            {
              type: 'text',
              text: new Date().toISOString().slice(0, 10),
              size: 'sm',
              color: '#999999',
              margin: 'sm',
            },
          ],
        },
      },
    };
  }

  /**
   * 体調チェック結果 Flex Message を構築する
   *
   * 利用者が体調チェックを送信した後の確認メッセージ。
   *
   * @param name  - 利用者名
   * @param score - 体調スコア (1〜5)
   * @returns Flex Message オブジェクト
   */
  buildHealthCheckResult(name: string, score: number): messagingApi.FlexMessage {
    const emojiMap: Record<number, string> = {
      1: '\u{1F630}',
      2: '\u{1F610}',
      3: '\u{1F642}',
      4: '\u{1F60A}',
      5: '\u{1F604}',
    };
    const emoji = emojiMap[score] ?? '\u{1F642}';
    return {
      type: 'flex',
      altText: `${name}さんの体調チェック`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '体調チェック',
              weight: 'bold',
              size: 'lg',
            },
            {
              type: 'text',
              text: `${emoji} スコア: ${String(score)}/5`,
              size: 'xl',
              margin: 'md',
            },
            {
              type: 'text',
              text: `${name}さん`,
              size: 'sm',
              color: '#999999',
              margin: 'sm',
            },
          ],
        },
      },
    };
  }
}
