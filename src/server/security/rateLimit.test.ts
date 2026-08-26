import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rateLimit";

describe("RateLimiter", () => {
  it("allows requests up to the limit within a window", () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.check("user1", 0)).toBe(true);
    expect(limiter.check("user1", 100)).toBe(true);
    expect(limiter.check("user1", 200)).toBe(true);
    expect(limiter.check("user1", 300)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check("user1", 0)).toBe(true);
    expect(limiter.check("user1", 500)).toBe(false);
    expect(limiter.check("user1", 1001)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check("user1", 0)).toBe(true);
    expect(limiter.check("user2", 0)).toBe(true);
  });

  it("sweep removes stale entries", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.check("user1", 0);
    limiter.sweep(2000);
    expect(limiter.check("user1", 2001)).toBe(true);
  });
});
