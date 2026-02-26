import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BitableClient } from '../../src/lark/client.js';
import type { LarkBitableRecord } from '../../src/types/lark.js';
import { FacilityRepository } from '../../src/lark/repositories/facility.js';

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

describe('FacilityRepository', () => {
  let client: BitableClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('findAll should use sanitized facilityId filter', async () => {
    const repo = new FacilityRepository(client, 'tbl-facility');

    await repo.findAll('fac"001\\x');

    expect(client.listAll).toHaveBeenCalledWith('tbl-facility', {
      filter: 'CurrentValue.[事業所ID] = "fac\\"001\\\\x"',
    });
  });

  it('findById should return null when facilityId does not match expected', async () => {
    const record: LarkBitableRecord = {
      record_id: 'rec-1',
      fields: {
        '事業所ID': 'fac-actual',
        '事業所名': 'A',
        '法人名': 'Corp',
        '事業所番号': '1300000001',
        '保険者番号': '13000001',
        '所在地': 'Tokyo',
        '郵便番号': '1000001',
        '電話番号': '000',
        '地域区分': '2級地',
        '報酬体系': 'Ⅱ',
        '定員': 20,
        'サービス種別コード': '600001',
        '作成日時': '2026-01-01T00:00:00.000Z',
        '更新日時': '2026-01-01T00:00:00.000Z',
      },
    };
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new FacilityRepository(client, 'tbl-facility');
    const entity = await repo.findById('rec-1', 'fac-other');

    expect(entity).toBeNull();
  });

  it('create should map domain fields into Lark labels and parse response robustly', async () => {
    const created: LarkBitableRecord = {
      record_id: 'rec-created',
      fields: {
        '事業所ID': 'fac-1',
        '事業所名': 'Miyabi',
        '法人名': 'Knowbe',
        '事業所番号': '1300000002',
        '保険者番号': '13000002',
        '所在地': 'Shibuya',
        '郵便番号': '1500002',
        '電話番号': '03-0000-0000',
        'FAX番号': '03-0000-0001',
        '地域区分': '不正値',
        '報酬体系': '???',
        '定員': 10,
        '平均工賃月額': 80000,
        'サービス種別コード': '601111',
        '作成日時': '2026-02-01T00:00:00.000Z',
        '更新日時': '2026-02-02T00:00:00.000Z',
      },
    };
    (client.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const repo = new FacilityRepository(client, 'tbl-facility');
    const result = await repo.create({
      facilityId: 'fac-1',
      name: 'Miyabi',
      corporateName: 'Knowbe',
      facilityNumber: '1300000002',
      insurerNumber: '13000002',
      address: 'Shibuya',
      postalCode: '1500002',
      phone: '03-0000-0000',
      fax: '03-0000-0001',
      areaGrade: 3,
      rewardStructure: 'IV',
      capacity: 10,
      averageMonthlyWage: 80000,
      serviceTypeCode: '601111',
    });

    const fields = (client.create as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    expect(fields['地域区分']).toBe('3級地');
    expect(fields['報酬体系']).toBe('Ⅳ');
    expect(fields['作成日時']).toEqual(expect.any(String));
    expect(fields['更新日時']).toEqual(expect.any(String));

    expect(result.areaGrade).toBe(1);
    expect(result.rewardStructure).toBe('I');
    expect(result.fax).toBe('03-0000-0001');
  });

  it('update should only send provided fields and always include 更新日時', async () => {
    const updated: LarkBitableRecord = {
      record_id: 'rec-updated',
      fields: {
        '事業所ID': 'fac-2',
        '事業所名': 'Updated',
        '法人名': 'Knowbe',
        '事業所番号': '1300000003',
        '保険者番号': '13000003',
        '所在地': 'Osaka',
        '郵便番号': '5300001',
        '電話番号': '06-0000-0000',
        '地域区分': '7級地',
        '報酬体系': 'VI',
        '定員': 30,
        'サービス種別コード': '602222',
        '作成日時': '2026-01-01T00:00:00.000Z',
        '更新日時': '2026-02-10T00:00:00.000Z',
      },
    };
    (client.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const repo = new FacilityRepository(client, 'tbl-facility');
    const result = await repo.update('rec-updated', { name: 'Updated', areaGrade: 7, rewardStructure: 'VI' });

    const fields = (client.update as ReturnType<typeof vi.fn>).mock.calls[0]![2] as Record<string, unknown>;
    expect(fields['事業所名']).toBe('Updated');
    expect(fields['地域区分']).toBe('7級地');
    expect(fields['報酬体系']).toBe('Ⅵ');
    expect(fields['更新日時']).toEqual(expect.any(String));
    expect(fields['法人名']).toBeUndefined();

    expect(result.areaGrade).toBe(7);
    expect(result.rewardStructure).toBe('VI');
  });

  it('delete should delegate to client.delete', async () => {
    const repo = new FacilityRepository(client, 'tbl-facility');

    await repo.delete('rec-del');

    expect(client.delete).toHaveBeenCalledWith('tbl-facility', 'rec-del');
  });
});
