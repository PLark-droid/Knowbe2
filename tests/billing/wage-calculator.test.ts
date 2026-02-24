/**
 * WageCalculatorEngine unit tests
 */

import { WageCalculatorEngine } from '../../src/billing/wage-calculator.js';
import type {
  ServiceUser,
  Attendance,
  ProductOutput,
  ProductActivity,
} from '../../src/types/domain.js';

// ─── Helper factories ────────────────────────────────────

function createUser(overrides: Partial<ServiceUser> = {}): ServiceUser {
  return {
    id: 'user-001',
    facilityId: 'facility-001',
    name: 'Test User',
    nameKana: 'テストユーザー',
    recipientNumber: '1234567890',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    contractDaysPerMonth: 22,
    serviceStartDate: '2025-04-01',
    copaymentLimit: 9300,
    isActive: true,
    createdAt: '2025-04-01T00:00:00Z',
    updatedAt: '2025-04-01T00:00:00Z',
    ...overrides,
  };
}

function createAttendance(
  userId: string,
  date: string,
  overrides: Partial<Attendance> = {},
): Attendance {
  return {
    id: `att-${date}`,
    facilityId: 'facility-001',
    userId,
    date,
    clockIn: '09:00',
    clockOut: '16:00',
    actualMinutes: 360,
    breakMinutes: 60,
    attendanceType: 'present',
    pickupType: 'none',
    mealProvided: false,
    createdAt: `${date}T09:00:00Z`,
    updatedAt: `${date}T16:00:00Z`,
    ...overrides,
  };
}

function createOutput(
  userId: string,
  activityId: string,
  date: string,
  workMinutes: number,
): ProductOutput {
  return {
    id: `out-${date}`,
    facilityId: 'facility-001',
    userId,
    activityId,
    date,
    workMinutes,
    createdAt: `${date}T16:00:00Z`,
  };
}

function createActivity(overrides: Partial<ProductActivity> = {}): ProductActivity {
  return {
    id: 'activity-001',
    facilityId: 'facility-001',
    name: 'Assembly Work',
    hourlyRate: 200,
    isActive: true,
    createdAt: '2025-04-01T00:00:00Z',
    updatedAt: '2025-04-01T00:00:00Z',
    ...overrides,
  };
}

/** Generate N days of attendance and output records for a user */
function generateDaysData(
  userId: string,
  activityId: string,
  days: number,
  workMinutesPerDay: number,
) {
  const attendances: Attendance[] = [];
  const outputs: ProductOutput[] = [];
  for (let i = 1; i <= days; i++) {
    const date = `2026-02-${String(i).padStart(2, '0')}`;
    attendances.push(createAttendance(userId, date));
    outputs.push(createOutput(userId, activityId, date, workMinutesPerDay));
  }
  return { attendances, outputs };
}

// ─── Tests ───────────────────────────────────────────────

