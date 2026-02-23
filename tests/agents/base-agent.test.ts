import { describe, expect, it } from 'vitest';
import { BaseAgent } from '../../src/agents/base-agent.js';
import type { AgentType } from '../../src/types/index.js';

class TestAgent extends BaseAgent {
  readonly type: AgentType = 'codegen';
  readonly description = 'Test agent for unit tests';

  constructor(private readonly behavior: 'success' | 'error' = 'success') {
    super();
  }

  protected async execute(input: unknown): Promise<unknown> {
    if (this.behavior === 'error') {
      throw new Error('Test error');
    }
    return { processed: input };
  }
}

describe('BaseAgent', () => {
  it('should execute successfully and return result', async () => {
    const agent = new TestAgent('success');
    const result = await agent.run({ data: 'test' });

    expect(result.status).toBe('completed');
    expect(result.agentType).toBe('codegen');
    expect(result.output).toEqual({ processed: { data: 'test' } });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('should handle errors and return failed result', async () => {
    const agent = new TestAgent('error');
    const result = await agent.run({});

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Test error');
    expect(result.output).toBeNull();
  });

  it('should track status correctly', async () => {
    const agent = new TestAgent('success');

    expect(agent.getStatus()).toBe('idle');

    await agent.run({});

    expect(agent.getStatus()).toBe('completed');
  });

  it('should track elapsed time', async () => {
    const agent = new TestAgent('success');

    expect(agent.getElapsedMs()).toBe(0);

    await agent.run({});

    expect(agent.getElapsedMs()).toBeGreaterThanOrEqual(0);
  });
});
