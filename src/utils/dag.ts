import type { DAG, DAGEdge, DAGNode, Task } from '../types/index.js';

/**
 * Build a DAG from tasks using Kahn's Algorithm for topological sort.
 * Detects circular dependencies.
 */
export function buildDAG(tasks: Task[]): DAG {
  const nodes = new Map<string, DAGNode>();
  const edges: DAGEdge[] = [];
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize nodes
  for (const task of tasks) {
    nodes.set(task.id, { id: task.id, task, level: -1 });
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  // Build edges from dependencies
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (nodes.has(dep)) {
        edges.push({ from: dep, to: task.id });
        adjacency.get(dep)!.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      }
    }
  }

  // Kahn's Algorithm — topological sort with level assignment
  const queue: string[] = [];
  const levels: string[][] = [];

  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  let processed = 0;

  while (queue.length > 0) {
    const currentLevel = [...queue];
    levels.push(currentLevel);
    const nextQueue: string[] = [];

    for (const nodeId of currentLevel) {
      processed++;
      const node = nodes.get(nodeId)!;
      node.level = levels.length - 1;

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          nextQueue.push(neighbor);
        }
      }
    }

    queue.length = 0;
    queue.push(...nextQueue);
  }

  // Circular dependency detection
  if (processed !== tasks.length) {
    const unprocessed = tasks
      .filter((t) => nodes.get(t.id)!.level === -1)
      .map((t) => t.id);
    throw new Error(
      `Circular dependency detected among tasks: ${unprocessed.join(', ')}`
    );
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    levels,
  };
}

/**
 * Find the critical path (longest path) through the DAG.
 */
export function findCriticalPath(dag: DAG): string[] {
  const taskMap = new Map(dag.nodes.map((n) => [n.id, n]));
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const node of dag.nodes) {
    dist.set(node.id, 0);
    prev.set(node.id, null);
  }

  // Process levels in order
  for (const level of dag.levels) {
    for (const nodeId of level) {
      const node = taskMap.get(nodeId)!;
      const currentDist = dist.get(nodeId)! + node.task.estimatedMinutes;

      for (const edge of dag.edges.filter((e) => e.from === nodeId)) {
        if (currentDist > dist.get(edge.to)!) {
          dist.set(edge.to, currentDist);
          prev.set(edge.to, nodeId);
        }
      }
    }
  }

  // Find the node with max distance
  let maxNode = '';
  let maxDist = -1;
  for (const [id, d] of dist) {
    const node = taskMap.get(id)!;
    const total = d + node.task.estimatedMinutes;
    if (total > maxDist) {
      maxDist = total;
      maxNode = id;
    }
  }

  // Trace back the path
  const path: string[] = [];
  let current: string | null = maxNode;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return path;
}
