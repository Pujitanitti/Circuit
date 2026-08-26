import { describe, it, expect } from "vitest";
import { resolveEscapeAction } from "./escapeHandling";

describe("resolveEscapeAction", () => {
  it("closes the shortcuts modal first when it's open, regardless of other state", () => {
    expect(resolveEscapeAction({ showShortcuts: true, showPreflight: true })).toBe("close-shortcuts");
    expect(resolveEscapeAction({ showShortcuts: true, showPreflight: false })).toBe("close-shortcuts");
  });

  it("closes the preflight modal when open and shortcuts isn't", () => {
    expect(resolveEscapeAction({ showShortcuts: false, showPreflight: true })).toBe("close-preflight");
  });

  it("only clears canvas selection when no modal is open — never leaks through an open modal", () => {
    expect(resolveEscapeAction({ showShortcuts: false, showPreflight: false })).toBe("clear-selection");
  });
});
