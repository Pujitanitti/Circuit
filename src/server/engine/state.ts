import type { WorkflowState } from "./types";

/**
 * Resolves a dotted path like "nodes.analyzer.output.priority" against the
 * workflow state by manual property traversal only. There is no eval/Function
 * constructor anywhere in this file — an unresolvable path returns undefined
 * rather than throwing, so a bad reference fails a downstream validation
 * check instead of crashing the engine. See README.md#state-management.
 */
export function resolvePath(path: string, state: WorkflowState): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = state;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const VAR_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

/** True only when the whole string is a single `{{path}}` reference (no surrounding text). */
export function isSoleVariableRef(text: string): string | null {
  const match = text.trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
  return match ? match[1]! : null; // safe: capture group 1 is mandatory in the pattern whenever match succeeds
}

/**
 * Replaces every `{{path}}` occurrence in a template string with its
 * resolved, stringified value. Used for Agent prompts and Transform
 * templates where the result must stay a string.
 */
export function interpolate(template: string, state: WorkflowState): string {
  return template.replace(VAR_PATTERN, (_match, path: string) => {
    const value = resolvePath(path, state);
    if (value === undefined) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

/**
 * Resolves a single "operand" (used by Condition operands and similar
 * single-value fields): if the operand is exactly one `{{path}}`, returns
 * the raw resolved value (preserving type — number, boolean, object) so
 * comparisons work correctly. Otherwise falls back to string interpolation.
 */
export function resolveOperand(raw: string, state: WorkflowState): unknown {
  const sole = isSoleVariableRef(raw);
  if (sole) return resolvePath(sole, state);
  return interpolate(raw, state);
}
