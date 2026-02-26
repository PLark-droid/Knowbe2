import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateWebhookSecretsMock = vi.fn();
const createServerMock = vi.fn();
const startServerMock = vi.fn();

const createLineWebhookHandlerMock = vi.fn();
const createLarkWebhookHandlerMock = vi.fn();
const createAttendanceHandlerMock = vi.fn();

const userRepoApi = { findByLineUserId: vi.fn() };
const attendanceRepoApi = { findByUserAndDate: vi.fn(), create: vi.fn(), update: vi.fn() };
const healthCheckRepoApi = { create: vi.fn() };

const lineMessagingApi = {
  replyMessage: vi.fn(),
  pushMessage: vi.fn(),
  buildHealthCheckResult: vi.fn(),
};

const larkAuthCtorMock = vi.fn();
const bitableClientCtorMock = vi.fn();
const userRepositoryCtorMock = vi.fn(() => userRepoApi);
const attendanceRepositoryCtorMock = vi.fn(() => attendanceRepoApi);
const healthCheckRepositoryCtorMock = vi.fn(() => healthCheckRepoApi);
const lineMessagingCtorMock = vi.fn(() => lineMessagingApi);

vi.mock('../../src/webhook/validate-secrets.js', () => ({
  validateWebhookSecrets: validateWebhookSecretsMock,
}));

vi.mock('../../src/webhook/server.js', () => ({
  createServer: createServerMock,
}));

vi.mock('../../src/webhook/handlers/line.js', () => ({
  createLineWebhookHandler: createLineWebhookHandlerMock,
}));

vi.mock('../../src/webhook/handlers/lark.js', () => ({
  createLarkWebhookHandler: createLarkWebhookHandlerMock,
}));

vi.mock('../../src/webhook/handlers/line-attendance.js', () => ({
  createAttendanceHandler: createAttendanceHandlerMock,
}));

vi.mock('../../src/lark/auth.js', () => ({
  LarkAuth: larkAuthCtorMock,
}));

vi.mock('../../src/lark/client.js', () => ({
  BitableClient: bitableClientCtorMock,
}));

vi.mock('../../src/lark/repositories/user.js', () => ({
  UserRepository: userRepositoryCtorMock,
}));

vi.mock('../../src/lark/repositories/attendance.js', () => ({
  AttendanceRepository: attendanceRepositoryCtorMock,
}));

vi.mock('../../src/lark/repositories/health-check.js', () => ({
  HealthCheckRepository: healthCheckRepositoryCtorMock,
}));

vi.mock('../../src/line/messaging.js', () => ({
  LineMessagingService: lineMessagingCtorMock,
}));

interface MockResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function setBaseEnv(): void {
  process.env['PORT'] = '3456';
  process.env['LINE_CHANNEL_SECRET'] = 'line-secret';
  process.env['LINE_CHANNEL_ACCESS_TOKEN'] = 'line-token';
  process.env['LARK_VERIFICATION_TOKEN'] = 'lark-verify';
  process.env['LARK_APP_ID'] = 'app-id';
  process.env['LARK_APP_SECRET'] = 'app-secret';
  process.env['LARK_BASE_APP_TOKEN'] = 'base-token';
  process.env['LARK_TABLE_USER'] = 'tbl-user';
  process.env['LARK_TABLE_ATTENDANCE'] = 'tbl-att';
  process.env['LARK_TABLE_HEALTH_CHECK'] = 'tbl-hc';
  process.env['NODE_ENV'] = 'production';
}

