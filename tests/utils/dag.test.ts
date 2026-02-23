import { describe, expect, it } from 'vitest';
import { buildDAG, findCriticalPath } from '../../src/utils/dag.js';
import type { Task } from '../../src/types/index.js';

function createTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    type: 'feature',
    title: `Task ${overrides.id}`,
    description: '',
    assignedAgent: 'codegen',
    severity: 'medium',
    complexity: 'medium',
    dependencies: [],
    estimatedMinutes: 30,
    status: 'pending',
    ...overrides,
  };
}

describe('buildDAG', () => {
  it('should build a DAG from independent tasks', () => {
    const tasks = [
      createTask({ id: 'a' }),
      createTask({ id: 'b' }),
      createTask({ id: 'c' }),
    ];

    const dag = buildDAG(tasks);

    expect(dag.nodes).toHaveLength(3);
    expect(dag.edges).toHaveLength(0);
    expect(dag.levels).toHaveLength(1);
    expect(dag.levels[0]).toContain('a');
    expect(dag.levels[0]).toContain('b');
    expect(dag.levels[0]).toContain('c');
  });

  it('should build a DAG with dependencies', () => {
    const tasks = [
      createTask({ id: 'a' }),
      createTask({ id: 'b', dependencies: ['a'] }),
      createTask({ id: 'c', dependencies: ['a'] }),
      createTask({ id: 'd', dependencies: ['b', 'c'] }),
    ];

    const dag = buildDAG(tasks);

    expect(dag.levels).toHaveLength(3);
    expect(dag.levels[0]).toEqual(['a']);
    expect(dag.levels[1]).toContain('b');
    expect(dag.levels[1]).toContain('c');
    expect(dag.levels[2]).toEqual(['d']);
  });

  it('should detect circular dependencies', () => {
    const tasks = [
      createTask({ id: 'a', dependencies: ['c'] }),
      createTask({ id: 'b', dependencies: ['a'] }),
      createTask({ id: 'c', dependencies: ['b'] }),
    ];

    expect(() => buildDAG(tasks)).toThrow('Circular dependency detected');
  });

  it('should assign correct levels', () => {
    const tasks = [
      createTask({ id: 'a' }),
      createTask({ id: 'b', dependencies: ['a'] }),
    ];

    const dag = buildDAG(tasks);
    const nodeA = dag.nodes.find((n) => n.id === 'a');
    const nodeB = dag.nodes.find((n) => n.id === 'b');

    expect(nodeA?.level).toBe(0);
    expect(nodeB?.level).toBe(1);
  });

  it('should handle empty task list', () => {
    const dag = buildDAG([]);

    expect(dag.nodes).toHaveLength(0);
    expect(dag.edges).toHaveLength(0);
    expect(dag.levels).toHaveLength(0);
  });
});

describe('findCriticalPath', () => {
  it('should find the critical path', () => {
    const tasks = [
      createTask({ id: 'a', estimatedMinutes: 10 }),
      createTask({ id: 'b', dependencies: ['a'], estimatedMinutes: 50 }),
      createTask({ id: 'c', dependencies: ['a'], estimatedMinutes: 20 }),
    ];

    const dag = buildDAG(tasks);
    const path = findCriticalPath(dag);

    expect(path).toEqual(['a', 'b']);
  });

  it('should return single node for single task', () => {
    const tasks = [createTask({ id: 'a', estimatedMinutes: 30 })];
    const dag = buildDAG(tasks);
    const path = findCriticalPath(dag);

    expect(path).toEqual(['a']);
  });
});
