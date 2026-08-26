import { describe, it, expect } from "vitest";
import { selectCarryOverNodes } from "./replay";

describe("selectCarryOverNodes", () => {
  it("carries over only SUCCESS and SKIPPED nodes", () => {
    const prior = [
      { nodeKey: "trigger", status: "SUCCESS", output: { ok: true } },
      { nodeKey: "condition", status: "SUCCESS", output: { handle: "false" } },
      { nodeKey: "trueBranch", status: "SKIPPED", output: null },
      { nodeKey: "tool", status: "FAILED", output: null },
    ];
    const carried = selectCarryOverNodes(prior);
    expect(carried.map((n) => n.nodeKey)).toEqual(["trigger", "condition", "trueBranch"]);
  });

  it("returns an empty list when nothing succeeded", () => {
    expect(selectCarryOverNodes([{ nodeKey: "trigger", status: "FAILED", output: null }])).toEqual([]);
  });
});
