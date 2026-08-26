import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const templates = await prisma.template.findMany({
    where: workspaceId ? { OR: [{ workspaceId: null }, { workspaceId }] } : { workspaceId: null },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}
