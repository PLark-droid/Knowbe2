/**
 * Miyabi Framework Core Types
 */

// ─── Agent Types ───────────────────────────────────────────

export type AgentType =
  | 'coordinator'
  | 'codegen'
  | 'review'
  | 'issue'
  | 'pr'
  | 'deployment'
  | 'test';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'escalated';

export interface AgentResult {
  agentType: AgentType;
  status: AgentStatus;
  durationMs: number;
  output: unknown;
  error?: string;
}

// ─── Task Types ────────────────────────────────────────────

export type TaskType = 'feature' | 'bug' | 'refactor' | 'docs' | 'test' | 'chore' | 'deployment';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'trivial';

export type Complexity = 'small' | 'medium' | 'large' | 'xlarge';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  assignedAgent: AgentType;
  severity: Severity;
  complexity: Complexity;
  dependencies: string[];
  estimatedMinutes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// ─── DAG Types ─────────────────────────────────────────────

export interface DAGNode {
  id: string;
  task: Task;
  level: number;
}

export interface DAGEdge {
  from: string;
  to: string;
}

export interface DAG {
  nodes: DAGNode[];
  edges: DAGEdge[];
  levels: string[][];
}

// ─── Execution Types ───────────────────────────────────────

export interface ExecutionPlan {
  dag: DAG;
  concurrency: number;
  estimatedTotalMinutes: number;
  criticalPath: string[];
}

export interface ExecutionReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  summary: {
    total: number;
    completed: number;
    failed: number;
    escalated: number;
    successRate: number;
  };
  tasks: TaskExecutionResult[];
}

export interface TaskExecutionResult {
  taskId: string;
  status: 'completed' | 'failed' | 'escalated';
  agentType: AgentType;
  durationMs: number;
  output?: unknown;
  error?: string;
}

// ─── Issue Types ───────────────────────────────────────────

export interface IssueLabel {
  name: string;
  color: string;
  description: string;
  category: string;
}

export interface IssueAnalysis {
  issueNumber: number;
  title: string;
  taskType: TaskType;
  severity: Severity;
  complexity: Complexity;
  labels: string[];
  tasks: Task[];
}

// ─── Quality Types ─────────────────────────────────────────

export interface QualityScore {
  total: number;
  breakdown: {
    typeScriptErrors: number;
    eslintErrors: number;
    testCoverage: number;
    securityIssues: number;
  };
  passed: boolean;
}

export interface QualityThreshold {
  minScore: number;
  testCoverage: number;
  typeScriptErrors: number;
  eslintErrors: number;
}

// ─── Config Types ──────────────────────────────────────────

export interface MiyabiConfig {
  agents: Record<AgentType, string>;
  qualityThreshold: QualityThreshold;
  escalation: {
    techLead: string;
    po: string;
    ciso: string;
    cto: string;
  };
  maxConcurrency: number;
}
