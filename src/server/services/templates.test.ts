import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES } from "@/server/services/templates";
import { validateGraph } from "@/components/workflow/validateGraph";
import type { CircuitNodeData } from "@/components/workflow/types";

describe("BUILTIN_TEMPLATES", () => {
  for (const template of BUILTIN_TEMPLATES) {
    it(`"${template.name}" passes validateGraph with zero issues`, () => {
      const issues = validateGraph(
        template.nodes.map((n) => ({
          key: n.key,
          type: n.type,
          data: { key: n.key, type: n.type, label: n.label, config: n.config, status: "idle" } as CircuitNodeData,
        })),
        template.edges
      );
      expect(issues).toEqual([]);
    });
  }
});
