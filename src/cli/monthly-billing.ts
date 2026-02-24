/**
 * 月次請求CLIコマンド
 * Usage: npm run billing:run -- --month=2026-02 --facility=FACILITY_ID [--dry-run]
 */

import type {
  Facility,
  ServiceUser,
  Attendance,
  ProductActivity,
  ProductOutput,
} from '../types/domain.js';
import type { MonthlyBillingDataProvider } from '../billing/monthly-billing.js';
import { runMonthlyBilling } from '../billing/monthly-billing.js';

interface CliArgs {
  month: string;
  facility: string;
  outputDir: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {
    outputDir: './exports',
    dryRun: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    const [key, value] = arg.replace(/^--/, '').split('=');
    switch (key) {
      case 'month':
        parsed.month = value;
        break;
      case 'facility':
        parsed.facility = value;
        break;
      case 'output-dir':
        parsed.outputDir = value;
        break;
    }
  }

  if (!parsed.month || !parsed.facility) {
    console.error('Usage: npm run billing:run -- --month=YYYY-MM --facility=FACILITY_ID [--dry-run]');
    process.exit(1);
  }

  return parsed as CliArgs;
}

/**
 * スタブデータプロバイダー (Lark Base接続前のテスト用)
 */
function createStubProvider(): MonthlyBillingDataProvider {
  return {
    async getFacility(facilityId: string): Promise<Facility> {
      return {
        id: '1',
        facilityId,
        name: 'テスト事業所',
        corporateName: 'テスト法人',
        facilityNumber: '1300000001',
        address: '東京都千代田区',
        postalCode: '100-0001',
        phone: '03-1234-5678',
        areaGrade: 1,
        rewardStructure: 'II',
        capacity: 20,
        serviceTypeCode: '612100',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async getActiveUsers(): Promise<ServiceUser[]> {
      return [
        {
          id: 'u1', facilityId: 'TEST001', name: '山田太郎', nameKana: 'ヤマダタロウ',
          recipientNumber: '1300000001', dateOfBirth: '1990-01-01', gender: 'male',
          contractDaysPerMonth: 20, serviceStartDate: '2024-04-01',
          copaymentLimit: 9300, isActive: true,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
      ];
    },
    async getMonthlyAttendances(): Promise<Map<string, Attendance[]>> {
      const map = new Map<string, Attendance[]>();
      const attendances: Attendance[] = [];
      for (let d = 1; d <= 20; d++) {
        attendances.push({
          id: `a${d}`, facilityId: 'TEST001', userId: 'u1',
          date: `2026-02-${String(d).padStart(2, '0')}`,
          clockIn: '09:00', clockOut: '15:00', actualMinutes: 330,
          breakMinutes: 30, attendanceType: 'present', pickupType: 'none',
          mealProvided: true, createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      map.set('u1', attendances);
      return map;
    },
    async getMonthlyOutputs(): Promise<Map<string, ProductOutput[]>> {
      const map = new Map<string, ProductOutput[]>();
      const outputs: ProductOutput[] = [];
      for (let d = 1; d <= 20; d++) {
        outputs.push({
          id: `o${d}`, facilityId: 'TEST001', userId: 'u1', activityId: 'act1',
          date: `2026-02-${String(d).padStart(2, '0')}`,
          workMinutes: 300, createdAt: new Date().toISOString(),
        });
      }
      map.set('u1', outputs);
      return map;
    },
    async getActivities(): Promise<ProductActivity[]> {
      return [{
        id: 'act1', facilityId: 'TEST001', name: '軽作業',
        hourlyRate: 200, isActive: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }];
    },
    async getExistingInvoiceYearMonths(): Promise<string[]> {
      return [];
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('🚀 月次請求パイプライン起動');
  console.log(`  対象月: ${args.month}`);
  console.log(`  事業所: ${args.facility}`);
  console.log(`  Dry-run: ${args.dryRun}`);
  console.log('');

  // Lark Base未接続の場合はスタブプロバイダーを使用
  const provider = createStubProvider();

  const result = await runMonthlyBilling(provider, {
    yearMonth: args.month,
    facilityId: args.facility,
    outputDir: args.outputDir,
    dryRun: args.dryRun,
  });

  if (!result.validationPassed) {
    console.error('❌ バリデーション失敗');
    process.exit(1);
  }

  console.log('✅ パイプライン完了');
  console.log(`  請求額: ¥${result.billing.totalAmount.toLocaleString()}`);
  console.log(`  平均工賃: ¥${result.wages.averageWage.toLocaleString()}`);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
