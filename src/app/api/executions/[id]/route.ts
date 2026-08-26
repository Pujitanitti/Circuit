import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const execution = await prisma.execution.findUnique({
    where: { id },
    include: {
      nodeExecutions: { include: { node: true }, orderBy: { startedAt: "asc" } },
      logs: { orderBy: { timestamp: "asc" } },
    },
  });
  if (!execution) return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  return NextResponse.json(execution);
}
