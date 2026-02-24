/**
 * Lark event subscription handler
 * Bitable recordの作成・更新イベントをディスパッチする
 */
import type { Request, Response } from 'express';
import type { LarkWebhookEvent } from '../../types/lark.js';

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
}

export function createLarkWebhookHandler(deps: LarkWebhookDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as LarkWebhookEvent;
      const eventType = body.header?.event_type;
      const event = body.event;

      if (
        eventType === 'drive.file.bitable_record_changed_v1' ||
        eventType === 'bitable.record.created'
      ) {
        const tableId = event.table_id as string;
        const recordId = event.record_id as string;
        const fields = (event.fields ?? {}) as Record<string, unknown>;

        if (deps.onRecordCreated) {
          await deps.onRecordCreated(tableId, recordId, fields);
        }
      }

      res.status(200).json({ msg: 'ok' });
    } catch (err) {
      console.error('Lark webhook error:', err);
      res.status(500).json({ error: 'Lark webhook processing failed' });
    }
  };
}