describe('WageCalculatorEngine', () => {
  const facilityId = 'facility-001';
  const yearMonth = '2026-02';

  describe('basic wage calculation', () => {
    it('should calculate baseWage as totalWorkHours * hourlyRate per day, summed', () => {
      const engine = new WageCalculatorEngine();
      const user = createUser();
      const activity = createActivity({ id: 'act-1', hourlyRate: 200 });

      // 20 days, 300 min/day => 20 * Math.round((300/60) * 200) = 20 * 1000 = 20000
      const { attendances, outputs } = generateDaysData(user.id, 'act-1', 20, 300);

      const attendanceMap = new Map([[user.id, attendances]]);
      const outputMap = new Map([[user.id, outputs]]);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        attendanceMap,
        outputMap,
        [activity],
        22,
      );

      expect(result.userWages).toHaveLength(1);
      const wage = result.userWages[0]!;
      expect(wage.baseWage).toBe(20000);
      expect(wage.attendanceDays).toBe(20);
      expect(wage.totalWorkMinutes).toBe(6000);
    });
  });

  describe('perfect attendance bonus', () => {
    it('should add attendance bonus when attendanceDays >= expectedDays', () => {
      const engine = new WageCalculatorEngine({ perfectAttendanceBonus: 1000 });
      const user = createUser();
      const activity = createActivity({ id: 'act-1' });
      const expectedDays = 20;

      const { attendances, outputs } = generateDaysData(user.id, 'act-1', 20, 300);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        new Map([[user.id, attendances]]),
        new Map([[user.id, outputs]]),
        [activity],
        expectedDays,
      );

      const wage = result.userWages[0]!;
      expect(wage.attendanceBonus).toBe(1000);
      expect(wage.totalWage).toBe(wage.baseWage + wage.skillWage + 1000);
    });

    it('should not add attendance bonus when attendanceDays < expectedDays', () => {
      const engine = new WageCalculatorEngine({ perfectAttendanceBonus: 1000 });
      const user = createUser();
      const activity = createActivity({ id: 'act-1' });
      const expectedDays = 22;

      // Only 20 present days, expected is 22
      const { attendances, outputs } = generateDaysData(user.id, 'act-1', 20, 300);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        new Map([[user.id, attendances]]),
        new Map([[user.id, outputs]]),
        [activity],
        expectedDays,
      );

      const wage = result.userWages[0]!;
      expect(wage.attendanceBonus).toBe(0);
    });
  });

  describe('deduction rate', () => {
    it('should apply deduction rate to totalWage', () => {
      const engine = new WageCalculatorEngine({
        deductionRate: 0.1,
        perfectAttendanceBonus: 0,
      });
      const user = createUser();
      const activity = createActivity({ id: 'act-1', hourlyRate: 200 });
      const { attendances, outputs } = generateDaysData(user.id, 'act-1', 20, 300);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        new Map([[user.id, attendances]]),
        new Map([[user.id, outputs]]),
        [activity],
        22,
      );

      const wage = result.userWages[0]!;
      // baseWage = 20000, deduction = Math.round(20000 * 0.1) = 2000
      expect(wage.deductions).toBe(2000);
      expect(wage.netWage).toBe(18000);
    });
  });

  describe('averageWage and meetsMinimumThreshold', () => {
    it('should compute averageWage as totalNetWage / userCount', () => {
      const engine = new WageCalculatorEngine({ perfectAttendanceBonus: 0, deductionRate: 0 });
      const user1 = createUser({ id: 'u1', name: 'User 1' });
      const user2 = createUser({ id: 'u2', name: 'User 2' });
      const activity = createActivity({ id: 'act-1', hourlyRate: 200 });

      const { attendances: att1, outputs: out1 } = generateDaysData('u1', 'act-1', 20, 300);
      const { attendances: att2, outputs: out2 } = generateDaysData('u2', 'act-1', 10, 300);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user1, user2],
        new Map([['u1', att1], ['u2', att2]]),
        new Map([['u1', out1], ['u2', out2]]),
        [activity],
        22,
      );

      expect(result.userWages).toHaveLength(2);
      // u1: 20 * 1000 = 20000, u2: 10 * 1000 = 10000 => total 30000, avg 15000
      expect(result.totalWage).toBe(30000);
      expect(result.averageWage).toBe(15000);
      expect(result.meetsMinimumThreshold).toBe(true);
    });

    it('should return meetsMinimumThreshold false when averageWage < minimumAverageMonthlyWage', () => {
      // set absurdly high threshold
      const engine = new WageCalculatorEngine({
        minimumAverageMonthlyWage: 999999,
        perfectAttendanceBonus: 0,
      });
      const user = createUser();
      const activity = createActivity({ id: 'act-1', hourlyRate: 1 });
      const { attendances, outputs } = generateDaysData(user.id, 'act-1', 1, 60);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        new Map([[user.id, attendances]]),
        new Map([[user.id, outputs]]),
        [activity],
        22,
      );

      expect(result.meetsMinimumThreshold).toBe(false);
    });
  });

  describe('inactive users', () => {
    it('should exclude inactive users from calculation', () => {
      const engine = new WageCalculatorEngine();
      const activeUser = createUser({ id: 'active', isActive: true });
      const inactiveUser = createUser({ id: 'inactive', isActive: false });
      const activity = createActivity({ id: 'act-1' });

      const { attendances: att1, outputs: out1 } = generateDaysData('active', 'act-1', 10, 300);
      const { attendances: att2, outputs: out2 } = generateDaysData('inactive', 'act-1', 10, 300);

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [activeUser, inactiveUser],
        new Map([['active', att1], ['inactive', att2]]),
        new Map([['active', out1], ['inactive', out2]]),
        [activity],
        22,
      );

      expect(result.userWages).toHaveLength(1);
      expect(result.userWages[0]!.userId).toBe('active');
    });
  });

  describe('empty attendance', () => {
    it('should return empty userWages when no attendance data exists', () => {
      const engine = new WageCalculatorEngine();
      const user = createUser();
      const activity = createActivity({ id: 'act-1' });

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        new Map(),
        new Map(),
        [activity],
        22,
      );

      expect(result.userWages).toHaveLength(0);
      expect(result.totalWage).toBe(0);
      expect(result.averageWage).toBe(0);
    });

    it('should skip users whose attendance records have zero present days', () => {
      const engine = new WageCalculatorEngine();
      const user = createUser();
      const activity = createActivity({ id: 'act-1' });

      // All attendance records are 'absent', not 'present'
      const absentAttendances: Attendance[] = [
        createAttendance(user.id, '2026-02-01', { attendanceType: 'absent' }),
        createAttendance(user.id, '2026-02-02', { attendanceType: 'absent' }),
      ];

      const result = engine.calculate(
        facilityId,
        yearMonth,
        [user],
        new Map([[user.id, absentAttendances]]),
        new Map(),
        [activity],
        22,
      );

      expect(result.userWages).toHaveLength(0);
    });
  });
});
