import { describe, it, expect } from "vitest";
import { resolvePath, interpolate, resolveOperand } from "./state";
import type { WorkflowState } from "./types";

const state: WorkflowState = {
  trigger: { issue: "Login button broken" },
  nodes: { analyzer: { output: { priority: "high", score: 8 } } },
  variables: {},
};

describe("resolvePath", () => {
  it("resolves a nested dotted path", () => {
    expect(resolvePath("nodes.analyzer.output.priority", state)).toBe("high");
  });

  it("returns undefined for a missing path instead of throwing", () => {
    expect(resolvePath("nodes.missing.output.x", state)).toBeUndefined();
  });

  it("does not evaluate arbitrary expressions", () => {
    // "process.exit" isn't in state, so it must resolve to undefined,
    // not attempt anything resembling code execution.
    expect(resolvePath("process.exit", state)).toBeUndefined();
  });
});

describe("interpolate", () => {
  it("substitutes multiple references and stringifies non-strings", () => {
    const out = interpolate("Issue: {{trigger.issue}} (score {{nodes.analyzer.output.score}})", state);
    expect(out).toBe("Issue: Login button broken (score 8)");
  });

  it("substitutes unresolved refs with an empty string", () => {
    expect(interpolate("{{nodes.missing.output}}", state)).toBe("");
  });
});

describe("resolveOperand", () => {
  it("preserves the raw type when the operand is a sole variable ref", () => {
    expect(resolveOperand("{{nodes.analyzer.output.score}}", state)).toBe(8);
  });

  it("falls back to string interpolation for mixed text", () => {
    expect(resolveOperand("score: {{nodes.analyzer.output.score}}", state)).toBe("score: 8");
  });
});
