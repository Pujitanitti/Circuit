"use client";

import { useRef } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { MAX_EXECUTION_DURATION_MS } from "@/server/engine/retry";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import type { ValidationIssue } from "./validateGraph";

export function PreflightModal({
  version,
  nodeCount,
  issues,
  onCancel,
  onConfirm,
  running,
}: {
  version: number;
  nodeCount: number;
  issues: ValidationIssue[];
  onCancel: () => void;
  onConfirm: () => void;
  running: boolean;
}) {
  const valid = issues.length === 0;
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preflight-title"
        tabIndex={-1}
        className="w-full max-w-md panel-raised p-4 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p id="preflight-title" className="text-[13px] font-medium text-ink">Run workflow</p>
          <button onClick={onCancel} aria-label="Close" className="text-ink-faint hover:text-ink">
            <X size={14} />
          </button>
        </div>

        <div className="mt-3 space-y-1.5 text-[12px]">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Version</span>
            <span className="text-ink">v{version}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Nodes</span>
            <span className="text-ink">{nodeCount}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Execution timeout</span>
            <span className="text-ink">{Math.round(MAX_EXECUTION_DURATION_MS / 60000)} min</span>
          </div>
        </div>

        <div className="mt-3 border-t border-canvas-border pt-3">
          {valid ? (
            <div className="flex items-center gap-1.5 text-[12px] text-state-success">
              <CheckCircle2 size={13} />
              Workflow valid — no validation issues found
            </div>
          ) : (
            <div className="space-y-1.5">
              {issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px] text-state-error">
                  <XCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Honest omission: credential-availability and loop-limit checks
            from the original spec aren't shown as separate line items here.
            Loop bounds are already covered by the validation issues above
            (validateGraph rejects a Loop node with an invalid maxIterations).
            Credential availability isn't checkable yet — Tool/Agent node
            configs don't reference a stored Credential by id in the current
            schema, so there's nothing real to check. See README's Known
            Limitations rather than fabricating a green checkmark here. */}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!valid || running}
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {running ? "Starting…" : "Run workflow"}
          </button>
        </div>
      </div>
    </div>
  );
}
