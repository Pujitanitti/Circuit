// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useExecutionStream, type ExecutionSnapshot } from "./useExecutionStream";

/**
 * jsdom has no native EventSource. This fake tracks listeners and whether
 * close() was called, and — like a real EventSource — silently ignores
 * dispatched events once closed, so tests can assert "no more updates
 * after close" the same way they'd assert it against the real API.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
  emit(type: string, data?: unknown) {
    if (this.closed) return; // real EventSource never fires after close()
    for (const handler of this.listeners[type] ?? []) {
      handler({ data: data !== undefined ? JSON.stringify(data) : undefined } as MessageEvent);
    }
  }
}

function TestHarness({ executionId }: { executionId: string | null }) {
  const { snapshot, connectionLost } = useExecutionStream(executionId);
  return (
    <div>
      <span data-testid="status">{snapshot?.status ?? "none"}</span>
      <span data-testid="connection-lost">{String(connectionLost)}</span>
    </div>
  );
}

const baseSnapshot: Omit<ExecutionSnapshot, "status"> = { nodeStatuses: {}, recentLogs: [] };

describe("useExecutionStream SSE lifecycle", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clean terminal completion (RUNNING -> SUCCESS) closes the connection without flagging connection-lost", async () => {
    const { getByTestId } = render(<TestHarness executionId="exec_1" />);
    const source = FakeEventSource.instances[0]!;

    source.emit("snapshot", { ...baseSnapshot, status: "SUCCESS" });

    await waitFor(() => expect(getByTestId("status")).toHaveTextContent("SUCCESS"));
    expect(source.closed).toBe(true);
    expect(getByTestId("connection-lost")).toHaveTextContent("false");
  });

  it("terminal failure (RUNNING -> FAILED) also closes cleanly without a false connection-lost flag", async () => {
    const { getByTestId } = render(<TestHarness executionId="exec_1" />);
    const source = FakeEventSource.instances[0]!;

    source.emit("snapshot", { ...baseSnapshot, status: "FAILED" });

    await waitFor(() => expect(getByTestId("status")).toHaveTextContent("FAILED"));
    expect(source.closed).toBe(true);
    expect(getByTestId("connection-lost")).toHaveTextContent("false");
  });

  it("a genuine connection failure (no terminal snapshot first) sets connection-lost and closes", async () => {
    const { getByTestId } = render(<TestHarness executionId="exec_1" />);
    const source = FakeEventSource.instances[0]!;

    source.emit("snapshot", { ...baseSnapshot, status: "RUNNING" });
    source.emit("error");

    await waitFor(() => expect(getByTestId("connection-lost")).toHaveTextContent("true"));
    expect(source.closed).toBe(true);
  });

  it("unmounting closes the connection (no leaked open EventSource)", () => {
    const { unmount } = render(<TestHarness executionId="exec_1" />);
    const source = FakeEventSource.instances[0]!;
    expect(source.closed).toBe(false);

    unmount();
    expect(source.closed).toBe(true);
  });

  it("does not react to events dispatched after unmount", async () => {
    const { unmount, getByTestId } = render(<TestHarness executionId="exec_1" />);
    const source = FakeEventSource.instances[0]!;
    unmount();

    // The fake mirrors real EventSource: emit() after close() is a no-op,
    // so this proves cleanup actually disconnects rather than merely
    // hoping React ignores a late state update.
    source.emit("snapshot", { ...baseSnapshot, status: "RUNNING" });
    void getByTestId; // component is unmounted; nothing to assert on screen
    expect(source.closed).toBe(true);
  });

  it("passing executionId=null never opens a connection", () => {
    render(<TestHarness executionId={null} />);
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
