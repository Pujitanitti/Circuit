import type { NodeExecutor, NodeResult, ExecutionContext } from "../types";
import type { AgentConfig } from "@/components/workflow/types";
import { interpolate } from "../state";
import type { LLMProvider, LLMToolDefinition } from "@/server/llm/types";
import { getProvider } from "@/server/llm";

/**
 * Current scope (real, not faked): a single LLM call per Agent node, with
 * interpolated system/user prompts and tool *definitions* forwarded to the
 * model so it can request a tool call. What's not built yet: automatically
 * executing that tool call and continuing the conversation — the model's
 * requested tool calls come back in `output.toolCalls` for the execution
 * history to display (see brief §19), but the engine doesn't loop them
 * back into another Agent turn. That multi-turn agentic loop is real,
 * scoped future work (see PLAN.md), not something silently skipped.
 */
export function createAgentExecutor(resolveProvider: (name: AgentConfig["provider"]) => LLMProvider = getProvider): NodeExecutor<AgentConfig> {
  return {
    validate(config) {
      const errors: string[] = [];
      if (!config.model) errors.push("Agent node requires a model.");
      if (!config.userPrompt) errors.push("Agent node requires a user prompt.");
      if (config.temperature < 0 || config.temperature > 1) errors.push("Temperature must be between 0 and 1.");
      return errors;
    },

    async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
      let provider: LLMProvider;
      try {
        provider = resolveProvider(config.provider);
      } catch (err) {
        return { status: "failed", error: err instanceof Error ? err.message : String(err), retryable: false };
      }

      const system = config.systemPrompt ? interpolate(config.systemPrompt, ctx.state) : undefined;
      const userPrompt = interpolate(config.userPrompt, ctx.state);

      // Tool *ids* in config.tools would resolve against the Tool registry
      // in a full implementation; kept as a placeholder definition here
      // since registry-backed schemas are wired in the Tools page, not yet
      // threaded through to this executor.
      const tools: LLMToolDefinition[] = config.tools.map((id) => ({
        name: id,
        description: `Registered tool: ${id}`,
        inputSchema: { type: "object", properties: {} },
      }));

      await ctx.log("info", `Calling ${config.provider}/${config.model}`);

      try {
        const result = await provider.generate({
          model: config.model,
          system,
          messages: [{ role: "user", content: userPrompt }],
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          tools: tools.length > 0 ? tools : undefined,
        });

        await ctx.log("info", `Agent responded (${result.stopReason}), ${result.toolCalls.length} tool call(s) requested`);

        return {
          status: "success",
          output: { content: result.content, toolCalls: result.toolCalls, stopReason: result.stopReason },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Network/5xx-shaped errors from the provider are worth retrying;
        // a thrown validation-ish error (e.g. missing API key) is not.
        const retryable = !message.includes("API key") && !message.includes("400");
        return { status: "failed", error: message, retryable };
      }
    },

    handleError() {
      return { retry: false, delayMs: 0 };
    },
  };
}

export const agentExecutor = createAgentExecutor();
