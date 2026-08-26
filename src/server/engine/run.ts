import { prisma } from "@/lib/prisma";
import { findExecutableNodes, findSkippedNodes, type Graph } from "./graph";
import { executorRegistry } from "./executors";
import { backoffDelayMs, DEFAULT_MAX_ATTEMPTS, MAX_EXECUTION_DURATION_MS } from "./retry";
import type { WorkflowState, ExecutionContext } from "./types";
import type { NodeType } from "@prisma/client";

type CompletedEntry = { status: "success" | "skipped" | "failed"; handle?: string };

/**
 * Starts a new execution of a workflow's active version. Validation already
 * ran at save time (see api/workflows/[id]/versions), but the engine
 * re-derives its own graph from persisted WorkflowNode/WorkflowEdge rows
 * rather than trusting client state — see #48 rule 1 (don't depend on
 * frontend state).
 */
export async function startExecution(workflowId: string, triggerInput: Record<string, unknown>, triggeredById?: string) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow?.activeVersionId) throw new Error("Workflow has no saved version to execute.");

  const execution = await prisma.execution.create({
    data: {
      workflowId,
      workflowVersionId: workflow.activeVersionId,
      status: "PENDING",
      triggeredById,
      state: { trigger: triggerInput, nodes: {}, variables: {} } as object,
    },
  });

  await runExecution(execution.id);
  return execution.id;
}

/**
 * Advances an execution as far as it can go: runs newly-executable nodes
 * until the workflow completes, fails, gets cancelled, or hits a WAITING
 * node (Approval/Delay) — at which point it persists and returns, to be
 * resumed later by approve/reject or a delay-expiry check. This makes the
 * function safely re-callable, which is what resumption relies on.
 */
export async function runExecution(executionId: string): Promise<void> {
  const execution = await prisma.execution.findUniqueOrThrow({
    where: { id: executionId },
    include: { workflowVersion: { include: { nodes: true, edges: true } } },
  });

  if (execution.status === "SUCCESS" || execution.status === "FAILED" || execution.status === "CANCELLED") return;

  const startedAt = execution.startedAt ?? new Date();
  if (!execution.startedAt) {
    await prisma.execution.update({ where: { id: executionId }, data: { status: "RUNNING", startedAt } });
  }

  const { nodes: dbNodes, edges: dbEdges } = execution.workflowVersion;
  const graph: Graph = {
    nodes: dbNodes.map((n) => ({ key: n.key, type: n.type })),
    edges: dbEdges.map((e) => ({ sourceKey: e.sourceKey, targetKey: e.targetKey, sourceHandle: e.sourceHandle })),
  };
  const nodeByKey = new Map(dbNodes.map((n) => [n.key, n]));

  let state = execution.state as unknown as WorkflowState;
  const priorNodeExecutions = await prisma.nodeExecution.findMany({ where: { executionId }, include: { node: true } });
  const completed = new Map<string, CompletedEntry>(
    priorNodeExecutions
      .filter((ne) => ["SUCCESS", "SKIPPED", "FAILED"].includes(ne.status))
      .map((ne) => [
        ne.node.key,
        {
          status: ne.status.toLowerCase() as CompletedEntry["status"],
          handle: (ne.output as { handle?: string } | null)?.handle,
        },
      ])
  );

  const logImpl = async (level: "info" | "warn" | "error", message: string, nodeKey?: string, metadata?: object) => {
    await prisma.executionLog.create({
      data: { executionId, nodeKey, level: level.toUpperCase() as "INFO" | "WARN" | "ERROR", message, metadata },
    });
  };

  // Seed root nodes (the trigger — findExecutableNodes never returns roots,
  // since they have no incoming edges to satisfy) by actually running them
  // through the normal executor path, not by fabricating a completed
  // entry directly. Fabricating it would mean the Trigger node never gets
  // a NodeExecution row and silently shows as never-run in the debugger —
  // this was a real bug caught by run.integration.test.ts, not a
  // hypothetical one.
  const roots = graph.nodes.filter((n) => !graph.edges.some((e) => e.targetKey === n.key));
  for (const root of roots) {
    if (completed.has(root.key)) continue;
    const dbNode = nodeByKey.get(root.key)!;
    const result = await runNodeWithRetry(dbNode, executionId, state, logImpl);
    if (result.status === "success") {
      completed.set(root.key, { status: "success", handle: (result.output as { handle?: string } | null)?.handle });
      state = { ...state, nodes: { ...state.nodes, [root.key]: { output: result.output } } };
    } else {
      completed.set(root.key, { status: "failed" });
      await prisma.execution.update({ where: { id: executionId }, data: { state: state as object } });
      await fail(executionId, `Root node "${dbNode.label}" failed: ${result.status === "failed" ? result.error : "did not complete"}`);
      return;
    }
  }

  const log = logImpl;

  while (true) {
    if (Date.now() - startedAt.getTime() > MAX_EXECUTION_DURATION_MS) {
      await fail(executionId, "Execution exceeded maximum duration.");
      return;
    }

    const fresh = await prisma.execution.findUniqueOrThrow({ where: { id: executionId }, select: { cancelRequested: true } });
    if (fresh.cancelRequested) {
      await prisma.execution.update({ where: { id: executionId }, data: { status: "CANCELLED", completedAt: new Date() } });
      await log("warn", "Execution cancelled by user.");
      return;
    }

    // Mark losing-branch nodes SKIPPED *before* computing what's executable
    // this iteration — otherwise a node on a Condition's untaken branch
    // never enters `completed` and the loop stalls forever, and anything
    // downstream of that skip (e.g. a merge node fed by both branches)
    // wouldn't see it as settled until an extra iteration later.
    for (const node of findSkippedNodes(graph, completed)) {
      const dbNode = nodeByKey.get(node.key)!;
      await prisma.nodeExecution.create({
        data: { executionId, nodeId: dbNode.id, attempt: 1, status: "SKIPPED", startedAt: new Date(), completedAt: new Date() },
      });
      completed.set(node.key, { status: "skipped" });
      await log("info", "Node skipped (unreached branch).", node.key);
    }

    const executable = findExecutableNodes(graph, completed).filter((n) => !completed.has(n.key));

    if (executable.length === 0) {
      const stillWaiting = priorNodeExecutions.some((ne) => ne.status === "WAITING");
      const nonBodyNodes = graph.nodes.filter((n) => !graph.edges.some((e) => e.sourceHandle === "loop" && e.targetKey === n.key));
      const allSettled = nonBodyNodes.every((n) => completed.has(n.key));

      if (allSettled) {
        await prisma.execution.update({
          where: { id: executionId },
          data: { status: "SUCCESS", completedAt: new Date(), state: state as object },
        });
        await log("info", "Execution completed successfully.");
      } else if (!stillWaiting) {
        // No executable nodes, not everything settled, nothing pending approval —
        // this shouldn't happen for a graph that passed validateGraph, but fail
        // loudly rather than spin forever.
        await fail(executionId, "Execution stalled: no executable nodes but workflow is incomplete.");
      }
      return; // WAITING case: persisted state is enough; resumed by approve/reject.
    }

    for (const node of executable) {
      const dbNode = nodeByKey.get(node.key)!;
      const result = await runNodeWithRetry(dbNode, executionId, state, log);

      if (result.status === "success") {
        completed.set(node.key, { status: "success", handle: (result.output as { handle?: string } | null)?.handle });
        state = { ...state, nodes: { ...state.nodes, [node.key]: { output: result.output } } };
      } else if (result.status === "skipped") {
        completed.set(node.key, { status: "skipped" });
      } else if (result.status === "waiting") {
        await prisma.execution.update({ where: { id: executionId }, data: { status: "WAITING_APPROVAL", state: state as object } });
        return;
      } else {
        completed.set(node.key, { status: "failed" });
        await prisma.execution.update({ where: { id: executionId }, data: { state: state as object } });
        await fail(executionId, `Node "${dbNode.label}" failed: ${result.error}`);
        return;
      }
    }

    await prisma.execution.update({ where: { id: executionId }, data: { state: state as object } });
  }
}

