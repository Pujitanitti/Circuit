export type PriorNodeExecution = { nodeKey: string; status: string; output: unknown };

/**
 * "Replay from failed node": since the engine stops at the first failure,
 * every node execution that exists on the prior run already succeeded (or
 * was skipped) — nothing downstream of the failure ever ran. So carrying
 * over is simply: reuse every prior SUCCESS/SKIPPED node result as-is, and
 * let the engine's normal traversal pick up wherever it left off, which
 * naturally re-attempts the node that failed. No separate "which nodes are
 * upstream of the failure" graph walk is needed — see run.ts for how the
 * engine resumes from a `completed` map built the same way after a pause.
 */
export function selectCarryOverNodes(priorNodeExecutions: PriorNodeExecution[]): PriorNodeExecution[] {
  return priorNodeExecutions.filter((ne) => ne.status === "SUCCESS" || ne.status === "SKIPPED");
}

/** Full replay carries nothing over — every node re-runs from the trigger. */
export function selectCarryOverNodesForFullReplay(): PriorNodeExecution[] {
  return [];
}
