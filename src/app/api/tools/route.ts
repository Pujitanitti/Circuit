import { NextRequest, NextResponse } from "next/server";
import { listTools } from "@/server/services/tools";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  const tools = await listTools(workspaceId);
  return NextResponse.json(tools);
}
