import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateGraph } from "@/components/workflow/validateGraph";
import type { CircuitNodeData } from "@/components/workflow/types";
import { authorizeWorkspaceAccess } from "@/server/auth/authorize";

const bodySchema = z.object({
  nodes: z.array(z.object({
    key: z.string(),
    type: z.enum(["TRIGGER", "AGENT", "TOOL", "CONDITION", "TRANSFORM", "LOOP", "DELAY", "APPROVAL", "OUTPUT"]),
    label: z.string(),
    config: z.record(z.unknown()),
    position: z.object({ x: z.number(), y: z.number() }),
  })),
  edges: z.array(z.object({
    sourceKey: z.string(),
    targetKey: z.string(),
    sourceHandle: z.string().nullable().optional(),
  })),
});

// Server is the source of truth for validation — the canvas re-runs the
// same pure `validateGraph` client-side for instant feedback, but nothing
// persists without passing it here too. See README §21 / #48 rule 8.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const authz = await authorizeWorkspaceAccess(workflow.workspaceId);
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { nodes, edges } = parsed.data;

  const issues = validateGraph(
    nodes.map((n) => ({
      key: n.key,
      type: n.type,
      data: { key: n.key, type: n.type, label: n.label, config: n.config as CircuitNodeData["config"], status: "idle" },
    })),
    edges
  );
  if (issues.length > 0) {
    return NextResponse.json({ error: "Workflow validation failed", issues }, { status: 422 });
  }

  const latest = await prisma.workflowVersion.findFirst({
    where: { workflowId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowVersion.create({
      data: {
        workflowId,
        version: nextVersion,
        graph: { nodes, edges },
        nodes: {
          create: nodes.map((n) => ({
            key: n.key, type: n.type, label: n.label, config: n.config,
            positionX: n.position.x, positionY: n.position.y,
          })),
        },
        edges: {
          create: edges.map((e) => ({ sourceKey: e.sourceKey, targetKey: e.targetKey, sourceHandle: e.sourceHandle })),
        },
      },
    });
    await tx.workflow.update({ where: { id: workflowId }, data: { activeVersionId: created.id } });
    return created;
  });

  return NextResponse.json({ id: version.id, version: version.version }, { status: 201 });
}
