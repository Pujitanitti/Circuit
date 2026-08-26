import type { NodeType } from "@prisma/client";
import type { NodeConfig } from "@/components/workflow/types";

export type TemplateNode = { key: string; type: NodeType; label: string; config: NodeConfig; position: { x: number; y: number } };
export type TemplateEdge = { sourceKey: string; targetKey: string; sourceHandle?: string };
export type TemplateDefinition = { name: string; description: string; category: string; nodes: TemplateNode[]; edges: TemplateEdge[] };

/**
 * Every graph here passes `validateGraph()` — these aren't decorative
 * screenshots, they're the same node/edge shape `POST /api/workflows/:id/versions`
 * accepts, so "Use template" produces a workflow that can actually run
 * (modulo Agent/Tool nodes needing real credentials — see README).
 */
export const BUILTIN_TEMPLATES: TemplateDefinition[] = [
  {
    name: "GitHub Issue Analyzer",
    description: "Classifies an incoming issue as a bug or feature request and drafts next steps.",
    category: "engineering",
    nodes: [
      { key: "trigger", type: "TRIGGER", label: "Webhook", config: { kind: "webhook", path: "/hooks/github-issue" }, position: { x: 0, y: 0 } },
      { key: "analyzer", type: "AGENT", label: "Analyze issue", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "You triage GitHub issues. Respond with JSON: { \"category\": \"bug\"|\"feature\", \"priority\": \"low\"|\"medium\"|\"high\" }.", userPrompt: "{{trigger.body}}", temperature: 0.2, maxTokens: 300, tools: [] }, position: { x: 260, y: 0 } },
      { key: "isBug", type: "CONDITION", label: "Is it a bug?", config: { left: "{{nodes.analyzer.output.content}}", operator: "contains", right: "bug" }, position: { x: 520, y: 0 } },
      { key: "bugPlan", type: "AGENT", label: "Draft fix proposal", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "You draft concise bug-fix proposals.", userPrompt: "Issue: {{trigger.body}}\nAnalysis: {{nodes.analyzer.output.content}}", temperature: 0.3, maxTokens: 500, tools: [] }, position: { x: 800, y: -80 } },
      { key: "featurePlan", type: "AGENT", label: "Draft implementation plan", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "You draft concise feature implementation plans.", userPrompt: "Issue: {{trigger.body}}\nAnalysis: {{nodes.analyzer.output.content}}", temperature: 0.3, maxTokens: 500, tools: [] }, position: { x: 800, y: 80 } },
      { key: "output", type: "OUTPUT", label: "Result", config: { resultExpression: "{{nodes.analyzer.output}}" }, position: { x: 1060, y: 0 } },
    ],
    edges: [
      { sourceKey: "trigger", targetKey: "analyzer" },
      { sourceKey: "analyzer", targetKey: "isBug" },
      { sourceKey: "isBug", targetKey: "bugPlan", sourceHandle: "true" },
      { sourceKey: "isBug", targetKey: "featurePlan", sourceHandle: "false" },
      { sourceKey: "bugPlan", targetKey: "output" },
      { sourceKey: "featurePlan", targetKey: "output" },
    ],
  },
  {
    name: "Customer Support Classifier",
    description: "Classifies an inbound message and routes urgent ones to Slack.",
    category: "support",
    nodes: [
      { key: "trigger", type: "TRIGGER", label: "Manual", config: { kind: "manual" }, position: { x: 0, y: 0 } },
      { key: "classify", type: "AGENT", label: "Classify message", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "Classify support messages by urgency.", userPrompt: "{{trigger.message}}", temperature: 0.2, maxTokens: 200, tools: [] }, position: { x: 260, y: 0 } },
      { key: "isUrgent", type: "CONDITION", label: "Is urgent?", config: { left: "{{nodes.classify.output.content}}", operator: "contains", right: "urgent" }, position: { x: 520, y: 0 } },
      { key: "notify", type: "TOOL", label: "Notify #support", config: { method: "POST", url: "https://hooks.slack.com/services/REPLACE_ME", headers: { "Content-Type": "application/json" }, body: "{\"text\":\"Urgent: {{trigger.message}}\"}", timeoutMs: 5000, retry: { maxAttempts: 3, backoffMs: 1000 } }, position: { x: 800, y: -60 } },
      { key: "output", type: "OUTPUT", label: "Result", config: { resultExpression: "{{nodes.classify.output}}" }, position: { x: 800, y: 100 } },
    ],
    edges: [
      { sourceKey: "trigger", targetKey: "classify" },
      { sourceKey: "classify", targetKey: "isUrgent" },
      { sourceKey: "isUrgent", targetKey: "notify", sourceHandle: "true" },
      { sourceKey: "isUrgent", targetKey: "output", sourceHandle: "false" },
      { sourceKey: "notify", targetKey: "output" },
    ],
  },
  {
    name: "Research Agent",
    description: "Takes a topic, gathers context via a tool call, and produces a summary.",
    category: "research",
    nodes: [
      { key: "trigger", type: "TRIGGER", label: "Manual", config: { kind: "manual" }, position: { x: 0, y: 0 } },
      { key: "search", type: "TOOL", label: "Search", config: { method: "GET", url: "https://api.example.com/search?q={{trigger.topic}}", headers: {}, timeoutMs: 8000, retry: { maxAttempts: 3, backoffMs: 1000 } }, position: { x: 260, y: 0 } },
      { key: "summarize", type: "AGENT", label: "Summarize findings", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "Summarize research findings concisely.", userPrompt: "Topic: {{trigger.topic}}\nResults: {{nodes.search.output.body}}", temperature: 0.4, maxTokens: 700, tools: [] }, position: { x: 520, y: 0 } },
      { key: "extract", type: "TRANSFORM", label: "Extract summary", config: { kind: "extract", expression: "{{nodes.summarize.output.content}}" }, position: { x: 780, y: 0 } },
      { key: "output", type: "OUTPUT", label: "Result", config: { resultExpression: "{{nodes.extract.output}}" }, position: { x: 1040, y: 0 } },
    ],
    edges: [
      { sourceKey: "trigger", targetKey: "search" },
      { sourceKey: "search", targetKey: "summarize" },
      { sourceKey: "summarize", targetKey: "extract" },
      { sourceKey: "extract", targetKey: "output" },
    ],
  },
  {
    name: "Code Review Assistant",
    description: "Reviews a pull request and waits for human approval before commenting.",
    category: "engineering",
    nodes: [
      { key: "trigger", type: "TRIGGER", label: "Webhook", config: { kind: "webhook", path: "/hooks/pull-request" }, position: { x: 0, y: 0 } },
      { key: "review", type: "AGENT", label: "Review diff", config: { provider: "anthropic", model: "claude-sonnet-5", systemPrompt: "You review pull request diffs for correctness and style.", userPrompt: "{{trigger.diff}}", temperature: 0.2, maxTokens: 800, tools: [] }, position: { x: 260, y: 0 } },
      { key: "approval", type: "APPROVAL", label: "Human review", config: { prompt: "Post this review comment?\n{{nodes.review.output.content}}", approvers: [] }, position: { x: 520, y: 0 } },
      { key: "comment", type: "TOOL", label: "Post comment", config: { method: "POST", url: "https://api.github.com/repos/{{trigger.repo}}/issues/{{trigger.prNumber}}/comments", headers: { Authorization: "Bearer {{trigger.githubToken}}" }, body: "{\"body\":\"{{nodes.review.output.content}}\"}", timeoutMs: 8000, retry: { maxAttempts: 3, backoffMs: 1000 } }, position: { x: 780, y: 0 } },
    ],
    edges: [
      { sourceKey: "trigger", targetKey: "review" },
      { sourceKey: "review", targetKey: "approval" },
      { sourceKey: "approval", targetKey: "comment" },
    ],
  },
];
