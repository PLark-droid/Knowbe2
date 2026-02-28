import {
  buildCsvGenerationCard,
  buildCsvCompletionCard,
  buildCsvCancellationCard,
  LarkBotMessaging,
} from '../../src/lark/bot-messaging.js';
import type { CsvGenerationCardParams, LarkMessageCard } from '../../src/lark/bot-messaging.js';
import type { LarkAuth } from '../../src/lark/auth.js';

// ─── Card Builder Tests ─────────────────────────────────

describe('buildCsvGenerationCard', () => {
  const baseParams: CsvGenerationCardParams = {
    invoiceId: 'rec_inv_001',
    facilityId: 'FAC001',
    yearMonth: '2026-01',
    facilityName: 'テスト事業所',
    userCount: 10,
  };

  it('should build a card with correct header', () => {
    const card = buildCsvGenerationCard(baseParams);

    expect(card.header).toBeDefined();
    expect(card.header?.title.content).toBe('CSV生成依頼');
    expect(card.header?.template).toBe('blue');
  });

  it('should include year month, facility name, and user count fields', () => {
    const card = buildCsvGenerationCard(baseParams);
    const divElements = card.elements.filter((e) => e.tag === 'div');

    const allFieldTexts = divElements.flatMap((e) => {
      if (e.tag !== 'div') return [];
      return (e.fields ?? []).map((f) => f.text.content);
    });

    expect(allFieldTexts).toContainEqual(expect.stringContaining('2026-01'));
    expect(allFieldTexts).toContainEqual(expect.stringContaining('テスト事業所'));
    expect(allFieldTexts).toContainEqual(expect.stringContaining('10名'));
  });

  it('should include confirm and cancel buttons', () => {
    const card = buildCsvGenerationCard(baseParams);
    const actionElement = card.elements.find((e) => e.tag === 'action');

    expect(actionElement).toBeDefined();
    if (actionElement?.tag !== 'action') throw new Error('Expected action element');

    expect(actionElement.actions).toHaveLength(2);

    const confirmButton = actionElement.actions.find((a) => a.text.content === '生成する');
    const cancelButton = actionElement.actions.find((a) => a.text.content === 'キャンセル');

    expect(confirmButton).toBeDefined();
    expect(confirmButton?.type).toBe('primary');
    expect(confirmButton?.value).toEqual({
      action: 'confirm',
      invoice_id: 'rec_inv_001',
      facility_id: 'FAC001',
      year_month: '2026-01',
    });

    expect(cancelButton).toBeDefined();
    expect(cancelButton?.type).toBe('danger');
    expect(cancelButton?.value).toEqual({
      action: 'cancel',
      invoice_id: 'rec_inv_001',
      facility_id: 'FAC001',
      year_month: '2026-01',
    });
  });

  it('should include totalAmount when provided', () => {
    const card = buildCsvGenerationCard({ ...baseParams, totalAmount: 123456 });
    const divElements = card.elements.filter((e) => e.tag === 'div');

    const allTexts = divElements.flatMap((e) => {
      if (e.tag !== 'div') return [];
      const fieldTexts = (e.fields ?? []).map((f) => f.text.content);
      const textContent = e.text?.content ?? '';
      return [...fieldTexts, textContent];
    });

    expect(allTexts.some((t) => t.includes('123,456'))).toBe(true);
  });

  it('should not include totalAmount when not provided', () => {
    const card = buildCsvGenerationCard(baseParams);
    const allTexts = JSON.stringify(card);

    expect(allTexts).not.toContain('合計請求額');
  });

  it('should have wide_screen_mode enabled', () => {
    const card = buildCsvGenerationCard(baseParams);
    expect(card.config?.wide_screen_mode).toBe(true);
  });

  it('should have forward disabled', () => {
    const card = buildCsvGenerationCard(baseParams);
    expect(card.config?.enable_forward).toBe(false);
  });
});

