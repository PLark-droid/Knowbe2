import { LarkAuth } from '../../src/lark/auth.js';

describe('LarkAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return cached token when still valid', async () => {
    const auth = new LarkAuth({ appId: 'app-id', appSecret: 'app-secret' });
    auth.setTokenForTest('cached-token', Date.now() + 10 * 60 * 1000);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(auth.getToken()).resolves.toBe('cached-token');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should refresh token when cache is missing', async () => {
    const auth = new LarkAuth({ appId: 'app-id', appSecret: 'app-secret' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          msg: 'ok',
          tenant_access_token: 'fresh-token',
          expire: 7200,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(auth.getToken()).resolves.toBe('fresh-token');
  });

  it('should throw when auth endpoint returns non-2xx', async () => {
    const auth = new LarkAuth({ appId: 'app-id', appSecret: 'app-secret' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('forbidden', { status: 403, statusText: 'Forbidden' }),
    );

    await expect(auth.getToken()).rejects.toThrow('Lark auth failed: 403 Forbidden');
  });

  it('should throw when response payload is invalid', async () => {
    const auth = new LarkAuth({ appId: 'app-id', appSecret: 'app-secret' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, msg: 'ok', expire: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(auth.getToken()).rejects.toThrow('Lark auth payload is invalid');
  });

  it('should throw when Lark code is non-zero', async () => {
    const auth = new LarkAuth({ appId: 'app-id', appSecret: 'app-secret' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 999, msg: 'bad request' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(auth.getToken()).rejects.toThrow('Lark auth error: 999 bad request');
  });
});
