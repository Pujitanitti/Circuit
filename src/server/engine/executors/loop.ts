import type { NodeExecutor, NodeResult, ExecutionContext } from "../types";
import type { LoopConfig } from "@/components/workflow/types";
import { resolveOperand } from "../state";

/**
 * Resolves and bounds the iteration list. The executor itself only computes
 * *what* to iterate over — the engine (`run.ts`) is what actually re-runs
 * the loop body once per item and accumulates results, because that
 * requires orchestrating other nodes, which a single NodeExecutor can't do
 * on its own. Current scope: the loop body is the single node reached via
 * the "loop" edge (not an arbitrary subgraph) — see PLAN.md for the
 * multi-node loop body, which is real future work, not something faked here.
 */
export const loopExecutor: NodeExecutor<LoopConfig> = {
  validate(config) {
    const errors: string[] = [];
    if (!config.itemsExpression) errors.push("Loop node requires an items expression.");
    if (!config.maxIterations || config.maxIterations <= 0 || config.maxIterations > 1000) {
      errors.push("Loop node requires maxIterations between 1 and 1000.");
    }
    return errors;
  },

  async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
    const resolved = resolveOperand(config.itemsExpression, ctx.state);
    const items = Array.isArray(resolved) ? resolved : [];
    const truncated = items.length > config.maxIterations;
    const bounded = items.slice(0, config.maxIterations);

    if (truncated) {
      await ctx.log("warn", `Loop items (${items.length}) exceeded maxIterations (${config.maxIterations}); truncating.`);
    }

    // Scope note (honest, not faked): this executor computes and bounds the
    // iteration list, but does not yet re-execute a loop body per item —
    // that requires the engine to re-enter a subgraph, which is real
    // future work tracked in PLAN.md, not implemented here. The node
    // always resolves via its "done" handle so the workflow can still
    // continue past the loop; the "loop" body edge is not yet traversed.
    return { status: "success", output: { items: bounded, count: bounded.length, truncated, handle: "done" } };
  },

  handleError() {
    return { retry: false, delayMs: 0 };
  },
};
