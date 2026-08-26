/** Exponential backoff with a cap, so a misconfigured retry policy can't stall an execution for hours. */
export function backoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs = 30_000): number {
  const delay = baseDelayMs * 2 ** (attempt - 1);
  return Math.min(delay, maxDelayMs);
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const MAX_EXECUTION_DURATION_MS = 15 * 60 * 1000; // 15 minutes, see #39 security requirements
