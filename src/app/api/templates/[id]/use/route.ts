import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { instantiateTemplate } from "@/server/services/templateInstances";
import { authorizeWorkspaceAccess } from "@/server/auth/authorize";

const bodySchema = z.object({ workspaceId: z.string(), name: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { workspaceId, name } = parsed.data;

  const authz = await authorizeWorkspaceAccess(workspaceId);
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  try {
    const result = await instantiateTemplate(templateId, workspaceId, name);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to use template" }, { status: 400 });
  }
}
