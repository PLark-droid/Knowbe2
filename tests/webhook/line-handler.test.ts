import type { Request, Response } from 'express';
import { createLineWebhookHandler } from '../../src/webhook/handlers/line.js';

interface MockResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function createMockRequest(body: Record<string, unknown>): Request {
  return { body } as Request;
}

describe('createLineWebhookHandler', () => {
  it('should dispatch postback and message events and skip events without userId', async () => {
    const handleAttendancePostback = vi.fn().mockResolvedValue(undefined);
    const handleMessage = vi.fn().mockResolvedValue(undefined);
    const handler = createLineWebhookHandler({ handleAttendancePostback, handleMessage });

    const req = createMockRequest({
      events: [
        {
          type: 'postback',
          source: { userId: 'U1' },
          postback: { data: 'action=clock_in' },
          replyToken: 'r1',
        },
        {
          type: 'message',
          source: { userId: 'U1' },
          message: { type: 'text', text: 'hello' },
          replyToken: 'r2',
        },
        {
          type: 'message',
          source: {},
          message: { type: 'text', text: 'ignored' },
          replyToken: 'r3',
        },
        {
          type: 'follow',
          source: { userId: 'U1' },
          replyToken: 'r4',
        },
      ],
    });
    const res = createMockResponse();

    await handler(req, res as unknown as Response);

    expect(handleAttendancePostback).toHaveBeenCalledWith('U1', 'action=clock_in', 'r1');
    expect(handleMessage).toHaveBeenCalledWith('U1', { type: 'text', text: 'hello' }, 'r2');
    expect(handleAttendancePostback).toHaveBeenCalledTimes(1);
    expect(handleMessage).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('should handle empty body.events', async () => {
    const handler = createLineWebhookHandler({
      handleAttendancePostback: vi.fn().mockResolvedValue(undefined),
      handleMessage: vi.fn().mockResolvedValue(undefined),
    });

    const req = createMockRequest({});
    const res = createMockResponse();

    await handler(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('should default replyToken to empty string', async () => {
    const handleAttendancePostback = vi.fn().mockResolvedValue(undefined);
    const handleMessage = vi.fn().mockResolvedValue(undefined);
    const handler = createLineWebhookHandler({ handleAttendancePostback, handleMessage });

    const req = createMockRequest({
      events: [
        {
          type: 'postback',
          source: { userId: 'U1' },
          postback: { data: 'action=clock_out' },
        },
        {
          type: 'message',
          source: { userId: 'U2' },
          message: { type: 'text', text: 'x' },
        },
      ],
    });
    const res = createMockResponse();

    await handler(req, res as unknown as Response);

    expect(handleAttendancePostback).toHaveBeenCalledWith('U1', 'action=clock_out', '');
    expect(handleMessage).toHaveBeenCalledWith('U2', { type: 'text', text: 'x' }, '');
  });

  it('should return 500 when dependency throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = createLineWebhookHandler({
      handleAttendancePostback: vi.fn().mockRejectedValue(new Error('bad')),
      handleMessage: vi.fn().mockResolvedValue(undefined),
    });

    const req = createMockRequest({
      events: [
        {
          type: 'postback',
          source: { userId: 'U1' },
          postback: { data: 'x' },
          replyToken: 'r1',
        },
      ],
    });
    const res = createMockResponse();

    await handler(req, res as unknown as Response);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'LINE webhook processing failed' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
