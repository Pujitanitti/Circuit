import type { LLMProvider, GenerateOptions, GenerateResult } from "./types";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export class AnthropicProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: options.model,
        system: options.system,
        messages: options.messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 1024,
        tools: options.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as { content: AnthropicContentBlock[]; stop_reason: string };

    const textBlocks = data.content.filter((b): b is { type: "text"; text: string } => b.type === "text");
    const toolUseBlocks = data.content.filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use"
    );

    return {
      content: textBlocks.map((b) => b.text).join("\n"),
      toolCalls: toolUseBlocks.map((b) => ({ id: b.id, name: b.name, input: b.input })),
      stopReason: data.stop_reason,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *stream(_options: GenerateOptions): AsyncIterable<string> {
    throw new Error("Streaming is not implemented yet (planned for Phase 5, alongside SSE execution updates).");
  }

  async structuredOutput<T>(options: GenerateOptions): Promise<T> {
    const result = await this.generate(options);
    try {
      return JSON.parse(result.content) as T;
    } catch {
      throw new Error("Model response was not valid JSON. Consider tightening the prompt's output format instructions.");
    }
  }
}
