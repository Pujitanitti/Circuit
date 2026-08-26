import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceAccess } from "@/server/auth/authorize";
import { createCredential, listCredentials } from "@/server/services/credentials";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  const authz = await authorizeWorkspaceAccess(workspaceId);
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  return NextResponse.json(await listCredentials(workspaceId));
}

const createSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1),
  provider: z.string().min(1),
  value: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

  const { workspaceId, name, provider, value } = parsed.data;
  const authz = await authorizeWorkspaceAccess(workspaceId, "ADMIN"); // credential creation requires elevated role
  if (!authz.ok) return NextResponse.json({ error: authz.message }, { status: authz.status });

  const credential = await createCredential(workspaceId, name, provider, value);
  return NextResponse.json(credential, { status: 201 }); // note: `value` never appears in this response
}
