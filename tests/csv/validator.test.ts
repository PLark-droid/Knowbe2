import { validateKokuhoRenRecords } from '../../src/csv/validator.js';
import type {
  KokuhoRenControlRecord,
  KokuhoRenDataRecord,
  KokuhoRenTrailerRecord,
  KokuhoRenRecord,
} from '../../src/types/csv.js';

function createValidRecords(): KokuhoRenRecord[] {
  const control: KokuhoRenControlRecord = {
    recordType: 'control',
    exchangeInfoId: 'EXCH001',
    mediaType: '5',
    prefectureCode: '13',
    insurerNumber: '12345678',
    facilityNumber: '1300000001',
    createdDate: '20250630',
    targetYearMonth: '202506',
  };

  const data: KokuhoRenDataRecord = {
    recordType: 'data',
    facilityNumber: '1300000001',
    serviceTypeCode: '612111',
    recipientNumber: '1300000002',
    nameKana: 'タナカタロウ',
    dateOfBirth: '19900101',
    gender: '1',
    serviceCode: '612111',
    units: 567,
    days: 20,
    totalServiceUnits: 11340,
    benefitClaimAmount: 100000,
    copaymentAmount: 9300,
    areaUnitPrice: 11.4,
  };

  const trailer: KokuhoRenTrailerRecord = {
    recordType: 'trailer',
    totalCount: 1,
    totalUnits: 11340,
    totalClaimAmount: 100000,
  };

  return [control, data, trailer];
}

describe('validateKokuhoRenRecords', () => {
  it('should pass with valid records', () => {
    const result = validateKokuhoRenRecords(createValidRecords());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when records are empty', () => {
    const result = validateKokuhoRenRecords([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.field).toBe('records');
  });

  it('should fail when trailer totals do not match data totals', () => {
    const records = createValidRecords();
    const trailer = records[2] as KokuhoRenTrailerRecord;
    trailer.totalUnits = 9999;

    const result = validateKokuhoRenRecords(records);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'totalUnits')).toBe(true);
  });

  it('should fail when data record has invalid fields', () => {
    const records = createValidRecords();
    const data = records[1] as KokuhoRenDataRecord;
    data.recipientNumber = 'abc';
    data.days = 0;

    const result = validateKokuhoRenRecords(records);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'recipientNumber')).toBe(true);
    expect(result.errors.some((e) => e.field === 'days')).toBe(true);
  });

  it('should fail when nameKana contains half-width kana or romaji', () => {
    const records = createValidRecords();
    const data = records[1] as KokuhoRenDataRecord;
    data.nameKana = 'ﾀﾅｶTARO';

    const result = validateKokuhoRenRecords(records);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'nameKana')).toBe(true);
  });

  it('should fail when birth date is not a real date', () => {
    const records = createValidRecords();
    const data = records[1] as KokuhoRenDataRecord;
    data.dateOfBirth = '19990230';

    const result = validateKokuhoRenRecords(records);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'dateOfBirth')).toBe(true);
  });

  it('should fail when birth date is in future or before 1900', () => {
    const futureRecords = createValidRecords();
    const futureData = futureRecords[1] as KokuhoRenDataRecord;
    futureData.dateOfBirth = '29990101';

    const pastRecords = createValidRecords();
    const pastData = pastRecords[1] as KokuhoRenDataRecord;
    pastData.dateOfBirth = '18991231';

    const futureResult = validateKokuhoRenRecords(futureRecords);
    const pastResult = validateKokuhoRenRecords(pastRecords);

    expect(futureResult.errors.some((e) => e.field === 'dateOfBirth')).toBe(true);
    expect(pastResult.errors.some((e) => e.field === 'dateOfBirth')).toBe(true);
  });

  it('should fail when total service units exceed monthly cap', () => {
    const records = createValidRecords();
    const data = records[1] as KokuhoRenDataRecord;
    data.totalServiceUnits = 31001;

    const result = validateKokuhoRenRecords(records);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'totalServiceUnits')).toBe(true);
  });
});
