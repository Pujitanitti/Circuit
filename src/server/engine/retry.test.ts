import { describe, it, expect } from "vitest";
import { backoffDelayMs } from "./retry";

describe("backoffDelayMs", () => {
  it("doubles each attempt", () => {
    expect(backoffDelayMs(1, 1000)).toBe(1000);
    expect(backoffDelayMs(2, 1000)).toBe(2000);
    expect(backoffDelayMs(3, 1000)).toBe(4000);
  });

  it("caps at maxDelayMs", () => {
    expect(backoffDelayMs(10, 1000, 5000)).toBe(5000);
  });
});
