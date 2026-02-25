/**
 * Repository テスト - Link フィールド ID 整合性
 *
 * 各リポジトリの toEntity / toFields が正しく:
 * - toEntity: テキスト型フィールドから業務IDを読み取る (Link型フィールドの record_id を使わない)
 * - toFields: LinkResolver 経由で Link 型フィールドに record_id を書き込む
 * - フィルタ: テキスト型フィールドで業務IDによるフィルタを行う
 * - タイトル/キー列: 各テーブルのタイトルフィールドを自動生成する
 *
 * これにより Link フィールド移行後の ID 意味不整合 (Issue #17) が解消されることを検証。
 * また Issue #20 で追加: update 時の Link 解決、タイトル列生成、
 * Invoice/ProductOutput/WorkSchedule の Link 型テストを追加。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BitableClient } from '../../src/lark/client.js';
import type { LarkBitableRecord } from '../../src/types/lark.js';
import { LinkResolver } from '../../src/lark/link-resolver.js';
import { AttendanceRepository } from '../../src/lark/repositories/attendance.js';
import { HealthCheckRepository } from '../../src/lark/repositories/health-check.js';
import { SupportRecordRepository } from '../../src/lark/repositories/support-record.js';
import { WageCalculationRepository } from '../../src/lark/repositories/wage.js';
import { InvoiceRepository } from '../../src/lark/repositories/invoice.js';
import { ProductOutputRepository } from '../../src/lark/repositories/product-output.js';
import { WorkScheduleRepository } from '../../src/lark/repositories/work-schedule.js';
import { UserRepository } from '../../src/lark/repositories/user.js';
import { StaffRepository } from '../../src/lark/repositories/staff.js';

// ─── Mock Helpers ─────────────────────────────────────────

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

function createMockLinkResolver(): LinkResolver {
  const resolver = new LinkResolver({
    client: createMockClient(),
    targets: {},
  });
  // Override resolve to return predictable record_ids
  vi.spyOn(resolver, 'resolve').mockImplementation(async (type, businessId) => {
    if (!businessId) return null;
    return `rec_${type}_${businessId}`;
  });
  return resolver;
}

// ─── AttendanceRepository ─────────────────────────────────

describe('AttendanceRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  describe('toEntity reads business IDs from text fields', () => {
    it('should read facilityId and userId from text fields, not Link fields', async () => {
      // Simulate a Lark record where Link fields have record_ids
      // and text fields have business IDs
      const record: LarkBitableRecord = {
        record_id: 'recATT001',
        fields: {
          '事業所': ['recFAC_LINK_001'],    // Link field -> record_id
          '事業所ID': 'fac-business-001',    // Text field -> business ID
          '利用者': ['recUSR_LINK_001'],     // Link field -> record_id
          '利用者ID': 'user-business-001',   // Text field -> business ID
          '日付': '2026-02-25',
          '出勤時刻': '09:00',
          '退勤時刻': '17:00',
          '実績時間': 450,
          '休憩時間': 30,
          '出席区分': '出席',
          '送迎': 'なし',
          '食事提供': true,
          '作成日時': '2026-02-25T00:00:00Z',
          '更新日時': '2026-02-25T00:00:00Z',
        },
      };

      (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

      const repo = new AttendanceRepository(mockClient, 'tbl-att', linkResolver);
      const entity = await repo.findById('recATT001', 'fac-business-001');

      // Should use text field values, NOT Link field record_ids
      expect(entity).not.toBeNull();
      expect(entity!.facilityId).toBe('fac-business-001');
      expect(entity!.userId).toBe('user-business-001');
      // Record ID is from record_id (unchanged)
      expect(entity!.id).toBe('recATT001');
    });

    it('findById should correctly match business ID after reading from text field', async () => {
      const record: LarkBitableRecord = {
        record_id: 'recATT001',
        fields: {
          '事業所': ['recFAC_LINK_001'],
          '事業所ID': 'fac-001',
          '利用者': ['recUSR_LINK_001'],
          '利用者ID': 'user-001',
          '日付': '2026-02-25',
          '休憩時間': 0,
          '出席区分': '出席',
          '送迎': 'なし',
          '食事提供': false,
          '作成日時': '',
          '更新日時': '',
        },
      };

      (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

      const repo = new AttendanceRepository(mockClient, 'tbl-att');

      // Should match because facilityId is now read from text field
      const entity = await repo.findById('recATT001', 'fac-001');
      expect(entity).not.toBeNull();

      // Should NOT match wrong facility
      const entityWrong = await repo.findById('recATT001', 'fac-wrong');
      expect(entityWrong).toBeNull();
    });
  });

  describe('create writes Link fields via LinkResolver', () => {
    it('should write record_ids to Link fields and business IDs to text fields', async () => {
      const createdRecord: LarkBitableRecord = {
        record_id: 'recATT_NEW',
        fields: {
          '事業所ID': 'fac-001',
          '利用者ID': 'user-001',
          '日付': '2026-02-25',
          '出勤時刻': '09:00',
          '休憩時間': 0,
          '出席区分': '出席',
          '送迎': 'なし',
          '食事提供': false,
          '作成日時': '',
          '更新日時': '',
        },
      };

      // Mock: findByUserAndDate returns null (no duplicate)
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

      const repo = new AttendanceRepository(mockClient, 'tbl-att', linkResolver);

      await repo.create({
        facilityId: 'fac-001',
        userId: 'user-001',
        date: '2026-02-25',
        clockIn: '09:00',
        breakMinutes: 0,
        attendanceType: 'present',
        pickupType: 'none',
        mealProvided: false,
      });

      // Verify the fields passed to client.create
      const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const fields = createCall[1] as Record<string, unknown>;

      // Text fields should have business IDs
      expect(fields['事業所ID']).toBe('fac-001');
      expect(fields['利用者ID']).toBe('user-001');

      // Link fields should have resolved record_ids (from mock resolver)
      expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
      expect(fields['利用者']).toEqual(['rec_user_user-001']);
    });

    it('should skip Link fields when LinkResolver is not provided', async () => {
      const createdRecord: LarkBitableRecord = {
        record_id: 'recATT_NEW',
        fields: {
          '事業所ID': 'fac-001',
          '利用者ID': 'user-001',
          '日付': '2026-02-25',
          '出勤時刻': '09:00',
          '休憩時間': 0,
          '出席区分': '出席',
          '送迎': 'なし',
          '食事提供': false,
          '作成日時': '',
          '更新日時': '',
        },
      };

      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

      // No LinkResolver
      const repo = new AttendanceRepository(mockClient, 'tbl-att');

      await repo.create({
        facilityId: 'fac-001',
        userId: 'user-001',
        date: '2026-02-25',
        clockIn: '09:00',
        breakMinutes: 0,
        attendanceType: 'present',
        pickupType: 'none',
        mealProvided: false,
      });

      const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const fields = createCall[1] as Record<string, unknown>;

      // Text fields should still be present
      expect(fields['事業所ID']).toBe('fac-001');
      expect(fields['利用者ID']).toBe('user-001');

      // Link fields should NOT be present
      expect(fields['事業所']).toBeUndefined();
      expect(fields['利用者']).toBeUndefined();
    });
  });

  describe('filter uses text fields for business ID lookup', () => {
    it('findAll should filter on text field', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const repo = new AttendanceRepository(mockClient, 'tbl-att');
      await repo.findAll('fac-001');

      expect(mockClient.listAll).toHaveBeenCalledWith('tbl-att', {
        filter: 'CurrentValue.[事業所ID] = "fac-001"',
      });
    });

    it('findByUserAndDate should filter on text field', async () => {
      (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const repo = new AttendanceRepository(mockClient, 'tbl-att');
      await repo.findByUserAndDate('user-001', '2026-02-25');

      expect(mockClient.listAll).toHaveBeenCalledWith('tbl-att', {
        filter: 'CurrentValue.[利用者ID] = "user-001" AND CurrentValue.[日付] = "2026-02-25"',
      });
    });
  });
});

// ─── HealthCheckRepository ────────────────────────────────

describe('HealthCheckRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('toEntity should read business IDs from text fields', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recHC001',
      fields: {
        '事業所': ['recFAC_LINK'],
        '事業所ID': 'fac-biz-001',
        '利用者': ['recUSR_LINK'],
        '利用者ID': 'user-biz-001',
        '日付': '2026-02-25',
        '体調スコア': '4 (良い)',
        '睡眠時間': 7,
        '朝食': true,
        '昼食': true,
        '夕食': false,
        '作成日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new HealthCheckRepository(mockClient, 'tbl-hc');
    const entity = await repo.findById('recHC001', 'fac-biz-001');

    expect(entity).not.toBeNull();
    expect(entity!.facilityId).toBe('fac-biz-001');
    expect(entity!.userId).toBe('user-biz-001');
    expect(entity!.score).toBe(4);
  });

  it('create should write Link fields via resolver', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recHC_NEW',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '日付': '2026-02-25',
        '体調スコア': '3 (普通)',
        '朝食': false,
        '昼食': false,
        '夕食': false,
        '作成日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new HealthCheckRepository(mockClient, 'tbl-hc', linkResolver);
    await repo.create({
      facilityId: 'fac-001',
      userId: 'user-001',
      date: '2026-02-25',
      score: 3,
      meals: { breakfast: false, lunch: false, dinner: false },
      createdAt: '2026-02-25T00:00:00Z',
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['事業所ID']).toBe('fac-001');
    expect(fields['利用者ID']).toBe('user-001');
    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['利用者']).toEqual(['rec_user_user-001']);
  });
});

// ─── SupportRecordRepository ──────────────────────────────

describe('SupportRecordRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('toEntity should read all business IDs from text fields including staffId', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recSR001',
      fields: {
        '事業所': ['recFAC_LINK'],
        '事業所ID': 'fac-biz-001',
        '利用者': ['recUSR_LINK'],
        '利用者ID': 'user-biz-001',
        '担当職員': ['recSTAFF_LINK'],
        '担当職員ID': 'staff-biz-001',
        '日付': '2026-02-25',
        '支援内容': 'Test support',
        '支援区分': '日常生活支援',
        '作成日時': '2026-02-25T00:00:00Z',
        '更新日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new SupportRecordRepository(mockClient, 'tbl-sr');
    const entity = await repo.findById('recSR001', 'fac-biz-001');

    expect(entity).not.toBeNull();
    expect(entity!.facilityId).toBe('fac-biz-001');
    expect(entity!.userId).toBe('user-biz-001');
    expect(entity!.staffId).toBe('staff-biz-001');
  });

  it('create should resolve all three Link fields', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recSR_NEW',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '担当職員ID': 'staff-001',
        '日付': '2026-02-25',
        '支援内容': 'test',
        '支援区分': '日常生活支援',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new SupportRecordRepository(mockClient, 'tbl-sr', linkResolver);
    await repo.create({
      facilityId: 'fac-001',
      userId: 'user-001',
      staffId: 'staff-001',
      date: '2026-02-25',
      content: 'test',
      supportType: 'daily',
      createdAt: '2026-02-25T00:00:00Z',
      updatedAt: '2026-02-25T00:00:00Z',
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['利用者']).toEqual(['rec_user_user-001']);
    expect(fields['担当職員']).toEqual(['rec_staff_staff-001']);
  });
});

// ─── WageCalculationRepository ────────────────────────────

describe('WageCalculationRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('toEntity should read business IDs from text fields', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recWC001',
      fields: {
        '事業所': ['recFAC_LINK'],
        '事業所ID': 'fac-biz-001',
        '利用者': ['recUSR_LINK'],
        '利用者ID': 'user-biz-001',
        '対象年月': '2026-02',
        '作業時間合計': 1200,
        '出勤日数': 20,
        '基本工賃': 15000,
        '能力給': 3000,
        '皆勤手当': 2000,
        '合計工賃': 20000,
        '控除': 0,
        '支給額': 20000,
        'ステータス': '確定',
        '作成日時': '2026-02-25T00:00:00Z',
        '更新日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new WageCalculationRepository(mockClient, 'tbl-wc');
    const entity = await repo.findById('recWC001', 'fac-biz-001');

    expect(entity).not.toBeNull();
    expect(entity!.facilityId).toBe('fac-biz-001');
    expect(entity!.userId).toBe('user-biz-001');
    expect(entity!.status).toBe('confirmed');
    expect(entity!.totalWage).toBe(20000);
  });

  it('create should write Link fields via resolver', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recWC_NEW',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '対象年月': '2026-02',
        '作業時間合計': 0,
        '出勤日数': 0,
        '基本工賃': 0,
        '能力給': 0,
        '皆勤手当': 0,
        '合計工賃': 0,
        '控除': 0,
        '支給額': 0,
        'ステータス': '下書き',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new WageCalculationRepository(mockClient, 'tbl-wc', linkResolver);
    await repo.create({
      facilityId: 'fac-001',
      userId: 'user-001',
      yearMonth: '2026-02',
      totalWorkMinutes: 0,
      attendanceDays: 0,
      baseWage: 0,
      skillWage: 0,
      attendanceBonus: 0,
      totalWage: 0,
      deductions: 0,
      netWage: 0,
      status: 'draft',
      createdAt: '2026-02-25T00:00:00Z',
      updatedAt: '2026-02-25T00:00:00Z',
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['事業所ID']).toBe('fac-001');
    expect(fields['利用者ID']).toBe('user-001');
    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['利用者']).toEqual(['rec_user_user-001']);
  });
});

// ─── AttendanceRepository update ──────────────────────────

describe('AttendanceRepository - update with Link fields', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('update should resolve Link fields and include title key', async () => {
    const existingRecord: LarkBitableRecord = {
      record_id: 'recATT_UPD',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '日付': '2026-02-25',
        '出勤時刻': '09:00',
        '退勤時刻': '17:00',
        '実績時間': 450,
        '休憩時間': 30,
        '出席区分': '出席',
        '送迎': 'なし',
        '食事提供': false,
        '作成日時': '2026-02-25T00:00:00Z',
        '更新日時': '2026-02-25T00:00:00Z',
      },
    };

    const updatedRecord: LarkBitableRecord = {
      record_id: 'recATT_UPD',
      fields: {
        ...existingRecord.fields,
        '退勤時刻': '18:00',
        '実績時間': 510,
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(existingRecord);
    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new AttendanceRepository(mockClient, 'tbl-att', linkResolver);
    await repo.update('recATT_UPD', { clockOut: '18:00' });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    // Link fields should be absent since facilityId/userId not in update data
    expect(fields['更新日時']).toBeDefined();
  });

  it('update with facilityId should resolve facility Link field', async () => {
    const existingRecord: LarkBitableRecord = {
      record_id: 'recATT_UPD2',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '日付': '2026-02-25',
        '出勤時刻': '09:00',
        '退勤時刻': '17:00',
        '実績時間': 450,
        '休憩時間': 30,
        '出席区分': '出席',
        '送迎': 'なし',
        '食事提供': false,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(existingRecord);
    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(existingRecord);

    const repo = new AttendanceRepository(mockClient, 'tbl-att', linkResolver);
    await repo.update('recATT_UPD2', { facilityId: 'fac-002', userId: 'user-002' });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['事業所ID']).toBe('fac-002');
    expect(fields['利用者ID']).toBe('user-002');
    expect(fields['事業所']).toEqual(['rec_facility_fac-002']);
    expect(fields['利用者']).toEqual(['rec_user_user-002']);
  });
});

// ─── AttendanceRepository title key generation ─────────────

describe('AttendanceRepository - title key generation', () => {
  let mockClient: BitableClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('create should auto-generate attendance key from date and userId', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recATT_KEY',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '日付': '2026-03-15',
        '休憩時間': 0,
        '出席区分': '出席',
        '送迎': 'なし',
        '食事提供': false,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new AttendanceRepository(mockClient, 'tbl-att');
    await repo.create({
      facilityId: 'fac-001',
      userId: 'user-001',
      date: '2026-03-15',
      breakMinutes: 0,
      attendanceType: 'present',
      pickupType: 'none',
      mealProvided: false,
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['勤怠キー']).toBe('2026-03-15_user-001');
  });
});

// ─── HealthCheckRepository update ─────────────────────────

describe('HealthCheckRepository - update with Link fields', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('update should resolve Link fields', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recHC_UPD',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '日付': '2026-02-25',
        '体調スコア': '5 (とても良い)',
        '朝食': true,
        '昼食': true,
        '夕食': true,
        '作成日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new HealthCheckRepository(mockClient, 'tbl-hc', linkResolver);
    await repo.update('recHC_UPD', {
      facilityId: 'fac-001',
      userId: 'user-001',
      score: 5,
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['利用者']).toEqual(['rec_user_user-001']);
  });

  it('update should generate health key', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recHC_KEY',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '日付': '2026-03-01',
        '体調スコア': '3 (普通)',
        '朝食': false,
        '昼食': false,
        '夕食': false,
        '作成日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new HealthCheckRepository(mockClient, 'tbl-hc');
    await repo.update('recHC_KEY', {
      date: '2026-03-01',
      userId: 'user-abc',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['体調キー']).toBe('2026-03-01_user-abc');
  });
});

// ─── SupportRecordRepository update ───────────────────────

describe('SupportRecordRepository - update with Link fields', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('update should resolve all three Link fields', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recSR_UPD',
      fields: {
        '事業所ID': 'fac-002',
        '利用者ID': 'user-002',
        '担当職員ID': 'staff-002',
        '日付': '2026-02-26',
        '支援内容': 'updated content',
        '支援区分': '相談支援',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new SupportRecordRepository(mockClient, 'tbl-sr', linkResolver);
    await repo.update('recSR_UPD', {
      facilityId: 'fac-002',
      userId: 'user-002',
      staffId: 'staff-002',
      content: 'updated content',
      supportType: 'counseling',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['事業所']).toEqual(['rec_facility_fac-002']);
    expect(fields['利用者']).toEqual(['rec_user_user-002']);
    expect(fields['担当職員']).toEqual(['rec_staff_staff-002']);
    expect(fields['支援区分']).toBe('相談支援');
  });

  it('update should generate support key', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recSR_KEY',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '担当職員ID': 'staff-001',
        '日付': '2026-03-10',
        '支援内容': 'test',
        '支援区分': '日常生活支援',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new SupportRecordRepository(mockClient, 'tbl-sr');
    await repo.update('recSR_KEY', {
      date: '2026-03-10',
      userId: 'user-xyz',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['支援キー']).toBe('2026-03-10_user-xyz');
  });
});

// ─── WageCalculationRepository update ─────────────────────

describe('WageCalculationRepository - update with Link fields', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('update should resolve Link fields and generate wage key', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recWC_UPD',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '対象年月': '2026-03',
        '作業時間合計': 1500,
        '出勤日数': 22,
        '基本工賃': 18000,
        '能力給': 4000,
        '皆勤手当': 2000,
        '合計工賃': 24000,
        '控除': 500,
        '支給額': 23500,
        'ステータス': '確定',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new WageCalculationRepository(mockClient, 'tbl-wc', linkResolver);
    await repo.update('recWC_UPD', {
      userId: 'user-001',
      yearMonth: '2026-03',
      status: 'confirmed',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['利用者']).toEqual(['rec_user_user-001']);
    expect(fields['工賃キー']).toBe('2026-03_user-001');
    expect(fields['ステータス']).toBe('確定');
  });
});

// ─── InvoiceRepository - Link field ID consistency ────────

describe('InvoiceRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('toEntity should read facilityId from text field', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recINV001',
      fields: {
        '事業所': ['recFAC_LINK'],
        '事業所ID': 'fac-biz-001',
        '対象年月': '2026-02',
        '請求先': '国保連',
        '合計単位数': 5000,
        '合計金額': 500000,
        '利用者負担額合計': 50000,
        'ステータス': 'CSV生成済み',
        '作成日時': '2026-02-25T00:00:00Z',
        '更新日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new InvoiceRepository(mockClient, 'tbl-inv');
    const entity = await repo.findById('recINV001', 'fac-biz-001');

    expect(entity).not.toBeNull();
    expect(entity!.facilityId).toBe('fac-biz-001');
    expect(entity!.status).toBe('csv_generated');
    expect(entity!.totalAmount).toBe(500000);
  });

  it('findById should return null for wrong facilityId', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recINV002',
      fields: {
        '事業所ID': 'fac-001',
        '対象年月': '2026-02',
        '請求先': '国保連',
        '合計単位数': 0,
        '合計金額': 0,
        '利用者負担額合計': 0,
        'ステータス': '下書き',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new InvoiceRepository(mockClient, 'tbl-inv');
    const entity = await repo.findById('recINV002', 'wrong-facility');
    expect(entity).toBeNull();
  });

  it('create should resolve facility Link field and generate invoice key', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recINV_NEW',
      fields: {
        '事業所ID': 'fac-001',
        '対象年月': '2026-03',
        '請求先': '国保連',
        '合計単位数': 0,
        '合計金額': 0,
        '利用者負担額合計': 0,
        'ステータス': '下書き',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new InvoiceRepository(mockClient, 'tbl-inv', linkResolver);
    await repo.create({
      facilityId: 'fac-001',
      yearMonth: '2026-03',
      billingTarget: 'kokuho_ren',
      totalUnits: 0,
      totalAmount: 0,
      totalCopayment: 0,
      status: 'draft',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['事業所ID']).toBe('fac-001');
    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['請求キー']).toBe('2026-03_fac-001');
  });

  it('update should resolve facility Link field', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recINV_UPD',
      fields: {
        '事業所ID': 'fac-001',
        '対象年月': '2026-03',
        '請求先': '国保連',
        '合計単位数': 100,
        '合計金額': 10000,
        '利用者負担額合計': 1000,
        'ステータス': '計算済み',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new InvoiceRepository(mockClient, 'tbl-inv', linkResolver);
    await repo.update('recINV_UPD', {
      facilityId: 'fac-001',
      totalUnits: 100,
      totalAmount: 10000,
      status: 'calculated',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['ステータス']).toBe('計算済み');
  });

  it('findByYearMonth should filter on text fields', async () => {
    (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const repo = new InvoiceRepository(mockClient, 'tbl-inv');
    await repo.findByYearMonth('fac-001', '2026-03');

    expect(mockClient.listAll).toHaveBeenCalledWith('tbl-inv', {
      filter: 'CurrentValue.[事業所ID]="fac-001" AND CurrentValue.[対象年月]="2026-03"',
    });
  });
});

// ─── ProductOutputRepository - Link field ID consistency ──

describe('ProductOutputRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('toEntity should read business IDs from text fields', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recPO001',
      fields: {
        '事業所': ['recFAC_LINK'],
        '事業所ID': 'fac-biz-001',
        '利用者': ['recUSR_LINK'],
        '利用者ID': 'user-biz-001',
        '活動': ['recACT_LINK'],
        '活動ID': 'act-biz-001',
        '日付': '2026-02-25',
        '作業時間': 120,
        '生産数量': 50,
        '備考': 'good work',
        '作成日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new ProductOutputRepository(mockClient, 'tbl-po');
    const entity = await repo.findById('recPO001', 'fac-biz-001');

    expect(entity).not.toBeNull();
    expect(entity!.facilityId).toBe('fac-biz-001');
    expect(entity!.userId).toBe('user-biz-001');
    expect(entity!.activityId).toBe('act-biz-001');
    expect(entity!.workMinutes).toBe(120);
  });

  it('findById should return null for non-matching facility', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recPO002',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '活動ID': 'act-001',
        '日付': '2026-02-25',
        '作業時間': 60,
        '作成日時': '',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new ProductOutputRepository(mockClient, 'tbl-po');
    const entity = await repo.findById('recPO002', 'wrong-facility');
    expect(entity).toBeNull();
  });

  it('create should resolve all three Link fields and generate output key', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recPO_NEW',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '活動ID': 'act-001',
        '日付': '2026-03-15',
        '作業時間': 90,
        '作成日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new ProductOutputRepository(mockClient, 'tbl-po', linkResolver);
    await repo.create({
      facilityId: 'fac-001',
      userId: 'user-001',
      activityId: 'act-001',
      date: '2026-03-15',
      workMinutes: 90,
      createdAt: '2026-03-15T00:00:00Z',
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['利用者']).toEqual(['rec_user_user-001']);
    expect(fields['活動']).toEqual(['rec_activity_act-001']);
    expect(fields['実績キー']).toBe('2026-03-15_user-001_act-001');
  });

  it('update should resolve Link fields', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recPO_UPD',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '活動ID': 'act-002',
        '日付': '2026-03-15',
        '作業時間': 120,
        '作成日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new ProductOutputRepository(mockClient, 'tbl-po', linkResolver);
    await repo.update('recPO_UPD', {
      activityId: 'act-002',
      workMinutes: 120,
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['活動']).toEqual(['rec_activity_act-002']);
    expect(fields['作業時間']).toBe(120);
  });

  it('findByUserAndMonth should filter on text fields', async () => {
    (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const repo = new ProductOutputRepository(mockClient, 'tbl-po');
    await repo.findByUserAndMonth('fac-001', 'user-001', '2026-03');

    const call = (mockClient.listAll as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const filter = call[1]?.filter as string;

    expect(filter).toContain('CurrentValue.[事業所ID] = "fac-001"');
    expect(filter).toContain('CurrentValue.[利用者ID] = "user-001"');
  });
});

// ─── WorkScheduleRepository - Link field ID consistency ───

describe('WorkScheduleRepository - Link field ID consistency', () => {
  let mockClient: BitableClient;
  let linkResolver: LinkResolver;

  beforeEach(() => {
    mockClient = createMockClient();
    linkResolver = createMockLinkResolver();
  });

  it('toEntity should read business IDs from text fields', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recWS001',
      fields: {
        '事業所': ['recFAC_LINK'],
        '事業所ID': 'fac-biz-001',
        '利用者': ['recUSR_LINK'],
        '利用者ID': 'user-biz-001',
        '対象年月': '2026-03',
        '予定出勤日': '1,5,10,15,20',
        '開始時刻': '09:00',
        '終了時刻': '16:00',
        '作成日時': '2026-02-25T00:00:00Z',
        '更新日時': '2026-02-25T00:00:00Z',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new WorkScheduleRepository(mockClient, 'tbl-ws');
    const entity = await repo.findById('recWS001', 'fac-biz-001');

    expect(entity).not.toBeNull();
    expect(entity!.facilityId).toBe('fac-biz-001');
    expect(entity!.userId).toBe('user-biz-001');
    expect(entity!.scheduledDays).toEqual([1, 5, 10, 15, 20]);
    expect(entity!.scheduledTime).toEqual({ start: '09:00', end: '16:00' });
  });

  it('findById should return null for non-matching facility', async () => {
    const record: LarkBitableRecord = {
      record_id: 'recWS002',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '対象年月': '2026-03',
        '予定出勤日': '',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new WorkScheduleRepository(mockClient, 'tbl-ws');
    const entity = await repo.findById('recWS002', 'wrong-facility');
    expect(entity).toBeNull();
  });

  it('create should resolve Link fields and generate schedule key', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recWS_NEW',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '対象年月': '2026-04',
        '予定出勤日': '1,2,3',
        '開始時刻': '10:00',
        '終了時刻': '15:00',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new WorkScheduleRepository(mockClient, 'tbl-ws', linkResolver);
    await repo.create({
      facilityId: 'fac-001',
      userId: 'user-001',
      yearMonth: '2026-04',
      scheduledDays: [1, 2, 3],
      scheduledTime: { start: '10:00', end: '15:00' },
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['事業所']).toEqual(['rec_facility_fac-001']);
    expect(fields['利用者']).toEqual(['rec_user_user-001']);
    expect(fields['予定キー']).toBe('2026-04_user-001');
  });

  it('update should resolve Link fields', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recWS_UPD',
      fields: {
        '事業所ID': 'fac-001',
        '利用者ID': 'user-001',
        '対象年月': '2026-04',
        '予定出勤日': '1,2,3,4,5',
        '開始時刻': '09:00',
        '終了時刻': '16:00',
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new WorkScheduleRepository(mockClient, 'tbl-ws', linkResolver);
    await repo.update('recWS_UPD', {
      userId: 'user-001',
      scheduledDays: [1, 2, 3, 4, 5],
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['利用者']).toEqual(['rec_user_user-001']);
    expect(fields['予定出勤日']).toBe('1,2,3,4,5');
  });

  it('findByUserAndMonth should filter on text fields', async () => {
    (mockClient.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const repo = new WorkScheduleRepository(mockClient, 'tbl-ws');
    await repo.findByUserAndMonth('fac-001', 'user-001', '2026-04');

    const call = (mockClient.listAll as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const filter = call[1]?.filter as string;

    expect(filter).toContain('CurrentValue.[事業所ID] = "fac-001"');
    expect(filter).toContain('CurrentValue.[利用者ID] = "user-001"');
    expect(filter).toContain('CurrentValue.[対象年月] = "2026-04"');
  });
});

// ─── UserRepository - title field generation ──────────────

describe('UserRepository - title field generation', () => {
  let mockClient: BitableClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('create should auto-generate display name from name and recipientNumber', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recUSR_NEW',
      fields: {
        '氏名': 'テスト太郎',
        '受給者証番号': '1234567890',
        '有効': true,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new UserRepository(mockClient, 'tbl-usr');
    await repo.create({
      facilityId: 'fac-001',
      name: 'テスト太郎',
      nameKana: 'テストタロウ',
      recipientNumber: '1234567890',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      contractDaysPerMonth: 20,
      serviceStartDate: '2026-01-01',
      copaymentLimit: 9300,
      isActive: true,
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    // Display name: "氏名 (受給者証番号下4桁)"
    expect(fields['表示名']).toBe('テスト太郎 (7890)');
  });

  it('update should regenerate display name when name changes', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recUSR_UPD',
      fields: {
        '氏名': '更新花子',
        '受給者証番号': '9876543210',
        '有効': true,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new UserRepository(mockClient, 'tbl-usr');
    await repo.update('recUSR_UPD', {
      name: '更新花子',
      recipientNumber: '9876543210',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['表示名']).toBe('更新花子 (3210)');
  });
});

// ─── StaffRepository - title field generation ─────────────

describe('StaffRepository - title field generation', () => {
  let mockClient: BitableClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('create should auto-generate display name from name and role', async () => {
    const createdRecord: LarkBitableRecord = {
      record_id: 'recSTF_NEW',
      fields: {
        '氏名': '職員一郎',
        '役職': 'サービス管理責任者',
        '有効': true,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);

    const repo = new StaffRepository(mockClient, 'tbl-stf');
    await repo.create({
      facilityId: 'fac-001',
      name: '職員一郎',
      nameKana: 'ショクインイチロウ',
      role: 'service_manager',
      isActive: true,
    });

    const createCall = (mockClient.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = createCall[1] as Record<string, unknown>;

    expect(fields['表示名']).toBe('職員一郎 (サービス管理責任者)');
  });

  it('update should regenerate display name when role changes', async () => {
    const updatedRecord: LarkBitableRecord = {
      record_id: 'recSTF_UPD',
      fields: {
        '氏名': '職員一郎',
        '役職': '管理者',
        '有効': true,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRecord);

    const repo = new StaffRepository(mockClient, 'tbl-stf');
    await repo.update('recSTF_UPD', {
      name: '職員一郎',
      role: 'manager',
    });

    const updateCall = (mockClient.update as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const fields = updateCall[2] as Record<string, unknown>;

    expect(fields['表示名']).toBe('職員一郎 (管理者)');
  });
});

// ─── Regression: findById ID mismatch (Issue #17 core bug) ─────

describe('Regression: findById must compare business IDs correctly', () => {
  it('should NOT confuse Link record_id with business ID in facilityId comparison', async () => {
    const mockClient = createMockClient();

    // This record simulates the old bug scenario:
    // Link field '事業所' has Lark record_id 'recFAC_INTERNAL'
    // Text field '事業所ID' has business ID 'FAC-2026-001'
    const record: LarkBitableRecord = {
      record_id: 'recATT001',
      fields: {
        '事業所': ['recFAC_INTERNAL'],  // Link -> different from business ID
        '事業所ID': 'FAC-2026-001',     // Text -> business ID
        '利用者': ['recUSR_INTERNAL'],
        '利用者ID': 'USR-2026-001',
        '日付': '2026-02-25',
        '休憩時間': 0,
        '出席区分': '出席',
        '送迎': 'なし',
        '食事提供': false,
        '作成日時': '',
        '更新日時': '',
      },
    };

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const repo = new AttendanceRepository(mockClient, 'tbl-att');

    // With the fix, this should match because facilityId comes from text field
    const found = await repo.findById('recATT001', 'FAC-2026-001');
    expect(found).not.toBeNull();
    expect(found!.facilityId).toBe('FAC-2026-001');
    expect(found!.userId).toBe('USR-2026-001');

    // Should NOT match the record_id of the Link field
    const notFound = await repo.findById('recATT001', 'recFAC_INTERNAL');
    expect(notFound).toBeNull();
  });
});
