/**
 * E2E Flow Test: Attendance (LINE -> Webhook -> Lark Base mock -> LINE reply)
 *
 * createAttendanceHandler に mock deps を注入して、
 * 出勤 / 退勤 / 未登録ユーザー / 重複出勤 / 出勤なし退勤 の5フローを検証する。
 */
import type { Attendance, AttendanceType, PickupType } from '../../src/types/domain.js';
import {
  createAttendanceHandler,
  type AttendanceDeps,
} from '../../src/webhook/handlers/line-attendance.js';

// ─── Helpers ─────────────────────────────────────────────

/** 基本的な Attendance レコードを生成する */
function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 'att-001',
    facilityId: 'fac-001',
    userId: 'user-001',
    date: '2026-02-25',
    clockIn: undefined,
    clockOut: undefined,
    actualMinutes: undefined,
    breakMinutes: 0,
    attendanceType: 'present' as AttendanceType,
    pickupType: 'none' as PickupType,
    mealProvided: false,
    createdAt: '2026-02-25T00:00:00.000Z',
    updatedAt: '2026-02-25T00:00:00.000Z',
    ...overrides,
  };
}

const TEST_USER = { id: 'user-001', facilityId: 'fac-001', name: 'Test Taro' };
const REPLY_TOKEN = 'reply-token-abc';

/** deps の共通モックを生成する */
function createMockDeps(overrides: Partial<AttendanceDeps> = {}): AttendanceDeps {
  return {
    findUserByLineId: vi.fn<AttendanceDeps['findUserByLineId']>().mockResolvedValue(TEST_USER),
    findAttendance: vi.fn<AttendanceDeps['findAttendance']>().mockResolvedValue(null),
    createAttendance: vi.fn<AttendanceDeps['createAttendance']>().mockResolvedValue(
      makeAttendance({ clockIn: '09:00' }),
    ),
    updateAttendance: vi.fn<AttendanceDeps['updateAttendance']>().mockResolvedValue(
      makeAttendance({ clockIn: '09:00', clockOut: '17:00' }),
    ),
    replyMessage: vi.fn<AttendanceDeps['replyMessage']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('E2E: Attendance Flow', () => {
  // ── 1. 出勤打刻フロー ──────────────────────────────────
  describe('clock-in flow', () => {
    it('should create attendance and reply greeting when no existing record', async () => {
      const deps = createMockDeps();
      const handler = createAttendanceHandler(deps);

      await handler('line-user-001', 'action=clock_in', REPLY_TOKEN);

      // UserRepo 検索
      expect(deps.findUserByLineId).toHaveBeenCalledWith('line-user-001');

      // 既存勤怠の検索 (null が返るので新規作成)
      expect(deps.findAttendance).toHaveBeenCalledWith('user-001', expect.any(String));

      // 新規レコード作成
      expect(deps.createAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          facilityId: 'fac-001',
          userId: 'user-001',
          attendanceType: 'present',
        }),
      );

      // LINE reply
      expect(deps.replyMessage).toHaveBeenCalledWith(
        REPLY_TOKEN,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Test Taro'),
          }),
        ]),
      );
    });
  });

  // ── 2. 退勤打刻フロー ──────────────────────────────────
  describe('clock-out flow', () => {
    it('should update attendance with clockOut and reply farewell', async () => {
      const existingAttendance = makeAttendance({ clockIn: '09:00' });
      const deps = createMockDeps({
        findAttendance: vi.fn<AttendanceDeps['findAttendance']>().mockResolvedValue(existingAttendance),
      });
      const handler = createAttendanceHandler(deps);

      await handler('line-user-001', 'action=clock_out', REPLY_TOKEN);

      // 既存勤怠の検索
      expect(deps.findAttendance).toHaveBeenCalledWith('user-001', expect.any(String));

      // 退勤時刻の更新
      expect(deps.updateAttendance).toHaveBeenCalledWith(
        'att-001',
        expect.objectContaining({ clockOut: expect.any(String) }),
      );

      // LINE reply (farewell)
      expect(deps.replyMessage).toHaveBeenCalledWith(
        REPLY_TOKEN,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Test Taro'),
          }),
        ]),
      );
    });
  });

  // ── 3. 未登録ユーザーの打刻 ────────────────────────────
  describe('unregistered user', () => {
    it('should reply error message when user is not found', async () => {
      const deps = createMockDeps({
        findUserByLineId: vi.fn<AttendanceDeps['findUserByLineId']>().mockResolvedValue(null),
      });
      const handler = createAttendanceHandler(deps);

      await handler('unknown-line-user', 'action=clock_in', REPLY_TOKEN);

      // ユーザー検索のみ実行
      expect(deps.findUserByLineId).toHaveBeenCalledWith('unknown-line-user');

      // 勤怠操作は呼ばれない
      expect(deps.findAttendance).not.toHaveBeenCalled();
      expect(deps.createAttendance).not.toHaveBeenCalled();
      expect(deps.updateAttendance).not.toHaveBeenCalled();

      // エラーメッセージ返信
      expect(deps.replyMessage).toHaveBeenCalledWith(
        REPLY_TOKEN,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('利用者情報が見つかりません'),
          }),
        ]),
      );
    });
  });

  // ── 4. 重複出勤チェック ────────────────────────────────
  describe('duplicate clock-in', () => {
    it('should reply error when already clocked in', async () => {
      const existingAttendance = makeAttendance({ clockIn: '09:00' });
      const deps = createMockDeps({
        findAttendance: vi.fn<AttendanceDeps['findAttendance']>().mockResolvedValue(existingAttendance),
      });
      const handler = createAttendanceHandler(deps);

      await handler('line-user-001', 'action=clock_in', REPLY_TOKEN);

      // 新規作成も更新もされない
      expect(deps.createAttendance).not.toHaveBeenCalled();
      expect(deps.updateAttendance).not.toHaveBeenCalled();

      // エラーメッセージ返信
      expect(deps.replyMessage).toHaveBeenCalledWith(
        REPLY_TOKEN,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('すでに出勤済み'),
          }),
        ]),
      );
    });
  });

  // ── 5. 出勤なしの退勤 ─────────────────────────────────
  describe('clock-out without clock-in', () => {
    it('should reply error when no clock-in record exists', async () => {
      // findAttendance returns null (no attendance record at all)
      const deps = createMockDeps({
        findAttendance: vi.fn<AttendanceDeps['findAttendance']>().mockResolvedValue(null),
      });
      const handler = createAttendanceHandler(deps);

      await handler('line-user-001', 'action=clock_out', REPLY_TOKEN);

      // 更新は呼ばれない
      expect(deps.updateAttendance).not.toHaveBeenCalled();

      // エラーメッセージ返信
      expect(deps.replyMessage).toHaveBeenCalledWith(
        REPLY_TOKEN,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('出勤記録がありません'),
          }),
        ]),
      );
    });

    it('should reply error when attendance record exists but has no clockIn', async () => {
      // Record exists but clockIn is undefined
      const existingAttendance = makeAttendance({ clockIn: undefined });
      const deps = createMockDeps({
        findAttendance: vi.fn<AttendanceDeps['findAttendance']>().mockResolvedValue(existingAttendance),
      });
      const handler = createAttendanceHandler(deps);

      await handler('line-user-001', 'action=clock_out', REPLY_TOKEN);

      expect(deps.updateAttendance).not.toHaveBeenCalled();
      expect(deps.replyMessage).toHaveBeenCalledWith(
        REPLY_TOKEN,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('出勤記録がありません'),
          }),
        ]),
      );
    });
  });
});
