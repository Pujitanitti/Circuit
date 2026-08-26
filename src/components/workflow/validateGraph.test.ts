import { describe, it, expect } from "vitest";
import { validateGraph, extractVariableRefs } from "./validateGraph";
import type { CircuitNodeData } from "./types";

function node(key: string, type: CircuitNodeData["type"], config: CircuitNodeData["config"]) {
  return { key, type, data: { key, type, label: key, config, status: "idle" as const } };
}

describe("validateGraph", () => {
  it("flags a workflow with no trigger", () => {
    const issues = validateGraph(
      [node("agent", "AGENT", { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "", userPrompt: "hi", temperature: 0.5, maxTokens: 512, tools: [] })],
      []
    );
    expect(issues.some((i) => i.message.includes("no trigger"))).toBe(true);
  });

  it("flags an agent node missing a model", () => {
    const issues = validateGraph(
      [
        node("trigger", "TRIGGER", { kind: "manual" }),
        node("agent", "AGENT", { provider: "anthropic", model: "", systemPrompt: "", userPrompt: "hi", temperature: 0.5, maxTokens: 512, tools: [] }),
      ],
      [{ sourceKey: "trigger", targetKey: "agent" }]
    );
    expect(issues.some((i) => i.message === "Agent node requires a model.")).toBe(true);
  });

  it("flags a condition with a missing branch", () => {
    const issues = validateGraph(
      [
        node("trigger", "TRIGGER", { kind: "manual" }),
        node("cond", "CONDITION", { left: "{{x}}", operator: "==", right: "1" }),
        node("out", "OUTPUT", { resultExpression: "{{cond}}" }),
      ],
      [
        { sourceKey: "trigger", targetKey: "cond" },
        { sourceKey: "cond", targetKey: "out", sourceHandle: "true" },
      ]
    );
    expect(issues.some((i) => i.message === "Condition has no FALSE branch.")).toBe(true);
  });

  it("flags an unreachable node", () => {
    const issues = validateGraph(
      [
        node("trigger", "TRIGGER", { kind: "manual" }),
        node("out", "OUTPUT", { resultExpression: "" }),
        node("orphan", "TRANSFORM", { kind: "extract", expression: "" }),
      ],
      [{ sourceKey: "trigger", targetKey: "out" }]
    );
    expect(issues.some((i) => i.nodeKey === "orphan" && i.message.includes("unreachable"))).toBe(true);
  });

  it("passes a minimal valid workflow", () => {
    const issues = validateGraph(
      [
        node("trigger", "TRIGGER", { kind: "manual" }),
        node("out", "OUTPUT", { resultExpression: "{{trigger}}" }),
      ],
      [{ sourceKey: "trigger", targetKey: "out" }]
    );
    expect(issues).toEqual([]);
  });
});

describe("extractVariableRefs", () => {
  it("extracts dotted variable paths", () => {
    expect(extractVariableRefs("Analyze {{trigger.issue}} using {{nodes.fetch.output.title}}")).toEqual([
      "trigger.issue",
      "nodes.fetch.output.title",
    ]);
  });
});
