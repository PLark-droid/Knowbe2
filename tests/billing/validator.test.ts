/**
 * validateBilling unit tests
 */

import { validateBilling } from '../../src/billing/validator.js';
import type { MonthlyBillingResult, UserBillingResult, ServiceDetail } from '../../src/billing/calculator.js';

// ─── Helper factories ────────────────────────────────────

function createServiceDetail(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    serviceCode: '611111',
    serviceName: 'B type service',
    units: 567,
    count: 20,
    subtotalUnits: 11340,
    ...overrides,
  };
}

function createUserBilling(overrides: Partial<UserBillingResult> = {}): UserBillingResult {
  const details = overrides.serviceDetails ?? [createServiceDetail()];
  const totalUnits = overrides.totalUnits ?? details.reduce((s, d) => s + d.subtotalUnits, 0);
  return {
    userId: 'user-001',
    recipientNumber: '1234567890',
    nameKana: 'テストユーザー',
    attendanceDays: 20,
    serviceDetails: details,
    totalUnits,
    totalAmount: 100000,
    copaymentAmount: 9300,
    benefitAmount: 90700,
    ...overrides,
  };
}

function createBillingResult(overrides: Partial<MonthlyBillingResult> = {}): MonthlyBillingResult {
  const userBillings = overrides.userBillings ?? [createUserBilling()];
  return {
    facilityId: 'facility-001',
    yearMonth: '2026-02',
    userBillings,
    totalUnits: userBillings.reduce((s, b) => s + b.totalUnits, 0),
    totalAmount: userBillings.reduce((s, b) => s + b.totalAmount, 0),
    totalCopayment: userBillings.reduce((s, b) => s + b.copaymentAmount, 0),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('validateBilling', () => {
  describe('valid billing', () => {
    it('should pass validation for a well-formed billing', () => {
      const billing = createBillingResult();
      const result = validateBilling(billing);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('duplicate invoice detection', () => {
    it('should detect duplicate invoice when yearMonth exists in existing list', () => {
      const billing = createBillingResult({ yearMonth: '2026-01' });
      const result = validateBilling(billing, ['2025-12', '2026-01', '2026-02']);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'DUPLICATE_INVOICE' }),
        ]),
      );
    });

    it('should not flag duplicate when yearMonth is not in existing list', () => {
      const billing = createBillingResult({ yearMonth: '2026-03' });
      const result = validateBilling(billing, ['2026-01', '2026-02']);

      const duplicateErrors = result.errors.filter((e) => e.code === 'DUPLICATE_INVOICE');
      expect(duplicateErrors).toHaveLength(0);
    });
  });

  describe('invalid recipient number', () => {
    it('should error when recipientNumber is not 10 digits', () => {
      const userBilling = createUserBilling({ recipientNumber: '12345' });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_RECIPIENT_NUMBER',
            field: 'recipientNumber',
          }),
        ]),
      );
    });

    it('should error when recipientNumber contains non-digit characters', () => {
      const userBilling = createUserBilling({ recipientNumber: '12345ABCDE' });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_RECIPIENT_NUMBER' }),
        ]),
      );
    });

    it('should accept valid 10-digit recipientNumber', () => {
      const userBilling = createUserBilling({ recipientNumber: '0000000001' });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      const recipientErrors = result.errors.filter((e) => e.code === 'INVALID_RECIPIENT_NUMBER');
      expect(recipientErrors).toHaveLength(0);
    });
  });

  describe('attendance days out of range', () => {
    it('should error when attendanceDays is negative', () => {
      const userBilling = createUserBilling({ attendanceDays: -1 });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_ATTENDANCE_DAYS',
            field: 'attendanceDays',
          }),
        ]),
      );
    });

    it('should error when attendanceDays exceeds 31', () => {
      const userBilling = createUserBilling({ attendanceDays: 32 });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_ATTENDANCE_DAYS' }),
        ]),
      );
    });

    it('should accept attendanceDays within 0-31 range', () => {
      const userBilling = createUserBilling({ attendanceDays: 0 });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      const daysErrors = result.errors.filter((e) => e.code === 'INVALID_ATTENDANCE_DAYS');
      expect(daysErrors).toHaveLength(0);
    });
  });

  describe('total amount mismatch', () => {
    it('should error when totalAmount does not match sum of userBillings', () => {
      const userBilling = createUserBilling({ totalAmount: 50000 });
      const billing = createBillingResult({
        userBillings: [userBilling],
        totalAmount: 99999, // mismatch: sum is 50000
      });
      const result = validateBilling(billing);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'TOTAL_MISMATCH' }),
        ]),
      );
    });

    it('should pass when totalAmount matches sum of userBillings', () => {
      const user1 = createUserBilling({ totalAmount: 50000 });
      const user2 = createUserBilling({
        userId: 'user-002',
        totalAmount: 30000,
      });
      const billing = createBillingResult({
        userBillings: [user1, user2],
        totalAmount: 80000,
      });
      const result = validateBilling(billing);

      const mismatchErrors = result.errors.filter((e) => e.code === 'TOTAL_MISMATCH');
      expect(mismatchErrors).toHaveLength(0);
    });
  });

  describe('service detail units mismatch', () => {
    it('should error when service detail subtotals do not match totalUnits', () => {
      const detail1 = createServiceDetail({ subtotalUnits: 5000 });
      const detail2 = createServiceDetail({ subtotalUnits: 3000 });
      // totalUnits is 10000 but detail sums to 8000
      const userBilling = createUserBilling({
        serviceDetails: [detail1, detail2],
        totalUnits: 10000,
        totalAmount: 100000,
      });
      const billing = createBillingResult({
        userBillings: [userBilling],
        totalAmount: 100000,
      });
      const result = validateBilling(billing);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'DETAIL_UNITS_MISMATCH' }),
        ]),
      );
    });

    it('should pass when service detail subtotals match totalUnits', () => {
      const detail1 = createServiceDetail({ subtotalUnits: 5000 });
      const detail2 = createServiceDetail({ subtotalUnits: 3000 });
      const userBilling = createUserBilling({
        serviceDetails: [detail1, detail2],
        totalUnits: 8000,
      });
      const billing = createBillingResult({ userBillings: [userBilling] });
      const result = validateBilling(billing);

      const detailErrors = result.errors.filter((e) => e.code === 'DETAIL_UNITS_MISMATCH');
      expect(detailErrors).toHaveLength(0);
    });
  });
});
