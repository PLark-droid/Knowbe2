import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BitableClient } from '../../src/lark/client.js';
import type { LarkAuth } from '../../src/lark/auth.js';

/** Minimal mock for LarkAuth */
function createMockAuth(): LarkAuth {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
  } as unknown as LarkAuth;
}

/** Helper to build a Lark API success response */
function larkOk<D>(data: D): Response {
  return new Response(JSON.stringify({ code: 0, msg: 'success', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Helper to build a Lark API error response (HTTP 200 but code != 0) */
function larkError(code: number, msg: string): Response {
  return new Response(JSON.stringify({ code, msg, data: null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BitableClient', () => {
  let client: BitableClient;
  let mockAuth: LarkAuth;

  beforeEach(() => {
    mockAuth = createMockAuth();
    client = new BitableClient({ auth: mockAuth, appToken: 'app123' });
    vi.restoreAllMocks();
  });

  describe('request - Lark API code validation', () => {
    it('should succeed when code is 0', async () => {
      const record = { record_id: 'rec1', fields: { name: 'test' } };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        larkOk({ record }),
      );

      const result = await client.get('tbl1', 'rec1');
      expect(result).toEqual(record);
    });

    it('should throw AbortError for non-retryable API error code', async () => {
      // Permission denied error (not in retryable range)
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254001, 'Permission denied')),
      );

      await expect(client.get('tbl1', 'rec1')).rejects.toThrow(
        'Lark API error [/apps/app123/tables/tbl1/records/rec1]: code=1254001 msg=Permission denied',
      );
    });

    it('should not retry for non-retryable error codes', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254001, 'Permission denied')),
      );

      await expect(client.get('tbl1', 'rec1')).rejects.toThrow();

      // Should be called only once (no retries) because AbortError stops p-retry
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should retry for retryable Bitable error codes (record locked)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(larkError(1254007, 'Record locked'))
        .mockResolvedValueOnce(larkError(1254007, 'Record locked'))
        .mockResolvedValueOnce(
          larkOk({ record: { record_id: 'rec1', fields: { name: 'ok' } } }),
        );

      const result = await client.get('tbl1', 'rec1');
      expect(result).toEqual({ record_id: 'rec1', fields: { name: 'ok' } });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('should retry for retryable Bitable error codes (table locked)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(larkError(1254008, 'Table locked'))
        .mockResolvedValueOnce(
          larkOk({ record: { record_id: 'rec1', fields: {} } }),
        );

      const result = await client.get('tbl1', 'rec1');
      expect(result.record_id).toBe('rec1');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should retry for retryable Bitable error codes (concurrent writes)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(larkError(1254043, 'Too many concurrent writes'))
        .mockResolvedValueOnce(
          larkOk({ record: { record_id: 'rec1', fields: {} } }),
        );

      await client.get('tbl1', 'rec1');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should retry for server internal error codes (99991xxx)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(larkError(99991001, 'Internal error'))
        .mockResolvedValueOnce(
          larkOk({ record: { record_id: 'rec1', fields: {} } }),
        );

      await client.get('tbl1', 'rec1');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries for persistent retryable errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254007, 'Record locked')),
      );

      await expect(client.get('tbl1', 'rec1')).rejects.toThrow(
        'Lark API error',
      );
    }, 15000);

    it('should include API path in error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254099, 'Some error')),
      );

      await expect(client.get('tbl1', 'rec1')).rejects.toThrow(
        /\/apps\/app123\/tables\/tbl1\/records\/rec1/,
      );
    });

    it('should include error code and message in the thrown error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(99999, 'Unknown error')),
      );

      await expect(client.get('tbl1', 'rec1')).rejects.toThrow(
        'Lark API error [/apps/app123/tables/tbl1/records/rec1]: code=99999 msg=Unknown error',
      );
    });
  });

  describe('CRUD methods with code validation', () => {
    it('list should propagate API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254002, 'Table not found')),
      );

      await expect(client.list('tbl1')).rejects.toThrow('code=1254002');
    });

    it('create should propagate API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254003, 'Field type mismatch')),
      );

      await expect(client.create('tbl1', { name: 'test' })).rejects.toThrow(
        'code=1254003',
      );
    });

    it('update should propagate API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254004, 'Record not found')),
      );

      await expect(
        client.update('tbl1', 'rec1', { name: 'test' }),
      ).rejects.toThrow('code=1254004');
    });

    it('delete should propagate API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(larkError(1254005, 'Delete failed')),
      );

      await expect(client.delete('tbl1', 'rec1')).rejects.toThrow(
        'code=1254005',
      );
    });

    it('list should return data on success', async () => {
      const items = [{ record_id: 'r1', fields: { x: 1 } }];
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        larkOk({ items, has_more: false, total: 1 }),
      );

      const result = await client.list('tbl1');
      expect(result.items).toEqual(items);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(1);
    });

    it('create should return created record on success', async () => {
      const record = { record_id: 'rec-new', fields: { name: 'created' } };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        larkOk({ record }),
      );

      const result = await client.create('tbl1', { name: 'created' });
      expect(result).toEqual(record);
    });

    it('delete should resolve on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        larkOk({}),
      );

      await expect(client.delete('tbl1', 'rec1')).resolves.toBeUndefined();
    });
  });

  describe('HTTP-level error handling', () => {
    it('should throw AbortError for HTTP non-2xx (not 429)', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response('Forbidden', { status: 403, statusText: 'Forbidden' })),
      );

      await expect(client.get('tbl1', 'rec1')).rejects.toThrow(
        'Lark API error: 403 Forbidden',
      );
    });

    it('should retry on HTTP 429 rate limit', async () => {
      const rateLimitResponse = new Response('Too Many Requests', {
        status: 429,
        headers: { 'x-ogw-ratelimit-reset': '0' },
      });
      const successResponse = larkOk({
        record: { record_id: 'rec1', fields: {} },
      });

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await client.get('tbl1', 'rec1');
      expect(result.record_id).toBe('rec1');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
