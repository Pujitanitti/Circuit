# Interview preparation

Every answer here is grounded in the actual Circuit codebase — file names
and behavior are real, not illustrative. Use this as a cheat sheet, not a
script; say it in your own words.

---

## Architecture

### 1. What did you build?
**Short answer:** A visual workflow builder where the graph you draw is
just a representation — a separate backend engine (`src/server/engine`)
actually executes it against Postgres, with retries, branching, and replay.

**Deeper:** Nine node types (Trigger, Agent, Tool, Condition, Transform,
Loop, Delay, Approval, Output), a React Flow canvas that saves graphs as
immutable `WorkflowVersion` snapshots, and an execution engine that does
real dependency-based scheduling rather than "run nodes top to bottom."

**Follow-up:** "How is that different from just calling functions in order?"
→ Because branching means the *order itself* isn't fixed until runtime —
the engine decides what's next based on what a Condition node resolved to.

### 2. Why did you choose this architecture?
**Short answer:** To force a real separation between "what the graph looks
like" and "what actually runs" — most workflow-builder demos collapse
those into one thing.

**Deeper:** `graph.ts` never imports Prisma. `run.ts` is the only file that
touches the database and calls into `graph.ts`'s pure functions. That
split is what let me unit-test scheduling logic without a database, and
later, is what makes an in-memory Prisma fake possible for orchestration
testing.

**Follow-up:** "What would break if you merged them?" → You'd lose the
ability to unit test traversal logic in isolation, and moving execution to
a queue worker later would mean rewriting traversal logic instead of
reusing it.

### 3. Walk me through the architecture.
**Short answer:** Frontend (Next.js/React Flow) → API routes (zod-validated)
→ workflow/execution services → execution engine → node executors → LLM/
tool runtime, all against Postgres via Prisma.

**Deeper:** See the Mermaid diagram in the README. The one thing worth
emphasizing out loud: the API layer and the engine are decoupled enough
that `runExecution()` can be called from an HTTP route *or* from the
approve/reject routes to resume a paused execution — it doesn't know or
care who's calling it.

### 4. What happens when a workflow executes?
**Short answer:** `POST /workflows/:id/execute` creates an `Execution` row,
loads the immutable graph, runs the Trigger through the normal executor
path, then loops: mark newly-skippable nodes, find what's executable,
run it, persist, repeat.

**Deeper:** See the README's "Example execution" walkthrough — it's the
literal sequence, not a simplification.

### 5. How does the execution engine schedule nodes?
**Short answer:** `findExecutableNodes(graph, completed)` — a node is
ready when every incoming edge's source has settled and, for branch edges,
the source picked the matching handle.

**Deeper:** This is pure and unit-tested independently of the database —
`graph.test.ts` builds a graph by hand and asserts on exactly which nodes
come back ready for a given `completed` map.

### 6. Why is this a DAG?
**Short answer:** Because a workflow's execution order depends on runtime
data (which branch a Condition takes), not a fixed sequence — but it still
can't have cycles, or it'd run forever.

**Deeper:** Loops are the one deliberate exception — bounded iteration,
not a structural cycle — and `detectCycle` explicitly excludes loop-body
edges so that exception doesn't become a hole in cycle detection.

### 7. How do you handle dependencies?
**Short answer:** Edges *are* the dependencies. A node's incoming edges
list what has to settle (and which branch, if any) before it can run.

### 8. How do you detect completion?
**Short answer:** Every non-loop-body node has a settled entry (`success`,
`skipped`, or `failed`) in the `completed` map.

**Deeper:** This is exactly the check that was buggy — see Bug 1 in the
README. "No more executable nodes this tick" and "everything is actually
settled" are different conditions, and conflating them is what caused the
deadlock.

### 9. How do you handle failures?
**Short answer:** A node executor returns `{ status: "failed", error,
retryable }`; retryable failures get retried with exponential backoff up
to 3 attempts, non-retryable or exhausted failures mark the whole
execution `FAILED`.

---

## Orchestration

### 10. How does conditional branching work?
**Short answer:** The Condition executor evaluates an operator and returns
`output.handle: "true" | "false"`; edges carry a matching `sourceHandle`,
and only the edge whose handle matches the chosen branch becomes
traversable.

