export type ClipboardNode = { id: string; typeKey: string; positionX: number; positionY: number };
export type ClipboardEdge = { source: string; target: string };

/**
 * Given a set of nodes+edges to paste and a function that mints a fresh
 * unique id, returns brand-new node ids/positions (offset so pastes don't
 * land exactly on top of their source) and edges remapped to the new ids.
 * Pure — no React state, no clipboard/DOM access — so copy/paste/duplicate
 * in Canvas.tsx are all thin wrappers around this and this alone needs
 * direct unit tests.
 */
export function remapForPaste<N extends ClipboardNode>(
  nodes: N[],
  edges: ClipboardEdge[],
  generateId: (typeKey: string) => string,
  offset = 40
): { idMap: Map<string, string>; nodes: (N & { newId: string; newPositionX: number; newPositionY: number })[]; edges: ClipboardEdge[] } {
  const idMap = new Map<string, string>();
  const remappedNodes = nodes.map((n) => {
    const newId = generateId(n.typeKey);
    idMap.set(n.id, newId);
    return { ...n, newId, newPositionX: n.positionX + offset, newPositionY: n.positionY + offset };
  });

  // Edges pointing outside the copied set would dangle after remap — those
  // are dropped rather than left referencing an id that was never copied.
  const remappedEdges = edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({ source: idMap.get(e.source)!, target: idMap.get(e.target)! }));

  return { idMap, nodes: remappedNodes, edges: remappedEdges };
}
