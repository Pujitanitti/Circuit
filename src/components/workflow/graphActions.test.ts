import { describe, it, expect } from "vitest";
import { createHistory, push, undo, redo } from "./history";
import {
  addNodeAction, deleteNodesAction, connectAction, pasteAction, alignNodesAction, snapPosition,
  type GraphSnapshot,
} from "./graphActions";
import type { CircuitNodeData } from "./types";
import type { Node } from "reactflow";

function makeNode(id: string, x: number, y: number): Node<CircuitNodeData> {
  return {
    id, type: "circuitNode", position: { x, y },
    data: { key: id, type: "TRANSFORM", label: id, config: { kind: "extract", expression: "" }, status: "idle" },
  };
}

const empty: GraphSnapshot = { nodes: [], edges: [] };

describe("addNodeAction", () => {
  it("appends a new node without touching existing ones", () => {
    const start: GraphSnapshot = { nodes: [makeNode("a", 0, 0)], edges: [] };
    const result = addNodeAction(start, "OUTPUT", { resultExpression: "" }, (t) => `${t.toLowerCase()}_1`, { x: 100, y: 100 });
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toBe(start.nodes[0]); // unchanged reference
    expect(result.nodes[1]).toMatchObject({ id: "output_1", position: { x: 100, y: 100 } });
  });
});

describe("deleteNodesAction", () => {
  it("removes the node and any edge touching it", () => {
    const start: GraphSnapshot = {
      nodes: [makeNode("a", 0, 0), makeNode("b", 100, 0)],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };
    const result = deleteNodesAction(start, ["a"]);
    expect(result.nodes.map((n) => n.id)).toEqual(["b"]);
    expect(result.edges).toEqual([]);
  });

  it("supports deleting multiple nodes at once", () => {
    const start: GraphSnapshot = { nodes: [makeNode("a", 0, 0), makeNode("b", 0, 0), makeNode("c", 0, 0)], edges: [] };
    const result = deleteNodesAction(start, ["a", "b"]);
    expect(result.nodes.map((n) => n.id)).toEqual(["c"]);
  });
});

describe("connectAction", () => {
  it("adds a new edge between two nodes", () => {
    const start: GraphSnapshot = { nodes: [makeNode("a", 0, 0), makeNode("b", 100, 0)], edges: [] };
    const result = connectAction(start, { source: "a", target: "b", sourceHandle: null, targetHandle: null });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ source: "a", target: "b" });
  });
});

