"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { clsx } from "clsx";

export type WorkflowSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  executionCount: number;
  lastExecutionStatus: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-state-success", FAILED: "text-state-error",
  RUNNING: "text-state-running", WAITING_APPROVAL: "text-state-warning",
  CANCELLED: "text-ink-faint", PENDING: "text-ink-faint",
};

type SortKey = "updated" | "name" | "runs";

export function WorkflowLibrary({ workflows }: { workflows: WorkflowSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? workflows.filter((w) => w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q))
      : workflows;

    return [...matched].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "runs") return b.executionCount - a.executionCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [workflows, query, sort]);

  return (
    <div>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-canvas-border bg-canvas-surface px-2.5 py-1.5">
          <Search size={13} className="text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workflows…"
            className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-canvas-border bg-canvas-surface px-2 py-1.5 text-[12px] text-ink-muted"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
          <option value="runs">Most runs</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-ink-muted">No workflows match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {filtered.map((w) => (
            <Link key={w.id} href={`/workflows/${w.id}`} className="panel p-4 transition-colors hover:border-accent/50">
              <p className="truncate text-[13px] font-medium text-ink">{w.name}</p>
              <p className="mt-1 line-clamp-2 text-[12px] text-ink-muted">{w.description ?? "No description"}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-faint">
                <span>{w.executionCount} runs</span>
                {w.lastExecutionStatus && (
                  <>
                    <span>·</span>
                    <span className={clsx(STATUS_COLOR[w.lastExecutionStatus] ?? "text-ink-faint")}>
                      last: {w.lastExecutionStatus.toLowerCase()}
                    </span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
