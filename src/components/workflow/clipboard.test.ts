import { describe, it, expect } from "vitest";
import { remapForPaste } from "./clipboard";

describe("remapForPaste", () => {
  it("assigns a fresh id to every node via the provided generator", () => {
    let counter = 0;
    const result = remapForPaste(
      [{ id: "a", typeKey: "agent", positionX: 0, positionY: 0 }],
      [],
      () => `new_${++counter}`
    );
    expect(result.nodes[0]!.newId).toBe("new_1");
    expect(result.idMap.get("a")).toBe("new_1");
  });

  it("offsets position so a paste doesn't land exactly on its source", () => {
    const result = remapForPaste([{ id: "a", typeKey: "agent", positionX: 100, positionY: 200 }], [], () => "x", 40);
    expect(result.nodes[0]).toMatchObject({ newPositionX: 140, newPositionY: 240 });
  });

  it("remaps internal edges to the new ids", () => {
    let counter = 0;
    const result = remapForPaste(
      [
        { id: "a", typeKey: "trigger", positionX: 0, positionY: 0 },
        { id: "b", typeKey: "output", positionX: 100, positionY: 0 },
      ],
      [{ source: "a", target: "b" }],
      () => `new_${++counter}`
    );
    expect(result.edges).toEqual([{ source: "new_1", target: "new_2" }]);
  });

  it("drops an edge that points outside the copied node set rather than leaving it dangling", () => {
    const result = remapForPaste(
      [{ id: "a", typeKey: "trigger", positionX: 0, positionY: 0 }],
      [{ source: "a", target: "not-copied" }],
      () => "new_1"
    );
    expect(result.edges).toEqual([]);
  });
});
