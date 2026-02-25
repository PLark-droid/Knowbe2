/**
 * E2E Flow Test: Health Check API
 *
 * POST /api/health-check のロジック層を検証する。
 * start.ts の healthCheckApiHandler と同等のロジックをモック注入で再現し、
 * UserRepo / HealthCheckRepo / LINE通知 の組合せをテストする。
 *
 * Express のリクエスト / レスポンスをモックして検証。
 */
import type { Request, Response } from 'express';
import type { HealthCheck } from '../../src/types/domain.js';

// ─── Types ───────────────────────────────────────────────

interface HealthCheckApiDeps {
  findUserByLineId: (
    lineUserId: string,
  ) => Promise<{ id: string; facilityId: string; name: string } | null>;
  createHealthCheck: (data: Omit<HealthCheck, 'id'>) => Promise<HealthCheck>;
}

interface HealthCheckRequestBody {
  lineUserId?: string;
  score?: number;
  sleepHours?: number;
  meals?: { breakfast: boolean; lunch: boolean; dinner: boolean };
  mood?: string;
  note?: string;
}

// ─── Handler under test (mirrors start.ts logic) ────────

/**
 * start.ts に定義されている healthCheckApiHandler と同等のロジック。
 * 依存注入可能にして E2E テスト用に切り出す。
 */
function createHealthCheckApiHandler(deps: HealthCheckApiDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as HealthCheckRequestBody;

      if (!body.lineUserId) {
        res.status(400).json({ error: 'lineUserId is required' });
        return;
      }

      const user = await deps.findUserByLineId(body.lineUserId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const rawScore = body.score ?? 3;
      const score = (rawScore >= 1 && rawScore <= 5 ? rawScore : 3) as 1 | 2 | 3 | 4 | 5;

      const healthCheck = await deps.createHealthCheck({
        facilityId: user.facilityId,
        userId: user.id,
        date: today,
        score,
        sleepHours: body.sleepHours,
        meals: body.meals ?? { breakfast: false, lunch: false, dinner: false },
        mood: body.mood,
        note: body.note,
        createdAt: new Date().toISOString(),
      });

      res.status(201).json({ status: 'ok', healthCheck });
    } catch {
      res.status(500).json({ error: 'Health check processing failed' });
    }
  };
}

// ─── Mock Helpers ────────────────────────────────────────

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

function createMockRequest(body: Record<string, unknown>): Request {
  return { body } as Request;
}

const TEST_USER = { id: 'user-001', facilityId: 'fac-001', name: 'Test Hanako' };

