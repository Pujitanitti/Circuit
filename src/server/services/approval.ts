import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runExecution } from "@/server/engine/run";

/**
 * Approval always resolves as a normal, single-path SUCCESS node; a
 * downstream Condition node reading {{nodes.<approval>.output.decision}}
 * is how a workflow branches on approve vs. reject — reusing the existing
 * Condition mechanism instead of inventing a second branching system just
 * for this node type. See README.md#human-approval.
 */
export async function resolveApproval(executionId: string, decision: "approved" | "rejected") {
  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution) return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  if (execution.status !== "WAITING_APPROVAL") {
    return NextResponse.json({ error: "Execution is not waiting on an approval." }, { status: 409 });
  }

  const waiting = await prisma.nodeExecution.findFirst({
    where: { executionId, status: "WAITING" },
    orderBy: { startedAt: "desc" },
  });
  if (!waiting) return NextResponse.json({ error: "No pending approval found." }, { status: 409 });

  await prisma.nodeExecution.update({
    where: { id: waiting.id },
    data: { status: "SUCCESS", output: { decision }, completedAt: new Date() },
  });
  await prisma.execution.update({ where: { id: executionId }, data: { status: "RUNNING" } });
  await prisma.executionLog.create({ data: { executionId, level: "INFO", message: `Approval ${decision}` } });

  await runExecution(executionId);
  return NextResponse.json({ ok: true, decision });
}
