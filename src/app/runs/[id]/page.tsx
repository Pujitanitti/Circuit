import { prisma } from "@/lib/prisma";
import { ExecutionDebugger } from "@/components/runs/ExecutionDebugger";
import { notFound } from "next/navigation";
import { DEFAULT_MAX_ATTEMPTS } from "@/server/engine/retry";

export default async function ExecutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const execution = await prisma.execution.findUnique({
    where: { id },
    include: {
      workflow: true,
      workflowVersion: { include: { nodes: true, edges: true } },
      nodeExecutions: { include: { node: true }, orderBy: { startedAt: "asc" } },
      logs: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!execution) notFound();

  return (
    <ExecutionDebugger
      executionId={execution.id}
      workflowName={execution.workflow.name}
      initialStatus={execution.status}
      nodes={execution.workflowVersion.nodes.map((n) => ({
        key: n.key, type: n.type, label: n.label, config: n.config as object, positionX: n.positionX, positionY: n.positionY,
      }))}
      edges={execution.workflowVersion.edges.map((e) => ({
        sourceKey: e.sourceKey, targetKey: e.targetKey, sourceHandle: e.sourceHandle,
      }))}
      initialNodeExecutions={execution.nodeExecutions.map((ne) => ({
        nodeKey: ne.node.key, status: ne.status, attempt: ne.attempt, maxAttempts: DEFAULT_MAX_ATTEMPTS,
        input: ne.input, output: ne.output, error: ne.error,
        startedAt: ne.startedAt?.toISOString() ?? null, completedAt: ne.completedAt?.toISOString() ?? null,
      }))}
      initialLogs={execution.logs.map((l) => ({
        level: l.level, message: l.message, nodeKey: l.nodeKey, timestamp: l.timestamp.toISOString(),
      }))}
      startedAt={execution.startedAt?.toISOString() ?? null}
      completedAt={execution.completedAt?.toISOString() ?? null}
    />
  );
}