describe('webhook/start bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    setBaseEnv();

    validateWebhookSecretsMock.mockReturnValue({ missing: [], warnings: [] });
    createServerMock.mockReturnValue({ start: startServerMock });

    createAttendanceHandlerMock.mockReturnValue(vi.fn());
    createLineWebhookHandlerMock.mockReturnValue(vi.fn());
    createLarkWebhookHandlerMock.mockReturnValue(vi.fn());

    userRepoApi.findByLineUserId.mockReset();
    attendanceRepoApi.findByUserAndDate.mockReset();
    attendanceRepoApi.create.mockReset();
    attendanceRepoApi.update.mockReset();
    healthCheckRepoApi.create.mockReset();

    lineMessagingApi.replyMessage.mockReset();
    lineMessagingApi.pushMessage.mockReset();
    lineMessagingApi.buildHealthCheckResult.mockReset();
    lineMessagingApi.buildHealthCheckResult.mockReturnValue({ type: 'flex', altText: 'ok', contents: {} });
  });

  it('should exit immediately when required secrets are missing', async () => {
    validateWebhookSecretsMock.mockReturnValue({ missing: ['LINE_CHANNEL_SECRET'], warnings: [] });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);

    await expect(import('../../src/webhook/start.js')).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(createServerMock).not.toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should bootstrap dependencies and start server when configuration is valid', async () => {
    validateWebhookSecretsMock.mockReturnValue({ missing: [], warnings: ['dev warning'] });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await import('../../src/webhook/start.js');

    expect(validateWebhookSecretsMock).toHaveBeenCalledWith({
      lineChannelSecret: 'line-secret',
      larkVerificationToken: 'lark-verify',
      larkAppId: 'app-id',
      larkAppSecret: 'app-secret',
      larkBaseAppToken: 'base-token',
      isProduction: true,
    });

    expect(larkAuthCtorMock).toHaveBeenCalledWith({ appId: 'app-id', appSecret: 'app-secret' });
    expect(bitableClientCtorMock).toHaveBeenCalledWith({ auth: expect.any(Object), appToken: 'base-token' });
    expect(userRepositoryCtorMock).toHaveBeenCalledWith(expect.any(Object), 'tbl-user');
    expect(attendanceRepositoryCtorMock).toHaveBeenCalledWith(expect.any(Object), 'tbl-att');
    expect(healthCheckRepositoryCtorMock).toHaveBeenCalledWith(expect.any(Object), 'tbl-hc');
    expect(lineMessagingCtorMock).toHaveBeenCalledWith('line-token');

    expect(createServerMock).toHaveBeenCalledTimes(1);
    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('WARNING: dev warning');

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('healthCheckApiHandler should validate input and process create/push flow', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../../src/webhook/start.js');

    const createServerArgs = createServerMock.mock.calls[0]![0] as {
      healthCheckApiHandler: (req: Request, res: Response) => Promise<void>;
    };
    const handler = createServerArgs.healthCheckApiHandler;

    const res1 = createMockResponse();
    await handler({ body: {} } as Request, res1 as unknown as Response);
    expect(res1.statusCode).toBe(400);
    expect(res1.body).toEqual({ error: 'lineUserId is required' });

    userRepoApi.findByLineUserId.mockResolvedValueOnce(null);
    const res2 = createMockResponse();
    await handler({ body: { lineUserId: 'U404' } } as Request, res2 as unknown as Response);
    expect(res2.statusCode).toBe(404);
    expect(res2.body).toEqual({ error: 'User not found' });

    userRepoApi.findByLineUserId.mockResolvedValueOnce({
      id: 'user-1',
      facilityId: 'fac-1',
      name: 'Taro',
    });
    healthCheckRepoApi.create.mockResolvedValueOnce({ id: 'hc-1' });

    const res3 = createMockResponse();
    await handler(
      {
        body: {
          lineUserId: ' U100 ',
          score: 'bad',
          sleepHours: 6.5,
          meals: { breakfast: true, lunch: 'x', dinner: true },
          mood: 'fine',
          note: 'memo',
        },
      } as Request,
      res3 as unknown as Response,
    );

    expect(healthCheckRepoApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: 'fac-1',
        userId: 'user-1',
        score: 3,
        sleepHours: 6.5,
        meals: { breakfast: true, lunch: false, dinner: true },
        mood: 'fine',
        note: 'memo',
      }),
    );
    expect(lineMessagingApi.buildHealthCheckResult).toHaveBeenCalledWith('Taro', 3);
    expect(lineMessagingApi.pushMessage).toHaveBeenCalledWith('U100', [{ type: 'flex', altText: 'ok', contents: {} }]);
    expect(res3.statusCode).toBe(201);
    expect(res3.body).toEqual({ status: 'ok', healthCheck: { id: 'hc-1' } });

    userRepoApi.findByLineUserId.mockResolvedValueOnce({ id: 'user-2', facilityId: 'fac-2', name: 'Hanako' });
    healthCheckRepoApi.create.mockRejectedValueOnce(new Error('db failed'));

    const res4 = createMockResponse();
    await handler(
      { body: { lineUserId: 'U500', score: 5 } } as Request,
      res4 as unknown as Response,
    );

    expect(res4.statusCode).toBe(500);
    expect(res4.body).toEqual({ error: 'Health check processing failed' });

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('healthCheckApiHandler should continue when LINE push fails', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../../src/webhook/start.js');

    const createServerArgs = createServerMock.mock.calls[0]![0] as {
      healthCheckApiHandler: (req: Request, res: Response) => Promise<void>;
    };
    const handler = createServerArgs.healthCheckApiHandler;

    userRepoApi.findByLineUserId.mockResolvedValueOnce({
      id: 'user-9',
      facilityId: 'fac-9',
      name: 'PushErr',
    });
    healthCheckRepoApi.create.mockResolvedValueOnce({ id: 'hc-push' });
    lineMessagingApi.buildHealthCheckResult.mockReturnValueOnce({ type: 'flex', altText: 'x', contents: {} });
    lineMessagingApi.pushMessage.mockRejectedValueOnce(new Error('push failed'));

    const res = createMockResponse();
    await handler(
      { body: { lineUserId: 'U-PUSH', score: 5, meals: null } } as Request,
      res as unknown as Response,
    );

    expect(healthCheckRepoApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 5,
        meals: { breakfast: false, lunch: false, dinner: false },
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ status: 'ok', healthCheck: { id: 'hc-push' } });
    expect(errorSpy).toHaveBeenCalledWith('LINE push message failed:', expect.any(Error));

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should bootstrap without LINE access token and use reply stub in attendance deps', async () => {
    process.env['LINE_CHANNEL_ACCESS_TOKEN'] = '';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await import('../../src/webhook/start.js');

    expect(lineMessagingCtorMock).not.toHaveBeenCalled();

    const attendanceDeps = createAttendanceHandlerMock.mock.calls[0]![0] as {
      replyMessage: (replyToken: string, messages: unknown[]) => Promise<void>;
    };

    await attendanceDeps.replyMessage('reply-token-xyz', [{ type: 'text', text: 'stub' }]);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Reply stub] token=reply-to... messages='),
      expect.any(String),
    );

    logSpy.mockRestore();
  });
});
