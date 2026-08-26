import { lookup } from "node:dns/promises";
import type { NodeExecutor, NodeResult, ExecutionContext } from "../types";
import type { ToolConfig } from "@/components/workflow/types";
import { interpolate } from "../state";
import { isBlockedIp } from "@/server/security/ssrf";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // #39 payload size limits

async function assertUrlIsSafe(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  // If the hostname is already a literal IP, check it directly. Otherwise
  // resolve it — checking the URL string alone would miss DNS rebinding to
  // an internal address (e.g. a public-looking hostname that resolves to
  // 169.254.169.254). This resolution step needs real DNS, so it's the one
  // part of SSRF protection not covered by ssrf.test.ts's pure unit tests.
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  const candidates = addresses.length > 0 ? addresses.map((a) => a.address) : [url.hostname];

  for (const address of candidates) {
    if (isBlockedIp(address)) {
      throw new Error(`Request to ${url.hostname} blocked: resolves to a private/internal address.`);
    }
  }
}

export function createToolExecutor(fetchImpl: typeof fetch = fetch): NodeExecutor<ToolConfig> {
  return {
    validate(config) {
      const errors: string[] = [];
      if (!config.url) errors.push("Tool node requires a URL.");
      if (config.timeoutMs <= 0 || config.timeoutMs > 60_000) errors.push("Timeout must be between 1ms and 60s.");
      return errors;
    },

    async execute(config, ctx: ExecutionContext): Promise<NodeResult> {
      const url = interpolate(config.url, ctx.state);

      try {
        await assertUrlIsSafe(url);
      } catch (err) {
        return { status: "failed", error: err instanceof Error ? err.message : String(err), retryable: false };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(config.headers ?? {})) headers[k] = interpolate(v, ctx.state);

        const response = await fetchImpl(url, {
          method: config.method,
          headers,
          body: config.body ? interpolate(config.body, ctx.state) : undefined,
          signal: controller.signal,
        });

        const text = await response.text();
        if (text.length > MAX_RESPONSE_BYTES) {
          return { status: "failed", error: "Response exceeded maximum payload size.", retryable: false };
        }

        await ctx.log("info", `${config.method} ${url} → ${response.status}`);

        let body: unknown = text;
        try { body = JSON.parse(text); } catch { /* leave as text */ }

        if (!response.ok) {
          // 4xx is very unlikely to succeed on retry; 5xx/network errors are.
          const retryable = response.status >= 500;
          return { status: "failed", error: `HTTP ${response.status}`, retryable };
        }

        return { status: "success", output: { status: response.status, body } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const timedOut = err instanceof Error && err.name === "AbortError";
        return { status: "failed", error: timedOut ? `Request timed out after ${config.timeoutMs}ms` : message, retryable: true };
      } finally {
        clearTimeout(timeout);
      }
    },

    handleError() {
      return { retry: false, delayMs: 0 }; // retry decision is made per-result above via `retryable`
    },
  };
}

export const toolExecutor = createToolExecutor();
