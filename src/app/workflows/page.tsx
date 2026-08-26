import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WorkflowLibrary } from "@/components/workflows/WorkflowLibrary";
import { WorkflowIllustration } from "@/components/ui/WorkflowIllustration";

export default async function WorkflowsPage() {
  const workflows = await prisma.workflow.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { executions: true } },
      executions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });

  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Workflows</h1>
      <p className="mt-1 text-[13px] text-ink-muted">{workflows.length} workflows</p>

      {workflows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-panel border border-dashed border-canvas-border py-16 text-center">
          <WorkflowIllustration />
          <p className="mt-2 text-[14px] text-ink">No workflows yet</p>
          <p className="max-w-sm text-[13px] text-ink-muted">
            Build your first intelligent workflow and watch Circuit execute it step by step — trigger, agent, and branch, all real.
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
        <WorkflowLibrary
          workflows={workflows.map((w) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            updatedAt: w.updatedAt.toISOString(),
            executionCount: w._count.executions,
            lastExecutionStatus: w.executions[0]?.status ?? null,
          }))}
        />
      )}
    </div>
  );
}
