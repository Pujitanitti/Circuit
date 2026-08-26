import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Sets the flag the engine loop checks between every node (see
// engine/run.ts). Honest limitation for this phase: execution currently
// runs synchronously within the request that started it (no queue/worker
// yet — see README.md#future-scale-architecture), so cancellation only
// takes effect if this request lands while that run is still in progress
// between node steps.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const execution = await prisma.execution.findUnique({ where: { id } });
  if (!execution) return NextResponse.json({ error: "Execution not found" }, { status: 404 });

  if (["SUCCESS", "FAILED", "CANCELLED"].includes(execution.status)) {
    return NextResponse.json({ error: `Execution already ${execution.status.toLowerCase()}` }, { status: 409 });
  }

  await prisma.execution.update({ where: { id }, data: { cancelRequested: true } });
  return NextResponse.json({ ok: true });
}
