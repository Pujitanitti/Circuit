import { Globe, Github, Slack, Mail, Shuffle, type LucideIcon } from "lucide-react";
import { BUILTIN_TOOLS } from "@/server/services/tools";

const ICONS: Record<string, LucideIcon> = { globe: Globe, github: Github, slack: Slack, mail: Mail, shuffle: Shuffle };
const CATEGORY_LABEL: Record<string, string> = { core: "Core", integration: "Integrations" };

// TODO(Phase 6): scope this to the current workspace via listTools() once
// auth/session middleware exists. Rendering BUILTIN_TOOLS directly here
// keeps the page honest about what's registered without inventing a
// workspace id.
export default function ToolsPage() {
  const categories = Array.from(new Set(BUILTIN_TOOLS.map((t) => t.category)));

  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Tools</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Capabilities an Agent node can call.
      </p>

      {categories.map((category) => (
        <div key={category} className="mt-7 first:mt-6">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            {CATEGORY_LABEL[category] ?? category}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {BUILTIN_TOOLS.filter((t) => t.category === category).map((tool) => {
              const Icon = ICONS[tool.icon] ?? Globe;
              // Only HTTP Request has a real executor (executors/tool.ts) —
              // every other builtin tool is a registered schema without one.
              // See README Known Limitations. Shown honestly, not hidden.
              const available = tool.name === "HTTP Request";
              return (
                <div key={tool.name} className="panel panel-hover p-4">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className="text-accent" />
                    <span className="text-[13px] font-medium text-ink">{tool.name}</span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
                        available ? "bg-state-success/10 text-state-success" : "border border-canvas-border text-ink-faint"
                      }`}
                    >
                      {available ? "Available" : "Schema only"}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-ink-muted">{tool.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
