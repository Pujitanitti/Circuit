import { prisma } from "@/lib/prisma";
import { runExecution } from "@/server/engine/run";
import { selectCarryOverNodes } from "@/server/engine/replay";
import type { WorkflowState } from "@/server/engine/types";

export async function replayExecution(sourceExecutionId: string, mode: "full" | "from-failed") {
  const source = await prisma.execution.findUniqueOrThrow({
    where: { id: sourceExecutionId },
    include: { nodeExecutions: { include: { node: true } } },
  });

  const priorTrigger = (source.state as unknown as WorkflowState | null)?.trigger ?? {};

  const newExecution = await prisma.execution.create({
    data: {
      workflowId: source.workflowId,
      workflowVersionId: source.workflowVersionId, // pinned to the exact graph that ran originally
      status: "PENDING",
      state: { trigger: priorTrigger, nodes: {}, variables: {} } as object,
    },
  });

  if (mode === "from-failed") {
    const carryOver = selectCarryOverNodes(
      source.nodeExecutions.map((ne) => ({ nodeKey: ne.node.key, status: ne.status, output: ne.output }))
    );

    if (carryOver.length > 0) {
      const nodeIdByKey = new Map(source.nodeExecutions.map((ne) => [ne.node.key, ne.nodeId]));
      const nodesState: WorkflowState["nodes"] = {};

      await prisma.$transaction(
        carryOver.map((ne) =>
          prisma.nodeExecution.create({
            data: {
              executionId: newExecution.id,
              nodeId: nodeIdByKey.get(ne.nodeKey)!,
              status: ne.status as "SUCCESS" | "SKIPPED",
              attempt: 1,
              output: ne.output as object,
              startedAt: new Date(),
              completedAt: new Date(),
            },
          })
        )
      );

      for (const ne of carryOver) nodesState[ne.nodeKey] = { output: ne.output };
      await prisma.execution.update({
        where: { id: newExecution.id },
        data: { state: { trigger: priorTrigger, nodes: nodesState, variables: {} } as object },
      });

      await prisma.executionLog.create({
        data: {
          executionId: newExecution.id,
          level: "INFO",
          message: `Replaying from failure — reused ${carryOver.length} prior successful node result(s).`,
        },
      });
    }
  }

  await runExecution(newExecution.id);
  return newExecution.id;
}
