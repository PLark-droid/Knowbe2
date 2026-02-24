/**
 * LINE Webhook route handler
 * イベントをパースしてタイプ別にディスパッチする
 */
import type { Request, Response } from 'express';

export interface LineWebhookDeps {
  handleAttendancePostback: (
    userId: string,
    data: string,
    replyToken: string,
  ) => Promise<void>;
  handleMessage: (
    userId: string,
    message: { type: string; text?: string },
    replyToken: string,
  ) => Promise<void>;
}

interface LineWebhookBody {
  events?: Array<{
    type: string;
    source?: { userId?: string };
    postback?: { data: string };
    message?: { type: string; text?: string };
    replyToken?: string;
  }>;
}

export function createLineWebhookHandler(deps: LineWebhookDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as LineWebhookBody;
      for (const event of body.events ?? []) {
        const userId = event.source?.userId;
        if (!userId) continue;

        if (event.type === 'postback' && event.postback) {
          await deps.handleAttendancePostback(
            userId,
            event.postback.data,
            event.replyToken ?? '',
          );
        } else if (event.type === 'message' && event.message) {
          await deps.handleMessage(
            userId,
            event.message,
            event.replyToken ?? '',
          );
        }
      }

      res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('LINE webhook handler error:', err);
      res.status(500).json({ error: 'LINE webhook processing failed' });
    }
  };
}
