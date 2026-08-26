import { prisma } from "@/lib/prisma";
import { Canvas } from "@/components/workflow/Canvas";
import { notFound } from "next/navigation";

export default async function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!workflow) notFound();

  return (
    <Canvas
      workflowId={id}
      initialWorkflowName={workflow.name}
      initialVersion={workflow.versions[0]?.version ?? 0}
    />
  );
}
