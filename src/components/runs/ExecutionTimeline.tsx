"use client";

type LogRecord = { level: string; message: string; nodeKey: string | null; timestamp: string };

/**
 * Every row here is a real ExecutionLog entry — timestamps, node scoping,
 * and messages are exactly what the engine wrote during the run (see
 * engine/run.ts's `log()` calls). No synthetic "started"/"completed" pairs
 * are invented; if the engine didn't log an event, it doesn't appear here.
 */
export function ExecutionTimeline({ logs, onSelectNode }: { logs: LogRecord[]; onSelectNode: (nodeKey: string) => void }) {
  if (logs.length === 0) {
    return <p className="p-4 text-[12px] text-ink-muted">No log events recorded yet.</p>;
  }

  const first = new Date(logs[0]!.timestamp).getTime();

  return (
    <div className="h-full overflow-auto p-3">
      {logs.map((log, i) => {
        const offsetMs = new Date(log.timestamp).getTime() - first;
        const mm = Math.floor(offsetMs / 60000);
        const ss = ((offsetMs % 60000) / 1000).toFixed(3).padStart(6, "0");
        return (
          <button
            key={i}
            onClick={() => log.nodeKey && onSelectNode(log.nodeKey)}
            disabled={!log.nodeKey}
            className="flex w-full items-start gap-3 rounded-md px-2 py-1 text-left font-mono text-[11px] hover:bg-canvas-raised disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="shrink-0 text-ink-faint">{mm}:{ss}</span>
            {log.nodeKey && <span className="shrink-0 text-accent-cyan">[{log.nodeKey}]</span>}
            <span
              className={
                log.level === "ERROR" ? "text-state-error" : log.level === "WARN" ? "text-state-warning" : "text-ink-muted"
              }
            >
              {log.message}
            </span>
          </button>
        );
      })}
      {logs.length > 1 && (
        <p className="mt-2 border-t border-canvas-border px-2 pt-2 text-[11px] text-ink-faint">
          Total: {((new Date(logs[logs.length - 1]!.timestamp).getTime() - first) / 1000).toFixed(3)}s
        </p>
      )}
    </div>
  );
}
