/**
 * Lark Bot Messaging Service
 *
 * Lark IM API を使用してメッセージカード・ファイルを送信する。
 * CSV生成確認カードの送信と結果通知を担当する。
 *
 * API Reference:
 * - Send Message: POST https://open.feishu.cn/open-apis/im/v1/messages
 * - Message Card: https://open.larkoffice.com/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-card
 */

import type { LarkAuth } from './auth.js';

const SEND_MESSAGE_URL = 'https://open.feishu.cn/open-apis/im/v1/messages';

/** Lark IM API レスポンス */
interface LarkImResponse {
  code: number;
  msg: string;
  data?: {
    message_id?: string;
  };
}

/** Lark Message Card の構造 */
export interface LarkMessageCard {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: 'plain_text';
      content: string;
    };
    template?: string;
  };
  elements: LarkCardElement[];
}

/** カード要素 (フィールド一覧・アクションボタン等) */
export type LarkCardElement =
  | LarkCardDivElement
  | LarkCardActionElement
  | LarkCardNoteElement
  | LarkCardHrElement;

export interface LarkCardDivElement {
  tag: 'div';
  text?: {
    tag: 'lark_md' | 'plain_text';
    content: string;
  };
  fields?: Array<{
    is_short: boolean;
    text: {
      tag: 'lark_md' | 'plain_text';
      content: string;
    };
  }>;
}

export interface LarkCardActionElement {
  tag: 'action';
  actions: Array<{
    tag: 'button';
    text: {
      tag: 'plain_text';
      content: string;
    };
    type: 'primary' | 'danger' | 'default';
    value: Record<string, string>;
  }>;
}

export interface LarkCardNoteElement {
  tag: 'note';
  elements: Array<{
    tag: 'plain_text';
    content: string;
  }>;
}

export interface LarkCardHrElement {
  tag: 'hr';
}

/** CSV生成確認カードのパラメータ */
export interface CsvGenerationCardParams {
  /** Invoice record ID (カードアクションで返却される) */
  invoiceId: string;
  /** 事業所ID */
  facilityId: string;
  /** 対象年月 (YYYY-MM) */
  yearMonth: string;
  /** 事業所名 */
  facilityName: string;
  /** 対象利用者数 */
  userCount: number;
  /** 合計金額 (円) */
  totalAmount?: number;
}

/**
 * CSV生成確認用 Interactive Card を構築する
 */
export function buildCsvGenerationCard(params: CsvGenerationCardParams): LarkMessageCard {
  const elements: LarkCardElement[] = [
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**対象年月:** ${params.yearMonth}`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**事業所:** ${params.facilityName}`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**利用者数:** ${params.userCount}名`,
          },
        },
      ],
    },
  ];

  if (params.totalAmount !== undefined) {
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**合計請求額:** ${params.totalAmount.toLocaleString()}円`,
      },
    });
  }

  elements.push({ tag: 'hr' });

  elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: { tag: 'plain_text', content: '生成する' },
        type: 'primary',
        value: {
          action: 'confirm',
          invoice_id: params.invoiceId,
          facility_id: params.facilityId,
          year_month: params.yearMonth,
        },
      },
      {
        tag: 'button',
        text: { tag: 'plain_text', content: 'キャンセル' },
        type: 'danger',
        value: {
          action: 'cancel',
          invoice_id: params.invoiceId,
          facility_id: params.facilityId,
          year_month: params.yearMonth,
        },
      },
    ],
  });

  elements.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: '国保連請求CSVと工賃データCSVを生成します',
      },
    ],
  });

  return {
    config: {
      wide_screen_mode: true,
      enable_forward: false,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: 'CSV生成依頼',
      },
      template: 'blue',
    },
    elements,
  };
}

/**
 * CSV生成完了通知カードを構築する
 */
export function buildCsvCompletionCard(params: {
  yearMonth: string;
  facilityName: string;
  kokuhoRenRecordCount: number;
  wageRecordCount: number;
  totalAmount?: number;
}): LarkMessageCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: 'CSV生成完了' },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**対象年月:** ${params.yearMonth}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**事業所:** ${params.facilityName}` },
          },
        ],
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**国保連CSV:** ${params.kokuhoRenRecordCount}件`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**工賃CSV:** ${params.wageRecordCount}件`,
            },
          },
        ],
      },
      ...(params.totalAmount !== undefined
        ? [
            {
              tag: 'div' as const,
              text: {
                tag: 'lark_md' as const,
                content: `**合計請求額:** ${params.totalAmount.toLocaleString()}円`,
              },
            },
          ]
        : []),
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: 'ファイルはこのチャットに送信されます',
          },
        ],
      },
    ],
  };
}

/**
 * キャンセル通知カードを構築する
 */
export function buildCsvCancellationCard(params: {
  yearMonth: string;
  facilityName: string;
}): LarkMessageCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: 'CSV生成キャンセル' },
      template: 'grey',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `${params.yearMonth} / ${params.facilityName} のCSV生成がキャンセルされました。`,
        },
      },
    ],
  };
}

/**
 * Lark Bot Messaging Service
 *
 * Lark IM API を介してインタラクティブカードやファイルメッセージを送信する。
 */
export class LarkBotMessaging {
  constructor(private readonly auth: LarkAuth) {}

  /**
   * チャットにインタラクティブカードを送信する
   */
  async sendInteractiveCard(chatId: string, card: LarkMessageCard): Promise<string | undefined> {
    const token = await this.auth.getToken();

    const res = await fetch(`${SEND_MESSAGE_URL}?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }),
    });

    if (!res.ok) {
      throw new Error(`Lark send message failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as LarkImResponse;
    if (json.code !== 0) {
      throw new Error(`Lark send message API error: code=${json.code} msg=${json.msg}`);
    }

    return json.data?.message_id;
  }

  /**
   * チャットにファイルメッセージを送信する
   *
   * @param chatId - 送信先チャットID
   * @param fileKey - Lark Driveにアップロード済みのファイルキー
   * @param fileName - 表示用ファイル名
   */
  async sendFile(chatId: string, fileKey: string, fileName?: string): Promise<string | undefined> {
    const token = await this.auth.getToken();

    const content: Record<string, string> = { file_key: fileKey };
    if (fileName) {
      content['file_name'] = fileName;
    }

    const res = await fetch(`${SEND_MESSAGE_URL}?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'file',
        content: JSON.stringify(content),
      }),
    });

    if (!res.ok) {
      throw new Error(`Lark send file failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as LarkImResponse;
    if (json.code !== 0) {
      throw new Error(`Lark send file API error: code=${json.code} msg=${json.msg}`);
    }

    return json.data?.message_id;
  }

  /**
   * テキストメッセージを送信する (通知等)
   */
  async sendText(chatId: string, text: string): Promise<string | undefined> {
    const token = await this.auth.getToken();

    const res = await fetch(`${SEND_MESSAGE_URL}?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    });

    if (!res.ok) {
      throw new Error(`Lark send text failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as LarkImResponse;
    if (json.code !== 0) {
      throw new Error(`Lark send text API error: code=${json.code} msg=${json.msg}`);
    }

    return json.data?.message_id;
  }
}
