/**
 * LinkResolver テスト
 * 業務ID <-> Lark record_id の変換層をテストする。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LinkResolver, NullLinkResolver } from '../../src/lark/link-resolver.js';
import type { BitableClient } from '../../src/lark/client.js';

function createMockClient(): BitableClient {
  return {
    listAll: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({ items: [], has_more: false, total: 0 }),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as BitableClient;
}

describe('LinkResolver', () => {
  let mockClient: BitableClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe('resolve', () => {
    it('should return null for empty businessId', async () => {
      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      const result = await resolver.resolve('facility', '');
      expect(result).toBeNull();
      expect(mockClient.listAll).not.toHaveBeenCalled();
    });

    it('should return null when target type is not configured', async () => {
      const resolver = new LinkResolver({
        client: mockClient,
        targets: {},
      });

      const result = await resolver.resolve('facility', 'fac-001');
      expect(result).toBeNull();
    });

    it('should return null when no matching record is found', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      const result = await resolver.resolve('facility', 'fac-nonexistent');
      expect(result).toBeNull();
      expect(mockClient.listAll).toHaveBeenCalledWith('tbl-fac', {
        filter: 'CurrentValue.[事業所ID] = "fac-nonexistent"',
      });
    });

    it('should resolve business ID to record_id', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { record_id: 'recABC123', fields: { '事業所ID': 'fac-001' } },
      ]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      const result = await resolver.resolve('facility', 'fac-001');
      expect(result).toBe('recABC123');
    });

    it('should cache resolved results', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { record_id: 'recABC123', fields: { '事業所ID': 'fac-001' } },
      ]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      // First call - hits API
      const result1 = await resolver.resolve('facility', 'fac-001');
      expect(result1).toBe('recABC123');
      expect(mockClient.listAll).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      const result2 = await resolver.resolve('facility', 'fac-001');
      expect(result2).toBe('recABC123');
      expect(mockClient.listAll).toHaveBeenCalledTimes(1); // No additional API call
    });

    it('should resolve different target types independently', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { record_id: 'recFAC001', fields: { '事業所ID': 'fac-001' } },
        ])
        .mockResolvedValueOnce([
          { record_id: 'recUSR001', fields: { '利用者ID': 'user-001' } },
        ]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
          user: { tableId: 'tbl-usr', businessIdField: '利用者ID' },
        },
      });

      const facResult = await resolver.resolve('facility', 'fac-001');
      expect(facResult).toBe('recFAC001');

      const userResult = await resolver.resolve('user', 'user-001');
      expect(userResult).toBe('recUSR001');
    });

    it('should sanitize filter values', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      await resolver.resolve('facility', 'fac"injection');
      expect(mockClient.listAll).toHaveBeenCalledWith('tbl-fac', {
        filter: 'CurrentValue.[事業所ID] = "fac\\"injection"',
      });
    });
  });

  describe('resolveOrThrow', () => {
    it('should return record_id when found', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { record_id: 'recXYZ', fields: { '利用者ID': 'usr-001' } },
      ]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          user: { tableId: 'tbl-usr', businessIdField: '利用者ID' },
        },
      });

      const result = await resolver.resolveOrThrow('user', 'usr-001');
      expect(result).toBe('recXYZ');
    });

    it('should throw when record not found', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          user: { tableId: 'tbl-usr', businessIdField: '利用者ID' },
        },
      });

      await expect(resolver.resolveOrThrow('user', 'nonexistent'))
        .rejects
        .toThrow('LinkResolver: user record not found for businessId="nonexistent"');
    });
  });

  describe('setCache', () => {
    it('should allow manual cache population', async () => {
      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      resolver.setCache('facility', 'fac-001', 'recPRECACHED');

      const result = await resolver.resolve('facility', 'fac-001');
      expect(result).toBe('recPRECACHED');
      expect(mockClient.listAll).not.toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached entries', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { record_id: 'recV1', fields: { '事業所ID': 'fac-001' } },
        ])
        .mockResolvedValueOnce([
          { record_id: 'recV2', fields: { '事業所ID': 'fac-001' } },
        ]);

      const resolver = new LinkResolver({
        client: mockClient,
        targets: {
          facility: { tableId: 'tbl-fac', businessIdField: '事業所ID' },
        },
      });

      await resolver.resolve('facility', 'fac-001');
      expect(mockClient.listAll).toHaveBeenCalledTimes(1);

      resolver.clearCache();

      // After clearing, should hit API again
      const result = await resolver.resolve('facility', 'fac-001');
      expect(result).toBe('recV2');
      expect(mockClient.listAll).toHaveBeenCalledTimes(2);
    });
  });
});

describe('NullLinkResolver', () => {
  it('should always return null from resolve', async () => {
    const resolver = new NullLinkResolver();
    const result = await resolver.resolve('facility', 'fac-001');
    expect(result).toBeNull();
  });

  it('should throw from resolveOrThrow', async () => {
    const resolver = new NullLinkResolver();
    await expect(resolver.resolveOrThrow('user', 'usr-001'))
      .rejects
      .toThrow('NullLinkResolver: Link resolution is not available');
  });
});
