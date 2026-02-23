/**
 * CoordinatorAgent Executor - タスク並列実行エンジン
 *
 * Usage:
 *   npm run agents:parallel:exec -- --issues=123 --concurrency=2
 *   USE_TASK_TOOL=true npm run agents:parallel:exec -- --issues=123
 *   USE_WORKTREE=true npm run agents:parallel:exec -- --issues=123
 */

import { buildDAG, findCriticalPath } from '../../utils/dag.js';
import { Logger } from '../../utils/logger.js';
import type { Task, ExecutionPlan, ExecutionReport, TaskExecutionResult } from '../../types/index.js';

const logger = Logger.forAgent('coordinator');

function parseArgs(): { issues: number[]; concurrency: number } {
  const args = process.argv.slice(2);
  let issues: number[] = [];
  let concurrency = 2;

  for (const arg of args) {
    if (arg.startsWith('--issues=')) {
      issues = arg.replace('--issues=', '').split(',').map(Number);
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = Number(arg.replace('--concurrency=', ''));
    }
  }

  return { issues, concurrency };
}

function createExecutionPlan(tasks: Task[], concurrency: number): ExecutionPlan {
  const dag = buildDAG(tasks);
  const criticalPath = findCriticalPath(dag);
  const estimatedTotalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return {
    dag,
    concurrency: Math.min(concurrency, tasks.length),
    estimatedTotalMinutes,
    criticalPath,
  };
}

async function executeLevel(tasks: Task[], _concurrency: number): Promise<TaskExecutionResult[]> {
  const results: TaskExecutionResult[] = [];

  // TODO: Implement actual agent execution
  for (const task of tasks) {
    logger.info(`Executing task: ${task.id} (${task.type})`, { agent: task.assignedAgent });

    results.push({
      taskId: task.id,
      status: 'completed',
      agentType: task.assignedAgent,
      durationMs: 0,
    });
  }

  return results;
}

async function main(): Promise<void> {
  const { issues, concurrency } = parseArgs();

  if (issues.length === 0) {
    logger.error('No issues specified. Usage: --issues=123,456 --concurrency=2');
    process.exit(1);
  }

  const sessionId = `session-${Date.now()}`;
  const startTime = Date.now();

  logger.info(`Orchestration starting`, { sessionId, issues, concurrency });

  // TODO: Fetch actual tasks from GitHub Issues
  // For now, create placeholder tasks
  const tasks: Task[] = issues.map((issueNum) => ({
    id: `task-${issueNum}`,
    type: 'feature' as const,
    title: `Issue #${issueNum}`,
    description: '',
    assignedAgent: 'codegen' as const,
    severity: 'medium' as const,
    complexity: 'medium' as const,
    dependencies: [],
    estimatedMinutes: 30,
    status: 'pending' as const,
  }));

  const plan = createExecutionPlan(tasks, concurrency);
  logger.info(`DAG built`, {
    nodes: plan.dag.nodes.length,
    edges: plan.dag.edges.length,
    levels: plan.dag.levels.length,
    criticalPath: plan.criticalPath,
  });

  const allResults: TaskExecutionResult[] = [];

  for (let i = 0; i < plan.dag.levels.length; i++) {
    const levelIds = plan.dag.levels[i]!;
    const levelTasks = tasks.filter((t) => levelIds.includes(t.id));

    logger.info(`Executing level ${i + 1}/${plan.dag.levels.length}`, {
      tasks: levelIds.length,
    });

    const results = await executeLevel(levelTasks, plan.concurrency);
    allResults.push(...results);
  }

  const endTime = Date.now();
  const completed = allResults.filter((r) => r.status === 'completed').length;
  const failed = allResults.filter((r) => r.status === 'failed').length;
  const escalated = allResults.filter((r) => r.status === 'escalated').length;

  const report: ExecutionReport = {
    sessionId,
    startTime,
    endTime,
    totalDurationMs: endTime - startTime,
    summary: {
      total: allResults.length,
      completed,
      failed,
      escalated,
      successRate: allResults.length > 0 ? (completed / allResults.length) * 100 : 0,
    },
    tasks: allResults,
  };

  logger.info(`Orchestration complete`, {
    successRate: `${report.summary.successRate}%`,
    duration: `${report.totalDurationMs}ms`,
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  logger.error('Fatal error', { error: String(error) });
  process.exit(1);
});