async function fail(executionId: string, message: string) {
  await prisma.execution.update({ where: { id: executionId }, data: { status: "FAILED", completedAt: new Date() } });
  await prisma.executionLog.create({ data: { executionId, level: "ERROR", message } });
}

async function runNodeWithRetry(
  dbNode: { id: string; key: string; type: NodeType; config: unknown },
  executionId: string,
  state: WorkflowState,
  log: (level: "info" | "warn" | "error", message: string, nodeKey?: string, metadata?: object) => Promise<void>
) {
  const executor = executorRegistry[dbNode.type]!; // safe: executorRegistry is a Record covering every NodeType exhaustively
  const ctx: ExecutionContext = {
    executionId,
    workflowVersionId: "", // not needed by any current executor; kept for interface completeness
    state,
    log: (level, message, metadata) => log(level, message, dbNode.key, metadata),
    isCancelled: async () => {
      const fresh = await prisma.execution.findUniqueOrThrow({ where: { id: executionId }, select: { cancelRequested: true } });
      return fresh.cancelRequested;
    },
  };

  let attempt = 1;
  const maxAttempts = DEFAULT_MAX_ATTEMPTS;

  while (true) {
    const nodeExecution = await prisma.nodeExecution.create({
      data: { executionId, nodeId: dbNode.id, attempt, status: "RUNNING", startedAt: new Date(), input: state as object },
    });

    try {
      const result = await executor.execute(dbNode.config, ctx);

      if (result.status === "success") {
        await prisma.nodeExecution.update({
          where: { id: nodeExecution.id },
          data: { status: "SUCCESS", output: result.output as object, completedAt: new Date() },
        });
        return result;
      }

      if (result.status === "waiting") {
        await prisma.nodeExecution.update({ where: { id: nodeExecution.id }, data: { status: "WAITING" } });
        return result;
      }

      if (result.status === "skipped") {
        await prisma.nodeExecution.update({
          where: { id: nodeExecution.id },
          data: { status: "SKIPPED", completedAt: new Date() },
        });
        return result;
      }

      // failed
      if (result.retryable && attempt < maxAttempts) {
        const delay = backoffDelayMs(attempt, 1000);
        await prisma.nodeExecution.update({
          where: { id: nodeExecution.id },
          data: { status: "RETRYING", error: result.error, completedAt: new Date() },
        });
        await log("warn", `Retrying (${attempt}/${maxAttempts}) after ${delay}ms: ${result.error}`, dbNode.key);
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
        continue;
      }

      await prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: { status: "FAILED", error: result.error, completedAt: new Date() },
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: { status: "FAILED", error: message, completedAt: new Date() },
      });
      return { status: "failed" as const, error: message, retryable: false };
    }
  }
}
