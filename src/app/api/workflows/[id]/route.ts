import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeWorkspaceAccess } from "@/server/auth/authorize";

const bodySchema = z.object({ name: z.string().min(1).max(200) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const authz = await authorizeWorkspaceAccess(workflow.workspaceId);
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const updated = await prisma.workflow.update({ where: { id }, data: { name: parsed.data.name } });
  return NextResponse.json({ name: updated.name });
}
