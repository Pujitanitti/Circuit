import { describe, it, expect } from "vitest";
import { findRoots, detectCycle, findExecutableNodes, findSkippedNodes, type Graph } from "./graph";

describe("findRoots", () => {
  it("returns nodes with no incoming edges", () => {
    const graph: Graph = {
      nodes: [{ key: "trigger", type: "TRIGGER" }, { key: "agent", type: "AGENT" }],
      edges: [{ sourceKey: "trigger", targetKey: "agent" }],
    };
    expect(findRoots(graph).map((n) => n.key)).toEqual(["trigger"]);
  });
});

describe("detectCycle", () => {
  it("returns null for a valid DAG", () => {
    const graph: Graph = {
      nodes: [{ key: "a", type: "TRIGGER" }, { key: "b", type: "AGENT" }],
      edges: [{ sourceKey: "a", targetKey: "b" }],
    };
    expect(detectCycle(graph)).toBeNull();
  });

  it("detects a direct cycle", () => {
    const graph: Graph = {
      nodes: [{ key: "a", type: "AGENT" }, { key: "b", type: "AGENT" }],
      edges: [
        { sourceKey: "a", targetKey: "b" },
        { sourceKey: "b", targetKey: "a" },
      ],
    };
    expect(detectCycle(graph)).not.toBeNull();
  });
});

describe("findExecutableNodes", () => {
  const graph: Graph = {
    nodes: [
      { key: "trigger", type: "TRIGGER" },
      { key: "condition", type: "CONDITION" },
      { key: "trueBranch", type: "AGENT" },
      { key: "falseBranch", type: "AGENT" },
      { key: "output", type: "OUTPUT" },
    ],
    edges: [
      { sourceKey: "trigger", targetKey: "condition" },
      { sourceKey: "condition", targetKey: "trueBranch", sourceHandle: "true" },
      { sourceKey: "condition", targetKey: "falseBranch", sourceHandle: "false" },
      { sourceKey: "trueBranch", targetKey: "output" },
      { sourceKey: "falseBranch", targetKey: "output" },
    ],
  };

  it("only makes the matching branch executable", () => {
    const completed = new Map([
      ["trigger", { status: "success" as const }],
      ["condition", { status: "success" as const, handle: "true" }],
    ]);
    const next = findExecutableNodes(graph, completed).map((n) => n.key);
    expect(next).toEqual(["trueBranch"]);
  });

  it("does not surface the losing branch as executable or block output forever", () => {
    const completed = new Map([
      ["trigger", { status: "success" as const }],
      ["condition", { status: "success" as const, handle: "true" }],
      ["trueBranch", { status: "success" as const }],
      ["falseBranch", { status: "skipped" as const }],
    ]);
    const next = findExecutableNodes(graph, completed).map((n) => n.key);
    expect(next).toEqual(["output"]);
  });
});

describe("findSkippedNodes", () => {
  const graph: Graph = {
    nodes: [
      { key: "trigger", type: "TRIGGER" },
      { key: "condition", type: "CONDITION" },
      { key: "trueBranch", type: "AGENT" },
      { key: "falseBranch", type: "AGENT" },
      { key: "output", type: "OUTPUT" },
    ],
    edges: [
      { sourceKey: "trigger", targetKey: "condition" },
      { sourceKey: "condition", targetKey: "trueBranch", sourceHandle: "true" },
      { sourceKey: "condition", targetKey: "falseBranch", sourceHandle: "false" },
      { sourceKey: "trueBranch", targetKey: "output" },
      { sourceKey: "falseBranch", targetKey: "output" },
    ],
  };

  it("identifies the untaken branch as skippable once its source has settled", () => {
    // This is the case the engine relies on every iteration (see run.ts) —
    // without it, falseBranch never enters `completed` and the workflow
    // stalls forever, since findExecutableNodes correctly excludes it but
    // nothing else ever marks it done.
    const completed = new Map([
      ["trigger", { status: "success" as const }],
      ["condition", { status: "success" as const, handle: "true" }],
    ]);
    expect(findSkippedNodes(graph, completed).map((n) => n.key)).toEqual(["falseBranch"]);
  });

  it("does not mark a node skipped while it's still waiting on an unsettled upstream node", () => {
    const completed = new Map([["trigger", { status: "success" as const }]]);
    // condition hasn't run yet, so trueBranch/falseBranch aren't skippable
    // OR executable — they're just not decidable yet.
    expect(findSkippedNodes(graph, completed).map((n) => n.key)).toEqual([]);
  });
});
