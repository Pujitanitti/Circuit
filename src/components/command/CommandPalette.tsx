"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow, PlayCircle, LayoutTemplate, Settings, Plus, Search,
} from "lucide-react";

type Command = { id: string; label: string; group: string; icon: typeof Plus; run: (router: ReturnType<typeof useRouter>) => void };

const COMMANDS: Command[] = [
  { id: "new-workflow", label: "Create workflow", group: "Workflow", icon: Plus, run: (r) => r.push("/workflows") },
  { id: "workflows", label: "Search workflows", group: "Navigate", icon: Workflow, run: (r) => r.push("/workflows") },
  { id: "runs", label: "Open runs", group: "Navigate", icon: PlayCircle, run: (r) => r.push("/runs") },
  { id: "templates", label: "Open templates", group: "Navigate", icon: LayoutTemplate, run: (r) => r.push("/templates") },
  { id: "settings", label: "Settings", group: "Navigate", icon: Settings, run: (r) => r.push("/settings") },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setActiveIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(
    () => COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  function runCommand(command: Command) {
    command.run(router);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg panel-raised overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && results[activeIndex]) runCommand(results[activeIndex]);
        }}
      >
        <div className="flex items-center gap-2 border-b border-canvas-border px-3 py-2.5">
          <Search size={14} className="text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="Type a command…"
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-canvas-border px-1.5 py-0.5 text-[10px] text-ink-faint">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-auto p-1.5">
          {results.map((command, i) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                onClick={() => runCommand(command)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] ${
                  i === activeIndex ? "bg-canvas-raised text-ink" : "text-ink-muted"
                }`}
              >
                <Icon size={14} />
                {command.label}
                <span className="ml-auto text-[11px] text-ink-faint">{command.group}</span>
              </button>
            );
          })}
          {results.length === 0 && <p className="px-2.5 py-4 text-center text-[12px] text-ink-faint">No matching commands.</p>}
        </div>
      </div>
    </div>
  );
}
