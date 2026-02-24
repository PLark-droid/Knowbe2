/**
 * 月次工賃計算エンジン
 * B型就労支援: 平均工賃月額 3,000円以上を維持
 */

import type {
  ServiceUser,
  Attendance,
  ProductOutput,
  ProductActivity,
  WageCalculation,
} from '../types/domain.js';

// ─── 計算結果型 ──────────────────────────────────────────

export interface MonthlyWageResult {
  facilityId: string;
  yearMonth: string;
  userWages: UserWageResult[];
  totalWage: number;
  averageWage: number;
  meetsMinimumThreshold: boolean;
}

export interface UserWageResult {
  userId: string;
  name: string;
  attendanceDays: number;
  totalWorkMinutes: number;
  baseWage: number;
  skillWage: number;
  attendanceBonus: number;
  totalWage: number;
  deductions: number;
  netWage: number;
}

// ─── 工賃設定 ────────────────────────────────────────────

export interface WageConfig {
  /** 最低平均工賃月額 (円) — B型は3,000円以上 */
  minimumAverageMonthlyWage: number;
  /** 皆勤手当 (円) */
  perfectAttendanceBonus: number;
  /** 控除率 (0〜1) — 例: 昼食代天引きなど */
  deductionRate: number;
}

const DEFAULT_WAGE_CONFIG: WageConfig = {
  minimumAverageMonthlyWage: 3000,
  perfectAttendanceBonus: 1000,
  deductionRate: 0,
};

// ─── 計算エンジン ────────────────────────────────────────

export class WageCalculatorEngine {
  private readonly config: WageConfig;

  constructor(config?: Partial<WageConfig>) {
    this.config = { ...DEFAULT_WAGE_CONFIG, ...config };
  }

  /**
   * 月次工賃を計算
   */
  calculate(
    facilityId: string,
    yearMonth: string,
    users: ServiceUser[],
    attendanceMap: Map<string, Attendance[]>,
    outputMap: Map<string, ProductOutput[]>,
    activities: ProductActivity[],
    expectedDays: number,
  ): MonthlyWageResult {
    const activityMap = new Map(activities.map((a) => [a.id, a]));
    const userWages: UserWageResult[] = [];

    for (const user of users) {
      if (!user.isActive) continue;

      const attendances = (attendanceMap.get(user.id) ?? [])
        .filter((a) => a.attendanceType === 'present');
      const outputs = outputMap.get(user.id) ?? [];

      if (attendances.length === 0) continue;

      const wage = this.calculateUserWage(
        user,
        attendances,
        outputs,
        activityMap,
        expectedDays,
      );
      userWages.push(wage);
    }

    const totalWage = userWages.reduce((s, w) => s + w.netWage, 0);
    const averageWage = userWages.length > 0 ? Math.round(totalWage / userWages.length) : 0;

    return {
      facilityId,
      yearMonth,
      userWages,
      totalWage,
      averageWage,
      meetsMinimumThreshold: averageWage >= this.config.minimumAverageMonthlyWage,
    };
  }

  private calculateUserWage(
    user: ServiceUser,
    attendances: Attendance[],
    outputs: ProductOutput[],
    activityMap: Map<string, ProductActivity>,
    expectedDays: number,
  ): UserWageResult {
    const attendanceDays = attendances.length;
    const totalWorkMinutes = outputs.reduce((s, o) => s + o.workMinutes, 0);

    // 基本工賃: 作業時間 × 作業単価
    let baseWage = 0;
    for (const output of outputs) {
      const activity = activityMap.get(output.activityId);
      if (activity) {
        baseWage += Math.round((output.workMinutes / 60) * activity.hourlyRate);
      }
    }

    // 能力給: 0 (事業所ごとに設定可能)
    const skillWage = 0;

    // 皆勤手当
    const attendanceBonus =
      attendanceDays >= expectedDays ? this.config.perfectAttendanceBonus : 0;

    const totalWage = baseWage + skillWage + attendanceBonus;
    const deductions = Math.round(totalWage * this.config.deductionRate);
    const netWage = totalWage - deductions;

    return {
      userId: user.id,
      name: user.name,
      attendanceDays,
      totalWorkMinutes,
      baseWage,
      skillWage,
      attendanceBonus,
      totalWage,
      deductions,
      netWage,
    };
  }

  /** 工賃計算結果をドメインエンティティに変換 */
  toWageCalculation(
    facilityId: string,
    yearMonth: string,
    result: UserWageResult,
  ): Omit<WageCalculation, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      facilityId,
      userId: result.userId,
      yearMonth,
      totalWorkMinutes: result.totalWorkMinutes,
      attendanceDays: result.attendanceDays,
      baseWage: result.baseWage,
      skillWage: result.skillWage,
      attendanceBonus: result.attendanceBonus,
      totalWage: result.totalWage,
      deductions: result.deductions,
      netWage: result.netWage,
      status: 'draft',
    };
  }
}
