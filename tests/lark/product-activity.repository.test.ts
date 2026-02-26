import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BitableClient } from '../../src/lark/client.js';
import type { LarkBitableRecord } from '../../src/types/lark.js';
import { ProductActivityRepository } from '../../src/lark/repositories/product-activity.js';
import type { LinkResolver } from '../../src/lark/link-resolver.js';

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

describe('ProductActivityRepository', () => {
  let client: BitableClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('findAll should use sanitized facilityId filter and map records', async () => {
    (client.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        record_id: 'rec-pa-1',
        fields: {
          '事業所ID': 'fac-1',
          '活動名': '洗浄',
          '説明': '説明',
          '作業単価': 550,
          '有効': true,
          '作成日時': '2026-01-01T00:00:00.000Z',
          '更新日時': '2026-01-02T00:00:00.000Z',
        },
      },
    ] as LarkBitableRecord[]);

    const repo = new ProductActivityRepository(client, 'tbl-pa');
    const result = await repo.findAll('fac"1\\x');

    expect(client.listAll).toHaveBeenCalledWith('tbl-pa', {
      filter: 'CurrentValue.[事業所ID] = "fac\\"1\\\\x"',
    });
    expect(result[0]!.name).toBe('洗浄');
    expect(result[0]!.hourlyRate).toBe(550);
  });

  it('findById should return null on facility mismatch or get error', async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-pa-2',
      fields: {
        '事業所ID': 'fac-actual',
        '活動名': '組立',
        '作業単価': 400,
        '有効': false,
        '作成日時': '2026-01-01T00:00:00.000Z',
        '更新日時': '2026-01-01T00:00:00.000Z',
      },
    } as LarkBitableRecord);

    const repo = new ProductActivityRepository(client, 'tbl-pa');
    await expect(repo.findById('rec-pa-2', 'fac-other')).resolves.toBeNull();

    (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    await expect(repo.findById('rec-pa-2', 'fac-actual')).resolves.toBeNull();
  });

  it('create should resolve and write link field when resolver returns record id', async () => {
    const resolve = vi.fn().mockResolvedValue('rec_facility_1');
    const resolver = { resolve } as unknown as LinkResolver;

    (client.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-pa-3',
      fields: {
        '事業所ID': 'fac-1',
        '活動名': '梱包',
        '作業単価': 700,
        '有効': true,
        '作成日時': '2026-01-01T00:00:00.000Z',
        '更新日時': '2026-01-01T00:00:00.000Z',
      },
    } as LarkBitableRecord);

    const repo = new ProductActivityRepository(client, 'tbl-pa', resolver);
    await repo.create({
      facilityId: 'fac-1',
      name: '梱包',
      hourlyRate: 700,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(resolve).toHaveBeenCalledWith('facility', 'fac-1');
    const fields = (client.create as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    expect(fields['事業所ID']).toBe('fac-1');
    expect(fields['事業所']).toEqual(['rec_facility_1']);
  });

  it('create/update should skip link field when resolver missing or unresolved', async () => {
    (client.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-pa-4',
      fields: {
        '事業所ID': 'fac-2',
        '活動名': '検品',
        '作業単価': 500,
        '有効': true,
        '作成日時': '2026-01-01T00:00:00.000Z',
        '更新日時': '2026-01-01T00:00:00.000Z',
      },
    } as LarkBitableRecord);
    (client.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-pa-4',
      fields: {
        '事業所ID': 'fac-2',
        '活動名': '検品(更新)',
        '作業単価': 520,
        '有効': true,
        '作成日時': '2026-01-01T00:00:00.000Z',
        '更新日時': '2026-01-03T00:00:00.000Z',
      },
    } as LarkBitableRecord);

    const withoutResolver = new ProductActivityRepository(client, 'tbl-pa');
    await withoutResolver.create({
      facilityId: 'fac-2',
      name: '検品',
      hourlyRate: 500,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const createFields = (client.create as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    expect(createFields['事業所']).toBeUndefined();

    const resolve = vi.fn().mockResolvedValue(null);
    const unresolvedResolver = { resolve } as unknown as LinkResolver;
    const withResolver = new ProductActivityRepository(client, 'tbl-pa', unresolvedResolver);
    await withResolver.update('rec-pa-4', { facilityId: 'fac-2', name: '検品(更新)', hourlyRate: 520 });

    const updateFields = (client.update as ReturnType<typeof vi.fn>).mock.calls[0]![2] as Record<string, unknown>;
    expect(resolve).toHaveBeenCalledWith('facility', 'fac-2');
    expect(updateFields['事業所']).toBeUndefined();
  });

  it('delete should delegate to client.delete', async () => {
    const repo = new ProductActivityRepository(client, 'tbl-pa');

    await repo.delete('rec-del');

    expect(client.delete).toHaveBeenCalledWith('tbl-pa', 'rec-del');
  });
});
