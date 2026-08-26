"use client";

import { useState } from "react";

type NodeExecutionRecord = {
  nodeKey: string; status: string; attempt: number; maxAttempts: number;
  input: unknown; output: unknown; error: string | null;
  startedAt: string | null; completedAt: string | null;
};
type LogRecord = { level: string; message: string; nodeKey: string | null; timestamp: string };

const TABS = ["Output", "State", "Logs"] as const;
type Tab = (typeof TABS)[number];

export function NodeDetailTabs({
  execution,
  conditionPanel,
  logs,
}: {
  execution: NodeExecutionRecord;
  conditionPanel: React.ReactNode;
  logs: LogRecord[];
}) {
  const [tab, setTab] = useState<Tab>("Output");
  const nodeLogs = logs.filter((l) => l.nodeKey === execution.nodeKey);
  const duration =
    execution.startedAt && execution.completedAt
      ? `${((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000).toFixed(2)}s`
      : null;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-canvas-border bg-canvas-surface">
      <div className="p-4 pb-0">
        <p className="text-[13px] font-medium text-ink">{execution.nodeKey}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
          <span>Attempt {execution.attempt}/{execution.maxAttempts}</span>
          {duration && (
            <>
              <span>·</span>
              <span>{duration}</span>
            </>
          )}
        </div>
        {execution.startedAt && (
          <p className="mt-1 text-[10px] text-ink-faint">
            {new Date(execution.startedAt).toLocaleTimeString()}
            {execution.completedAt && ` → ${new Date(execution.completedAt).toLocaleTimeString()}`}
          </p>
        )}

        {execution.error && (
          <div className="mt-3 rounded-md border border-state-error/30 bg-state-error/10 p-2 text-[11px] text-state-error">
            {execution.error}
          </div>
        )}

        {conditionPanel}
      </div>

      <div className="mt-3 flex shrink-0 border-b border-canvas-border px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-2.5 py-2 text-[11px] font-medium transition-colors ${
              tab === t ? "border-accent text-ink" : "border-transparent text-ink-faint hover:text-ink-muted"
            }`}
          >
            {t === "Logs" ? `Logs${nodeLogs.length > 0 ? ` (${nodeLogs.length})` : ""}` : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === "Output" && (
          <pre className="whitespace-pre-wrap rounded-md bg-canvas p-2 font-mono text-[10px] text-ink-muted">
            {execution.output !== null && execution.output !== undefined ? JSON.stringify(execution.output, null, 2) : "—"}
          </pre>
        )}

        {tab === "State" && (
          <>
            {/* Honest labeling: NodeExecution.input is the full WorkflowState
                snapshot passed into this node's ExecutionContext — not a
                separate "arguments to this node" object. There's no
                distinct "input" data to show beyond this, so this is the
                one real view of it rather than two tabs pretending to
                differ. See engine/run.ts's `input: state as object`. */}
            <p className="mb-2 text-[10px] text-ink-faint">
              Full workflow state at the moment this node ran (trigger, prior node outputs, variables).
            </p>
            <pre className="whitespace-pre-wrap rounded-md bg-canvas p-2 font-mono text-[10px] text-ink-muted">
              {execution.input !== null && execution.input !== undefined ? JSON.stringify(execution.input, null, 2) : "—"}
            </pre>
          </>
        )}

        {tab === "Logs" && (
          <div className="space-y-1.5">
            {nodeLogs.length === 0 && <p className="text-[11px] text-ink-faint">No log entries for this node.</p>}
            {nodeLogs.map((log, i) => (
              <div key={i} className="rounded-md bg-canvas p-2 font-mono text-[10px]">
                <span className="text-ink-faint">{new Date(log.timestamp).toLocaleTimeString()}</span>{" "}
                <span className={log.level === "ERROR" ? "text-state-error" : log.level === "WARN" ? "text-state-warning" : "text-ink-muted"}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
