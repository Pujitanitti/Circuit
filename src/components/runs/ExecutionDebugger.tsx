"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "@/components/workflow/CircuitNode";
import type { CircuitNodeData, NodeRuntimeStatus } from "@/components/workflow/types";
import { LogsPanel } from "./LogsPanel";
import { NodeDetailTabs } from "./NodeDetailTabs";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { useExecutionStream } from "./useExecutionStream";
import { clsx } from "clsx";
import type { NodeType } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";

type NodeExecutionRecord = {
  nodeKey: string; status: string; attempt: number; maxAttempts: number;
  input: unknown; output: unknown; error: string | null;
  startedAt: string | null; completedAt: string | null;
};
type LogRecord = { level: string; message: string; nodeKey: string | null; timestamp: string };

const STATUS_MAP: Record<string, NodeRuntimeStatus> = {
  PENDING: "idle", RUNNING: "running", RETRYING: "retrying", WAITING: "waiting",
  SUCCESS: "success", FAILED: "failed", SKIPPED: "skipped",
};

export function ExecutionDebugger({
  executionId, workflowName, initialStatus, nodes, edges, initialNodeExecutions, initialLogs, startedAt, completedAt,
}: {
  executionId: string;
  workflowName: string;
  initialStatus: string;
  nodes: { key: string; type: NodeType; label: string; config: object; positionX: number; positionY: number }[];
  edges: { sourceKey: string; targetKey: string; sourceHandle: string | null }[];
  initialNodeExecutions: NodeExecutionRecord[];
  initialLogs: LogRecord[];
  startedAt: string | null;
  completedAt: string | null;
}) {
  const isTerminal = ["SUCCESS", "FAILED", "CANCELLED"].includes(initialStatus);
  const { snapshot: live, connectionLost } = useExecutionStream(isTerminal ? null : executionId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<"logs" | "timeline">("logs");
  const toast = useToast();

  // Most-recent status per node, preferring live snapshot data once it arrives.
  const nodeStatuses: Record<string, string> = useMemo(() => {
    const fromInitial = Object.fromEntries(
      initialNodeExecutions
        .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
        .map((ne) => [ne.nodeKey, ne.status])
    );
    return live ? { ...fromInitial, ...live.nodeStatuses } : fromInitial;
  }, [initialNodeExecutions, live]);

  const logs: LogRecord[] = live?.recentLogs
    ? [...initialLogs, ...live.recentLogs].filter(
        (log, i, arr) => arr.findIndex((l) => l.timestamp === log.timestamp && l.message === log.message) === i
      )
    : initialLogs;

  const flowNodes: Node<CircuitNodeData>[] = nodes.map((n) => {
    const currentStatus = live?.status ?? initialStatus;
    const currentlyTerminal = ["SUCCESS", "FAILED", "CANCELLED"].includes(currentStatus);
    const rawStatus = nodeStatuses[n.key];
    // A node with no NodeExecution row at all is either "hasn't run YET"
    // (execution still in progress — legitimately "idle"/Ready) or "the
    // run finished and this node was simply never reached" (e.g. it sits
    // downstream of a node that failed) — those are different facts and
    // shouldn't share a label. Skipped nodes DO get a real row (status
    // SKIPPED, since the Bug-1 fix in run.ts) so they're handled by the
    // normal STATUS_MAP lookup below, not this branch.
    const status = rawStatus
      ? STATUS_MAP[rawStatus] ?? "idle"
      : currentlyTerminal ? "not_executed" : "idle";
    return {
      id: n.key,
      type: "circuitNode",
      position: { x: n.positionX, y: n.positionY },
      data: {
        key: n.key, type: n.type, label: n.label, config: n.config as CircuitNodeData["config"],
        status,
      },
      // Skipped nodes (the untaken branch of a Condition) are dimmed rather
      // than rendered identically to nodes that simply haven't run yet —
      // this is the visual difference between "ruled out" and "pending"
      // that engine/graph.ts's findSkippedNodes makes explicit server-side.
      style: status === "skipped" ? { opacity: 0.4 } : undefined,
      draggable: false,
      connectable: false,
    };
  });

  const flowEdges: Edge[] = edges.map((e, i) => {
    const targetSkipped = nodeStatuses[e.targetKey] === "SKIPPED";
    return {
      id: `${e.sourceKey}-${e.targetKey}-${i}`,
      source: e.sourceKey,
      target: e.targetKey,
      sourceHandle: e.sourceHandle ?? undefined,
      animated: nodeStatuses[e.sourceKey] === "SUCCESS" && nodeStatuses[e.targetKey] === "RUNNING",
      style: targetSkipped ? { opacity: 0.25, strokeDasharray: "4 3" } : undefined,
    };
  });

  const stats = useMemo(() => {
    const byStatus = (s: string) => initialNodeExecutions.filter((ne) => ne.status === s).length;
    return {
      total: nodes.length,
      success: byStatus("SUCCESS"),
      failed: byStatus("FAILED"),
      skipped: byStatus("SKIPPED"),
    };
  }, [initialNodeExecutions, nodes.length]);

  const durationLabel = useMemo(() => {
    if (!startedAt) return "—";
    const end = completedAt ? new Date(completedAt) : new Date();
    return `${((end.getTime() - new Date(startedAt).getTime()) / 1000).toFixed(1)}s`;
  }, [startedAt, completedAt]);

  const selectedExecution = initialNodeExecutions
    .filter((ne) => ne.nodeKey === selectedKey)
    .sort((a, b) => b.attempt - a.attempt)[0];
  const selectedNodeDef = nodes.find((n) => n.key === selectedKey);

  async function replay(mode: "full" | "from-failed") {
    const res = await fetch(`/api/executions/${executionId}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (data.executionId) {
      toast({ kind: "info", title: "Replay started", description: "Redirecting to the new execution…" });
      window.location.href = `/runs/${data.executionId}`;
    } else {
      toast({ kind: "error", title: "Replay failed", description: data.error ?? "Unknown error" });
    }
  }

  const status = live?.status ?? initialStatus;
  const hasFailure = initialNodeExecutions.some((ne) => ne.status === "FAILED");

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-canvas-border bg-canvas-surface px-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-ink">{workflowName}</span>
          <StatusBadge status={status} />
          {connectionLost && !isTerminal && (
            <span className="flex items-center gap-1 text-[11px] text-state-warning">
              Live updates stopped — reload to check status
            </span>
          )}
          <span className="text-[11px] text-ink-faint">{executionId}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11px] text-ink-muted">
            <span>{durationLabel}</span>
            <span className="text-ink-faint">·</span>
            <span>{stats.total} nodes</span>
            {stats.success > 0 && <span className="text-state-success">{stats.success} success</span>}
            {stats.failed > 0 && <span className="text-state-error">{stats.failed} failed</span>}
            {stats.skipped > 0 && <span className="text-ink-faint">{stats.skipped} skipped</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => replay("full")} className="rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink">
              Replay
            </button>
            {hasFailure && (
              <button onClick={() => replay("from-failed")} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white">
                Replay from failed node
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedKey(n.id)}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
          >
            <Background color="#DCE0EA" gap={20} size={1.5} />
            <Controls showInteractive={false} className="!bg-canvas-surface !border-canvas-border [&>button]:!bg-canvas-surface [&>button]:!border-canvas-border" />
          </ReactFlow>
        </div>

        {selectedExecution && (
          <NodeDetailTabs
            execution={selectedExecution}
            logs={logs}
            conditionPanel={
              selectedNodeDef?.type === "CONDITION" && selectedExecution.output !== null ? (
                <ConditionResult config={selectedNodeDef.config as { left?: string; operator?: string; right?: string }} output={selectedExecution.output} />
              ) : null
            }
          />
        )}

        <div className="flex h-full w-96 shrink-0 flex-col border-l border-canvas-border">
          <div className="flex shrink-0 border-b border-canvas-border">
            <button
              onClick={() => setRightPanel("logs")}
              className={clsx("flex-1 py-2 text-[11px] font-medium", rightPanel === "logs" ? "border-b-2 border-accent text-ink" : "text-ink-faint hover:text-ink-muted")}
            >
              Logs
            </button>
            <button
              onClick={() => setRightPanel("timeline")}
              className={clsx("flex-1 py-2 text-[11px] font-medium", rightPanel === "timeline" ? "border-b-2 border-accent text-ink" : "text-ink-faint hover:text-ink-muted")}
            >
              Timeline
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightPanel === "logs" ? <LogsPanel logs={logs} /> : <ExecutionTimeline logs={logs} onSelectNode={setSelectedKey} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionResult({ config, output }: { config: { left?: string; operator?: string; right?: string }; output: unknown }) {
  const result = output as { result?: boolean; handle?: string; resolvedLeft?: unknown; resolvedRight?: unknown };
  const hasResolved = result.resolvedLeft !== undefined || result.resolvedRight !== undefined;

  return (
    <div className="mt-3 rounded-md border border-canvas-border bg-canvas p-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">Expression</p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
        {config.left} <span className="text-accent-cyan">{config.operator}</span> {config.right}
      </p>

      {hasResolved && (
        <>
          <p className="mt-2 text-[10px] uppercase tracking-wide text-ink-faint">Resolved</p>
          <p className="mt-0.5 font-mono text-[11px] text-ink">
            {JSON.stringify(result.resolvedLeft)} <span className="text-accent-cyan">{config.operator}</span> {JSON.stringify(result.resolvedRight)}
          </p>
        </>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-[11px]">
        <span className={result.result ? "text-state-success" : "text-ink-faint"}>
          {result.result ? "TRUE" : "FALSE"}
        </span>
        <span className="text-ink-faint">→ took the</span>
        <span className="font-medium text-ink">{result.handle}</span>
        <span className="text-ink-faint">branch</span>
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    SUCCESS: "text-state-success", RUNNING: "text-state-running", FAILED: "text-state-error",
    WAITING_APPROVAL: "text-state-warning", CANCELLED: "text-ink-faint", PENDING: "text-ink-faint",
  };
  return <span className={clsx("text-[11px] font-medium", color[status] ?? "text-ink-muted")}>{status}</span>;
}
