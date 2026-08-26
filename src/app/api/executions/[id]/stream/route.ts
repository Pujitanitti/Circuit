import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const POLL_INTERVAL_MS = 800;
const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED"]);

/**
 * Streams execution + node-execution state as Server-Sent Events. This is
 * poll-and-diff against Postgres, not a real pub/sub — see
 * README.md#real-time-execution for why that's an honest, documented
 * choice for this phase rather than standing up Postgres LISTEN/NOTIFY or
 * a broker. It stops polling once the execution reaches a terminal status,
 * so a finished run doesn't hold a connection open forever.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const tick = async () => {
        if (closed) return;
        const execution = await prisma.execution.findUnique({
          where: { id },
          include: { nodeExecutions: { include: { node: true } }, logs: { orderBy: { timestamp: "desc" }, take: 20 } },
        });

        if (!execution) {
          send("error", { message: "Execution not found" });
          if (!closed) { closed = true; controller.close(); }
          return;
        }

        send("snapshot", {
          status: execution.status,
          nodeStatuses: Object.fromEntries(execution.nodeExecutions.map((ne) => [ne.node.key, ne.status])),
          recentLogs: execution.logs.map((l) => ({ level: l.level, message: l.message, nodeKey: l.nodeKey, timestamp: l.timestamp })),
        });

        if (TERMINAL_STATUSES.has(execution.status)) {
          if (!closed) { closed = true; controller.close(); }
          return;
        }

        setTimeout(tick, POLL_INTERVAL_MS);
      };

      await tick();
    },
    cancel() {
      closed = true; // stops the next scheduled tick() from doing any work
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
