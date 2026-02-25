/**
 * LINE勤怠ポストバックハンドラー
 * 出退勤打刻処理 (action=clock_in / action=clock_out)
 */
import type { Attendance, AttendanceType, PickupType } from '../../types/domain.js';
import { nowJST, formatDate } from '../../utils/datetime.js';

export interface AttendanceDeps {
  findUserByLineId: (
    lineUserId: string,
  ) => Promise<{ id: string; facilityId: string; name: string } | null>;
  findAttendance: (userId: string, date: string) => Promise<Attendance | null>;
  createAttendance: (
    data: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<Attendance>;
  updateAttendance: (
    id: string,
    data: Partial<Attendance>,
  ) => Promise<Attendance>;
  replyMessage: (replyToken: string, messages: unknown[]) => Promise<void>;
}

function getCurrentTimeString(now: Date): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function createAttendanceHandler(deps: AttendanceDeps) {
  return async (
    lineUserId: string,
    postbackData: string,
    replyToken: string,
  ): Promise<void> => {
    // Parse postback data
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');

    const user = await deps.findUserByLineId(lineUserId);
    if (!user) {
      await deps.replyMessage(replyToken, [
        {
          type: 'text',
          text: '利用者情報が見つかりません。管理者にお問い合わせください。',
        },
      ]);
      return;
    }

    const now = nowJST();
    const today = formatDate(now);
    const timeStr = getCurrentTimeString(now);

    if (action === 'clock_in') {
      await handleClockIn(deps, user, today, timeStr, replyToken);
    } else if (action === 'clock_out') {
      await handleClockOut(deps, user, today, timeStr, replyToken);
    }
  };
}

async function handleClockIn(
  deps: AttendanceDeps,
  user: { id: string; facilityId: string; name: string },
  today: string,
  timeStr: string,
  replyToken: string,
): Promise<void> {
  const existing = await deps.findAttendance(user.id, today);

  if (existing?.clockIn) {
    await deps.replyMessage(replyToken, [
      {
        type: 'text',
        text: `本日はすでに出勤済みです (${existing.clockIn})`,
      },
    ]);
    return;
  }

  if (existing) {
    await deps.updateAttendance(existing.id, { clockIn: timeStr });
  } else {
    await deps.createAttendance({
      facilityId: user.facilityId,
      userId: user.id,
      date: today,
      clockIn: timeStr,
      attendanceType: 'present' as AttendanceType,
      breakMinutes: 0,
      pickupType: 'none' as PickupType,
      mealProvided: false,
    });
  }

  await deps.replyMessage(replyToken, [
    {
      type: 'text',
      text: `${user.name}さん、おはようございます！\n出勤: ${timeStr}`,
    },
  ]);
}

async function handleClockOut(
  deps: AttendanceDeps,
  user: { id: string; facilityId: string; name: string },
  today: string,
  timeStr: string,
  replyToken: string,
): Promise<void> {
  const existing = await deps.findAttendance(user.id, today);

  if (!existing?.clockIn) {
    await deps.replyMessage(replyToken, [
      {
        type: 'text',
        text: '本日の出勤記録がありません。先に出勤打刻を行ってください。',
      },
    ]);
    return;
  }

  if (existing.clockOut) {
    await deps.replyMessage(replyToken, [
      {
        type: 'text',
        text: `本日はすでに退勤済みです (${existing.clockOut})`,
      },
    ]);
    return;
  }

  await deps.updateAttendance(existing.id, { clockOut: timeStr });

  await deps.replyMessage(replyToken, [
    {
      type: 'text',
      text: `${user.name}さん、お疲れ様でした！\n退勤: ${timeStr}`,
    },
  ]);
}
