/**
 * In-memory fixed-window rate limiter. Honest limitation: state lives in
 * process memory, so it only works correctly for a single server instance
 * — a real multi-instance deployment needs Redis (INCR + EXPIRE) instead.
 * Documented here and in README.md rather than silently shipping something
 * that looks like real distributed rate limiting.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(private limit: number, private windowMs: number) {}

  /** Returns true if the request is allowed; false if the key is over its limit for the current window. */
  check(key: string, now: number = Date.now()): boolean {
    const entry = this.hits.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.limit) return false;

    entry.count += 1;
    return true;
  }

  /** Periodic cleanup so long-lived processes don't accumulate stale keys forever. */
  sweep(now: number = Date.now()) {
    for (const [key, entry] of this.hits) {
      if (now - entry.windowStart >= this.windowMs) this.hits.delete(key);
    }
  }
}
