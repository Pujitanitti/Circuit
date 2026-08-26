import type { NodeExecutor, NodeResult, ExecutionContext } from "../types";
import type { ConditionConfig } from "@/components/workflow/types";
import { resolveOperand } from "../state";

function compare(left: unknown, operator: ConditionConfig["operator"], right: unknown): boolean {
  switch (operator) {
    case "==": return String(left) === String(right);
    case "!=": return String(left) !== String(right);
    case "contains": return String(left).includes(String(right));
    case ">":
    case "<": {
      const l = Number(left), r = Number(right);
      if (Number.isNaN(l) || Number.isNaN(r)) return false;
      return operator === ">" ? l > r : l < r;
    }
  }
}

export const conditionExecutor: NodeExecutor<ConditionConfig> = {
  validate(config) {
    const errors: string[] = [];
    if (!config.left) errors.push("Condition requires a left-hand value.");
    if (config.right === undefined || config.right === null || config.right === "") {
      errors.push("Condition requires a right-hand value.");
    }
    return errors;
  },

  async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
    const left = resolveOperand(config.left, ctx.state);
    const right = resolveOperand(config.right, ctx.state);
    const result = compare(left, config.operator, right);

    await ctx.log("info", `Condition evaluated: ${JSON.stringify(left)} ${config.operator} ${JSON.stringify(right)} = ${result}`);

    // The chosen branch is carried as the node's output.handle; the engine
    // reads this to decide which outgoing edge (sourceHandle "true"/"false")
    // becomes executable next. See engine/run.ts.
    // resolvedLeft/resolvedRight are the actual post-{{path}}-resolution
    // values (not just the raw config strings) — the execution debugger's
    // ConditionResult panel reads these directly instead of re-deriving
    // them client-side against a resolver it doesn't have access to.
    return { status: "success", output: { result, handle: result ? "true" : "false", resolvedLeft: left, resolvedRight: right } };
  },

  handleError() {
    // Pure computation — a thrown error here means a bug, not a transient
    // failure, so it's never worth retrying.
    return { retry: false, delayMs: 0 };
  },
};
