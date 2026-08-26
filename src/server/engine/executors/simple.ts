import type { NodeExecutor, NodeResult, ExecutionContext } from "../types";
import type { TransformConfig, DelayConfig, OutputConfig, TriggerConfig } from "@/components/workflow/types";
import { interpolate, resolvePath, resolveOperand } from "../state";

export const triggerExecutor: NodeExecutor<TriggerConfig> = {
  validate() {
    return [];
  },
  async execute(_config, ctx: ExecutionContext): Promise<NodeResult> {
    await ctx.log("info", "Trigger fired");
    return { status: "success", output: ctx.state.trigger };
  },
  handleError() {
    return { retry: false, delayMs: 0 };
  },
};

export const transformExecutor: NodeExecutor<TransformConfig> = {
  validate(config) {
    return config.expression ? [] : ["Transform node requires an expression."];
  },
  async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
    let output: unknown;
    switch (config.kind) {
      case "extract":
        output = resolveOperand(config.expression, ctx.state);
        break;
      case "template":
        output = interpolate(config.expression, ctx.state);
        break;
      case "map":
      case "filter": {
        // config.expression is a `{{path}}` pointing at an array in state;
        // real jq-style mapping/filtering expressions are future work
        // (see PLAN.md) rather than something faked here.
        const source = resolveOperand(config.expression, ctx.state);
        output = Array.isArray(source) ? source : [];
        break;
      }
    }
    await ctx.log("info", `Transform (${config.kind}) produced output`);
    return { status: "success", output };
  },
  handleError() {
    return { retry: false, delayMs: 0 };
  },
};

export const delayExecutor: NodeExecutor<DelayConfig> = {
  validate(config) {
    return config.seconds > 0 ? [] : ["Delay node requires seconds > 0."];
  },
  async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
    await ctx.log("info", `Delaying ${config.seconds}s`);
    return { status: "waiting", reason: "delay", resumeAt: new Date(Date.now() + config.seconds * 1000) };
  },
  handleError() {
    return { retry: false, delayMs: 0 };
  },
};

export const outputExecutor: NodeExecutor<OutputConfig> = {
  validate(config) {
    return config.resultExpression ? [] : ["Output node requires a result expression."];
  },
  async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
    const sole = config.resultExpression.trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    const output = sole ? resolvePath(sole[1]!, ctx.state) : interpolate(config.resultExpression, ctx.state); // safe: mandatory capture group
    await ctx.log("info", "Workflow output produced");
    return { status: "success", output };
  },
  handleError() {
    return { retry: false, delayMs: 0 };
  },
};
