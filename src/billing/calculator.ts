/**
 * 月次請求計算エンジン
 * (基本報酬 + 加算) × 地域区分単価 で給付費を計算
 */

import type {
  Facility,
  ServiceUser,
  Attendance,
} from '../types/domain.js';
import { ServiceCodeEngine } from './service-codes.js';

// ─── 計算結果型 ──────────────────────────────────────────

export interface MonthlyBillingResult {
  facilityId: string;
  yearMonth: string;
  userBillings: UserBillingResult[];
  totalUnits: number;
  totalAmount: number;
  totalCopayment: number;
}

export interface UserBillingResult {
  userId: string;
  recipientNumber: string;
  nameKana: string;
  attendanceDays: number;
  serviceDetails: ServiceDetail[];
  totalUnits: number;
  /** 金額 = 端数処理(totalUnits × areaUnitPrice) */
  totalAmount: number;
  copaymentAmount: number;
  benefitAmount: number;
}

export interface ServiceDetail {
  serviceCode: string;
  serviceName: string;
  units: number;
  count: number;
  subtotalUnits: number;
}

// ─── 計算エンジン ────────────────────────────────────────

export class BillingCalculator {

  /**
   * 月次請求を計算
   */
  calculate(
    yearMonth: string,
    facility: Facility,
    users: ServiceUser[],
    attendanceMap: Map<string, Attendance[]>,
  ): MonthlyBillingResult {
    const areaUnitPrice = ServiceCodeEngine.getAreaUnitPrice(facility.areaGrade);
    const userBillings: UserBillingResult[] = [];

    for (const user of users) {
      if (!user.isActive) continue;
      const attendances = attendanceMap.get(user.id) ?? [];
      const presentDays = attendances.filter((a) => a.attendanceType === 'present');

      if (presentDays.length === 0) continue;

      const billing = this.calculateUserBilling(
        facility,
        user,
        presentDays,
        attendances,
        areaUnitPrice,
      );
      userBillings.push(billing);
    }

    const totalUnits = userBillings.reduce((sum, b) => sum + b.totalUnits, 0);
    const totalAmount = userBillings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalCopayment = userBillings.reduce((sum, b) => sum + b.copaymentAmount, 0);

    return {
      facilityId: facility.facilityId,
      yearMonth,
      userBillings,
      totalUnits,
      totalAmount,
      totalCopayment,
    };
  }

  private calculateUserBilling(
    facility: Facility,
    user: ServiceUser,
    presentDays: Attendance[],
    allAttendances: Attendance[],
    areaUnitPrice: number,
  ): UserBillingResult {
    const details: ServiceDetail[] = [];
    const attendanceDays = presentDays.length;

    // 1. 基本報酬
    const baseUnits = this.getBaseUnits(facility);
    details.push({
      serviceCode: facility.serviceTypeCode,
      serviceName: '就労継続支援B型サービス費',
      units: baseUnits,
      count: attendanceDays,
      subtotalUnits: baseUnits * attendanceDays,
    });

    // 2. 送迎加算
    const pickupDays = this.countPickupDays(presentDays);
    if (pickupDays.pickup > 0) {
      details.push({
        serviceCode: '612211',
        serviceName: '送迎加算(片道)',
        units: 21,
        count: pickupDays.pickup,
        subtotalUnits: 21 * pickupDays.pickup,
      });
    }

    // 3. 食事提供体制加算
    const mealDays = presentDays.filter((a) => a.mealProvided).length;
    if (mealDays > 0) {
      details.push({
        serviceCode: '612311',
        serviceName: '食事提供体制加算',
        units: 30,
        count: mealDays,
        subtotalUnits: 30 * mealDays,
      });
    }

    // 4. 欠席時対応加算 (連絡あり欠席、月4回まで)
    const absentNotified = allAttendances
      .filter((a) => a.attendanceType === 'absent_notified')
      .slice(0, 4);
    if (absentNotified.length > 0) {
      details.push({
        serviceCode: '612611',
        serviceName: '欠席時対応加算',
        units: 94,
        count: absentNotified.length,
        subtotalUnits: 94 * absentNotified.length,
      });
    }

    // 合計計算
    const totalUnits = details.reduce((sum, d) => sum + d.subtotalUnits, 0);
    const rawAmount = Math.floor(totalUnits * areaUnitPrice);
    const copaymentAmount = Math.min(rawAmount, user.copaymentLimit);
    const benefitAmount = rawAmount - copaymentAmount;

    return {
      userId: user.id,
      recipientNumber: user.recipientNumber,
      nameKana: user.nameKana,
      attendanceDays,
      serviceDetails: details,
      totalUnits,
      totalAmount: rawAmount,
      copaymentAmount,
      benefitAmount,
    };
  }

  private getBaseUnits(facility: Facility): number {
    const structure = facility.rewardStructure;
    let category = 'default';

    if (structure === 'I') {
      category = this.getWageCategory(facility.averageMonthlyWage);
    } else if (structure === 'II' || structure === 'III' || structure === 'IV' || structure === 'V' || structure === 'VI') {
      category = this.getCapacityCategory(facility.capacity);
    }

    const units = ServiceCodeEngine.getBaseRewardUnits(
      structure,
      category,
    );
    return units;
  }

  private getWageCategory(averageMonthlyWage?: number): string {
    const wage = averageMonthlyWage ?? 0;
    if (wage >= 45000) return '4.5万円以上';
    if (wage >= 35000) return '3.5万円以上4.5万円未満';
    if (wage >= 30000) return '3万円以上3.5万円未満';
    if (wage >= 25000) return '2.5万円以上3万円未満';
    if (wage >= 20000) return '2万円以上2.5万円未満';
    if (wage >= 15000) return '1.5万円以上2万円未満';
    if (wage >= 10000) return '1万円以上1.5万円未満';
    if (wage >= 5000) return '5千円以上1万円未満';
    return '5千円未満';
  }

  private getCapacityCategory(capacity: number): string {
    if (capacity <= 20) return '20人以下';
    if (capacity <= 40) return '21〜40人';
    if (capacity <= 60) return '41〜60人';
    if (capacity <= 80) return '61〜80人';
    return '81人以上';
  }

  private countPickupDays(attendances: Attendance[]): { pickup: number } {
    let pickup = 0;
    for (const a of attendances) {
      if (a.pickupType === 'pickup_only' || a.pickupType === 'dropoff_only') {
        pickup += 1;
      } else if (a.pickupType === 'both') {
        pickup += 2;
      }
    }
    return { pickup };
  }
}
