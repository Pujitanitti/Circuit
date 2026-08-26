import type { NodeExecutor, NodeResult, ExecutionContext } from "../types";
import type { ApprovalConfig } from "@/components/workflow/types";
import { interpolate } from "../state";

// The executor's job is only to signal "waiting" — resumption (approve/reject)
// happens out-of-band via POST /api/executions/:id/approve, which writes the
// decision onto the NodeExecution and re-invokes the engine loop from here.
// See README.md#human-approval and engine/run.ts.
export const approvalExecutor: NodeExecutor<ApprovalConfig> = {
  validate(config) {
    return config.prompt ? [] : ["Approval node requires a prompt."];
  },

  async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
    const prompt = interpolate(config.prompt, ctx.state);
    await ctx.log("info", `Waiting for approval: ${prompt}`);
    return { status: "waiting", reason: "approval" };
  },

  handleError() {
    return { retry: false, delayMs: 0 };
  },
};
