import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A real integration test (create → execute → branch → complete against
 * actual Postgres) needs a running database, which this sandbox has no
 * network access to (see network_configuration — only npm/GitHub domains
 * are reachable). Rather than skip engine orchestration testing entirely,
 * this hand-rolled in-memory fake implements exactly the Prisma calls
 * `run.ts` makes, so the traversal/retry/state logic in `runExecution`
 * itself gets exercised end-to-end. It is not a substitute for the real
 * Postgres integration test in PLAN.md's Phase 8 checklist — that item
 * stays unchecked — but it's real coverage of the orchestration code, not
 * nothing.
 */

type Row = Record<string, unknown>;

function makeFakeDb() {
  const workflows = new Map<string, Row>();
  const workflowVersions = new Map<string, Row>();
  const workflowNodes: Row[] = [];
  const workflowEdges: Row[] = [];
  const executions = new Map<string, Row>();
  const nodeExecutions = new Map<string, Row>();
  const executionLogs: Row[] = [];
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

  const prisma = {
    workflow: {
      findUnique: async ({ where }: { where: { id: string } }) => workflows.get(where.id) ?? null,
    },
    execution: {
      create: async ({ data }: { data: Row }) => {
        const id = nextId("exec");
        const row = { id, cancelRequested: false, startedAt: null, completedAt: null, ...data };
        executions.set(id, row);
        return row;
      },
      findUniqueOrThrow: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
        const row = executions.get(where.id);
        if (!row) throw new Error("Execution not found");
        if (select) {
          const projected: Row = {};
          for (const key of Object.keys(select)) projected[key] = row[key];
          return projected;
        }
        const workflowVersionId = row.workflowVersionId as string;
        return {
          ...row,
          workflowVersion: {
            ...workflowVersions.get(workflowVersionId),
            nodes: workflowNodes.filter((n) => n.workflowVersionId === workflowVersionId),
            edges: workflowEdges.filter((e) => e.workflowVersionId === workflowVersionId),
          },
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = executions.get(where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    nodeExecution: {
      create: async ({ data }: { data: Row }) => {
        const id = nextId("ne");
        const row = { id, ...data };
        nodeExecutions.set(id, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = nodeExecutions.get(where.id)!;
        Object.assign(row, data);
        return row;
      },
      findMany: async ({ where }: { where: { executionId: string } }) => {
        const rows = [...nodeExecutions.values()].filter((r) => r.executionId === where.executionId);
        return rows.map((r) => ({ ...r, node: workflowNodes.find((n) => n.id === r.nodeId) }));
      },
    },
    executionLog: {
      create: async ({ data }: { data: Row }) => {
        executionLogs.push(data);
        return data;
      },
    },
  };

  function seedWorkflow(nodes: { key: string; type: string; label: string; config: object }[], edges: { sourceKey: string; targetKey: string; sourceHandle?: string }[]) {
    const workflowId = nextId("wf");
    const workflowVersionId = nextId("wfv");
    workflows.set(workflowId, { id: workflowId, activeVersionId: workflowVersionId });
    workflowVersions.set(workflowVersionId, { id: workflowVersionId, workflowId });
    for (const n of nodes) {
      workflowNodes.push({ id: nextId("node"), workflowVersionId, positionX: 0, positionY: 0, ...n });
    }
    for (const e of edges) {
      workflowEdges.push({ id: nextId("edge"), workflowVersionId, sourceHandle: null, ...e });
    }
    return { workflowId, workflowVersionId };
  }

  return { prisma, seedWorkflow, executions, nodeExecutions, executionLogs };
}

const db = makeFakeDb();

vi.mock("@/lib/prisma", () => ({ get prisma() { return db.prisma; } }));

describe("runExecution (in-memory Prisma fake)", () => {
  beforeEach(() => {
    db.executions.clear();
    db.nodeExecutions.clear();
    db.executionLogs.length = 0;
  });

  it("runs a linear trigger -> output workflow to SUCCESS", async () => {
    const { startExecution } = await import("./run");
    const { workflowId } = db.seedWorkflow(
      [
        { key: "trigger", type: "TRIGGER", label: "Trigger", config: { kind: "manual" } },
        { key: "output", type: "OUTPUT", label: "Output", config: { resultExpression: "{{trigger.value}}" } },
      ],
      [{ sourceKey: "trigger", targetKey: "output" }]
    );

    const executionId = await startExecution(workflowId, { value: 42 });
    const execution = db.executions.get(executionId)!;

    expect(execution.status).toBe("SUCCESS");
    expect((execution.state as { nodes: Record<string, { output: unknown }> }).nodes.output!.output).toBe(42);
  });

  it("branches through a Condition node and skips the losing branch", async () => {
    const { startExecution } = await import("./run");
    const { workflowId } = db.seedWorkflow(
      [
        { key: "trigger", type: "TRIGGER", label: "Trigger", config: { kind: "manual" } },
        { key: "cond", type: "CONDITION", label: "Check", config: { left: "{{trigger.priority}}", operator: "==", right: "high" } },
        { key: "urgent", type: "OUTPUT", label: "Urgent path", config: { resultExpression: "urgent" } },
        { key: "normal", type: "OUTPUT", label: "Normal path", config: { resultExpression: "normal" } },
      ],
      [
        { sourceKey: "trigger", targetKey: "cond" },
        { sourceKey: "cond", targetKey: "urgent", sourceHandle: "true" },
        { sourceKey: "cond", targetKey: "normal", sourceHandle: "false" },
      ]
    );

    const executionId = await startExecution(workflowId, { priority: "high" });
    const nodeExecs = [...db.nodeExecutions.values()].filter((ne) => ne.executionId === executionId);
    const execution = db.executions.get(executionId)!;

    expect(execution.status).toBe("SUCCESS");
    // trigger, cond, and exactly one branch (urgent) should have run —
    // normal is never traversed because its incoming edge requires
    // handle "false" and cond resolved to "true".
    expect(nodeExecs.filter((ne) => ne.status === "SUCCESS").length).toBe(3);
  });

  it("marks the execution FAILED when a node fails non-retryably", async () => {
    const { startExecution } = await import("./run");
    const { workflowId } = db.seedWorkflow(
      [
        { key: "trigger", type: "TRIGGER", label: "Trigger", config: { kind: "manual" } },
        { key: "tool", type: "TOOL", label: "Call API", config: { method: "GET", url: "http://127.0.0.1/blocked", headers: {}, timeoutMs: 1000, retry: { maxAttempts: 3, backoffMs: 10 } } },
      ],
      [{ sourceKey: "trigger", targetKey: "tool" }]
    );

    const executionId = await startExecution(workflowId, {});
    const execution = db.executions.get(executionId)!;

    expect(execution.status).toBe("FAILED");
  });
});
