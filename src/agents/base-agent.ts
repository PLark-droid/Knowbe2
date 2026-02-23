import type { AgentResult, AgentStatus, AgentType } from '../types/index.js';

/**
 * Base class for all Miyabi agents.
 * Each agent follows 識学理論: clear responsibility, authority, and evaluation.
 */
export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly description: string;

  protected status: AgentStatus = 'idle';
  protected startTime = 0;

  /**
   * Execute the agent's primary task.
   */
  async run(input: unknown): Promise<AgentResult> {
    this.status = 'running';
    this.startTime = Date.now();

    try {
      const output = await this.execute(input);
      this.status = 'completed';

      return {
        agentType: this.type,
        status: 'completed',
        durationMs: Date.now() - this.startTime,
        output,
      };
    } catch (error) {
      this.status = 'failed';
      const message = error instanceof Error ? error.message : String(error);

      return {
        agentType: this.type,
        status: 'failed',
        durationMs: Date.now() - this.startTime,
        output: null,
        error: message,
      };
    }
  }

  /**
   * Agent-specific execution logic. Subclasses must implement this.
   */
  protected abstract execute(input: unknown): Promise<unknown>;

  getStatus(): AgentStatus {
    return this.status;
  }

  getElapsedMs(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }
}
