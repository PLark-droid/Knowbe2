import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BitableClient } from '../../src/lark/client.js';
import type { LarkBitableRecord } from '../../src/types/lark.js';
import { ServiceCodeRepository } from '../../src/lark/repositories/service-code.js';

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

describe('ServiceCodeRepository', () => {
  let client: BitableClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('findAll should map records', async () => {
    (client.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        record_id: 'rec-1',
        fields: {
          'サービスコード': '600001',
          '名称': '基本',
          '単位数': 100,
          'サービス種類': '就労継続支援B型',
          '有効開始日': '2026-01-01',
          '加算フラグ': false,
        },
      },
    ] as LarkBitableRecord[]);

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');
    const all = await repo.findAll();

    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe('rec-1');
    expect(all[0]!.units).toBe(100);
    expect(all[0]!.isAddition).toBe(false);
  });

  it('findById should return cached value without additional get call', async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-2',
      fields: {
        'サービスコード': '600002',
        '名称': '加算',
        '単位数': 25,
        'サービス種類': '加算',
        '有効開始日': '2026-01-01',
        '有効終了日': '2026-12-31',
        '加算フラグ': true,
        '適用条件': '条件A',
      },
    } as LarkBitableRecord);

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');

    const first = await repo.findById('rec-2');
    const second = await repo.findById('rec-2');

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('findById should return null on client error', async () => {
    (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');
    const result = await repo.findById('missing');

    expect(result).toBeNull();
  });

  it('findByCode should use cache first then query with sanitized filter', async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-cached',
      fields: {
        'サービスコード': '600010',
        '名称': 'cached',
        '単位数': 10,
        'サービス種類': 'S',
        '有効開始日': '2026-01-01',
        '加算フラグ': false,
      },
    } as LarkBitableRecord);

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');
    await repo.findById('rec-cached');

    const hit = await repo.findByCode('600010');
    expect(hit?.id).toBe('rec-cached');
    expect(client.listAll).not.toHaveBeenCalled();

    (client.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        record_id: 'rec-query',
        fields: {
          'サービスコード': 'x"\\x',
          '名称': 'queried',
          '単位数': 9,
          'サービス種類': 'S',
          '有効開始日': '2026-01-01',
          '加算フラグ': false,
        },
      },
    ] as LarkBitableRecord[]);

    const queried = await repo.findByCode('x"\\x');
    expect(queried?.id).toBe('rec-query');
    expect(client.listAll).toHaveBeenCalledWith('tbl-service-code', {
      filter: 'CurrentValue.[サービスコード] = "x\\"\\\\x"',
    });
  });

  it('findByCode should return null when no match', async () => {
    (client.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');
    const result = await repo.findByCode('999999');

    expect(result).toBeNull();
  });

  it('findAllValid should filter records by date', async () => {
    (client.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        record_id: 'rec-valid',
        fields: {
          'サービスコード': '600001',
          '名称': 'valid',
          '単位数': 100,
          'サービス種類': 'A',
          '有効開始日': '2025-01-01',
          '有効終了日': '2026-12-31',
          '加算フラグ': false,
        },
      },
      {
        record_id: 'rec-future',
        fields: {
          'サービスコード': '600002',
          '名称': 'future',
          '単位数': 100,
          'サービス種類': 'A',
          '有効開始日': '2027-01-01',
          '加算フラグ': false,
        },
      },
      {
        record_id: 'rec-ended',
        fields: {
          'サービスコード': '600003',
          '名称': 'ended',
          '単位数': 100,
          'サービス種類': 'A',
          '有効開始日': '2024-01-01',
          '有効終了日': '2025-01-31',
          '加算フラグ': false,
        },
      },
    ] as LarkBitableRecord[]);

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');
    const valid = await repo.findAllValid('2026-02-01');

    expect(valid.map((v) => v.id)).toEqual(['rec-valid']);
  });

  it('create/update/delete should keep cache coherent', async () => {
    (client.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-new',
      fields: {
        'サービスコード': '700001',
        '名称': 'new',
        '単位数': 1,
        'サービス種類': 'A',
        '有効開始日': '2026-01-01',
        '加算フラグ': false,
      },
    } as LarkBitableRecord);

    (client.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-new',
      fields: {
        'サービスコード': '700001',
        '名称': 'updated',
        '単位数': 2,
        'サービス種類': 'A',
        '有効開始日': '2026-01-01',
        '加算フラグ': true,
      },
    } as LarkBitableRecord);

    const repo = new ServiceCodeRepository(client, 'tbl-service-code');

    const created = await repo.create({
      code: '700001',
      name: 'new',
      units: 1,
      serviceType: 'A',
      validFrom: '2026-01-01',
      isAddition: false,
    });
    expect(created.name).toBe('new');

    const cachedAfterCreate = await repo.findById('rec-new');
    expect(cachedAfterCreate?.name).toBe('new');
    expect(client.get).not.toHaveBeenCalled();

    const updated = await repo.update('rec-new', { name: 'updated', isAddition: true, units: 2 });
    expect(updated.name).toBe('updated');

    const cachedAfterUpdate = await repo.findById('rec-new');
    expect(cachedAfterUpdate?.name).toBe('updated');

    await repo.delete('rec-new');
    expect(client.delete).toHaveBeenCalledWith('tbl-service-code', 'rec-new');

    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      record_id: 'rec-new',
      fields: {
        'サービスコード': '700001',
        '名称': 'loaded-after-delete',
        '単位数': 3,
        'サービス種類': 'A',
        '有効開始日': '2026-01-01',
        '加算フラグ': false,
      },
    } as LarkBitableRecord);

    const afterDelete = await repo.findById('rec-new');
    expect(afterDelete?.name).toBe('loaded-after-delete');
    expect(client.get).toHaveBeenCalledTimes(1);
  });
});
