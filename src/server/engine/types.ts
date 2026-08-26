// The node execution contract. Every node type (Agent, Tool, Condition, ...)
// implements this interface so the engine can treat them uniformly during
// DAG traversal. See README.md#node-execution-contract.

export type WorkflowState = {
  trigger: Record<string, unknown>;
  nodes: Record<string, { output: unknown }>; // keyed by node "key", not db id
  variables: Record<string, unknown>;
  loop?: { currentItem: unknown; index: number; accumulator: unknown[] };
};

export type ExecutionContext = {
  executionId: string;
  workflowVersionId: string;
  state: WorkflowState;
  log: (level: "info" | "warn" | "error", message: string, metadata?: object) => Promise<void>;
  isCancelled: () => Promise<boolean>;
};

export type NodeResult =
  | { status: "success"; output: unknown; stateUpdates?: Partial<WorkflowState> }
  | { status: "failed"; error: string; retryable: boolean }
  | { status: "skipped"; reason: string }
  | { status: "waiting"; reason: "approval" | "delay"; resumeAt?: Date };

export interface NodeExecutor<Config = unknown> {
  /** Structural + config validation before the node ever runs. */
  /**
   * Structural + config validation before the node ever runs. `availableVariables`
   * is part of the intended contract (checking a node's `{{path}}` references
   * against what's actually produced upstream) but nothing in the app calls
   * this method yet — `components/workflow/validateGraph.ts` does all real
   * validation today as a separate, graph-level pass. Optional here because
   * every current implementation ignores it; see README's Known Limitations.
   */
  validate(config: Config, availableVariables?: string[]): string[]; // returns error messages, [] if valid

  /** Do the work. Must be safe to retry (idempotent where the node type allows). */
  execute(config: Config, ctx: ExecutionContext): Promise<NodeResult>;

  /** Called when execute() throws or times out; decides retry vs. fail. */
  handleError(error: unknown, attempt: number, maxAttempts: number): { retry: boolean; delayMs: number };
}
