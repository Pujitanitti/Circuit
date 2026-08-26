// Pure graph utilities. No I/O, no Prisma — kept pure so they're trivial to
// unit test (see README.md#testing) and reusable if execution ever moves
// out-of-process into a worker (see README.md#future-scale-architecture).

export type GraphNode = { key: string; type: string };
export type GraphEdge = { sourceKey: string; targetKey: string; sourceHandle?: string | null };

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Nodes with no incoming edges — valid entry points (should be exactly the trigger). */
export function findRoots(graph: Graph): GraphNode[] {
  const hasIncoming = new Set(graph.edges.map((e) => e.targetKey));
  return graph.nodes.filter((n) => !hasIncoming.has(n.key));
}

/**
 * Detects cycles via DFS coloring. Loop nodes are the one sanctioned
 * exception — they declare their own back-edge via `loopBackTo` in config,
 * which the engine handles as bounded iteration rather than a structural
 * cycle, so this check runs against the graph with loop-body edges only.
 */
export function detectCycle(graph: Graph): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const e of graph.edges) {
    adjacency.set(e.sourceKey, [...(adjacency.get(e.sourceKey) ?? []), e.targetKey]);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(graph.nodes.map((n) => [n.key, WHITE]));
  const stack: string[] = [];

  function dfs(key: string): string[] | null {
    color.set(key, GRAY);
    stack.push(key);
    for (const next of adjacency.get(key) ?? []) {
      if (color.get(next) === GRAY) {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (color.get(next) === WHITE) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(key, BLACK);
    return null;
  }

  for (const n of graph.nodes) {
    if (color.get(n.key) === WHITE) {
      const found = dfs(n.key);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Given the set of nodes already completed (success or skipped) and their
 * chosen outgoing handles (e.g. a Condition's "true"/"false"), returns the
 * next nodes that are now executable: every incoming edge of that node is
 * either satisfied (source completed + matching handle) or absent.
 */
export function findExecutableNodes(
  graph: Graph,
  completed: Map<string, { status: "success" | "skipped" | "failed"; handle?: string }>
): GraphNode[] {
  return classifyPendingNodes(graph, completed).executable;
}

/**
 * The counterpart to findExecutableNodes: nodes whose incoming edges have
 * all settled, but none of them route here (a losing Condition/Loop
 * branch). These need to be explicitly marked SKIPPED by the caller — a
 * node in this state is not "not yet ready", it is permanently unreachable
 * for this execution, and the traversal loop will stall forever if nothing
 * ever adds it to `completed`. See run.ts, which calls this every
 * iteration alongside findExecutableNodes.
 */
export function findSkippedNodes(
  graph: Graph,
  completed: Map<string, { status: "success" | "skipped" | "failed"; handle?: string }>
): GraphNode[] {
  return classifyPendingNodes(graph, completed).skipped;
}

function classifyPendingNodes(
  graph: Graph,
  completed: Map<string, { status: "success" | "skipped" | "failed"; handle?: string }>
): { executable: GraphNode[]; skipped: GraphNode[] } {
  const executable: GraphNode[] = [];
  const skipped: GraphNode[] = [];

  for (const node of graph.nodes) {
    if (completed.has(node.key)) continue;

    const incoming = graph.edges.filter((e) => e.targetKey === node.key);
    if (incoming.length === 0) continue; // roots are seeded separately

    const ready = incoming.every((edge) => {
      const src = completed.get(edge.sourceKey);
      if (!src) return false;
      if (src.status === "failed") return false; // propagated failure, not ready
      if (edge.sourceHandle && src.handle !== edge.sourceHandle) return false;
      return true;
    });

    const allSourcesSettled = incoming.every((edge) => completed.has(edge.sourceKey));

    if (ready) executable.push(node);
    else if (allSourcesSettled) skipped.push(node); // every source settled, but none route here
    // else: still waiting on an upstream node — neither list.
  }

  return { executable, skipped };
}
