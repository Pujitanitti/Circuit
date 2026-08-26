import { prisma } from "@/lib/prisma";
import { BUILTIN_TEMPLATES } from "./templates";

export async function seedBuiltinTemplates() {
  await prisma.$transaction(
    BUILTIN_TEMPLATES.map((t) =>
      prisma.template.upsert({
        where: { id: `builtin-${t.name.toLowerCase().replace(/\s+/g, "-")}` },
        update: {},
        create: {
          id: `builtin-${t.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: t.name,
          description: t.description,
          category: t.category,
          graph: { nodes: t.nodes, edges: t.edges },
          workspaceId: null,
        },
      })
    )
  );
}

/** Creates a new workflow + first WorkflowVersion from a template's graph. */
export async function instantiateTemplate(templateId: string, workspaceId: string, workflowName: string) {
  const template = await prisma.template.findUniqueOrThrow({ where: { id: templateId } });
  const graph = template.graph as { nodes: Array<{ key: string; type: string; label: string; config: object; position: { x: number; y: number } }>; edges: Array<{ sourceKey: string; targetKey: string; sourceHandle?: string }> };

  const workflow = await prisma.workflow.create({
    data: { name: workflowName, workspaceId, description: `Created from template: ${template.name}` },
  });

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        graph: { nodes: graph.nodes, edges: graph.edges },
        nodes: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: graph.nodes.map((n: any) => ({
            key: n.key, type: n.type, label: n.label, config: n.config,
            positionX: n.position.x, positionY: n.position.y,
          })),
        },
        edges: {
          create: graph.edges.map((e) => ({ sourceKey: e.sourceKey, targetKey: e.targetKey, sourceHandle: e.sourceHandle })),
        },
      },
    });
    await tx.workflow.update({ where: { id: workflow.id }, data: { activeVersionId: created.id } });
    return created;
  });

  return { workflowId: workflow.id, versionId: version.id };
}
