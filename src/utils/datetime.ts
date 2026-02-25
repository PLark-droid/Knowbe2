/**
 * 日時ユーティリティ — 営業日計算、JST対応
 */

const JST_OFFSET = 9 * 60 * 60 * 1000;

/** 日本の祝日 (年ごとにキャッシュ) */
const NATIONAL_HOLIDAYS: Record<number, Set<string>> = {};

/**
 * 指定年の国民の祝日を生成 (固定祝日 + ハッピーマンデー)
 */
function generateHolidays(year: number): Set<string> {
  if (NATIONAL_HOLIDAYS[year]) return NATIONAL_HOLIDAYS[year]!;

  const holidays = new Set<string>();

  // 固定祝日
  const fixed: [number, number][] = [
    [1, 1],   // 元日
    [2, 11],  // 建国記念の日
    [2, 23],  // 天皇誕生日
    [4, 29],  // 昭和の日
    [5, 3],   // 憲法記念日
    [5, 4],   // みどりの日
    [5, 5],   // こどもの日
    [8, 11],  // 山の日
    [11, 3],  // 文化の日
    [11, 23], // 勤労感謝の日
  ];

  for (const [month, day] of fixed) {
    holidays.add(formatDate(new Date(year, month - 1, day)));
  }

  // ハッピーマンデー (第n月曜日)
  holidays.add(formatDate(getNthWeekday(year, 1, 1, 2)));  // 成人の日: 1月第2月曜
  holidays.add(formatDate(getNthWeekday(year, 7, 1, 3)));  // 海の日: 7月第3月曜
  holidays.add(formatDate(getNthWeekday(year, 9, 1, 3)));  // 敬老の日: 9月第3月曜
  holidays.add(formatDate(getNthWeekday(year, 10, 1, 2))); // スポーツの日: 10月第2月曜

  // 春分の日 (概算)
  const springEquinox = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  holidays.add(formatDate(new Date(year, 2, springEquinox)));

  // 秋分の日 (概算)
  const autumnEquinox = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  holidays.add(formatDate(new Date(year, 8, autumnEquinox)));

  // 振替休日: 祝日が日曜の場合、翌月曜が休日
  for (const h of [...holidays]) {
    const d = new Date(h);
    if (d.getDay() === 0) {
      const substitute = new Date(d);
      substitute.setDate(substitute.getDate() + 1);
      holidays.add(formatDate(substitute));
    }
  }

  NATIONAL_HOLIDAYS[year] = holidays;
  return holidays;
}

/** 第n weekday を取得 */
function getNthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  let day = 1 + ((weekday - first.getDay() + 7) % 7);
  day += (n - 1) * 7;
  return new Date(year, month - 1, day);
}

/** 日付を YYYY-MM-DD 形式にフォーマット */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 日付を YYYYMMDD 形式にフォーマット */
export function formatDateCompact(date: Date): string {
  return formatDate(date).replace(/-/g, '');
}

/** 年月を YYYYMM 形式にフォーマット */
export function formatYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/** 現在のJST日時を取得 */
export function nowJST(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utc + JST_OFFSET);
}

/** 指定日がB型事業所の営業日か判定 (土日祝を除外) */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const holidays = generateHolidays(date.getFullYear());
  return !holidays.has(formatDate(date));
}

/** 指定日が祝日かどうか */
export function isHoliday(date: Date): boolean {
  const holidays = generateHolidays(date.getFullYear());
  return holidays.has(formatDate(date));
}

/** 指定月の営業日数を取得 */
export function getBusinessDaysInMonth(year: number, month: number): number {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (isBusinessDay(new Date(year, month - 1, d))) {
      count++;
    }
  }
  return count;
}

/** 指定月の営業日配列を取得 */
export function getBusinessDaysArray(year: number, month: number): Date[] {
  const result: Date[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (isBusinessDay(date)) {
      result.push(date);
    }
  }
  return result;
}

/**
 * HH:mm 形式の出退勤時刻から実績時間(分)を計算
 * 休憩時間を差し引く
 */
export function calculateWorkMinutes(clockIn: string, clockOut: string, breakMinutes: number = 0): number {
  const [inH, inM] = clockIn.split(':').map(Number) as [number, number];
  const [outH, outM] = clockOut.split(':').map(Number) as [number, number];
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM) - breakMinutes;
  return Math.max(0, totalMinutes);
}

/** YYYY-MM 形式を年・月に分解 */
export function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const [yearStr, monthStr] = yearMonth.split('-');
  return { year: Number(yearStr), month: Number(monthStr) };
}