### 11. How do you handle an unreachable branch?
**Short answer:** `findSkippedNodes` detects it — every incoming edge's
source is settled, but none of them route here — and the engine marks it
`SKIPPED` with a real persisted `NodeExecution` row.

### 12. Why did the branch bug happen?
**Short answer:** `findExecutableNodes` correctly excluded the losing
branch, but nothing else ever marked it done — exclusion isn't the same
as resolution.

**Deeper:** Full writeup is Bug 1 in the README — worth reading before
this question comes up, because the honest answer requires the specific
mechanism, not "there was a bug in the scheduler."

### 13. How did you diagnose it?
**Short answer:** An integration test asserted `SUCCESS` on a branching
workflow, got `FAILED` with a "stalled" message, and tracing the loop by
hand against the in-memory fake's state showed the losing branch never
entering `completed`.

### 14. Why didn't unit tests catch it?
**Short answer:** The existing unit test *pre-seeded* the losing branch as
already skipped — it tested "given this is skipped, what's next," not
"does anything actually mark it skipped."

### 15. Why was the integration test important?
**Short answer:** Because the bug lived at the seam between two
individually-correct functions — `findExecutableNodes` and the orchestration
loop — and no unit test exercises that seam by definition.

### 16. How do retries work?
**Short answer:** Exponential backoff (`backoffDelayMs`, capped at 30s),
up to `DEFAULT_MAX_ATTEMPTS` (3), only for results marked `retryable`.

**Deeper:** Each attempt is its own `NodeExecution` row — you can see the
full retry history for a node, not just the final outcome.

### 17. What happens after a node permanently fails?
**Short answer:** The node's `NodeExecution` gets `status: FAILED` with
the error message, the whole `Execution` is marked `FAILED`, and an
`ExecutionLog` row is written — everything up to that point stays persisted.

### 18. How do you prevent duplicate execution?
**Short answer:** Right now — running in-process, single request — you
mostly don't need to, but the schema is shaped for it: `NodeExecution` is
keyed by `(executionId, nodeId, attempt)`, so a future worker could check
for an existing row before re-running side effects.

**Deeper:** Be honest that this isn't enforced by a unique constraint
today — it's a documented design intent for the future-scale path, not a
currently-active guarantee.

### 19. How would this scale to thousands of workflows?
**Short answer:** Move execution out of the request/response cycle into a
queue + worker pool — `graph.ts` and the `NodeExecutor` contract don't
need to change, only what calls `runExecution()`.

---

## Persistence

### 20. Why do you persist NodeExecution?
**Short answer:** It's the audit trail — every attempt of every node, with
input/output/error/timestamps — which is what the execution debugger UI
and replay both read from.

### 21. Why should Trigger nodes create execution records?
**Short answer:** Because the debugger UI derives node status from
`NodeExecution` rows — a Trigger with none would show as never-run even on
a successful execution. This is literally Bug 2 in the README.

### 22. What information would you need for debugging?
**Short answer:** It's already there: `NodeExecution.input`/`output`/`error`
per attempt, plus `ExecutionLog` rows with timestamps and optional
`nodeKey` scoping.

### 23. How would you recover after a process crash?
**Short answer:** `runExecution()` rebuilds its `completed` map from
persisted `NodeExecution` rows on every call rather than trusting
in-memory state, so calling it again after a crash resumes correctly —
this is the same mechanism that makes approve/reject resumption work.

**Deeper:** Honest caveat: a node mid-execution when the process crashes
doesn't currently have a way to be detected as "orphaned" and retried —
that's the gap a real queue/worker with visibility timeouts would close.

### 24. How would you make execution idempotent?
**Short answer:** Key side-effecting work (like a Tool node's HTTP call) by
`(executionId, nodeId, attempt)` and check for a prior result before
re-executing — the schema supports this lookup today even though nothing
currently enforces it automatically.

---

## Security

### 25. What security concerns did you consider?
**Short answer:** Credential exposure, SSRF via user-configured HTTP tools,
brute-force on auth endpoints, and unauthorized cross-workspace access.

### 26. How is authorization handled?
**Short answer:** `authorizeWorkspaceAccess(workspaceId, minimumRole)` —
one function, checks the session against `WorkspaceMember`, applied to
workflow save/execute and credentials routes.

### 27. What are the remaining security gaps?
**Short answer:** Authorization isn't swept across every route yet (Runs/
Tools listing endpoints are open), and `workspaceId` is hardcoded client-side
in two places — both named explicitly in Known limitations, not hidden.

