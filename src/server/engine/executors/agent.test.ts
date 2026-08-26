import { describe, it, expect, vi } from "vitest";
import { createAgentExecutor } from "./agent";
import type { WorkflowState, ExecutionContext } from "../types";
import type { AgentConfig } from "@/components/workflow/types";
import type { LLMProvider } from "@/server/llm/types";

function ctxWithState(state: WorkflowState): ExecutionContext {
  return { executionId: "e1", workflowVersionId: "v1", state, log: async () => {}, isCancelled: async () => false };
}

const state: WorkflowState = { trigger: { issue: "Login button does nothing on click" }, nodes: {}, variables: {} };

const baseConfig: AgentConfig = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  systemPrompt: "You triage GitHub issues.",
  userPrompt: "Classify this issue: {{trigger.issue}}",
  temperature: 0.3,
  maxTokens: 512,
  tools: [],
};

describe("agentExecutor", () => {
  it("interpolates the prompt before calling the provider", async () => {
    const generate = vi.fn().mockResolvedValue({ content: "bug", toolCalls: [], stopReason: "end_turn" });
    const fakeProvider: LLMProvider = { generate, stream: vi.fn() as unknown as LLMProvider["stream"], structuredOutput: vi.fn() };
    const executor = createAgentExecutor(() => fakeProvider);

    const result = await executor.execute(baseConfig, ctxWithState(state));

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Classify this issue: Login button does nothing on click" }],
      })
    );
    expect(result).toEqual({
      status: "success",
      output: { content: "bug", toolCalls: [], stopReason: "end_turn" },
    });
  });

  it("returns a non-retryable failure when the provider can't be resolved (e.g. missing API key)", async () => {
    const executor = createAgentExecutor(() => {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    });

    const result = await executor.execute(baseConfig, ctxWithState(state));
    expect(result).toEqual({ status: "failed", error: "ANTHROPIC_API_KEY is not set.", retryable: false });
  });

  it("surfaces requested tool calls without executing them", async () => {
    const generate = vi.fn().mockResolvedValue({
      content: "",
      toolCalls: [{ id: "call_1", name: "get_issue", input: { id: "42" } }],
      stopReason: "tool_use",
    });
    const fakeProvider: LLMProvider = { generate, stream: vi.fn() as unknown as LLMProvider["stream"], structuredOutput: vi.fn() };
    const executor = createAgentExecutor(() => fakeProvider);

    const result = await executor.execute(baseConfig, ctxWithState(state));
    expect(result).toMatchObject({
      status: "success",
      output: { toolCalls: [{ id: "call_1", name: "get_issue", input: { id: "42" } }] },
    });
  });

  it("flags a missing model during validate", () => {
    const executor = createAgentExecutor();
    expect(executor.validate({ ...baseConfig, model: "" })).toContain("Agent node requires a model.");
  });
});
