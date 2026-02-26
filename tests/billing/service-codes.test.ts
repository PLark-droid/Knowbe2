import { describe, expect, it } from 'vitest';
import {
  ADDITION_CODES,
  AREA_UNIT_PRICES,
  BASE_REWARD_UNITS,
  ServiceCodeEngine,
} from '../../src/billing/service-codes.js';
import type { ServiceCode } from '../../src/types/domain.js';

function code(overrides: Partial<ServiceCode> = {}): ServiceCode {
  return {
    id: 'rec-1',
    code: '600001',
    name: '基本報酬',
    units: 100,
    serviceType: '就労継続支援B型',
    validFrom: '2026-01-01',
    isAddition: false,
    ...overrides,
  };
}

describe('service-codes constants', () => {
  it('should expose area prices and base reward/addition maps', () => {
    expect(AREA_UNIT_PRICES[1]).toBe(11.4);
    expect(BASE_REWARD_UNITS['I']!['4.5万円以上']).toBe(702);
    expect(ADDITION_CODES['612311']).toEqual({ name: '食事提供体制加算', units: 30 });
  });
});

describe('ServiceCodeEngine', () => {
  it('findByCode should return from initial cache then undefined for missing', () => {
    const engine = new ServiceCodeEngine([
      code({ id: 'r1', code: '600001', name: 'A' }),
      code({ id: 'r2', code: '600002', name: 'B' }),
    ]);

    expect(engine.findByCode('600001')?.name).toBe('A');
    expect(engine.findByCode('600002')?.name).toBe('B');
    expect(engine.findByCode('999999')).toBeUndefined();
  });

  it('findByCode should populate cache when code exists only in backing list', () => {
    const engine = new ServiceCodeEngine([]);
    (engine as unknown as { codes: ServiceCode[] }).codes = [code({ id: 'late', code: '612311', name: 'late' })];

    const first = engine.findByCode('612311');
    const second = engine.findByCode('612311');

    expect(first?.id).toBe('late');
    expect(second?.id).toBe('late');
  });

  it('findAllValid should include only codes valid on the target date', () => {
    const engine = new ServiceCodeEngine([
      code({ id: 'v1', code: '600001', validFrom: '2026-01-01', validTo: '2026-12-31' }),
      code({ id: 'v2', code: '600002', validFrom: '2027-01-01' }),
      code({ id: 'v3', code: '600003', validFrom: '2025-01-01', validTo: '2025-12-31' }),
    ]);

    expect(engine.findAllValid('2026-02-01').map((c) => c.id)).toEqual(['v1']);
  });

  it('findAdditions should return only addition codes', () => {
    const engine = new ServiceCodeEngine([
      code({ id: 'a1', code: '600001', isAddition: false }),
      code({ id: 'a2', code: '612311', isAddition: true }),
    ]);

    expect(engine.findAdditions().map((c) => c.id)).toEqual(['a2']);
  });

  it('getAreaUnitPrice should return mapped grade and fallback to default', () => {
    expect(ServiceCodeEngine.getAreaUnitPrice(3)).toBe(11.05);
    expect(ServiceCodeEngine.getAreaUnitPrice(999)).toBe(10.0);
  });

  it('getBaseRewardUnits should resolve category/default and unknown structure', () => {
    expect(ServiceCodeEngine.getBaseRewardUnits('I', '3万円以上3.5万円未満')).toBe(647);
    expect(ServiceCodeEngine.getBaseRewardUnits('III', 'anything')).toBe(556);
    expect(ServiceCodeEngine.getBaseRewardUnits('UNKNOWN', 'x')).toBe(0);
  });

  it('getBaseRewardUnits should support tier lookup for reward structures III-VI', () => {
    expect(ServiceCodeEngine.getBaseRewardUnits('III', '41〜60人')).toBe(536);
    expect(ServiceCodeEngine.getBaseRewardUnits('IV', '81人以上')).toBe(476);
    expect(ServiceCodeEngine.getBaseRewardUnits('V', '21〜40人')).toBe(496);
    expect(ServiceCodeEngine.getBaseRewardUnits('VI', '61〜80人')).toBe(456);
  });
});
