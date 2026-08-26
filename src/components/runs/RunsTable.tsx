"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { clsx } from "clsx";

export type RunRow = {
  id: string;
  workflowName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  triggeredBy: string | null;
  nodeCount: number;
  errorCount: number;
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-state-success", RUNNING: "text-state-running", WAITING_APPROVAL: "text-state-warning",
  FAILED: "text-state-error", CANCELLED: "text-ink-faint", PENDING: "text-ink-faint",
};

function duration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "—";
  const end = completedAt ? new Date(completedAt) : new Date();
  return `${((end.getTime() - new Date(startedAt).getTime()) / 1000).toFixed(1)}s`;
}

type SortKey = "started" | "duration" | "workflow";

export function RunsTable({ runs }: { runs: RunRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("started");

  const workflowNames = useMemo(() => Array.from(new Set(runs.map((r) => r.workflowName))).sort(), [runs]);
  const statuses = useMemo(() => Array.from(new Set(runs.map((r) => r.status))).sort(), [runs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = runs;
    if (q) result = result.filter((r) => r.workflowName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (workflowFilter !== "all") result = result.filter((r) => r.workflowName === workflowFilter);

    return [...result].sort((a, b) => {
      if (sort === "workflow") return a.workflowName.localeCompare(b.workflowName);
      if (sort === "duration") {
        const da = a.startedAt ? new Date(a.completedAt ?? Date.now()).getTime() - new Date(a.startedAt).getTime() : -1;
        const db = b.startedAt ? new Date(b.completedAt ?? Date.now()).getTime() - new Date(b.startedAt).getTime() : -1;
        return db - da;
      }
      return new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime();
    });
  }, [runs, query, statusFilter, workflowFilter, sort]);

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-canvas-border bg-canvas-surface px-2.5 py-1.5">
          <Search size={13} className="text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by workflow or execution id…"
            className="w-56 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-canvas-border bg-canvas-surface px-2 py-1.5 text-[12px] text-ink-muted">
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value)} className="rounded-md border border-canvas-border bg-canvas-surface px-2 py-1.5 text-[12px] text-ink-muted">
          <option value="all">All workflows</option>
          {workflowNames.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-canvas-border bg-canvas-surface px-2 py-1.5 text-[12px] text-ink-muted">
          <option value="started">Most recent</option>
          <option value="duration">Longest duration</option>
          <option value="workflow">Workflow name</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-panel border border-canvas-border">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-canvas-border bg-canvas-surface text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-normal">Workflow</th>
              <th className="px-3 py-2 font-normal">Status</th>
              <th className="px-3 py-2 font-normal">Duration</th>
              <th className="px-3 py-2 font-normal">Started</th>
              <th className="px-3 py-2 font-normal">Triggered by</th>
              <th className="px-3 py-2 font-normal">Nodes</th>
              <th className="px-3 py-2 font-normal">Errors</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-canvas-border last:border-0 hover:bg-canvas-raised/40">
                <td className="px-3 py-2">
                  <Link href={`/runs/${r.id}`} className="text-ink hover:text-accent">{r.workflowName}</Link>
                </td>
                <td className={clsx("px-3 py-2 font-medium", STATUS_COLOR[r.status])}>{r.status}</td>
                <td className="px-3 py-2 text-ink-muted">{duration(r.startedAt, r.completedAt)}</td>
                <td className="px-3 py-2 text-ink-muted">{r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}</td>
                <td className="px-3 py-2 text-ink-muted">{r.triggeredBy ?? "Manual"}</td>
                <td className="px-3 py-2 text-ink-muted">{r.nodeCount}</td>
                <td className="px-3 py-2 text-ink-muted">{r.errorCount}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-ink-muted">
                  {runs.length === 0 ? "No runs yet. Execute a workflow to see it here." : "No runs match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
