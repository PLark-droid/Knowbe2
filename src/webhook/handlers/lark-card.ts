/**
 * Lark Card Callback Handler
 *
 * Lark インタラクティブカードのボタンクリック時に送られるコールバックを処理する。
 * POST /webhook/lark/card で受信し、アクション値に基づいて適切なハンドラーにルーティングする。
 *
 * Lark Card Action Callback format:
 * {
 *   "open_id": "ou_xxx",
 *   "user_id": "xxx",
 *   "open_message_id": "om_xxx",
 *   "tenant_key": "xxx",
 *   "token": "xxx",
 *   "action": {
 *     "value": { "action": "confirm", "invoice_id": "rec_xxx", ... },
 *     "tag": "button"
 *   }
 * }
 */

import type { Request, Response } from 'express';
import type { CardActionPayload, CsvGenerationDeps } from './csv-generation.js';
import { handleCardAction } from './csv-generation.js';

/** Lark Card Action コールバックのボディ型 */
export interface LarkCardCallbackBody {
  open_id?: string;
  user_id?: string;
  open_message_id?: string;
  tenant_key?: string;
  token?: string;
  action?: {
    value?: Record<string, string>;
    tag?: string;
  };
}

/** カードコールバックハンドラーの依存 */
export interface LarkCardHandlerDeps {
  csvGenerationDeps: CsvGenerationDeps;
  /** Lark verification token (カードコールバック検証用) */
  verificationToken?: string;
}

/**
 * Lark カードコールバックハンドラーを作成する
 */
export function createLarkCardHandler(deps: LarkCardHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as LarkCardCallbackBody;

      // トークン検証 (設定されている場合)
      if (deps.verificationToken && body.token !== deps.verificationToken) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // アクション値が無い場合
      if (!body.action?.value) {
        res.status(200).json({ msg: 'ok' });
        return;
      }

      const actionValue = body.action.value;
      const actionType = actionValue['action'];

      if (!actionType) {
        console.warn('[LarkCard] No action type in card callback');
        res.status(200).json({ msg: 'ok' });
        return;
      }

      // CSV生成アクションのルーティング
      if (actionType === 'confirm' || actionType === 'cancel') {
        const invoiceId = actionValue['invoice_id'];
        const facilityId = actionValue['facility_id'];
        const yearMonth = actionValue['year_month'];

        if (!invoiceId || !facilityId || !yearMonth) {
          console.warn('[LarkCard] Missing required fields in card action', actionValue);
          res.status(200).json({ msg: 'ok' });
          return;
        }

        const payload: CardActionPayload = {
          action: actionType,
          invoice_id: invoiceId,
          facility_id: facilityId,
          year_month: yearMonth,
        };

        // 即座にレスポンスを返してからバックグラウンドで処理
        res.status(200).json({ msg: 'ok' });

        // バックグラウンド処理 (Lark は 3秒以内のレスポンスを要求)
        handleCardAction(deps.csvGenerationDeps, payload).catch((error) => {
          console.error('[LarkCard] Card action handler failed:', error);
        });
        return;
      }

      // 未知のアクション
      console.warn(`[LarkCard] Unknown action type: ${actionType}`);
      res.status(200).json({ msg: 'ok' });
    } catch (err) {
      console.error('[LarkCard] Card callback error:', err);
      res.status(500).json({ error: 'Card callback processing failed' });
    }
  };
}
