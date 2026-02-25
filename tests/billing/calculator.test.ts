/**
 * BillingCalculator tests
 */

import { BillingCalculator } from '../../src/billing/calculator.js';
import type { Facility, ServiceUser, Attendance } from '../../src/types/domain.js';

// ─── Test data helpers ──────────────────────────────────

function createFacility(overrides?: Partial<Facility>): Facility {
  return {
    id: 'fac-001',
    facilityId: 'FAC001',
    name: 'テスト事業所',
    corporateName: 'テスト法人',
    facilityNumber: '1300000001',
    address: '東京都千代田区1-1-1',
    postalCode: '100-0001',
    phone: '03-1234-5678',
    areaGrade: 1,
    rewardStructure: 'II',
    capacity: 20,
    serviceTypeCode: '612111',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createServiceUser(overrides?: Partial<ServiceUser>): ServiceUser {
  return {
    id: 'user-001',
    facilityId: 'FAC001',
    name: '田中太郎',
    nameKana: 'タナカタロウ',
    recipientNumber: '1300000001',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    contractDaysPerMonth: 22,
    serviceStartDate: '2025-01-01',
    copaymentLimit: 9300,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createAttendance(overrides?: Partial<Attendance>): Attendance {
  return {
    id: 'att-001',
    facilityId: 'FAC001',
    userId: 'user-001',
    date: '2025-06-02',
    clockIn: '09:00',
    clockOut: '16:00',
    actualMinutes: 360,
    breakMinutes: 60,
    attendanceType: 'present',
    pickupType: 'none',
    mealProvided: false,
    createdAt: '2025-06-02T09:00:00Z',
    updatedAt: '2025-06-02T16:00:00Z',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('BillingCalculator', () => {
  let calculator: BillingCalculator;

  beforeEach(() => {
    calculator = new BillingCalculator();
  });

  // ─── Basic calculation ────────────────────────────────

  describe('basic calculation', () => {
    it('should calculate billing for a single user with one attendance day', () => {
      const facility = createFacility();
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance(),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);

      expect(result.facilityId).toBe('FAC001');
      expect(result.yearMonth).toBe('2025-06');
      expect(result.userBillings).toHaveLength(1);
      expect(result.totalUnits).toBeGreaterThan(0);
      expect(result.totalAmount).toBeGreaterThan(0);
    });

    it('should calculate correct units for reward structure II, 20 or fewer users', () => {
      const facility = createFacility({ areaGrade: 1, rewardStructure: 'II', capacity: 20 });
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance(),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      // Base units for II / 20 or fewer = 567
      const baseDetail = billing.serviceDetails.find(
        (d) => d.serviceName === '就労継続支援B型サービス費',
      );
      expect(baseDetail).toBeDefined();
      expect(baseDetail!.units).toBe(567);
      expect(baseDetail!.count).toBe(1);
      expect(baseDetail!.subtotalUnits).toBe(567);
    });

    it('should calculate structure I base units from averageMonthlyWage', () => {
      const facility = createFacility({
        rewardStructure: 'I',
        averageMonthlyWage: 36000,
      });
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [createAttendance()]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;
      const baseDetail = billing.serviceDetails.find(
        (d) => d.serviceName === '就労継続支援B型サービス費',
      );

      expect(baseDetail).toBeDefined();
      expect(baseDetail!.units).toBe(672);
    });

    it('should calculate structure II base units from capacity category', () => {
      const facility = createFacility({
        rewardStructure: 'II',
        capacity: 41,
      });
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [createAttendance()]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;
      const baseDetail = billing.serviceDetails.find(
        (d) => d.serviceName === '就労継続支援B型サービス費',
      );

      expect(baseDetail).toBeDefined();
      expect(baseDetail!.units).toBe(502);
    });

    it('should apply area unit price correctly', () => {
      // Area grade 1 = 11.40 yen per unit
      const facility = createFacility({ areaGrade: 1 });
      const user = createServiceUser({ copaymentLimit: 99999 }); // high limit to see full amount
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance(),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      // totalAmount = floor(totalUnits * 11.40)
      const expectedAmount = Math.floor(billing.totalUnits * 11.40);
      expect(billing.totalAmount).toBe(expectedAmount);
    });
  });

  // ─── Multiple attendance days ──────────────────────────

  describe('multiple attendance days', () => {
    it('should multiply base units by number of present days', () => {
      const facility = createFacility();
      const user = createServiceUser({ copaymentLimit: 99999 });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ id: 'att-001', date: '2025-06-02' }),
        createAttendance({ id: 'att-002', date: '2025-06-03' }),
        createAttendance({ id: 'att-003', date: '2025-06-04' }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      expect(billing.attendanceDays).toBe(3);

      const baseDetail = billing.serviceDetails.find(
        (d) => d.serviceName === '就労継続支援B型サービス費',
      );
      expect(baseDetail!.count).toBe(3);
      expect(baseDetail!.subtotalUnits).toBe(567 * 3);
    });
  });

  // ─── Copayment cap ────────────────────────────────────

  describe('copayment cap', () => {
    it('should cap copayment at copaymentLimit', () => {
      const facility = createFacility({ areaGrade: 1 });
      const user = createServiceUser({ copaymentLimit: 9300 });
      const attendances: Attendance[] = [];
      for (let i = 1; i <= 20; i++) {
        attendances.push(
          createAttendance({
            id: `att-${i}`,
            date: `2025-06-${String(i).padStart(2, '0')}`,
          }),
        );
      }
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', attendances);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      // With 20 days * 567 units * 11.40 = much larger than 9300
      expect(billing.copaymentAmount).toBeLessThanOrEqual(9300);
      expect(billing.copaymentAmount).toBe(9300);
      expect(billing.benefitAmount).toBe(billing.totalAmount - billing.copaymentAmount);
    });

    it('should set copayment to totalAmount when below limit', () => {
      const facility = createFacility({ areaGrade: 7 }); // lower area price = 10.14
      const user = createServiceUser({ copaymentLimit: 99999 });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance(),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      // 1 day, small amount should be under 99999
      expect(billing.copaymentAmount).toBe(billing.totalAmount);
      expect(billing.benefitAmount).toBe(0);
    });
  });

  // ─── Meal provision addition ──────────────────────────

  describe('meal provision addition', () => {
    it('should add meal provision units when mealProvided is true', () => {
      const facility = createFacility();
      const user = createServiceUser({ copaymentLimit: 99999 });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ mealProvided: true }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      const mealDetail = billing.serviceDetails.find(
        (d) => d.serviceCode === '612311',
      );
      expect(mealDetail).toBeDefined();
      expect(mealDetail!.units).toBe(30);
      expect(mealDetail!.count).toBe(1);
      expect(mealDetail!.subtotalUnits).toBe(30);
    });

    it('should not add meal addition when mealProvided is false', () => {
      const facility = createFacility();
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ mealProvided: false }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      const mealDetail = billing.serviceDetails.find(
        (d) => d.serviceCode === '612311',
      );
      expect(mealDetail).toBeUndefined();
    });
  });

  // ─── Pickup addition ──────────────────────────────────

  describe('pickup addition', () => {
    it('should add pickup units for pickup_only', () => {
      const facility = createFacility();
      const user = createServiceUser({ copaymentLimit: 99999 });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ pickupType: 'pickup_only' }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      const pickupDetail = billing.serviceDetails.find(
        (d) => d.serviceCode === '612211',
      );
      expect(pickupDetail).toBeDefined();
      expect(pickupDetail!.units).toBe(21);
      expect(pickupDetail!.count).toBe(1);
    });

    it('should count both directions for pickup type both', () => {
      const facility = createFacility();
      const user = createServiceUser({ copaymentLimit: 99999 });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ pickupType: 'both' }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      const pickupDetail = billing.serviceDetails.find(
        (d) => d.serviceCode === '612211',
      );
      expect(pickupDetail).toBeDefined();
      expect(pickupDetail!.count).toBe(2); // both = 2 trips
      expect(pickupDetail!.subtotalUnits).toBe(21 * 2);
    });

    it('should not add pickup when pickupType is none', () => {
      const facility = createFacility();
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ pickupType: 'none' }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      const pickupDetail = billing.serviceDetails.find(
        (d) => d.serviceCode === '612211',
      );
      expect(pickupDetail).toBeUndefined();
    });
  });

  // ─── Absent notified addition ─────────────────────────

  describe('absent notified addition', () => {
    it('should add absent notified units capped at 4 per month', () => {
      const facility = createFacility();
      const user = createServiceUser({ copaymentLimit: 99999 });
      const attendances: Attendance[] = [
        createAttendance({ id: 'att-p1', date: '2025-06-02' }),
      ];
      // 6 absent_notified — only 4 should be counted
      for (let i = 1; i <= 6; i++) {
        attendances.push(
          createAttendance({
            id: `att-a${i}`,
            date: `2025-06-${String(10 + i).padStart(2, '0')}`,
            attendanceType: 'absent_notified',
            clockIn: undefined,
            clockOut: undefined,
            actualMinutes: 0,
          }),
        );
      }
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', attendances);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      const absentDetail = billing.serviceDetails.find(
        (d) => d.serviceCode === '612611',
      );
      expect(absentDetail).toBeDefined();
      expect(absentDetail!.count).toBe(4); // capped at 4
      expect(absentDetail!.subtotalUnits).toBe(94 * 4);
    });
  });

  // ─── Empty attendance ─────────────────────────────────

  describe('empty attendance', () => {
    it('should return no userBillings when attendance map is empty', () => {
      const facility = createFacility();
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);

      expect(result.userBillings).toHaveLength(0);
      expect(result.totalUnits).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.totalCopayment).toBe(0);
    });

    it('should return no billing when user has only absent days (no present)', () => {
      const facility = createFacility();
      const user = createServiceUser();
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ attendanceType: 'absent' }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);

      expect(result.userBillings).toHaveLength(0);
    });
  });

  // ─── Inactive user exclusion ──────────────────────────

  describe('inactive user exclusion', () => {
    it('should skip inactive users', () => {
      const facility = createFacility();
      const inactiveUser = createServiceUser({ isActive: false });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance(),
      ]);

      const result = calculator.calculate('2025-06', facility, [inactiveUser], attendanceMap);

      expect(result.userBillings).toHaveLength(0);
      expect(result.totalUnits).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should include active users and exclude inactive ones', () => {
      const facility = createFacility();
      const activeUser = createServiceUser({ id: 'user-active', isActive: true });
      const inactiveUser = createServiceUser({ id: 'user-inactive', isActive: false });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-active', [
        createAttendance({ userId: 'user-active' }),
      ]);
      attendanceMap.set('user-inactive', [
        createAttendance({ userId: 'user-inactive' }),
      ]);

      const result = calculator.calculate('2025-06', 
        facility,
        [activeUser, inactiveUser],
        attendanceMap,
      );

      expect(result.userBillings).toHaveLength(1);
      expect(result.userBillings[0]!.userId).toBe('user-active');
    });
  });

  // ─── Multiple users ───────────────────────────────────

  describe('multiple users', () => {
    it('should sum totals across all active users', () => {
      const facility = createFacility();
      const user1 = createServiceUser({
        id: 'user-001',
        recipientNumber: '1300000001',
        copaymentLimit: 99999,
      });
      const user2 = createServiceUser({
        id: 'user-002',
        recipientNumber: '1300000002',
        copaymentLimit: 99999,
      });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [
        createAttendance({ id: 'att-1', userId: 'user-001' }),
      ]);
      attendanceMap.set('user-002', [
        createAttendance({ id: 'att-2', userId: 'user-002' }),
      ]);

      const result = calculator.calculate('2025-06', facility, [user1, user2], attendanceMap);

      expect(result.userBillings).toHaveLength(2);
      expect(result.totalUnits).toBe(
        result.userBillings[0]!.totalUnits + result.userBillings[1]!.totalUnits,
      );
      expect(result.totalAmount).toBe(
        result.userBillings[0]!.totalAmount + result.userBillings[1]!.totalAmount,
      );
    });
  });

  // ─── Result structure ─────────────────────────────────

  describe('result structure', () => {
    it('should include correct facilityId in result', () => {
      const facility = createFacility({ facilityId: 'MY-FAC' });
      const result = calculator.calculate('2025-06', facility, [], new Map());
      expect(result.facilityId).toBe('MY-FAC');
    });

    it('should include user metadata in billing', () => {
      const facility = createFacility();
      const user = createServiceUser({
        recipientNumber: '9999999999',
        nameKana: 'ヤマダハナコ',
      });
      const attendanceMap = new Map<string, Attendance[]>();
      attendanceMap.set('user-001', [createAttendance()]);

      const result = calculator.calculate('2025-06', facility, [user], attendanceMap);
      const billing = result.userBillings[0]!;

      expect(billing.recipientNumber).toBe('9999999999');
      expect(billing.nameKana).toBe('ヤマダハナコ');
    });
  });
});
