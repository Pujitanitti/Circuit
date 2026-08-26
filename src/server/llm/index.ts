import type { LLMProvider } from "./types";
import { AnthropicProvider } from "./anthropic";

export type ProviderName = "anthropic" | "openai" | "google";

/**
 * The only place that switches on provider name — everything downstream
 * (Agent executor) depends only on the LLMProvider interface. OpenAI/Google
 * are declared in the type but not implemented; calling them fails loudly
 * instead of silently routing to Anthropic. See README.md#llm-integration.
 */
export function getProvider(name: ProviderName): LLMProvider {
  switch (name) {
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
      return new AnthropicProvider(key);
    }
    case "openai":
      throw new Error("OpenAI provider is not implemented yet.");
    case "google":
      throw new Error("Google provider is not implemented yet.");
  }
}
