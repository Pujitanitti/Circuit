import { prisma } from "@/lib/prisma";

/**
 * Builtin tools available to every workspace without explicit setup. Each
 * one is at least a real, checkable schema — none of these are decorative;
 * "HTTP Request" is the one with a full executor today (see executors/tool.ts).
 * GitHub/Slack/Email are registered as real tool *definitions* (schema +
 * category + auth requirement) so the Tools page and Agent tool-selection
 * aren't empty, but their executors aren't built — calling them through an
 * Agent node surfaces as an unresolved tool call, not a fake response.
 */
export const BUILTIN_TOOLS = [
  {
    name: "HTTP Request",
    description: "Call any external HTTP API.",
    category: "core",
    icon: "globe",
    inputSchema: { type: "object", properties: { url: { type: "string" }, method: { type: "string" } }, required: ["url"] },
    outputSchema: { type: "object", properties: { status: { type: "number" }, body: {} } },
  },
  {
    name: "GitHub",
    description: "Read issues, pull requests, and repository files.",
    category: "integration",
    icon: "github",
    inputSchema: { type: "object", properties: { repo: { type: "string" }, issueNumber: { type: "number" } }, required: ["repo"] },
    outputSchema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } } },
  },
  {
    name: "Slack",
    description: "Post a message to a Slack channel.",
    category: "integration",
    icon: "slack",
    inputSchema: { type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel", "text"] },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
  },
  {
    name: "Email",
    description: "Send a transactional email.",
    category: "integration",
    icon: "mail",
    inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject"] },
    outputSchema: { type: "object", properties: { messageId: { type: "string" } } },
  },
  {
    name: "JSON Transform",
    description: "Extract, map, or filter a JSON value with a path expression.",
    category: "core",
    icon: "shuffle",
    inputSchema: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] },
    outputSchema: {},
  },
] as const;

export async function listTools(workspaceId: string) {
  return prisma.tool.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
}

export async function seedBuiltinTools(workspaceId: string) {
  await prisma.$transaction(
    BUILTIN_TOOLS.map((tool) =>
      prisma.tool.upsert({
        where: { workspaceId_name: { workspaceId, name: tool.name } },
        update: {},
        create: { ...tool, workspaceId, builtin: true },
      })
    )
  );
}
