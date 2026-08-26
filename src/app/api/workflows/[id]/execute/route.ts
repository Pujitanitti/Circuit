import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startExecution } from "@/server/engine/run";
import { authorizeWorkspaceAccess } from "@/server/auth/authorize";
import { RateLimiter } from "@/server/security/rateLimit";

// Executions can trigger real, billable LLM calls — worth its own limiter
// separate from generic API rate limiting. See README.md#rate-limiting.
const executeLimiter = new RateLimiter(20, 60_000);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId }, select: { workspaceId: true } });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const authz = await authorizeWorkspaceAccess(workflow.workspaceId);
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  if (!executeLimiter.check(authz.userId)) {
    return NextResponse.json({ error: "Too many executions started. Try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const executionId = await startExecution(workflowId, body.trigger ?? {}, authz.userId);
    return NextResponse.json({ executionId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start execution";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
