import { detectCycle, findRoots, type Graph } from "@/server/engine/graph";
import type { CircuitNodeData, AgentConfig, ToolConfig, ConditionConfig, LoopConfig } from "./types";

export type ValidationIssue = { nodeKey: string | null; message: string };

/**
 * Structural + per-node config validation, run before execution and
 * surfaced directly on the canvas (see README §21 in the original brief).
 * Pure — no DB access — so it runs identically client-side (as-you-type)
 * and server-side (before persisting/executing).
 */
export function validateGraph(
  nodes: { key: string; type: string; data: CircuitNodeData }[],
  edges: { sourceKey: string; targetKey: string; sourceHandle?: string | null }[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const graph: Graph = { nodes: nodes.map((n) => ({ key: n.key, type: n.type })), edges };

  const triggers = nodes.filter((n) => n.type === "TRIGGER");
  if (triggers.length === 0) issues.push({ nodeKey: null, message: "Workflow has no trigger node." });
  if (triggers.length > 1) issues.push({ nodeKey: null, message: "Workflow has more than one trigger node." });

  const roots = findRoots(graph);
  if (roots.length > 1) {
    issues.push({ nodeKey: null, message: "Multiple disconnected entry points found." });
  }

  const cycle = detectCycle({
    nodes: graph.nodes.filter((n) => n.type !== "LOOP"),
    edges: graph.edges,
  });
  if (cycle) {
    issues.push({ nodeKey: cycle[0] ?? null, message: `Cycle detected: ${cycle.join(" → ")}` });
  }

  // Reachability is seeded from the trigger specifically, not from every
  // "no incoming edges" root — an isolated node with zero edges has no
  // incoming edges either, and would otherwise be miscounted as reachable.
  const nodeKeys = new Set(nodes.map((n) => n.key));
  const reachable = new Set(triggers.map((t) => t.key));
  let frontier = [...reachable];
  while (frontier.length) {
    const next = edges.filter((e) => frontier.includes(e.sourceKey)).map((e) => e.targetKey);
    frontier = next.filter((k) => !reachable.has(k));
    frontier.forEach((k) => reachable.add(k));
  }
  for (const key of nodeKeys) {
    if (!reachable.has(key)) issues.push({ nodeKey: key, message: "Node is unreachable from the trigger." });
  }

  for (const n of nodes) {
    issues.push(...validateNodeConfig(n.key, n.data));
    if (n.type === "CONDITION") {
      const outgoing = edges.filter((e) => e.sourceKey === n.key);
      if (!outgoing.some((e) => e.sourceHandle === "true")) {
        issues.push({ nodeKey: n.key, message: "Condition has no TRUE branch." });
      }
      if (!outgoing.some((e) => e.sourceHandle === "false")) {
        issues.push({ nodeKey: n.key, message: "Condition has no FALSE branch." });
      }
    }
  }

  return issues;
}

function validateNodeConfig(key: string, data: CircuitNodeData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  switch (data.type) {
    case "AGENT": {
      const c = data.config as AgentConfig;
      if (!c.model) issues.push({ nodeKey: key, message: "Agent node requires a model." });
      if (!c.userPrompt) issues.push({ nodeKey: key, message: "Agent node requires a user prompt." });
      break;
    }
    case "TOOL": {
      const c = data.config as ToolConfig;
      if (!c.url) issues.push({ nodeKey: key, message: "Tool node requires a URL." });
      break;
    }
    case "CONDITION": {
      const c = data.config as ConditionConfig;
      if (!c.left) issues.push({ nodeKey: key, message: "Condition node requires a left-hand value." });
      break;
    }
    case "LOOP": {
      const c = data.config as LoopConfig;
      if (!c.maxIterations || c.maxIterations <= 0 || c.maxIterations > 1000) {
        issues.push({ nodeKey: key, message: "Loop node requires maxIterations between 1 and 1000." });
      }
      if (!c.itemsExpression) issues.push({ nodeKey: key, message: "Loop node requires an items expression." });
      break;
    }
  }
  return issues;
}

/** Extracts `{{a.b.c}}` references from a string, e.g. Agent prompts or Condition operands. */
export function extractVariableRefs(text: string): string[] {
  const matches = text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g);
  return [...matches].map((m) => m[1]!); // safe: capture group 1 is mandatory in the pattern, always matched
}
