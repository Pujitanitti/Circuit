"use client";

import { useEffect, useRef, useState } from "react";

export type ExecutionSnapshot = {
  status: string;
  nodeStatuses: Record<string, string>;
  recentLogs: { level: string; message: string; nodeKey: string | null; timestamp: string }[];
};

/**
 * Subscribes to /api/executions/:id/stream and closes itself once the run
 * reaches a terminal status. Exposes `connectionLost` because an SSE
 * `error` event used to close the connection silently — the debugger
 * would just stop updating with zero indication anything went wrong. Now
 * the caller can show a real "live updates stopped" indicator instead of
 * letting a dropped connection look identical to "nothing happening yet."
 */
export function useExecutionStream(executionId: string | null) {
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!executionId) return;
    setConnectionLost(false);

    const source = new EventSource(`/api/executions/${executionId}/stream`);
    sourceRef.current = source;

    source.addEventListener("snapshot", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as ExecutionSnapshot;
      setSnapshot(data);
      // The route closes the connection normally once the execution
      // reaches a terminal status — that's an expected close, not a lost
      // connection, so don't flag it.
      if (["SUCCESS", "FAILED", "CANCELLED"].includes(data.status)) source.close();
    });
    source.addEventListener("error", () => {
      setConnectionLost(true);
      source.close();
    });

    return () => source.close();
  }, [executionId]);

  return { snapshot, connectionLost };
}
