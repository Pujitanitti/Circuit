// Provider abstraction so the rest of Circuit (Agent executor, future
// structured-output callers) never imports an Anthropic/OpenAI/Google SDK
// directly. Adding a provider means implementing this interface once — see
// README.md#llm-integration.

export type LLMMessage = { role: "user" | "assistant"; content: string };

export type LLMToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON schema
};

export type LLMToolCall = { id: string; name: string; input: Record<string, unknown> };

export type GenerateOptions = {
  model: string;
  system?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: LLMToolDefinition[];
};

export type GenerateResult = {
  content: string;
  toolCalls: LLMToolCall[];
  stopReason: string;
};

export interface LLMProvider {
  generate(options: GenerateOptions): Promise<GenerateResult>;

  /**
   * Streaming isn't implemented yet — Phase 5 wires execution updates over
   * SSE, and that's the point streaming actually becomes useful here. This
   * throws rather than silently falling back to a fake single chunk.
   */
  stream(options: GenerateOptions): AsyncIterable<string>;

  /** Convenience wrapper: generate() + parse the response as JSON. */
  structuredOutput<T>(options: GenerateOptions): Promise<T>;
}
