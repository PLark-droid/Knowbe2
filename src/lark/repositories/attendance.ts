/**
 * AttendanceRepository - 勤怠記録
 */

import type { Attendance, AttendanceType, PickupType } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';

function timeToMinutes(time: string): number {
  const [hStr, mStr] = time.split(':');
  return Number(hStr) * 60 + Number(mStr);
}

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

function getLinkId(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return first != null ? String(first) : '';
  }
  return value != null ? String(value) : '';
}

function toLinkValue(id: string | undefined): string[] | undefined {
  if (!id) return undefined;
  return [id];
}

function toAttendanceType(raw: unknown): AttendanceType {
  const s = String(raw ?? '出席');
  const map: Record<string, AttendanceType> = {
    出席: 'present',
    欠席: 'absent',
    '欠席(連絡あり)': 'absent_notified',
    祝日: 'holiday',
    休暇: 'leave',
    present: 'present',
    absent: 'absent',
    absent_notified: 'absent_notified',
    holiday: 'holiday',
    leave: 'leave',
  };
  return map[s] ?? 'present';
}

function toAttendanceTypeLabel(value: AttendanceType): string {
  const map: Record<AttendanceType, string> = {
    present: '出席',
    absent: '欠席',
    absent_notified: '欠席(連絡あり)',
    holiday: '祝日',
    leave: '休暇',
  };
  return map[value];
}

function toPickupType(raw: unknown): PickupType {
  const s = String(raw ?? 'なし');
  const map: Record<string, PickupType> = {
    なし: 'none',
    迎えのみ: 'pickup_only',
    送りのみ: 'dropoff_only',
    送迎: 'both',
    none: 'none',
    pickup_only: 'pickup_only',
    dropoff_only: 'dropoff_only',
    both: 'both',
  };
  return map[s] ?? 'none';
}

function toPickupTypeLabel(value: PickupType): string {
  const map: Record<PickupType, string> = {
    none: 'なし',
    pickup_only: '迎えのみ',
    dropoff_only: '送りのみ',
    both: '送迎',
  };
  return map[value];
}

/**
 * Link型フィールド ('事業所', '利用者') からは record_id を取得しドメインIDとして使用。
 * フィルタ検索にはテキスト型の '事業所ID' / '利用者ID' フィールドを使用
 * (Link型フィールドは CurrentValue フィルタで直接検索できないため)。
 * toFields では Link値とテキストID両方を書き込み、データ整合性を保つ。
 */
function toEntity(record: LarkBitableRecord): Attendance {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: getLinkId(f['事業所']),
    userId: getLinkId(f['利用者']),
    date: String(f['日付'] ?? ''),
    clockIn: f['出勤時刻'] ? String(f['出勤時刻']) : undefined,
    clockOut: f['退勤時刻'] ? String(f['退勤時刻']) : undefined,
    actualMinutes: f['実績時間'] != null ? Number(f['実績時間']) : undefined,
    breakMinutes: Number(f['休憩時間'] ?? 0),
    attendanceType: toAttendanceType(f['出席区分']),
    pickupType: toPickupType(f['送迎']),
    mealProvided: Boolean(f['食事提供']),
    note: f['備考'] ? String(f['備考']) : undefined,
    createdAt: String(f['作成日時'] ?? ''),
    updatedAt: String(f['更新日時'] ?? ''),
  };
}

function toFields(entity: Partial<Attendance>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields['事業所'] = toLinkValue(entity.facilityId);
    fields['事業所ID'] = entity.facilityId; // テキスト型 (フィルタ検索用)
  }
  if (entity.userId !== undefined) {
    fields['利用者'] = toLinkValue(entity.userId);
    fields['利用者ID'] = entity.userId; // テキスト型 (フィルタ検索用)
  }
  if (entity.date !== undefined) fields['日付'] = entity.date;
  if (entity.clockIn !== undefined) fields['出勤時刻'] = entity.clockIn;
  if (entity.clockOut !== undefined) fields['退勤時刻'] = entity.clockOut;
  if (entity.actualMinutes !== undefined) fields['実績時間'] = entity.actualMinutes;
  if (entity.breakMinutes !== undefined) fields['休憩時間'] = entity.breakMinutes;
  if (entity.attendanceType !== undefined) fields['出席区分'] = toAttendanceTypeLabel(entity.attendanceType);
  if (entity.pickupType !== undefined) fields['送迎'] = toPickupTypeLabel(entity.pickupType);
  if (entity.mealProvided !== undefined) fields['食事提供'] = entity.mealProvided;
  if (entity.note !== undefined) fields['備考'] = entity.note;

  // タイトル列: 勤怠キーを自動生成 (日付_利用者表示名 or 日付_userId)
  if (entity.date !== undefined || entity.userId !== undefined) {
    const date = entity.date ?? '';
    const userKey = entity.userId ?? '';
    fields['勤怠キー'] = `${date}_${userKey}`;
  }

  return fields;
}

export class AttendanceRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
  ) {}

  async findAll(facilityId: string): Promise<Attendance[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[事業所ID] = "${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<Attendance | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async findByUserAndDate(userId: string, date: string): Promise<Attendance | null> {
    const records = await this.client.listAll(this.tableId, {
      filter:
        `CurrentValue.[利用者ID] = "${sanitizeLarkFilterValue(userId)}"` +
        ` AND CurrentValue.[日付] = "${sanitizeLarkFilterValue(date)}"`,
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async create(
    data: Omit<Attendance, 'id' | 'actualMinutes' | 'createdAt' | 'updatedAt'>,
  ): Promise<Attendance> {
    const existing = await this.findByUserAndDate(data.userId, data.date);
    if (existing) {
      throw new Error(
        `Attendance record already exists for userId=${data.userId} on date=${data.date} (recordId=${existing.id})`,
      );
    }

    const actualMinutes = calculateActualMinutes(data.clockIn, data.clockOut, data.breakMinutes);
    const fields = toFields({ ...data, actualMinutes });
    fields['作成日時'] = new Date().toISOString();
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<Attendance>): Promise<Attendance> {
    if (data.clockIn !== undefined || data.clockOut !== undefined || data.breakMinutes !== undefined) {
      const currentRecord = await this.client.get(this.tableId, id);
      const current = toEntity(currentRecord);
      data = {
        ...data,
        actualMinutes: calculateActualMinutes(
          data.clockIn ?? current.clockIn,
          data.clockOut ?? current.clockOut,
          data.breakMinutes ?? current.breakMinutes,
        ),
      };
    }

    const fields = toFields(data);
    fields['更新日時'] = new Date().toISOString();
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
