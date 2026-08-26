import type { Node, Edge, Connection } from "reactflow";
import { addEdge } from "reactflow";
import type { CircuitNodeData, NodeConfig } from "./types";
import type { NodeType } from "@prisma/client";
import { remapForPaste } from "./clipboard";

export type GraphSnapshot = { nodes: Node<CircuitNodeData>[]; edges: Edge[] };

/**
 * Every function here takes a snapshot and returns a NEW snapshot — no
 * mutation, no React state, no DOM. Canvas.tsx's job is reduced to: call
 * one of these, then `commit(result)` to push it onto the undo/redo
 * history. This is what makes "undo add", "undo delete", etc. directly
 * testable (see graphActions.test.ts) without rendering anything.
 */

export function addNodeAction(
  snapshot: GraphSnapshot,
  type: NodeType,
  config: NodeConfig,
  generateKey: (typeKey: string) => string,
  position: { x: number; y: number }
): GraphSnapshot {
  const key = generateKey(type);
  const newNode: Node<CircuitNodeData> = {
    id: key,
    type: "circuitNode",
    position,
    data: { key, type, label: `${type.charAt(0)}${type.slice(1).toLowerCase()}`, config, status: "idle" },
  };
  return { nodes: [...snapshot.nodes, newNode], edges: snapshot.edges };
}

export function deleteNodesAction(snapshot: GraphSnapshot, ids: string[]): GraphSnapshot {
  const idSet = new Set(ids);
  return {
    nodes: snapshot.nodes.filter((n) => !idSet.has(n.id)),
    edges: snapshot.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
  };
}

export function connectAction(snapshot: GraphSnapshot, connection: Connection): GraphSnapshot {
  return { nodes: snapshot.nodes, edges: addEdge(connection, snapshot.edges) };
}

export function updateNodeConfigAction(snapshot: GraphSnapshot, nodeId: string, config: NodeConfig): GraphSnapshot {
  return {
    nodes: snapshot.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config } } : n)),
    edges: snapshot.edges,
  };
}

/**
 * Shared by both copy→paste and duplicate — the only difference between
 * them is what's passed as `source` (the clipboard vs. the current
 * selection). Deselects everything existing and selects the new nodes, so
 * a paste/duplicate is immediately draggable/deletable as its own unit.
 */
export function pasteAction(
  snapshot: GraphSnapshot,
  source: { nodes: Node<CircuitNodeData>[]; edges: Edge[] },
  generateKey: (typeKey: string) => string,
  offset = 40
): GraphSnapshot {
  if (source.nodes.length === 0) return snapshot;

  const remap = remapForPaste(
    source.nodes.map((n) => ({ id: n.id, typeKey: n.data.type, positionX: n.position.x, positionY: n.position.y })),
    source.edges.map((e) => ({ source: e.source, target: e.target })),
    generateKey,
    offset
  );

  const newNodes: Node<CircuitNodeData>[] = source.nodes.map((n, i) => {
    const r = remap.nodes[i]!;
    return { ...n, id: r.newId, position: { x: r.newPositionX, y: r.newPositionY }, selected: true, data: { ...n.data, key: r.newId } };
  });
  const newEdges: Edge[] = remap.edges.map((e, i) => ({ id: `${e.source}-${e.target}-copy${i}`, source: e.source, target: e.target }));

  return {
    nodes: [...snapshot.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
    edges: [...snapshot.edges, ...newEdges],
  };
}

export type Alignment = "left" | "center" | "top" | "middle";

/**
 * Repositions only the nodes in `ids` (leaves everything else untouched)
 * so they share a common edge/center — "left"/"top" align to the
 * selection's minimum x/y, "center"/"middle" align to the mean.
 */
export function alignNodesAction(snapshot: GraphSnapshot, ids: string[], alignment: Alignment): GraphSnapshot {
  const idSet = new Set(ids);
  const selected = snapshot.nodes.filter((n) => idSet.has(n.id));
  if (selected.length < 2) return snapshot;

  let target: number;
  if (alignment === "left") target = Math.min(...selected.map((n) => n.position.x));
  else if (alignment === "top") target = Math.min(...selected.map((n) => n.position.y));
  else if (alignment === "center") target = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length;
  else target = selected.reduce((sum, n) => sum + n.position.y, 0) / selected.length;

  const axis = alignment === "left" || alignment === "center" ? "x" : "y";

  return {
    nodes: snapshot.nodes.map((n) =>
      idSet.has(n.id) ? { ...n, position: { ...n.position, [axis]: target } } : n
    ),
    edges: snapshot.edges,
  };
}

/** Rounds a position to the nearest grid cell. Pure — the actual toggle/gridSize live in Canvas state. */
export function snapPosition(position: { x: number; y: number }, gridSize: number): { x: number; y: number } {
  return { x: Math.round(position.x / gridSize) * gridSize, y: Math.round(position.y / gridSize) * gridSize };
}
