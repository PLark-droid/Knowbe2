import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const replyMessageMock = vi.fn();
  const pushMessageMock = vi.fn();
  const messagingClientCtor = vi.fn(() => ({
    replyMessage: replyMessageMock,
    pushMessage: pushMessageMock,
  }));
  return { replyMessageMock, pushMessageMock, messagingClientCtor };
});

vi.mock('@line/bot-sdk', () => {
  return {
    messagingApi: {
      MessagingApiClient: mocks.messagingClientCtor,
    },
  };
});

import { LineMessagingService } from '../../src/line/messaging.js';

describe('LineMessagingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize MessagingApiClient with channelAccessToken', () => {
    new LineMessagingService('token-abc');

    expect(mocks.messagingClientCtor).toHaveBeenCalledWith({ channelAccessToken: 'token-abc' });
  });

  it('replyMessage/replyText/pushMessage should delegate to LINE client', async () => {
    const svc = new LineMessagingService('token');

    await svc.replyMessage('reply-token', [{ type: 'text', text: 'hello' }]);
    await svc.replyText('reply-token-2', 'shortcut');
    await svc.pushMessage('U123', [{ type: 'text', text: 'push' }]);

    expect(mocks.replyMessageMock).toHaveBeenNthCalledWith(1, {
      replyToken: 'reply-token',
      messages: [{ type: 'text', text: 'hello' }],
    });
    expect(mocks.replyMessageMock).toHaveBeenNthCalledWith(2, {
      replyToken: 'reply-token-2',
      messages: [{ type: 'text', text: 'shortcut' }],
    });
    expect(mocks.pushMessageMock).toHaveBeenCalledWith({
      to: 'U123',
      messages: [{ type: 'text', text: 'push' }],
    });
  });

  it('buildAttendanceConfirmation should build clock-in and clock-out flex payloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T12:34:56.000Z'));

    const svc = new LineMessagingService('token');

    const inMsg = svc.buildAttendanceConfirmation('太郎', 'clock_in', '09:01');
    const outMsg = svc.buildAttendanceConfirmation('太郎', 'clock_out', '17:59');

    expect(inMsg.altText).toContain('出勤しました');
    expect((inMsg.contents as { body: { contents: Array<{ text?: string; color?: string }> } }).body.contents[0]).toMatchObject({
      text: '出勤',
      color: '#1DB446',
    });
    expect((inMsg.contents as { body: { contents: Array<{ text?: string }> } }).body.contents[3]!.text).toBe('2026-02-26');

    expect(outMsg.altText).toContain('退勤しました');
    expect((outMsg.contents as { body: { contents: Array<{ text?: string; color?: string }> } }).body.contents[0]).toMatchObject({
      text: '退勤',
      color: '#FF6B6B',
    });

    vi.useRealTimers();
  });

  it('buildHealthCheckResult should use mapped emoji and fallback emoji', () => {
    const svc = new LineMessagingService('token');

    const score5 = svc.buildHealthCheckResult('花子', 5);
    const score99 = svc.buildHealthCheckResult('花子', 99);

    expect(score5.altText).toBe('花子さんの体調チェック');
    expect((score5.contents as { body: { contents: Array<{ text?: string }> } }).body.contents[1]!.text).toContain('😄 スコア: 5/5');
    expect((score99.contents as { body: { contents: Array<{ text?: string }> } }).body.contents[1]!.text).toContain('🙂 スコア: 99/5');
  });
});
