"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/components/ui/useFocusTrap";

const SHORTCUTS: [string, string][] = [
  ["Delete / Backspace", "Delete selected node(s)"],
  ["Cmd/Ctrl + A", "Select all nodes"],
  ["Cmd/Ctrl + C", "Copy selected node(s)"],
  ["Cmd/Ctrl + V", "Paste"],
  ["Cmd/Ctrl + D", "Duplicate selected node(s)"],
  ["Esc", "Close dialog, or clear selection"],
  ["Cmd/Ctrl + Z", "Undo"],
  ["Cmd/Ctrl + Shift + Z", "Redo"],
  ["Cmd/Ctrl + S", "Save version"],
  ["Cmd/Ctrl + K", "Command palette"],
  ["Cmd/Ctrl + Enter", "Run workflow"],
  ["?", "Show this help"],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        tabIndex={-1}
        className="w-full max-w-sm panel-raised p-4 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="shortcuts-help-title" className="text-[13px] font-medium text-ink">Keyboard shortcuts</p>
        <div className="mt-3 space-y-2">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between text-[12px]">
              <span className="text-ink-muted">{label}</span>
              <kbd className="rounded border border-canvas-border px-1.5 py-0.5 text-[11px] text-ink-faint">{key}</kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}
