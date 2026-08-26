"use client";

import { clsx } from "clsx";

type LogEntry = { level: string; message: string; nodeKey: string | null; timestamp: string | Date };

const LEVEL_COLOR: Record<string, string> = {
  INFO: "text-ink-muted",
  WARN: "text-state-warning",
  ERROR: "text-state-error",
};

export function LogsPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="h-full overflow-auto bg-canvas p-3 font-mono text-[11px]">
      {logs.length === 0 && <p className="text-ink-faint">No logs yet.</p>}
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2 py-0.5">
          <span className="shrink-0 text-ink-faint">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          {log.nodeKey && <span className="shrink-0 text-accent-cyan">[{log.nodeKey}]</span>}
          <span className={clsx(LEVEL_COLOR[log.level] ?? "text-ink-muted")}>{log.message}</span>
        </div>
      ))}
    </div>
  );
}