### 28. What would you improve before production?
**Short answer:** Finish the auth sweep, move the rate limiter to Redis for
multi-instance correctness, and add the real Postgres integration test
this sandbox couldn't run.

---

## Testing

### 29. What is your testing strategy?
**Short answer:** Pure logic gets unit tests; orchestration gets an
integration test against an in-memory Prisma fake; anything needing a
browser or real Postgres is named as untested rather than skipped silently.

### 30. What does the 72-test suite actually cover?
**Short answer:** DAG traversal (including skip detection), every
executor's core logic, security primitives (SSRF, crypto, rate limiting),
client validation, undo/redo, and — checked, not assumed — every builtin
template against the real validator.

### 31. What is unit tested?
**Short answer:** See the Verification matrix in the README — it's the
literal answer to this question, cross-referenced to test files.

### 32. What is integration tested?
**Short answer:** The full `runExecution()` orchestration loop, via
`run.integration.test.ts`'s in-memory Prisma fake — linear success,
branching, and non-retryable failure.

### 33. What is NOT tested?
**Short answer:** Real Postgres behavior, the browser UI, SSE delivery, and
auth flows end-to-end — all named in Known limitations rather than implied
to be covered by the 72 passing tests.

### 34. Why did you use an in-memory Prisma fake?
**Short answer:** This sandbox has no network path to a database at all —
the fake was the only way to test orchestration control flow instead of
only its pure dependencies.

**Deeper:** Be ready to immediately add: "and it's not equivalent to real
Postgres — no SQL correctness or concurrency coverage." Saying this
unprompted is stronger than waiting to be asked.

### 35. What would you test with real PostgreSQL?
**Short answer:** The exact same scenarios in `run.integration.test.ts` —
transaction behavior around `$transaction` calls (workflow version save,
signup), and whether two concurrent `runExecution()` calls on the same
execution race.

### 36. How would you test concurrent workflow execution?
**Short answer:** Two processes calling `runExecution()` on the same
`executionId` simultaneously — right now nothing prevents both from
creating `NodeExecution` rows for the same node; a row-level lock or a
`SELECT ... FOR UPDATE` on the `Execution` row would be the fix to test
against.

---

## System design

### 37. How would you scale this?
**Short answer:** Move execution to a queue (`API → enqueue → Queue →
Worker pool → engine`), documented in the README's Future-scale
architecture section, without changing `graph.ts` or the `NodeExecutor`
contract.

### 38. How would you introduce a job queue?
**Short answer:** Replace the direct `runExecution()` call in the execute
route with "enqueue a job," and have a worker process call the exact same
`runExecution()` function — the engine code doesn't need to know it's
being called from a worker instead of a request handler.

### 39. How would you distribute workers?
**Short answer:** Stateless workers pulling from the queue, each calling
`runExecution(executionId)` — since the engine rebuilds its state from
Postgres every call, any worker can pick up any execution.

### 40. How would you handle retries across workers?
**Short answer:** Retry state already lives in Postgres (`NodeExecution.attempt`),
not in worker memory, so a retry landing on a different worker than the
original attempt would work unchanged.

### 41. How would you prevent two workers executing the same node?
**Short answer:** Nothing does today — this is a named gap. A row lock on
the `Execution` (or a `SELECT FOR UPDATE`) around the "find executable,
claim, execute" step would be the real fix.

### 42. How would you implement cancellation?
**Short answer:** Already partially there — `cancelRequested` is checked
before every node step. The honest limitation: it only works because
execution runs synchronously within a request; a queue-based version needs
workers to poll or receive a cancellation signal mid-job.

