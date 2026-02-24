/**
 * CSV出力CLIコマンド
 * Usage: npm run csv:export -- --type=kokuho-ren --month=2026-02 --facility=FACILITY_ID
 */

import { resolve } from 'node:path';

interface CliArgs {
  type: 'kokuho-ren' | 'wage';
  month: string;
  facility: string;
  outputDir: string;
  dryRun: boolean;
  encoding: 'shift-jis' | 'utf-8' | 'utf-8-bom';
}

function parseType(value: string | undefined): CliArgs['type'] | undefined {
  if (value === 'kokuho-ren' || value === 'wage') return value;
  return undefined;
}

function parseEncoding(value: string | undefined): CliArgs['encoding'] | undefined {
  if (value === 'shift-jis' || value === 'utf-8' || value === 'utf-8-bom') {
    return value;
  }
  return undefined;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {
    outputDir: './exports',
    dryRun: false,
    encoding: 'shift-jis',
  };

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    switch (key) {
      case 'type':
        parsed.type = parseType(value);
        break;
      case 'month':
        parsed.month = value;
        break;
      case 'facility':
        parsed.facility = value;
        break;
      case 'output-dir':
        parsed.outputDir = value;
        break;
      case 'dry-run':
        parsed.dryRun = true;
        break;
      case 'encoding':
        parsed.encoding = parseEncoding(value);
        break;
    }
  }

  if (!parsed.type || !parsed.month || !parsed.facility || !parsed.outputDir || !parsed.encoding) {
    console.error('Usage: npm run csv:export -- --type=kokuho-ren|wage --month=YYYY-MM --facility=FACILITY_ID');
    console.error('Options:');
    console.error('  --output-dir=DIR    出力先ディレクトリ (default: ./exports)');
    console.error('  --dry-run           バリデーションのみ実行');
    console.error('  --encoding=ENC      エンコーディング (shift-jis|utf-8|utf-8-bom)');
    process.exit(1);
  }

  return {
    type: parsed.type,
    month: parsed.month,
    facility: parsed.facility,
    outputDir: parsed.outputDir,
    dryRun: parsed.dryRun ?? false,
    encoding: parsed.encoding,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '');

  console.log(`\n📄 CSV Export`);
  console.log(`  Type:     ${args.type}`);
  console.log(`  Month:    ${args.month}`);
  console.log(`  Facility: ${args.facility}`);
  console.log(`  Encoding: ${args.encoding}`);
  console.log(`  Dry Run:  ${args.dryRun}`);
  console.log('');

  const outputPath = resolve(
    args.outputDir,
    `${args.type}_${args.month}_${args.facility}_${timestamp}.csv`,
  );

  if (args.type === 'kokuho-ren') {
    // 国保連CSV: Larkからデータ取得 → 請求計算 → CSV生成
    console.log('⚠️  Lark Base接続が必要です。環境変数を確認してください。');
    console.log(`  出力先: ${outputPath}`);

    // TODO: Larkクライアント初期化 → データ取得 → 計算 → CSV生成
    // 実装は monthly-billing.ts のオーケストレーションで行う
    console.log('  ➡️  npm run billing:run -- --month=' + args.month + ' --facility=' + args.facility + ' でフルパイプライン実行');
  } else if (args.type === 'wage') {
    console.log('⚠️  Lark Base接続が必要です。環境変数を確認してください。');
    console.log(`  出力先: ${outputPath}`);

    console.log('  ➡️  npm run billing:run -- --month=' + args.month + ' --facility=' + args.facility + ' --type=wage でフルパイプライン実行');
  }

  console.log('\n✅ Done');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