describe('buildCsvCompletionCard', () => {
  it('should build a green completion card', () => {
    const card = buildCsvCompletionCard({
      yearMonth: '2026-01',
      facilityName: 'テスト事業所',
      kokuhoRenRecordCount: 5,
      wageRecordCount: 10,
      totalAmount: 500000,
    });

    expect(card.header?.title.content).toBe('CSV生成完了');
    expect(card.header?.template).toBe('green');

    const allTexts = JSON.stringify(card);
    expect(allTexts).toContain('2026-01');
    expect(allTexts).toContain('テスト事業所');
    expect(allTexts).toContain('5件');
    expect(allTexts).toContain('10件');
    expect(allTexts).toContain('500,000');
  });

  it('should not include totalAmount when undefined', () => {
    const card = buildCsvCompletionCard({
      yearMonth: '2026-01',
      facilityName: 'テスト事業所',
      kokuhoRenRecordCount: 3,
      wageRecordCount: 7,
    });

    const allTexts = JSON.stringify(card);
    expect(allTexts).not.toContain('合計請求額');
  });
});

describe('buildCsvCancellationCard', () => {
  it('should build a grey cancellation card', () => {
    const card = buildCsvCancellationCard({
      yearMonth: '2026-01',
      facilityName: 'テスト事業所',
    });

    expect(card.header?.title.content).toBe('CSV生成キャンセル');
    expect(card.header?.template).toBe('grey');

    const allTexts = JSON.stringify(card);
    expect(allTexts).toContain('2026-01');
    expect(allTexts).toContain('テスト事業所');
    expect(allTexts).toContain('キャンセル');
  });
});

// ─── LarkBotMessaging Tests ─────────────────────────────

describe('LarkBotMessaging', () => {
  let mockAuth: LarkAuth;
  let messaging: LarkBotMessaging;

  beforeEach(() => {
    mockAuth = {
      getToken: vi.fn().mockResolvedValue('test-token'),
    } as unknown as LarkAuth;
    messaging = new LarkBotMessaging(mockAuth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendInteractiveCard', () => {
    it('should send a card message to the specified chat', async () => {
      const mockCard: LarkMessageCard = {
        elements: [{ tag: 'div', text: { tag: 'plain_text', content: 'test' } }],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 0, msg: 'ok', data: { message_id: 'msg_001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const messageId = await messaging.sendInteractiveCard('chat_001', mockCard);

      expect(messageId).toBe('msg_001');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0]!;
      expect(url).toContain('im/v1/messages');
      expect(url).toContain('receive_id_type=chat_id');
      expect((options as RequestInit).method).toBe('POST');

      const body = JSON.parse((options as RequestInit).body as string) as Record<string, unknown>;
      expect(body['receive_id']).toBe('chat_001');
      expect(body['msg_type']).toBe('interactive');
    });

    it('should throw when HTTP response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Server Error', { status: 500 }),
      );

      await expect(
        messaging.sendInteractiveCard('chat_001', { elements: [] }),
      ).rejects.toThrow('Lark send message failed');
    });

    it('should throw when Lark API returns error code', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 99999, msg: 'permission denied' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(
        messaging.sendInteractiveCard('chat_001', { elements: [] }),
      ).rejects.toThrow('Lark send message API error');
    });
  });

  describe('sendFile', () => {
    it('should send a file message', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 0, msg: 'ok', data: { message_id: 'msg_002' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const messageId = await messaging.sendFile('chat_001', 'file_key_abc', 'report.csv');

      expect(messageId).toBe('msg_002');

      const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body['msg_type']).toBe('file');
      const content = JSON.parse(body['content'] as string) as Record<string, string>;
      expect(content['file_key']).toBe('file_key_abc');
      expect(content['file_name']).toBe('report.csv');
    });

    it('should throw when HTTP response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Error', { status: 403 }),
      );

      await expect(messaging.sendFile('chat_001', 'fk')).rejects.toThrow('Lark send file failed');
    });
  });

  describe('sendText', () => {
    it('should send a text message', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 0, msg: 'ok', data: { message_id: 'msg_003' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const messageId = await messaging.sendText('chat_001', 'Hello');

      expect(messageId).toBe('msg_003');

      const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body['msg_type']).toBe('text');
      const content = JSON.parse(body['content'] as string) as Record<string, string>;
      expect(content['text']).toBe('Hello');
    });

    it('should throw when Lark API returns error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 10001, msg: 'chat not found' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(messaging.sendText('bad_chat', 'test')).rejects.toThrow(
        'Lark send text API error',
      );
    });
  });
});
