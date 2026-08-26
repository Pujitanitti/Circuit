import { describe, it, expect } from "vitest";
import { conditionExecutor } from "./condition";
import type { WorkflowState, ExecutionContext } from "../types";

function ctxWithState(state: WorkflowState): ExecutionContext {
  return {
    executionId: "exec_1",
    workflowVersionId: "v1",
    state,
    log: async () => {},
    isCancelled: async () => false,
  };
}

const state: WorkflowState = {
  trigger: {},
  nodes: { analyzer: { output: { priority: "high", score: 8 } } },
  variables: {},
};

describe("conditionExecutor", () => {
  it("takes the true branch when the string comparison matches", async () => {
    const result = await conditionExecutor.execute(
      { left: "{{nodes.analyzer.output.priority}}", operator: "==", right: "high" },
      ctxWithState(state)
    );
    expect(result).toEqual({
      status: "success",
      output: { result: true, handle: "true", resolvedLeft: "high", resolvedRight: "high" },
    });
  });

  it("exposes the resolved (post-{{path}}) operand values, not the raw config strings", async () => {
    const result = await conditionExecutor.execute(
      { left: "{{nodes.analyzer.output.score}}", operator: ">", right: "5" },
      ctxWithState(state)
    );
    expect(result).toMatchObject({ output: { resolvedLeft: 8, resolvedRight: "5" } });
  });

  it("takes the false branch when it doesn't match", async () => {
    const result = await conditionExecutor.execute(
      { left: "{{nodes.analyzer.output.priority}}", operator: "==", right: "low" },
      ctxWithState(state)
    );
    expect(result).toMatchObject({ output: { handle: "false" } });
  });

  it("compares numeric operands correctly for > and <", async () => {
    const gt = await conditionExecutor.execute(
      { left: "{{nodes.analyzer.output.score}}", operator: ">", right: "5" },
      ctxWithState(state)
    );
    expect(gt).toMatchObject({ output: { result: true } });

    const lt = await conditionExecutor.execute(
      { left: "{{nodes.analyzer.output.score}}", operator: "<", right: "5" },
      ctxWithState(state)
    );
    expect(lt).toMatchObject({ output: { result: false } });
  });

  it("supports contains for substring checks", async () => {
    const result = await conditionExecutor.execute(
      { left: "{{nodes.analyzer.output.priority}}", operator: "contains", right: "hig" },
      ctxWithState(state)
    );
    expect(result).toMatchObject({ output: { result: true } });
  });

  it("flags missing operands during validate", () => {
    expect(conditionExecutor.validate({ left: "", operator: "==", right: "" })).toContain(
      "Condition requires a left-hand value."
    );
  });
});
