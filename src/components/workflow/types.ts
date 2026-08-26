import type { NodeType } from "@prisma/client";

// Client-side shape of a canvas node. Mirrors WorkflowNode in prisma/schema.prisma
// but keeps `key` as the React Flow node id (db id doesn't exist until saved).
export type CircuitNodeData = {
  key: string;
  type: NodeType;
  label: string;
  config: NodeConfig;
  status: NodeRuntimeStatus;
};

export type NodeRuntimeStatus =
  | "idle" | "running" | "success" | "failed" | "skipped" | "waiting" | "retrying" | "not_executed";

export type NodeConfig =
  | TriggerConfig | AgentConfig | ToolConfig | ConditionConfig
  | TransformConfig | LoopConfig | DelayConfig | ApprovalConfig | OutputConfig;

export type TriggerConfig = { kind: "manual" } | { kind: "webhook"; path: string } | { kind: "schedule"; cron: string };

export type AgentConfig = {
  provider: "anthropic" | "openai" | "google";
  model: string;
  systemPrompt: string;
  userPrompt: string; // supports {{variable}} interpolation
  temperature: number;
  maxTokens: number;
  tools: string[]; // Tool ids the agent may call
};

export type ToolConfig = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  retry: { maxAttempts: number; backoffMs: number };
};

export type ConditionConfig = { left: string; operator: "==" | "!=" | ">" | "<" | "contains"; right: string };

export type TransformConfig = { kind: "extract" | "map" | "filter" | "template"; expression: string };

export type LoopConfig = { itemsExpression: string; maxIterations: number };

export type DelayConfig = { seconds: number };

export type ApprovalConfig = { prompt: string; approvers: string[] };

export type OutputConfig = { resultExpression: string };

// Semantic node-type accent colors — matches the Tailwind `node.*` tokens
// in tailwind.config.ts so the palette is defined in exactly one place
// conceptually (these hex values ARE those tokens; kept as literals here
// because NODE_TYPE_META is consumed by inline SVG/style props that can't
// resolve Tailwind classes at runtime).
export const NODE_TYPE_META: Record<NodeType, { label: string; description: string; color: string }> = {
  TRIGGER: { label: "Trigger", description: "Starts workflow execution", color: "#2563EB" },
  AGENT: { label: "Agent", description: "LLM reasons over input", color: "#6D5AE6" },
  TOOL: { label: "Tool", description: "Calls an external API", color: "#0E9CB8" },
  CONDITION: { label: "Condition", description: "Branches execution", color: "#B7791F" },
  TRANSFORM: { label: "Transform", description: "Reshapes workflow state", color: "#4F46E5" },
  LOOP: { label: "Loop", description: "Iterates over a list", color: "#B7791F" },
  DELAY: { label: "Delay", description: "Pauses execution", color: "#5B6172" },
  APPROVAL: { label: "Human Approval", description: "Waits for a person", color: "#C2600C" },
  OUTPUT: { label: "Output", description: "Defines workflow result", color: "#0E9F6E" },
};
