import { describe, it, expect, vi } from "vitest";
import { createToolExecutor } from "./tool";
import type { WorkflowState, ExecutionContext } from "../types";
import type { ToolConfig } from "@/components/workflow/types";

function ctxWithState(state: WorkflowState): ExecutionContext {
  return { executionId: "e1", workflowVersionId: "v1", state, log: async () => {}, isCancelled: async () => false };
}

const baseConfig: ToolConfig = {
  method: "GET",
  url: "https://api.example.com/issues/{{trigger.id}}",
  headers: { Authorization: "Bearer {{trigger.token}}" },
  timeoutMs: 5000,
  retry: { maxAttempts: 3, backoffMs: 1000 },
};

const state: WorkflowState = { trigger: { id: "42", token: "secret" }, nodes: {}, variables: {} };

describe("toolExecutor", () => {
  it("interpolates the URL and headers, and returns parsed JSON on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ title: "Bug" }),
    });
    const executor = createToolExecutor(fetchMock as unknown as typeof fetch);

    const result = await executor.execute(baseConfig, ctxWithState(state));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/issues/42",
      expect.objectContaining({ headers: { Authorization: "Bearer secret" } })
    );
    expect(result).toEqual({ status: "success", output: { status: 200, body: { title: "Bug" } } });
  });

  it("marks 5xx responses retryable and 4xx not retryable", async () => {
    const executor500 = createToolExecutor(
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "" }) as unknown as typeof fetch
    );
    const result500 = await executor500.execute(baseConfig, ctxWithState(state));
    expect(result500).toMatchObject({ status: "failed", retryable: true });

    const executor400 = createToolExecutor(
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }) as unknown as typeof fetch
    );
    const result400 = await executor400.execute(baseConfig, ctxWithState(state));
    expect(result400).toMatchObject({ status: "failed", retryable: false });
  });

  it("blocks requests to a private IP literal before ever calling fetch", async () => {
    const fetchMock = vi.fn();
    const executor = createToolExecutor(fetchMock as unknown as typeof fetch);

    const result = await executor.execute({ ...baseConfig, url: "http://127.0.0.1/admin" }, ctxWithState(state));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "failed", retryable: false });
  });

  it("blocks the cloud metadata IP literal", async () => {
    const fetchMock = vi.fn();
    const executor = createToolExecutor(fetchMock as unknown as typeof fetch);

    const result = await executor.execute({ ...baseConfig, url: "http://169.254.169.254/latest/meta-data" }, ctxWithState(state));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "failed" });
  });
});
