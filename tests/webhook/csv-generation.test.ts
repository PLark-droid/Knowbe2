import {
  handleCsvGenerationRequest,
  handleCardAction,
} from '../../src/webhook/handlers/csv-generation.js';
import type { CsvGenerationDeps, CardActionPayload } from '../../src/webhook/handlers/csv-generation.js';
import type { Invoice, Facility, ServiceUser, Attendance, InvoiceStatus } from '../../src/types/domain.js';
import type { InvoiceRepository } from '../../src/lark/repositories/invoice.js';
import type { FacilityRepository } from '../../src/lark/repositories/facility.js';
import type { UserRepository } from '../../src/lark/repositories/user.js';
import type { AttendanceRepository } from '../../src/lark/repositories/attendance.js';
import type { LarkBotMessaging } from '../../src/lark/bot-messaging.js';

// ─── Test Fixtures ──────────────────────────────────────

function createMockFacility(overrides?: Partial<Facility>): Facility {
  return {
    id: 'rec_fac_001',
    facilityId: 'FAC001',
    name: 'テスト事業所',
    corporateName: 'テスト法人',
    facilityNumber: '1234567890',
    insurerNumber: '12345678',
    address: '東京都千代田区',
    postalCode: '100-0001',
    phone: '03-1234-5678',
    areaGrade: 1,
    rewardStructure: 'I',
    capacity: 20,
    averageMonthlyWage: 15000,
    serviceTypeCode: '612111',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockUser(overrides?: Partial<ServiceUser>): ServiceUser {
  return {
    id: 'rec_user_001',
    facilityId: 'FAC001',
    name: 'テスト太郎',
    nameKana: 'テストタロウ',
    recipientNumber: '0000000001',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    contractDaysPerMonth: 20,
    serviceStartDate: '2025-01-01',
    copaymentLimit: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: 'rec_inv_001',
    facilityId: 'FAC001',
    yearMonth: '2026-01',
    billingTarget: 'kokuho_ren',
    totalUnits: 1000,
    totalAmount: 100000,
    totalCopayment: 0,
    status: 'csv_generation_requested',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function createMockAttendance(overrides?: Partial<Attendance>): Attendance {
  return {
    id: 'rec_att_001',
    facilityId: 'FAC001',
    userId: 'rec_user_001',
    date: '2026-01-06',
    clockIn: '09:00',
    clockOut: '16:00',
    actualMinutes: 420,
    breakMinutes: 60,
    attendanceType: 'present',
    pickupType: 'none',
    mealProvided: false,
    createdAt: '2026-01-06T09:00:00Z',
    updatedAt: '2026-01-06T16:00:00Z',
    ...overrides,
  };
}

function createMockDeps(overrides?: Partial<CsvGenerationDeps>): CsvGenerationDeps {
  return {
    invoiceRepo: {
      findById: vi.fn().mockResolvedValue(createMockInvoice()),
      findAll: vi.fn().mockResolvedValue([createMockInvoice()]),
      findByYearMonth: vi.fn().mockResolvedValue([createMockInvoice()]),
      updateStatus: vi.fn().mockResolvedValue(createMockInvoice()),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as InvoiceRepository,
    facilityRepo: {
      findAll: vi.fn().mockResolvedValue([createMockFacility()]),
      findById: vi.fn().mockResolvedValue(createMockFacility()),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as FacilityRepository,
    userRepo: {
      findAll: vi.fn().mockResolvedValue([createMockUser()]),
      findById: vi.fn(),
      findByLineUserId: vi.fn(),
      findByRecipientNumber: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as UserRepository,
    attendanceRepo: {
      findAll: vi.fn().mockResolvedValue([]),
      findByUserAndDate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as AttendanceRepository,
    botMessaging: {
      sendInteractiveCard: vi.fn().mockResolvedValue('msg_001'),
      sendFile: vi.fn().mockResolvedValue('msg_002'),
      sendText: vi.fn().mockResolvedValue('msg_003'),
    } as unknown as LarkBotMessaging,
    chatId: 'chat_test_001',
    getAttendances: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  };
}

// ─── handleCsvGenerationRequest Tests ───────────────────

describe('handleCsvGenerationRequest', () => {
  it('should send confirmation card and update status to confirming', async () => {
    const deps = createMockDeps();
    const invoice = createMockInvoice();

    await handleCsvGenerationRequest(deps, invoice);

    expect(deps.facilityRepo.findAll).toHaveBeenCalledWith('FAC001');
    expect(deps.userRepo.findAll).toHaveBeenCalledWith('FAC001');
    expect(deps.botMessaging.sendInteractiveCard).toHaveBeenCalledWith(
      'chat_test_001',
      expect.objectContaining({
        header: expect.objectContaining({
          title: expect.objectContaining({ content: 'CSV生成依頼' }),
        }),
      }),
    );
    expect(deps.invoiceRepo.updateStatus).toHaveBeenCalledWith('rec_inv_001', 'confirming');
  });

  it('should not proceed when facility is not found', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = createMockDeps({
      facilityRepo: {
        findAll: vi.fn().mockResolvedValue([]),
      } as unknown as FacilityRepository,
    });
    const invoice = createMockInvoice();

    await handleCsvGenerationRequest(deps, invoice);

    expect(deps.botMessaging.sendInteractiveCard).not.toHaveBeenCalled();
    expect(deps.invoiceRepo.updateStatus).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should count only active users', async () => {
    const deps = createMockDeps({
      userRepo: {
        findAll: vi.fn().mockResolvedValue([
          createMockUser({ id: 'u1', isActive: true }),
          createMockUser({ id: 'u2', isActive: false }),
          createMockUser({ id: 'u3', isActive: true }),
        ]),
      } as unknown as UserRepository,
    });
    const invoice = createMockInvoice();

    await handleCsvGenerationRequest(deps, invoice);

    const cardArg = (deps.botMessaging.sendInteractiveCard as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as Record<string, unknown>;
    const cardJson = JSON.stringify(cardArg);
    expect(cardJson).toContain('2名');
  });
});

// ─── handleCardAction Tests ─────────────────────────────

describe('handleCardAction', () => {
  describe('cancel action', () => {
    it('should update status to cancelled and send cancellation card', async () => {
      const deps = createMockDeps();
      const payload: CardActionPayload = {
        action: 'cancel',
        invoice_id: 'rec_inv_001',
        facility_id: 'FAC001',
        year_month: '2026-01',
      };

      await handleCardAction(deps, payload);

      expect(deps.invoiceRepo.updateStatus).toHaveBeenCalledWith('rec_inv_001', 'cancelled');
      expect(deps.botMessaging.sendInteractiveCard).toHaveBeenCalledWith(
        'chat_test_001',
        expect.objectContaining({
          header: expect.objectContaining({
            title: expect.objectContaining({ content: 'CSV生成キャンセル' }),
          }),
        }),
      );
    });
  });

  describe('confirm action', () => {
    it('should generate CSVs and update status to csv_generated', async () => {
      const attendanceMap = new Map<string, Attendance[]>([
        [
          'rec_user_001',
          [
            createMockAttendance({ date: '2026-01-06' }),
            createMockAttendance({ id: 'rec_att_002', date: '2026-01-07' }),
          ],
        ],
      ]);

      const deps = createMockDeps({
        getAttendances: vi.fn().mockResolvedValue(attendanceMap),
      });
      const payload: CardActionPayload = {
        action: 'confirm',
        invoice_id: 'rec_inv_001',
        facility_id: 'FAC001',
        year_month: '2026-01',
      };

      await handleCardAction(deps, payload);

      // Status transitions: generating -> csv_generated
      const updateStatusCalls = (deps.invoiceRepo.updateStatus as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(updateStatusCalls[0]).toEqual(['rec_inv_001', 'generating']);

      // Final status should be csv_generated
      const lastCall = updateStatusCalls[updateStatusCalls.length - 1] as [string, InvoiceStatus];
      expect(lastCall[1]).toBe('csv_generated');

      // Should send completion card
      expect(deps.botMessaging.sendInteractiveCard).toHaveBeenCalledWith(
        'chat_test_001',
        expect.objectContaining({
          header: expect.objectContaining({
            title: expect.objectContaining({ content: 'CSV生成完了' }),
          }),
        }),
      );

      // Should send CSV text messages
      expect(deps.botMessaging.sendText).toHaveBeenCalledTimes(2);
    });

    it('should handle CSV generation error and revert to confirming', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const deps = createMockDeps({
        facilityRepo: {
          findAll: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        } as unknown as FacilityRepository,
      });
      const payload: CardActionPayload = {
        action: 'confirm',
        invoice_id: 'rec_inv_001',
        facility_id: 'FAC001',
        year_month: '2026-01',
      };

      await handleCardAction(deps, payload);

      // First call: generating, last call: confirming (rollback)
      const updateStatusCalls = (deps.invoiceRepo.updateStatus as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(updateStatusCalls[0]).toEqual(['rec_inv_001', 'generating']);
      const lastCall = updateStatusCalls[updateStatusCalls.length - 1] as [string, InvoiceStatus];
      expect(lastCall[1]).toBe('confirming');

      // Should send error notification
      expect(deps.botMessaging.sendText).toHaveBeenCalledWith(
        'chat_test_001',
        expect.stringContaining('CSV生成エラー'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle facility not found during confirm', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const deps = createMockDeps({
        facilityRepo: {
          findAll: vi.fn().mockResolvedValue([]),
        } as unknown as FacilityRepository,
      });
      const payload: CardActionPayload = {
        action: 'confirm',
        invoice_id: 'rec_inv_001',
        facility_id: 'FAC001',
        year_month: '2026-01',
      };

      await handleCardAction(deps, payload);

      // Should revert status
      const updateStatusCalls = (deps.invoiceRepo.updateStatus as ReturnType<typeof vi.fn>).mock
        .calls;
      const lastCall = updateStatusCalls[updateStatusCalls.length - 1] as [string, InvoiceStatus];
      expect(lastCall[1]).toBe('confirming');

      consoleSpy.mockRestore();
    });
  });

  describe('unknown action', () => {
    it('should log warning for unknown action types', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const deps = createMockDeps();
      const payload = {
        action: 'unknown' as 'confirm',
        invoice_id: 'rec_inv_001',
        facility_id: 'FAC001',
        year_month: '2026-01',
      };

      await handleCardAction(deps, payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown card action'),
      );
      consoleSpy.mockRestore();
    });
  });
});
