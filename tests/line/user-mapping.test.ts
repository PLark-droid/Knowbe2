import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMappingService, type UserMappingDeps } from '../../src/line/user-mapping.js';
import type { ServiceUser } from '../../src/types/domain.js';

function createUser(overrides: Partial<ServiceUser> = {}): ServiceUser {
  return {
    id: 'user-1',
    facilityId: 'fac-1',
    name: 'Test User',
    nameKana: 'テストユーザー',
    recipientNumber: '1234567890',
    dateOfBirth: '1990-01-01',
    gender: 'other',
    contractDaysPerMonth: 20,
    serviceStartDate: '2025-01-01',
    copaymentLimit: 10000,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createDeps(overrides: Partial<UserMappingDeps> = {}): UserMappingDeps {
  return {
    findUserByLineId: vi.fn().mockResolvedValue(null),
    findUserByRecipientNumber: vi.fn().mockResolvedValue(null),
    updateUserLineId: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('UserMappingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findUser should cache successful lookup by lineUserId', async () => {
    const deps = createDeps({
      findUserByLineId: vi.fn().mockResolvedValue(createUser()),
    });
    const svc = new UserMappingService(deps);

    const first = await svc.findUser('line-1');
    const second = await svc.findUser('line-1');

    expect(first?.id).toBe('user-1');
    expect(second?.id).toBe('user-1');
    expect(deps.findUserByLineId).toHaveBeenCalledTimes(1);
  });

  it('findUser should not cache null responses', async () => {
    const deps = createDeps({
      findUserByLineId: vi.fn().mockResolvedValue(null),
    });
    const svc = new UserMappingService(deps);

    await svc.findUser('line-2');
    await svc.findUser('line-2');

    expect(deps.findUserByLineId).toHaveBeenCalledTimes(2);
  });

  it('registerUser should return null when recipientNumber not found', async () => {
    const deps = createDeps({
      findUserByRecipientNumber: vi.fn().mockResolvedValue(null),
    });
    const svc = new UserMappingService(deps);

    const result = await svc.registerUser('line-x', '0000000000');

    expect(result).toBeNull();
    expect(deps.updateUserLineId).not.toHaveBeenCalled();
  });

  it('registerUser should update lineId and cache updated user', async () => {
    const original = createUser({ lineUserId: undefined });
    const deps = createDeps({
      findUserByRecipientNumber: vi.fn().mockResolvedValue(original),
      updateUserLineId: vi.fn().mockResolvedValue(undefined),
      findUserByLineId: vi.fn().mockResolvedValue(null),
    });
    const svc = new UserMappingService(deps);

    const registered = await svc.registerUser('line-new', '1234567890');
    const cached = await svc.findUser('line-new');

    expect(deps.updateUserLineId).toHaveBeenCalledWith('user-1', 'line-new');
    expect(registered?.lineUserId).toBe('line-new');
    expect(cached?.lineUserId).toBe('line-new');
    expect(deps.findUserByLineId).not.toHaveBeenCalled();
  });

  it('clearCache should force subsequent lookup to hit deps again', async () => {
    const deps = createDeps({
      findUserByLineId: vi.fn().mockResolvedValue(createUser()),
    });
    const svc = new UserMappingService(deps);

    await svc.findUser('line-3');
    svc.clearCache();
    await svc.findUser('line-3');

    expect(deps.findUserByLineId).toHaveBeenCalledTimes(2);
  });
});
