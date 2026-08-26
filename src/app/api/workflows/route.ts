import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeWorkspaceAccess } from "@/server/auth/authorize";

const bodySchema = z.object({ workspaceId: z.string(), name: z.string().min(1).default("Untitled workflow") });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { workspaceId, name } = parsed.data;

  const authz = await authorizeWorkspaceAccess(workspaceId);
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  const workflow = await prisma.workflow.create({ data: { workspaceId, name } });
  return NextResponse.json({ id: workflow.id }, { status: 201 });
}
