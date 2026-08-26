import { prisma } from "@/lib/prisma";
import { RunsTable } from "@/components/runs/RunsTable";

export default async function RunsPage() {
  const executions = await prisma.execution.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { workflow: true, nodeExecutions: true, triggeredBy: true },
  });

  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Runs</h1>
      <p className="mt-1 text-[13px] text-ink-muted">{executions.length} recent executions</p>

      <RunsTable
        runs={executions.map((e) => ({
          id: e.id,
          workflowName: e.workflow.name,
          status: e.status,
          startedAt: e.startedAt?.toISOString() ?? null,
          completedAt: e.completedAt?.toISOString() ?? null,
          triggeredBy: e.triggeredBy?.name ?? null,
          nodeCount: e.nodeExecutions.length,
          errorCount: e.nodeExecutions.filter((ne) => ne.status === "FAILED").length,
        }))}
      />
    </div>
  );
}
