/**
 * Tests for kokuho-ren CSV encoder
 * @module tests/csv/kokuho-ren
 */

import {
  buildKokuhoRenRecords,
  encodeRecords,
  exportKokuhoRenCsv,
} from '../../src/csv/kokuho-ren.js';
import type { Facility, ServiceUser } from '../../src/types/domain.js';
import type { MonthlyBillingResult, UserBillingResult, ServiceDetail } from '../../src/billing/calculator.js';
import type {
  KokuhoRenControlRecord,
  KokuhoRenDataRecord,
  KokuhoRenTrailerRecord,
  KokuhoRenRecord,
} from '../../src/types/csv.js';

// ─── Test Fixtures ──────────────────────────────────────

function createFacility(overrides?: Partial<Facility>): Facility {
  return {
    id: 'fac-001',
    facilityId: 'fac-001',
    name: 'テスト事業所',
    corporateName: 'テスト法人',
    facilityNumber: '1312345678',
    insurerNumber: '13123456',
    address: '東京都千代田区1-1-1',
    postalCode: '100-0001',
    phone: '03-1234-5678',
    areaGrade: 1,
    rewardStructure: 'I',
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
    facilityId: 'fac-001',
    name: '山田太郎',
    nameKana: 'ヤマダタロウ',
    recipientNumber: '0123456789',
    dateOfBirth: '1990-05-15',
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

function createServiceDetail(overrides?: Partial<ServiceDetail>): ServiceDetail {
  return {
    serviceCode: '612111',
    serviceName: '就労継続支援B型サービス費',
    units: 566,
    count: 20,
    subtotalUnits: 11320,
    ...overrides,
  };
}

function createUserBilling(overrides?: Partial<UserBillingResult>): UserBillingResult {
  return {
    userId: 'user-001',
    recipientNumber: '0123456789',
    nameKana: 'ヤマダタロウ',
    attendanceDays: 20,
    serviceDetails: [createServiceDetail()],
    totalUnits: 11320,
    totalAmount: 120000,
    copaymentAmount: 9300,
    benefitAmount: 110700,
    ...overrides,
  };
}

function createBillingResult(overrides?: Partial<MonthlyBillingResult>): MonthlyBillingResult {
  return {
    facilityId: 'fac-001',
    yearMonth: '2025-06',
    userBillings: [createUserBilling()],
    totalUnits: 11320,
    totalAmount: 120000,
    totalCopayment: 9300,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('buildKokuhoRenRecords', () => {
  it('should generate control, data, trailer records in correct order', () => {
    const facility = createFacility();
    const billing = createBillingResult();
    const users = new Map<string, ServiceUser>();
    users.set('user-001', createServiceUser());

    const records = buildKokuhoRenRecords(facility, billing, users);

    expect(records.length).toBeGreaterThanOrEqual(3);
    expect(records[0]!.recordType).toBe('control');
    expect(records[records.length - 1]!.recordType).toBe('trailer');

    // All middle records should be data
    const middleRecords = records.slice(1, -1);
    for (const r of middleRecords) {
      expect(r.recordType).toBe('data');
    }
  });

  it('should set correct control record fields', () => {
    const facility = createFacility({ facilityNumber: '1312345678', insurerNumber: '13123456' });
    const billing = createBillingResult({ yearMonth: '2025-06' });
    const users = new Map<string, ServiceUser>();
    users.set('user-001', createServiceUser());

    const records = buildKokuhoRenRecords(facility, billing, users);
    const control = records[0] as KokuhoRenControlRecord;

    expect(control.exchangeInfoId).toBe('7121');
    expect(control.mediaType).toBe('5');
    expect(control.prefectureCode).toBe('13');
    expect(control.insurerNumber).toBe('13123456');
    expect(control.facilityNumber).toBe('1312345678');
    expect(control.targetYearMonth).toBe('202506');
  });

  it('should generate one summarized data record per user', () => {
    const facility = createFacility();
    const detail1 = createServiceDetail({ serviceCode: '612111', subtotalUnits: 5000 });
    const detail2 = createServiceDetail({ serviceCode: '612211', subtotalUnits: 420 });
    const userBilling = createUserBilling({
      serviceDetails: [detail1, detail2],
      benefitAmount: 50000,
    });
    const billing = createBillingResult({ userBillings: [userBilling] });
    const users = new Map<string, ServiceUser>();
    users.set('user-001', createServiceUser());

    const records = buildKokuhoRenRecords(facility, billing, users);
    const dataRecords = records.filter((r): r is KokuhoRenDataRecord => r.recordType === 'data');

    expect(dataRecords).toHaveLength(1);
    expect(dataRecords[0]!.serviceCode).toBe(facility.serviceTypeCode);
    expect(dataRecords[0]!.totalServiceUnits).toBe(5000 + 420);
  });

  it('should skip users not found in the users map', () => {
    const facility = createFacility();
    const billing = createBillingResult({
      userBillings: [
        createUserBilling({ userId: 'user-001' }),
        createUserBilling({ userId: 'user-missing' }),
      ],
    });
    const users = new Map<string, ServiceUser>();
    users.set('user-001', createServiceUser());

    const records = buildKokuhoRenRecords(facility, billing, users);
    const dataRecords = records.filter((r) => r.recordType === 'data');

    // Only user-001 should produce data records
    expect(dataRecords).toHaveLength(1);
  });

  it('should set correct trailer record with totals', () => {
    const facility = createFacility();
    const detail1 = createServiceDetail({ subtotalUnits: 11320 });
    const detail2 = createServiceDetail({ subtotalUnits: 420 });
    const user1Billing = createUserBilling({
      userId: 'user-001',
      serviceDetails: [detail1],
      benefitAmount: 100000,
    });
    const user2Billing = createUserBilling({
      userId: 'user-002',
      serviceDetails: [detail2],
      benefitAmount: 5000,
    });
    const billing = createBillingResult({ userBillings: [user1Billing, user2Billing] });
    const users = new Map<string, ServiceUser>();
    users.set('user-001', createServiceUser({ id: 'user-001' }));
    users.set('user-002', createServiceUser({
      id: 'user-002',
      recipientNumber: '9876543210',
      nameKana: 'スズキハナコ',
    }));

    const records = buildKokuhoRenRecords(facility, billing, users);
    const trailer = records[records.length - 1] as KokuhoRenTrailerRecord;

    expect(trailer.recordType).toBe('trailer');
    expect(trailer.totalCount).toBe(2); // 2 users => 2 data records
    expect(trailer.totalUnits).toBe(11320 + 420);
    expect(trailer.totalClaimAmount).toBe(100000 + 5000);
  });

  it('should convert user fields correctly into data records', () => {
    const facility = createFacility({ serviceTypeCode: '612111' });
    const billing = createBillingResult();
    const users = new Map<string, ServiceUser>();
    users.set('user-001', createServiceUser({
      recipientNumber: '0123456789',
      nameKana: 'ヤマダタロウ',
      dateOfBirth: '1990-05-15',
      gender: 'male',
    }));

    const records = buildKokuhoRenRecords(facility, billing, users);
    const dataRecord = records.find((r): r is KokuhoRenDataRecord => r.recordType === 'data')!;

    expect(dataRecord.recipientNumber).toBe('0123456789');
    expect(dataRecord.nameKana).toBe('ヤマダタロウ');
    expect(dataRecord.dateOfBirth).toBe('19900515');
    expect(dataRecord.gender).toBe('1'); // male -> '1'
    expect(dataRecord.serviceTypeCode).toBe('612111');
  });
});

describe('encodeRecords', () => {
  it('should produce CRLF-delimited CSV text', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'data',
        facilityNumber: '1312345678',
        serviceTypeCode: '612111',
        recipientNumber: '0123456789',
        nameKana: 'ヤマダタロウ',
        dateOfBirth: '19900515',
        gender: '1',
        serviceCode: '612111',
        units: 566,
        days: 20,
        totalServiceUnits: 11320,
        benefitClaimAmount: 110700,
        copaymentAmount: 9300,
        areaUnitPrice: 0,
      },
      {
        recordType: 'trailer',
        totalCount: 1,
        totalUnits: 11320,
        totalClaimAmount: 110700,
      },
    ];

    const csv = encodeRecords(records);

    // Should end with CRLF
    expect(csv.endsWith('\r\n')).toBe(true);

    // Split on CRLF; last entry after final CRLF is empty string
    const lines = csv.split('\r\n');
    // 3 data lines + 1 trailing empty string
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
  });

  it('should not contain LF-only line endings', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'trailer',
        totalCount: 0,
        totalUnits: 0,
        totalClaimAmount: 0,
      },
    ];

    const csv = encodeRecords(records);

    // Remove all CRLF first, then check no bare LF remains
    const withoutCrlf = csv.replace(/\r\n/g, '');
    expect(withoutCrlf).not.toContain('\n');
  });

  it('should zero-pad numeric fields in data records', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'data',
        facilityNumber: '1312345678',
        serviceTypeCode: '612111',
        recipientNumber: '0123456789',
        nameKana: 'ヤマダタロウ',
        dateOfBirth: '19900515',
        gender: '1',
        serviceCode: '612111',
        units: 42,
        days: 5,
        totalServiceUnits: 210,
        benefitClaimAmount: 2000,
        copaymentAmount: 300,
        areaUnitPrice: 0,
      },
      {
        recordType: 'trailer',
        totalCount: 1,
        totalUnits: 210,
        totalClaimAmount: 2000,
      },
    ];

    const csv = encodeRecords(records);
    const lines = csv.split('\r\n');
    const dataLine = lines[1]!;
    const fields = dataLine.split(',');

    // units (index 7) should be zero-padded to 6 digits: "000042"
    expect(fields[7]).toBe('000042');
    // days (index 8) should be zero-padded to 2 digits: "05"
    expect(fields[8]).toBe('05');
    // totalServiceUnits (index 9) should be zero-padded to 8 digits: "00000210"
    expect(fields[9]).toBe('00000210');
    // benefitClaimAmount (index 10) should be zero-padded to 10 digits: "0000002000"
    expect(fields[10]).toBe('0000002000');
    // copaymentAmount (index 11) should be zero-padded to 10 digits: "0000000300"
    expect(fields[11]).toBe('0000000300');
  });

  it('should zero-pad trailer record fields', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'trailer',
        totalCount: 3,
        totalUnits: 500,
        totalClaimAmount: 45000,
      },
    ];

    const csv = encodeRecords(records);
    const lines = csv.split('\r\n');
    const trailerLine = lines[1]!;
    const fields = trailerLine.split(',');

    // totalCount padded to 6: "000003"
    expect(fields[0]).toBe('000003');
    // totalUnits padded to 10: "0000000500"
    expect(fields[1]).toBe('0000000500');
    // totalClaimAmount padded to 12: "000000045000"
    expect(fields[2]).toBe('000000045000');
  });

  it('should encode control record fields as comma-separated', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'trailer',
        totalCount: 0,
        totalUnits: 0,
        totalClaimAmount: 0,
      },
    ];

    const csv = encodeRecords(records);
    const controlLine = csv.split('\r\n')[0]!;
    const fields = controlLine.split(',');

    expect(fields[0]).toBe('7121');
    expect(fields[1]).toBe('5');
    expect(fields[2]).toBe('13');
    expect(fields[3]).toBe('');
    expect(fields[4]).toBe('1312345678');
    expect(fields[5]).toBe('20250601');
    expect(fields[6]).toBe('202506');
  });
});

