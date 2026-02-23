/**
 * miyabi:agent - Agent手動実行
 *
 * Usage: npm run miyabi:agent -- --type=codegen --issue=123
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('MiyabiAgent');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let agentType = 'codegen';
  let issueNumber = 0;

  for (const arg of args) {
    if (arg.startsWith('--type=')) agentType = arg.replace('--type=', '');
    if (arg.startsWith('--issue=')) issueNumber = Number(arg.replace('--issue=', ''));
  }

  if (issueNumber === 0) {
    logger.error('No issue specified. Usage: --type=codegen --issue=123');
    process.exit(1);
  }

  logger.info(`Starting ${agentType} agent for issue #${issueNumber}`);

  // TODO: Implement actual agent execution via Anthropic SDK
  logger.info('Agent execution not yet implemented. Use /agent-run in Claude Code.');
}

main().catch((error: unknown) => {
  logger.error('Agent execution failed', { error: String(error) });
  process.exit(1);
});
