"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Workflow, PlayCircle, LayoutTemplate, Wrench, KeyRound, Settings, ChevronsUpDown,
} from "lucide-react";
import { Logo } from "./Logo";
import { clsx } from "clsx";

// "Agents" is deliberately not a section here — there's no standalone Agent
// registry entity in the schema (Agent *nodes* live inside workflows), so a
// page for it would either be empty or fabricated. See README Known
// Limitations. Credentials/Settings ARE real pages now, backed by the
// Credential and Workspace models respectively.
const SECTIONS: { label: string; items: { href: string; label: string; icon: typeof Workflow }[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/workflows", label: "Workflows", icon: Workflow },
      { href: "/runs", label: "Runs", icon: PlayCircle },
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/tools", label: "Tools", icon: Wrench },
      { href: "/credentials", label: "Credentials", icon: KeyRound },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col justify-between border-r border-canvas-border bg-canvas-raised px-3 py-4">
      <div>
        <div className="mb-6 flex items-center px-2">
          <Logo />
        </div>

        <nav className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname?.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-canvas-surface text-ink shadow-panel"
                          : "text-ink-muted hover:bg-canvas-surface/70 hover:text-ink"
                      )}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <button className="flex items-center justify-between rounded-md px-2.5 py-2 text-[13px] text-ink-muted hover:bg-canvas-surface/70 hover:text-ink">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
            PN
          </span>
          Pujita&apos;s Workspace
        </span>
        <ChevronsUpDown size={14} />
      </button>
    </aside>
  );
}