describe('exportKokuhoRenCsv', () => {
  it('should succeed with dryRun=true without creating a file', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'data',
        facilityNumber: '1312345678',
        serviceTypeCode: '612111',
        recipientNumber: '0123456789',
        nameKana: 'ヤマダタロウ',
        dateOfBirth: '19900515',
        gender: '1',
        serviceCode: '612111',
        units: 566,
        days: 20,
        totalServiceUnits: 11320,
        benefitClaimAmount: 110700,
        copaymentAmount: 9300,
        areaUnitPrice: 0,
      },
      {
        recordType: 'trailer',
        totalCount: 1,
        totalUnits: 11320,
        totalClaimAmount: 110700,
      },
    ];

    const result = exportKokuhoRenCsv(records, '/tmp/test-kokuho-ren.csv', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(result.totalAmount).toBe(110700);
    // dryRun should not set filePath
    expect(result.filePath).toBeUndefined();
  });

  it('should return totalAmount equal to sum of data benefitClaimAmounts on dryRun', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'data',
        facilityNumber: '1312345678',
        serviceTypeCode: '612111',
        recipientNumber: '0123456789',
        nameKana: 'ヤマダタロウ',
        dateOfBirth: '19900515',
        gender: '1',
        serviceCode: '612111',
        units: 566,
        days: 20,
        totalServiceUnits: 11320,
        benefitClaimAmount: 80000,
        copaymentAmount: 9300,
        areaUnitPrice: 0,
      },
      {
        recordType: 'data',
        facilityNumber: '1312345678',
        serviceTypeCode: '612111',
        recipientNumber: '9876543210',
        nameKana: 'スズキハナコ',
        dateOfBirth: '19850320',
        gender: '2',
        serviceCode: '612111',
        units: 566,
        days: 15,
        totalServiceUnits: 8490,
        benefitClaimAmount: 60000,
        copaymentAmount: 4000,
        areaUnitPrice: 0,
      },
      {
        recordType: 'trailer',
        totalCount: 2,
        totalUnits: 19810,
        totalClaimAmount: 140000,
      },
    ];

    const result = exportKokuhoRenCsv(records, '/tmp/test-kokuho-ren2.csv', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(80000 + 60000);
  });

  it('should fail validation when records are empty', () => {
    const result = exportKokuhoRenCsv([], '/tmp/empty.csv', { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail validation when trailer totals mismatch data', () => {
    const records: KokuhoRenRecord[] = [
      {
        recordType: 'control',
        exchangeInfoId: '7121',
        mediaType: '5',
        prefectureCode: '13',
        insurerNumber: '',
        facilityNumber: '1312345678',
        createdDate: '20250601',
        targetYearMonth: '202506',
      },
      {
        recordType: 'data',
        facilityNumber: '1312345678',
        serviceTypeCode: '612111',
        recipientNumber: '0123456789',
        nameKana: 'ヤマダタロウ',
        dateOfBirth: '19900515',
        gender: '1',
        serviceCode: '612111',
        units: 566,
        days: 20,
        totalServiceUnits: 11320,
        benefitClaimAmount: 110700,
        copaymentAmount: 9300,
        areaUnitPrice: 0,
      },
      {
        recordType: 'trailer',
        totalCount: 99, // intentionally wrong
        totalUnits: 99999,
        totalClaimAmount: 99999,
      },
    ];

    const result = exportKokuhoRenCsv(records, '/tmp/mismatch.csv', { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