describe("pasteAction", () => {
  it("offsets pasted nodes and selects only the new ones", () => {
    const start: GraphSnapshot = { nodes: [makeNode("a", 0, 0)], edges: [] };
    const result = pasteAction(start, { nodes: [start.nodes[0]!], edges: [] }, () => "a_copy");
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]!.selected).toBe(false);
    expect(result.nodes[1]).toMatchObject({ id: "a_copy", position: { x: 40, y: 40 }, selected: true });
  });

  it("duplicate-style repeated calls cascade because each call's source is the previous result's selection", () => {
    let counter = 0;
    const gen = () => `dup_${++counter}`;
    const original = makeNode("a", 0, 0);
    let snapshot: GraphSnapshot = { nodes: [original], edges: [] };

    // First duplicate: source = current selection (just "a")
    snapshot = pasteAction(snapshot, { nodes: [original], edges: [] }, gen);
    const firstDup = snapshot.nodes.find((n) => n.id === "dup_1")!;

    // Second duplicate: source = the CURRENT selection, which is now the
    // first duplicate — this is what Canvas.tsx's duplicateSelection()
    // does by reading live selectedIds each time it's called.
    snapshot = pasteAction(snapshot, { nodes: [firstDup], edges: [] }, gen);
    const secondDup = snapshot.nodes.find((n) => n.id === "dup_2")!;

    expect(firstDup.position).toEqual({ x: 40, y: 40 });
    expect(secondDup.position).toEqual({ x: 80, y: 80 });
  });

  it("pasteAction with a fixed offset always lands at the same position — cascading is the CALLER's job, not this function's", () => {
    // pasteAction is pure and stateless: it has no memory of prior calls,
    // so calling it twice with the same explicit offset correctly produces
    // the same position. Canvas.tsx achieves cascading paste (40px, 80px,
    // 120px, ...) by passing an increasing offset each time it calls this
    // function — see the next test for that mechanism directly.
    let counter = 0;
    const gen = () => `copy_${++counter}`;
    const original = makeNode("a", 0, 0);
    const firstPaste = pasteAction({ nodes: [original], edges: [] }, { nodes: [original], edges: [] }, gen);
    const secondPaste = pasteAction(firstPaste, { nodes: [original], edges: [] }, gen);
    const firstNew = firstPaste.nodes.find((n) => n.id === "copy_1")!;
    const secondNew = secondPaste.nodes.find((n) => n.id === "copy_2")!;
    expect(firstNew.position).toEqual(secondNew.position);
  });

  it("passing an increasing offset (as Canvas.tsx's paste-count tracking does) cascades each paste outward", () => {
    let counter = 0;
    const gen = () => `copy_${++counter}`;
    const original = makeNode("a", 0, 0);
    let snapshot: GraphSnapshot = { nodes: [original], edges: [] };

    snapshot = pasteAction(snapshot, { nodes: [original], edges: [] }, gen, 40 * 1);
    snapshot = pasteAction(snapshot, { nodes: [original], edges: [] }, gen, 40 * 2);
    snapshot = pasteAction(snapshot, { nodes: [original], edges: [] }, gen, 40 * 3);

    const positions = ["copy_1", "copy_2", "copy_3"].map((id) => snapshot.nodes.find((n) => n.id === id)!.position);
    expect(positions).toEqual([{ x: 40, y: 40 }, { x: 80, y: 80 }, { x: 120, y: 120 }]);
  });

  it("preserves the copied node's configuration exactly", () => {
    const original: Node<CircuitNodeData> = {
      id: "a", type: "circuitNode", position: { x: 0, y: 0 },
      data: { key: "a", type: "AGENT", label: "My Agent", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "sys", userPrompt: "hi", temperature: 0.7, maxTokens: 500, tools: [] }, status: "idle" },
    };
    const result = pasteAction({ nodes: [original], edges: [] }, { nodes: [original], edges: [] }, () => "a_copy");
    const pasted = result.nodes.find((n) => n.id === "a_copy")!;
    expect(pasted.data.config).toEqual(original.data.config);
  });

  it("does not copy an edge pointing outside the pasted node set", () => {
    const a = makeNode("a", 0, 0), b = makeNode("b", 100, 0), c = makeNode("c", 200, 0);
    const start: GraphSnapshot = { nodes: [a, b, c], edges: [{ id: "e1", source: "a", target: "b" }, { id: "e2", source: "b", target: "c" }] };
    const result = pasteAction(start, { nodes: [a, b], edges: [{ id: "e1", source: "a", target: "b" }] }, () => `n_${Math.random()}`);
    const newEdgeCount = result.edges.length - start.edges.length;
    expect(newEdgeCount).toBe(1); // only a->b was internal to what was copied
  });
});

describe("alignNodesAction", () => {
  const nodes: GraphSnapshot = {
    nodes: [makeNode("a", 0, 0), makeNode("b", 100, 50), makeNode("c", 200, 100)],
    edges: [],
  };

  it("align left moves all selected nodes to the minimum x", () => {
    const result = alignNodesAction(nodes, ["a", "b", "c"], "left");
    expect(result.nodes.map((n) => n.position.x)).toEqual([0, 0, 0]);
  });

  it("align top moves all selected nodes to the minimum y", () => {
    const result = alignNodesAction(nodes, ["a", "b", "c"], "top");
    expect(result.nodes.map((n) => n.position.y)).toEqual([0, 0, 0]);
  });

  it("only repositions nodes in the given id list", () => {
    const result = alignNodesAction(nodes, ["a", "b"], "left");
    expect(result.nodes.find((n) => n.id === "c")!.position).toEqual({ x: 200, y: 100 });
  });

  it("is a no-op with fewer than 2 nodes selected", () => {
    const result = alignNodesAction(nodes, ["a"], "left");
    expect(result).toBe(nodes);
  });
});

