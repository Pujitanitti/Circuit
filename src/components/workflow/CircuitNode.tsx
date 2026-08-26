"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { clsx } from "clsx";
import {
  Zap, Bot, Globe, GitBranch, Shuffle, Repeat, Clock, UserCheck, Flag,
} from "lucide-react";
import { NODE_TYPE_META, type CircuitNodeData } from "./types";

const ICONS = {
  TRIGGER: Zap, AGENT: Bot, TOOL: Globe, CONDITION: GitBranch, TRANSFORM: Shuffle,
  LOOP: Repeat, DELAY: Clock, APPROVAL: UserCheck, OUTPUT: Flag,
} as const;

const STATUS_DOT: Record<CircuitNodeData["status"], string> = {
  idle: "bg-ink-faint",
  running: "bg-state-running animate-pulseRing",
  success: "bg-state-success",
  failed: "bg-state-error",
  skipped: "bg-ink-faint",
  not_executed: "bg-canvas-border",
  waiting: "bg-state-warning",
  retrying: "bg-state-warning animate-pulseRing",
};

const STATUS_LABEL: Record<CircuitNodeData["status"], string> = {
  idle: "Ready", running: "Running", success: "Success", failed: "Failed",
  // "Skipped" (this node's incoming branch was never taken — a real,
  // deliberate outcome the engine recorded) is deliberately worded
  // differently from "Not executed" (the run never reached this node at
  // all — e.g. it's still in progress, or failed before getting here).
  // Conflating the two would misrepresent what actually happened; see
  // ExecutionDebugger.tsx for how each is derived from real data.
  skipped: "Skipped", not_executed: "Not executed", waiting: "Waiting", retrying: "Retrying",
};

function configSummary(data: CircuitNodeData): string {
  switch (data.type) {
    case "AGENT": {
      const c = data.config as { model?: string };
      return c.model ?? "No model set";
    }
    case "TOOL": {
      const c = data.config as { method?: string; url?: string };
      return c.method && c.url ? `${c.method} ${c.url}` : "Not configured";
    }
    case "CONDITION": {
      const c = data.config as { left?: string; operator?: string; right?: string };
      return c.left ? `${c.left} ${c.operator} ${c.right}` : "No condition set";
    }
    default:
      return NODE_TYPE_META[data.type]!.description;
  }
}

export function CircuitNode({ data, selected }: NodeProps<CircuitNodeData>) {
  const Icon = ICONS[data.type]!; // safe: ICONS is a Record covering every NodeType exhaustively
  const meta = NODE_TYPE_META[data.type]!; // safe: exhaustive Record over NodeType
  const isCondition = data.type === "CONDITION";
  const isLoop = data.type === "LOOP";

  return (
    <div
      className={clsx(
        "w-[220px] rounded-node border bg-canvas-raised px-3 py-2.5 shadow-node transition-shadow",
        selected ? "border-accent shadow-glow" : "border-canvas-border"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-canvas-border !border-canvas-border" />

      <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
        <Icon size={12} style={{ color: meta.color }} />
        {meta.label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-ink">{data.label}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-ink-muted">{configSummary(data)}</div>

      <div className="mt-2 flex items-center gap-1.5">
        <span className={clsx("h-1.5 w-1.5 rounded-full", STATUS_DOT[data.status])} />
        <span className="text-[11px] text-ink-faint">{STATUS_LABEL[data.status]}</span>
      </div>

      {isCondition ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "40%" }} className="!bg-state-success" />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "70%" }} className="!bg-state-error" />
        </>
      ) : isLoop ? (
        <>
          <Handle type="source" position={Position.Right} id="loop" style={{ top: "40%" }} className="!bg-state-warning" />
          <Handle type="source" position={Position.Right} id="done" style={{ top: "70%" }} className="!bg-state-success" />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!bg-canvas-border !border-canvas-border" />
      )}
    </div>
  );
}

export const nodeTypes = { circuitNode: CircuitNode };
