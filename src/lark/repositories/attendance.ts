/**
 * AttendanceRepository - 勤怠記録
 * 重複チェック・実績時間自動計算対応
 */

import type {
  Attendance,
  AttendanceType,
  PickupType,
} from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

// ─── Helpers ────────────────────────────────────────────

/**
 * HH:mm 形式の時刻文字列を当日0時からの分数に変換する。
 * 不正な値は NaN を返す。
 */
function timeToMinutes(time: string): number {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  return h * 60 + m;
}

/**
 * clockIn / clockOut / breakMinutes から実績時間 (分) を計算する。
 * いずれかの値が不正・未指定の場合は undefined を返す。
 */
function calculateActualMinutes(
  clockIn: string | undefined,
  clockOut: string | undefined,
  breakMinutes: number,
): number | undefined {
  if (!clockIn || !clockOut) return undefined;
  const inMin = timeToMinutes(clockIn);
  const outMin = timeToMinutes(clockOut);
  if (Number.isNaN(inMin) || Number.isNaN(outMin)) return undefined;
  const diff = outMin - inMin - breakMinutes;
  return diff > 0 ? diff : 0;
}

// ─── Field Mapping (Japanese ↔ Entity) ──────────────────

function toEntity(record: LarkBitableRecord): Attendance {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f['事業所ID'] ?? ''),
    userId: String(f['利用者ID'] ?? ''),
    date: String(f['日付'] ?? ''),
    clockIn: f['出勤時刻'] ? String(f['出勤時刻']) : undefined,
    clockOut: f['退勤時刻'] ? String(f['退勤時刻']) : undefined,
    actualMinutes: f['実績時間'] != null ? Number(f['実績時間']) : undefined,
    breakMinutes: Number(f['休憩時間'] ?? 0),
    attendanceType: String(f['出席区分'] ?? 'present') as AttendanceType,
    pickupType: String(f['送迎'] ?? 'none') as PickupType,
    mealProvided: Boolean(f['食事提供']),
    note: f['備考'] ? String(f['備考']) : undefined,
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<Attendance>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) fields['事業所ID'] = entity.facilityId;
  if (entity.userId !== undefined) fields['利用者ID'] = entity.userId;
  if (entity.date !== undefined) fields['日付'] = entity.date;
  if (entity.clockIn !== undefined) fields['出勤時刻'] = entity.clockIn;
  if (entity.clockOut !== undefined) fields['退勤時刻'] = entity.clockOut;
  if (entity.actualMinutes !== undefined) fields['実績時間'] = entity.actualMinutes;
  if (entity.breakMinutes !== undefined) fields['休憩時間'] = entity.breakMinutes;
  if (entity.attendanceType !== undefined) fields['出席区分'] = entity.attendanceType;
  if (entity.pickupType !== undefined) fields['送迎'] = entity.pickupType;
  if (entity.mealProvided !== undefined) fields['食事提供'] = entity.mealProvided;
  if (entity.note !== undefined) fields['備考'] = entity.note;
  return fields;
}

// ─── Repository ─────────────────────────────────────────

export class AttendanceRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  /** 事業所IDで全勤怠取得 */
  async findAll(facilityId: string): Promise<Attendance[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  /** レコードIDで1件取得 */
  async findById(id: string, expectedFacilityId: string): Promise<Attendance | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    if (entity.facilityId !== expectedFacilityId) {
      return null;
    }
    return entity;
  }

  /**
   * 利用者ID + 日付で検索 (重複チェック用)
   * 同一利用者・同一日の勤怠が既に存在するか確認する。
   */
  async findByUserAndDate(userId: string, date: string): Promise<Attendance | null> {
    const records = await this.client.listAll(this.tableId, {
      filter: `AND(CurrentValue.[利用者ID] = "${sanitizeLarkFilterValue(userId)}", CurrentValue.[日付] = "${sanitizeLarkFilterValue(date)}")`,
    });
    const first = records[0];
    return first ? toEntity(first) : null;
  }

  /**
   * 新規作成
   * clockIn / clockOut が指定されている場合、actualMinutes を自動計算する。
   * 同一利用者・同一日の重複レコードが存在する場合はエラーをスローする。
   */
  async create(
    data: Omit<Attendance, 'id' | 'actualMinutes' | 'createdAt' | 'updatedAt'>,
  ): Promise<Attendance> {
    // 重複チェック
    const existing = await this.findByUserAndDate(data.userId, data.date);
    if (existing) {
      throw new Error(
        `Attendance record already exists for userId=${data.userId} on date=${data.date} (recordId=${existing.id})`,
      );
    }

    // actualMinutes 自動計算
    const actualMinutes = calculateActualMinutes(
      data.clockIn,
      data.clockOut,
      data.breakMinutes,
    );

    const fields = toFields({ ...data, actualMinutes });
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  /**
   * 更新
   * clockIn / clockOut / breakMinutes が含まれる場合、actualMinutes を再計算する。
   */
  async update(id: string, data: Partial<Attendance>): Promise<Attendance> {
    // clockIn/clockOut/breakMinutes が更新される場合、actualMinutes を再計算
    if (data.clockIn !== undefined || data.clockOut !== undefined || data.breakMinutes !== undefined) {
      const currentRecord = await this.client.get(this.tableId, id);
      const current = toEntity(currentRecord);
      const clockIn = data.clockIn ?? current.clockIn;
      const clockOut = data.clockOut ?? current.clockOut;
      const breakMinutes = data.breakMinutes ?? current.breakMinutes;
      data = {
        ...data,
        actualMinutes: calculateActualMinutes(clockIn, clockOut, breakMinutes),
      };
    }

    const fields = toFields(data);
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  /** 削除 */
  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