describe("snapPosition", () => {
  it("rounds to the nearest grid cell", () => {
    expect(snapPosition({ x: 23, y: 47 }, 20)).toEqual({ x: 20, y: 40 });
    expect(snapPosition({ x: 33, y: 47 }, 20)).toEqual({ x: 40, y: 40 });
  });
});

describe("undo/redo of graph actions (via history.ts, the real mechanism Canvas.tsx uses)", () => {
  it("undo add node removes it, redo add node restores it", () => {
    let h = createHistory(empty);
    const withNode = addNodeAction(h.present, "OUTPUT", { resultExpression: "" }, () => "out_1", { x: 0, y: 0 });
    h = push(h, withNode);
    expect(h.present.nodes).toHaveLength(1);

    h = undo(h);
    expect(h.present.nodes).toHaveLength(0);

    h = redo(h);
    expect(h.present.nodes).toHaveLength(1);
    expect(h.present.nodes[0]!.id).toBe("out_1");
  });

  it("undo delete restores the node AND its edges, redo delete removes them again", () => {
    const a = makeNode("a", 0, 0), b = makeNode("b", 100, 0);
    const initial: GraphSnapshot = { nodes: [a, b], edges: [{ id: "e1", source: "a", target: "b" }] };
    let h = createHistory(initial);

    h = push(h, deleteNodesAction(h.present, ["a"]));
    expect(h.present.nodes).toHaveLength(1);
    expect(h.present.edges).toHaveLength(0);

    h = undo(h);
    expect(h.present.nodes).toHaveLength(2);
    expect(h.present.edges).toHaveLength(1); // the edge comes back too, not just the node

    h = redo(h);
    expect(h.present.nodes).toHaveLength(1);
    expect(h.present.edges).toHaveLength(0);
  });

  it("undo edge creation removes the edge, redo restores it", () => {
    const a = makeNode("a", 0, 0), b = makeNode("b", 100, 0);
    let h = createHistory<GraphSnapshot>({ nodes: [a, b], edges: [] });

    h = push(h, connectAction(h.present, { source: "a", target: "b", sourceHandle: null, targetHandle: null }));
    expect(h.present.edges).toHaveLength(1);

    h = undo(h);
    expect(h.present.edges).toHaveLength(0);

    h = redo(h);
    expect(h.present.edges).toHaveLength(1);
  });

  it("undoing a multi-node delete restores every deleted node in one step", () => {
    const initial: GraphSnapshot = { nodes: [makeNode("a", 0, 0), makeNode("b", 0, 0), makeNode("c", 0, 0)], edges: [] };
    let h = createHistory(initial);

    h = push(h, deleteNodesAction(h.present, ["a", "b"]));
    expect(h.present.nodes).toHaveLength(1);

    h = undo(h);
    expect(h.present.nodes).toHaveLength(3);
    expect(h.present.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("undo align restores original per-node positions, not just an average", () => {
    const initial: GraphSnapshot = { nodes: [makeNode("a", 0, 0), makeNode("b", 100, 50)], edges: [] };
    let h = createHistory(initial);

    h = push(h, alignNodesAction(h.present, ["a", "b"], "left"));
    expect(h.present.nodes.map((n) => n.position.x)).toEqual([0, 0]);

    h = undo(h);
    expect(h.present.nodes.map((n) => n.position.x)).toEqual([0, 100]);
  });
});
