import { describe, it, expect } from "vitest";
import { createHistory, push, undo, redo, canUndo, canRedo } from "./history";

describe("history stack", () => {
  it("starts with nothing to undo or redo", () => {
    const h = createHistory("v0");
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it("undo restores the previous state and enables redo", () => {
    let h = createHistory("v0");
    h = push(h, "v1");
    h = push(h, "v2");
    h = undo(h);
    expect(h.present).toBe("v1");
    expect(canRedo(h)).toBe(true);
  });

  it("redo restores the undone state", () => {
    let h = createHistory("v0");
    h = push(h, "v1");
    h = undo(h);
    h = redo(h);
    expect(h.present).toBe("v1");
    expect(canRedo(h)).toBe(false);
  });

  it("a new push after undo clears the redo stack", () => {
    let h = createHistory("v0");
    h = push(h, "v1");
    h = undo(h);
    h = push(h, "v2-alternate");
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe("v2-alternate");
  });

  it("undoing past the start is a no-op", () => {
    const h = createHistory("v0");
    expect(undo(h)).toEqual(h);
  });

  it("caps history length so it can't grow unbounded", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 60; i++) h = push(h, i);
    expect(h.past.length).toBeLessThanOrEqual(50);
  });
});
