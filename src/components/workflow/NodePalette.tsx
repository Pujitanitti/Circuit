"use client";

import { NODE_TYPE_META } from "./types";
import type { NodeType } from "@prisma/client";
import {
  Zap, Bot, Globe, GitBranch, Shuffle, Repeat, Clock, UserCheck, Flag, Search,
} from "lucide-react";
import { useState } from "react";

const ICONS = {
  TRIGGER: Zap, AGENT: Bot, TOOL: Globe, CONDITION: GitBranch, TRANSFORM: Shuffle,
  LOOP: Repeat, DELAY: Clock, APPROVAL: UserCheck, OUTPUT: Flag,
} as const;

export function NodePalette({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const [query, setQuery] = useState("");
  const entries = (Object.keys(NODE_TYPE_META) as NodeType[]).filter((t) =>
    NODE_TYPE_META[t]!.label.toLowerCase().includes(query.toLowerCase()) // safe: t comes from Object.keys(NODE_TYPE_META)
  );

  return (
    <div className="w-56 shrink-0 border-r border-canvas-border bg-canvas-surface p-3">
      <div className="flex items-center gap-2 rounded-md border border-canvas-border bg-canvas px-2 py-1.5">
        <Search size={13} className="text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="mt-3 space-y-1">
        {entries.map((type) => {
          const Icon = ICONS[type]; // safe: ICONS is a Record covering every NodeType exhaustively
          const meta = NODE_TYPE_META[type]!;
          return (
            <button
              key={type}
              onClick={() => onAdd(type)}
              className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-canvas-raised"
            >
              <Icon size={14} style={{ color: meta.color }} className="mt-0.5 shrink-0" />
              <span>
                <span className="block text-[12px] font-medium text-ink">{meta.label}</span>
                <span className="block text-[11px] text-ink-muted">{meta.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
