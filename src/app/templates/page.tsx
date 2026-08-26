import { BUILTIN_TEMPLATES } from "@/server/services/templates";
import { TemplateCard } from "@/components/templates/TemplateCard";

export default function TemplatesPage() {
  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Templates</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Real, runnable graphs — each one passes the same validation a hand-built workflow does.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {BUILTIN_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.name}
            name={t.name}
            description={t.description}
            category={t.category}
            nodeCount={t.nodes.length}
            branchCount={t.nodes.filter((n) => n.type === "CONDITION").length}
            nodes={t.nodes}
            edges={t.edges}
          />
        ))}
      </div>
    </div>
  );
}
