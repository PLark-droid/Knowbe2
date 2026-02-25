import { getCurrentTenant, requireTenant, runWithTenant } from '../../src/utils/tenant.js';

describe('tenant utils', () => {
  it('should provide tenant context inside runWithTenant', async () => {
    const ctx = { facilityId: 'FAC001', facilityNumber: '1300000001' };

    await runWithTenant(ctx, async () => {
      await Promise.resolve();
      expect(getCurrentTenant()).toEqual(ctx);
      expect(requireTenant()).toEqual(ctx);
    });
  });

  it('should return undefined outside tenant context', () => {
    expect(getCurrentTenant()).toBeUndefined();
  });

  it('should throw when tenant context is required but not set', () => {
    expect(() => requireTenant()).toThrow('Tenant context is not set');
  });
});
