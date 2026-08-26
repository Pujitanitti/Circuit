import { NODE_TYPE_META } from "@/components/workflow/types";
import type { NodeType } from "@prisma/client";

type PreviewNode = { key: string; type: NodeType; position: { x: number; y: number } };
type PreviewEdge = { sourceKey: string; targetKey: string };

/**
 * Renders the ACTUAL structure of a template — real node positions (the
 * same x/y stored in WorkflowNode when the template is instantiated) and
 * real edges, scaled into a small viewBox. Not a decorative stand-in: the
 * branch fan-out and node sequence you see here is the graph that gets
 * created if you click "Use template".
 */
export function MiniGraphPreview({ nodes, edges }: { nodes: PreviewNode[]; edges: PreviewEdge[] }) {
  if (nodes.length === 0) return null;

  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const W = 240, H = 70, PAD = 14;
  const scale = (x: number, y: number) => ({
    x: PAD + ((x - minX) / spanX) * (W - PAD * 2),
    y: PAD + ((y - minY) / spanY) * (H - PAD * 2),
  });

  const positioned = new Map(nodes.map((n) => [n.key, scale(n.position.x, n.position.y)]));

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {edges.map((e, i) => {
        const from = positioned.get(e.sourceKey);
        const to = positioned.get(e.targetKey);
        if (!from || !to) return null;
        return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#E4E7EF" strokeWidth="1.5" />;
      })}
      {nodes.map((n) => {
        const pos = positioned.get(n.key)!; // safe: positioned was built from this same nodes array
        const color = NODE_TYPE_META[n.type]!.color; // safe: exhaustive Record over NodeType
        return <circle key={n.key} cx={pos.x} cy={pos.y} r="4.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />;
      })}
    </svg>
  );
}
