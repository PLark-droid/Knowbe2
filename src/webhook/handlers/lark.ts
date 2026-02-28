/**
 * Lark event subscription handler
 * Bitable recordの作成・更新イベントをディスパッチする
 *
 * URL verification (challenge) にも対応:
 * 通常はミドルウェア (lark-verification.ts) で処理されるが、
 * ミドルウェアが無効な環境やテスト環境のための防御的対応。
 */
import type { Request, Response } from 'express';
import type { LarkWebhookBody, LarkWebhookChallenge, LarkWebhookEvent } from '../../types/lark.js';

export interface LarkWebhookDeps {
  onRecordCreated?: (
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ) => Promise<void>;
  onRecordUpdated?: (
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ) => Promise<void>;
  /** Invoice テーブルのステータスが "CSV生成依頼" に変更された際に呼ばれるハンドラー */
  onCsvGenerationRequested?: (
    recordId: string,
    fields: Record<string, unknown>,
  ) => Promise<void>;
  /** Invoice テーブルのテーブルID (CSV生成依頼検出用) */
  invoiceTableId?: string;
}

/**
 * リクエストボディが Lark URL verification (challenge) か判定する
 */
function isChallenge(body: LarkWebhookBody): body is LarkWebhookChallenge {
  return (body as LarkWebhookChallenge).type === 'url_verification';
}

export function createLarkWebhookHandler(deps: LarkWebhookDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as LarkWebhookBody;

      // URL verification (challenge-response)
      // ミドルウェアで処理される想定だが、防御的にハンドラーでも対応
      if (isChallenge(body)) {
        res.status(200).json({ challenge: body.challenge });
        return;
      }

      const event = body as LarkWebhookEvent;
      const eventType = event.header?.event_type;

      // event プロパティが存在しない場合は無視して 200 を返す
      if (!event.event) {
        res.status(200).json({ msg: 'ok' });
        return;
      }

      const tableId = event.event.table_id as string;
      const recordId = event.event.record_id as string;
      const fields = (event.event.fields ?? {}) as Record<string, unknown>;

      if (eventType === 'bitable.record.created') {
        if (deps.onRecordCreated) {
          await deps.onRecordCreated(tableId, recordId, fields);
        }
      } else if (
        eventType === 'bitable.record.updated' ||
        eventType === 'drive.file.bitable_record_changed_v1'
      ) {
        if (deps.onRecordUpdated) {
          await deps.onRecordUpdated(tableId, recordId, fields);
        }

        // Invoice テーブルのステータス変更を検出
        if (
          deps.onCsvGenerationRequested &&
          deps.invoiceTableId &&
          tableId === deps.invoiceTableId
        ) {
          const statusValue = fields['ステータス'];
          if (statusValue === 'CSV生成依頼' || statusValue === 'csv_generation_requested') {
            await deps.onCsvGenerationRequested(recordId, fields);
          }
        }
      }

      res.status(200).json({ msg: 'ok' });
    } catch (err) {
      console.error('Lark webhook error:', err);
      res.status(500).json({ error: 'Lark webhook processing failed' });
    }
  };
}