### 43. How would you implement timeouts?
**Short answer:** Per-node: the Tool executor already has one
(`AbortController`, `timeoutMs`). Per-execution: `MAX_EXECUTION_DURATION_MS`
is checked every loop iteration in `run.ts`.

### 44. How would you support long-running workflows?
**Short answer:** They already can pause — Approval and Delay nodes return
`waiting` and the loop returns, resumable later. The gap is Delay nodes
don't yet have anything that automatically resumes them after the delay
elapses (no scheduler/cron calling `runExecution()` again) — Approval's
resumption is driven by a person; Delay's would need to be driven by time.

### 45. How would you implement observability?
**Short answer:** Structured `ExecutionLog` rows already exist with
timestamps and node scoping — the honest gap is metrics/tracing beyond
that (no OpenTelemetry, no dashboards).

### 46. What metrics would you collect?
**Short answer:** Execution duration by workflow, failure rate by node
type, retry counts, and queue depth once execution moves off in-process.

---

## AI / Agentic systems

### 47. Where could LLM/tool calling fit into this architecture?
**Short answer:** It already does, partially — the Agent executor calls
Anthropic's Messages API with tool definitions attached, and any requested
tool calls come back in the result. What's missing is the loop that
executes them and feeds results back for a second turn.

### 48. What is the difference between deterministic orchestration and agentic execution?
**Short answer:** In Circuit's graph, the *structure* (which node runs
next) is decided by explicit Condition logic the developer wrote. True
agentic execution would let the model itself decide the next action —
Circuit's Agent nodes are LLM calls *within* a deterministic graph, not a
model driving the graph's shape.

### 49. How would you safely execute an LLM-generated tool call?
**Short answer:** Route it through the exact same `NodeExecutor` /
`ToolConfig` path that already exists — same SSRF checks, same timeout,
same schema validation — rather than giving the model a raw shell/HTTP
escape hatch.

### 50. How would you prevent an agent from executing unauthorized tools?
**Short answer:** The `tools` array in `AgentConfig` would need to be
validated against the actual `Tool` registry entries scoped to that
workspace before ever being sent to the model, so the model can't request
a tool name that was never offered to it in the first place.

### 51. How would you handle malformed model output?
**Short answer:** `structuredOutput<T>()` on the `LLMProvider` interface
already does JSON parsing with an explicit thrown error on failure — the
Agent executor would need to catch that and either retry with a stricter
prompt or fail the node rather than silently passing through garbage.

### 52. How would you make LLM execution observable and reproducible?
**Short answer:** Log the exact prompt (after interpolation) and full
response into `NodeExecution.input`/`output` — which already happens today
via the standard executor persistence path, no special-casing needed.

---

## Code quality

### 53. What was the hardest engineering decision?
**Short answer:** Deciding to write a fake-Prisma integration test instead
of either skipping orchestration testing or claiming a unit-test suite was
"enough" — it was extra work for a test that has an asterisk on it
(not real Postgres), but it found two real bugs that no amount of unit
testing would have.

### 54. What was the most interesting bug?
**Short answer:** Bug 1 — the unreachable-branch deadlock — because both
functions involved (`findExecutableNodes`, the orchestration loop) were
individually correct; the bug was a missing function that didn't exist
yet, not a wrong one.

### 55. What would you redesign?
**Short answer:** `NodeExecutor.validate()` — I'd either wire it into the
save flow for real or remove it, rather than leave a specified-but-unused
method on the interface; right now it overstates what's connected.

### 56. What technical debt remains?
**Short answer:** The authorization sweep, the hardcoded `workspaceId`
placeholders, and loop-body re-execution — all named explicitly in Known
limitations rather than left for someone else to discover.

### 57. What did you intentionally NOT build?
**Short answer:** A job queue, multi-turn agentic tool-calling, and
Postgres LISTEN/NOTIFY for live updates — each one is a real feature with
its own design surface, and bolting on a shallow version would have cost
correctness in the parts that actually got built.

### 58. What would you do differently with another month?
**Short answer:** Real Postgres in CI (to close the biggest verification
gap), the multi-turn agent loop, and loop-body re-execution — in that
order, because the first closes a *verification* gap and the other two are
*feature* gaps, and I'd rather know what I have works before building more
on top of it.
