import { prisma } from "@/lib/prisma";

// All numbers are real Prisma aggregates against the current workspace —
// no hardcoded metrics. See README.md#dashboard and #48 critical rules.
export async function getDashboardMetrics(workspaceId?: string) {
  const workflowWhere = workspaceId ? { workspaceId } : {};

  const [workflowCount, activeRuns, totalRuns, successfulRuns, durations] = await Promise.all([
    prisma.workflow.count({ where: workflowWhere }),
    prisma.execution.count({ where: { status: { in: ["RUNNING", "WAITING_APPROVAL"] } } }),
    prisma.execution.count({ where: { status: { in: ["SUCCESS", "FAILED"] } } }),
    prisma.execution.count({ where: { status: "SUCCESS" } }),
    prisma.execution.findMany({
      where: { status: "SUCCESS", startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      take: 200,
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const avgMs =
    durations.length > 0
      ? durations.reduce((sum, e) => sum + (e.completedAt!.getTime() - e.startedAt!.getTime()), 0) / durations.length
      : 0;

  return {
    workflowCount,
    activeRuns,
    successRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0,
    avgDurationLabel: avgMs > 0 ? `${(avgMs / 1000).toFixed(1)}s` : "—",
  };
}

/** Real rows for the dashboard's recent-executions table — no fabricated fields. */
export async function getRecentExecutions(limit = 8) {
  const executions = await prisma.execution.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { workflow: { select: { name: true } } },
  });

  return executions.map((e) => ({
    id: e.id,
    workflowName: e.workflow.name,
    status: e.status,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
  }));
}