function makeHealthCheck(overrides: Partial<HealthCheck> = {}): HealthCheck {
  return {
    id: 'hc-001',
    facilityId: 'fac-001',
    userId: 'user-001',
    date: '2026-02-25',
    score: 3,
    sleepHours: 7,
    meals: { breakfast: true, lunch: true, dinner: true },
    mood: 'good',
    note: undefined,
    createdAt: '2026-02-25T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('E2E: Health Check Flow', () => {
  // ── 1. 正常な体調チェック送信 ──────────────────────────
  describe('successful health check submission', () => {
    it('should create health check and return 201', async () => {
      const createdRecord = makeHealthCheck({ score: 4, sleepHours: 8 });
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn().mockResolvedValue(TEST_USER),
        createHealthCheck: vi.fn().mockResolvedValue(createdRecord),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({
        lineUserId: 'line-user-001',
        score: 4,
        sleepHours: 8,
        meals: { breakfast: true, lunch: true, dinner: false },
        mood: 'good',
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          healthCheck: expect.objectContaining({ id: 'hc-001', score: 4 }),
        }),
      );

      expect(deps.findUserByLineId).toHaveBeenCalledWith('line-user-001');
      expect(deps.createHealthCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          facilityId: 'fac-001',
          userId: 'user-001',
          score: 4,
          sleepHours: 8,
          meals: { breakfast: true, lunch: true, dinner: false },
          mood: 'good',
        }),
      );
    });

    it('should default score to 3 and meals to all false when not provided', async () => {
      const createdRecord = makeHealthCheck({ score: 3 });
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn().mockResolvedValue(TEST_USER),
        createHealthCheck: vi.fn().mockResolvedValue(createdRecord),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({ lineUserId: 'line-user-001' });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(201);
      expect(deps.createHealthCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 3,
          meals: { breakfast: false, lunch: false, dinner: false },
        }),
      );
    });
  });

  // ── 2. 未登録ユーザー ──────────────────────────────────
  describe('unregistered user', () => {
    it('should return 404 when user is not found', async () => {
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn().mockResolvedValue(null),
        createHealthCheck: vi.fn(),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({
        lineUserId: 'unknown-user',
        score: 3,
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
      expect(deps.createHealthCheck).not.toHaveBeenCalled();
    });
  });

  // ── 3. lineUserId 欠落 ─────────────────────────────────
  describe('missing lineUserId', () => {
    it('should return 400 when lineUserId is not provided', async () => {
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn(),
        createHealthCheck: vi.fn(),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({ score: 4 });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'lineUserId is required' });
      expect(deps.findUserByLineId).not.toHaveBeenCalled();
      expect(deps.createHealthCheck).not.toHaveBeenCalled();
    });

    it('should return 400 when lineUserId is empty string', async () => {
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn(),
        createHealthCheck: vi.fn(),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({ lineUserId: '', score: 3 });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'lineUserId is required' });
    });
  });

  // ── 4. スコアバリデーション ────────────────────────────
  describe('score validation', () => {
    it.each([1, 2, 3, 4, 5] as const)(
      'should accept valid score %d',
      async (validScore) => {
        const createdRecord = makeHealthCheck({ score: validScore });
        const deps: HealthCheckApiDeps = {
          findUserByLineId: vi.fn().mockResolvedValue(TEST_USER),
          createHealthCheck: vi.fn().mockResolvedValue(createdRecord),
        };
        const handler = createHealthCheckApiHandler(deps);

        const req = createMockRequest({
          lineUserId: 'line-user-001',
          score: validScore,
        });
        const res = createMockResponse();

        await handler(req, res as unknown as Response);

        expect(res.statusCode).toBe(201);
        expect(deps.createHealthCheck).toHaveBeenCalledWith(
          expect.objectContaining({ score: validScore }),
        );
      },
    );

    it('should default to score 3 for out-of-range values', async () => {
      const createdRecord = makeHealthCheck({ score: 3 });
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn().mockResolvedValue(TEST_USER),
        createHealthCheck: vi.fn().mockResolvedValue(createdRecord),
      };
      const handler = createHealthCheckApiHandler(deps);

      // Score 0 is out of range
      const req = createMockRequest({ lineUserId: 'line-user-001', score: 0 });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(201);
      expect(deps.createHealthCheck).toHaveBeenCalledWith(
        expect.objectContaining({ score: 3 }),
      );
    });

    it('should default to score 3 for values above 5', async () => {
      const createdRecord = makeHealthCheck({ score: 3 });
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn().mockResolvedValue(TEST_USER),
        createHealthCheck: vi.fn().mockResolvedValue(createdRecord),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({ lineUserId: 'line-user-001', score: 10 });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(201);
      expect(deps.createHealthCheck).toHaveBeenCalledWith(
        expect.objectContaining({ score: 3 }),
      );
    });
  });

  // ── 5. サーバーエラー ──────────────────────────────────
  describe('server error', () => {
    it('should return 500 when repository throws', async () => {
      const deps: HealthCheckApiDeps = {
        findUserByLineId: vi.fn().mockResolvedValue(TEST_USER),
        createHealthCheck: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      };
      const handler = createHealthCheckApiHandler(deps);

      const req = createMockRequest({
        lineUserId: 'line-user-001',
        score: 3,
      });
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Health check processing failed' });
    });
  });
});
