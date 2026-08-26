// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useFocusTrap } from "./useFocusTrap";

function TestDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <div ref={ref} tabIndex={-1} data-testid="dialog">
      <button>First</button>
      <button>Second</button>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button data-testid="trigger">Open dialog</button>
      {open && <TestDialog onClose={onClose} />}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus into the dialog (to its first focusable element) when it opens", () => {
    render(<Harness open={true} onClose={() => {}} />);
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    render(<Harness open={true} onClose={() => {}} />);
    const last = screen.getByText("Close");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element back to the last", () => {
    render(<Harness open={true} onClose={() => {}} />);
    const first = screen.getByText("First");
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Close")).toHaveFocus();
  });

  it("restores focus to the element that had it before the dialog opened", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(<Harness open={false} onClose={() => {}} />);
    trigger.focus(); // simulate the trigger being what's focused right before opening
    rerender(<Harness open={true} onClose={() => {}} />);
    expect(screen.getByText("First")).toHaveFocus();

    rerender(<Harness open={false} onClose={() => {}} />);
    expect(trigger).toHaveFocus();

    document.body.removeChild(trigger);
  });
});
