"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { MiniGraphPreview } from "./MiniGraphPreview";
import type { NodeType } from "@prisma/client";

type PreviewNode = { key: string; type: NodeType; position: { x: number; y: number } };
type PreviewEdge = { sourceKey: string; targetKey: string };

export function TemplateCard({
  name, description, category, nodeCount, branchCount, nodes, edges,
}: {
  name: string; description: string; category: string; nodeCount: number; branchCount: number;
  nodes: PreviewNode[]; edges: PreviewEdge[];
}) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function use() {
    setLoading(true);
    const res = await fetch(`/api/templates/builtin-${name.toLowerCase().replace(/\s+/g, "-")}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "", name }), // TODO(Phase 6 sweep): current workspace id from session, not hardcoded
    });
    setLoading(false);
    const data = await res.json();
    if (data.workflowId) {
      toast({ kind: "success", title: `Created "${name}"`, description: "Opening the workflow builder…" });
      window.location.href = `/workflows/${data.workflowId}`;
    } else {
      toast({ kind: "error", title: "Couldn't create workflow from template", description: data.error ?? "Unknown error" });
    }
  }

  return (
    <div className="panel panel-hover p-4">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{name}</span>
        <span className="ml-auto rounded-full border border-canvas-border px-2 py-0.5 text-[10px] text-ink-faint">{category}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-ink-muted">{description}</p>

      <div className="mt-3 rounded-md border border-canvas-border bg-canvas-grid px-2 py-2">
        <MiniGraphPreview nodes={nodes} edges={edges} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-ink-faint">
          {nodeCount} nodes{branchCount > 0 ? ` · ${branchCount} branch${branchCount > 1 ? "es" : ""}` : ""}
        </span>
        <button onClick={use} disabled={loading} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
          {loading ? "Creating…" : "Use template"}
        </button>
      </div>
    </div>
  );
}
