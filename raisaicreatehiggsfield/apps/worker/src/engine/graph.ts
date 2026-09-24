import type { Edge, NodeInstance, WorkflowDocument } from "./document";

/** Graph helpers shared by validation, estimation and execution. */

export function nodeMap(doc: WorkflowDocument): Map<string, NodeInstance> {
  return new Map(doc.nodes.map((n) => [n.id, n]));
}

export function incomingEdges(doc: WorkflowDocument, nodeId: string): Edge[] {
  return doc.edges.filter((e) => e.to.node === nodeId);
}

export function outgoingEdges(doc: WorkflowDocument, nodeId: string): Edge[] {
  return doc.edges.filter((e) => e.from.node === nodeId);
}

/** Nodes a given node depends on, directly. */
export function dependenciesOf(doc: WorkflowDocument, nodeId: string): string[] {
  return [...new Set(incomingEdges(doc, nodeId).map((e) => e.from.node))];
}

/**
 * Kahn topological sort. Returns null when the graph contains a cycle, along
 * with the nodes that could not be ordered so the editor can highlight them.
 */
export function topologicalOrder(doc: WorkflowDocument): { order: string[] | null; cycleNodes: string[] } {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of doc.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of doc.edges) {
    if (!indegree.has(edge.to.node) || !adjacency.has(edge.from.node)) continue;
    indegree.set(edge.to.node, (indegree.get(edge.to.node) ?? 0) + 1);
    adjacency.get(edge.from.node)!.push(edge.to.node);
  }

  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (order.length === doc.nodes.length) return { order, cycleNodes: [] };
  const ordered = new Set(order);
  return { order: null, cycleNodes: doc.nodes.map((n) => n.id).filter((id) => !ordered.has(id)) };
}

/** Every node reachable downstream of the given nodes, including them. */
export function downstreamClosure(doc: WorkflowDocument, startIds: string[]): Set<string> {
  const result = new Set(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const edge of outgoingEdges(doc, id)) {
      if (!result.has(edge.to.node)) {
        result.add(edge.to.node);
        queue.push(edge.to.node);
      }
    }
  }
  return result;
}

/** Every node that feeds the given nodes, including them. */
export function upstreamClosure(doc: WorkflowDocument, startIds: string[]): Set<string> {
  const result = new Set(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const edge of incomingEdges(doc, id)) {
      if (!result.has(edge.from.node)) {
        result.add(edge.from.node);
        queue.push(edge.from.node);
      }
    }
  }
  return result;
}
