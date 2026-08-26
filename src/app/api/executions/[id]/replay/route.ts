import { NextRequest, NextResponse } from "next/server";
import { replayExecution } from "@/server/services/replay";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mode: "full" | "from-failed" = body.mode === "from-failed" ? "from-failed" : "full";

  try {
    const newExecutionId = await replayExecution(id, mode);
    return NextResponse.json({ executionId: newExecutionId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Replay failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
