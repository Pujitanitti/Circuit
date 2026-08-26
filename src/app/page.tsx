import Link from "next/link";
import { clsx } from "clsx";
import { getDashboardMetrics, getRecentExecutions } from "@/server/services/dashboard";
import { WorkflowIllustration } from "@/components/ui/WorkflowIllustration";

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-state-success", FAILED: "text-state-error",
  RUNNING: "text-state-running", WAITING_APPROVAL: "text-state-warning",
  CANCELLED: "text-ink-faint", PENDING: "text-ink-faint",
};

// Every number here comes from getDashboardMetrics()/getRecentExecutions()
// (real Prisma queries), never hardcoded — see README.md#dashboard.
export default async function DashboardPage() {
  const [metrics, recentExecutions] = await Promise.all([getDashboardMetrics(), getRecentExecutions()]);

  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Dashboard</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        {metrics.workflowCount} workflows · {metrics.activeRuns} runs in progress
      </p>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <Metric label="Workflows" value={metrics.workflowCount} />
        <Metric label="Active runs" value={metrics.activeRuns} accent="running" />
        <Metric label="Success rate" value={`${metrics.successRate}%`} accent="success" />
        <Metric label="Avg. duration" value={metrics.avgDurationLabel} />
      </div>

      {metrics.workflowCount === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-panel border border-dashed border-canvas-border py-16 text-center">
          <WorkflowIllustration />
          <p className="mt-2 text-[14px] text-ink">No workflows yet</p>
          <p className="max-w-sm text-[13px] text-ink-muted">
            Build your first intelligent workflow and watch Circuit execute it step by step.
          </p>
          <div className="mt-2 flex gap-2">
            <Link href="/workflows/new" className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white">
              Create workflow
            </Link>
            <Link href="/templates" className="rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted">
              Browse templates
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-ink">Recent executions</h2>
            <Link href="/runs" className="text-[12px] text-ink-muted hover:text-ink">View all</Link>
          </div>
          <div className="mt-3 overflow-hidden rounded-panel border border-canvas-border">
            {recentExecutions.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-muted">No executions yet. Run a workflow to see it here.</p>
            ) : (
              <table className="w-full text-left text-[12px]">
                <tbody>
                  {recentExecutions.map((e) => (
                    <tr key={e.id} className="border-b border-canvas-border last:border-0 hover:bg-canvas-raised/40">
                      <td className="px-3 py-2">
                        <Link href={`/runs/${e.id}`} className="text-ink hover:text-accent">{e.workflowName}</Link>
                      </td>
                      <td className={clsx("px-3 py-2 font-medium", STATUS_COLOR[e.status] ?? "text-ink-muted")}>{e.status}</td>
                      <td className="px-3 py-2 text-ink-muted">{e.startedAt ? new Date(e.startedAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "running";
}) {
  return (
    <div className="panel p-4">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p
        className={
          "mt-1 font-display text-2xl font-medium " +
          (accent === "success" ? "text-state-success" : accent === "running" ? "text-state-running" : "text-ink")
        }
      >
        {value}
      </p>
    </div>
  );
}
