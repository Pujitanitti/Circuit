# Circuit — build plan

Built in vertical slices; each phase should leave the app runnable.

- [x] **Phase 1 — Foundation**
  - [x] Repo structure, TypeScript/Tailwind config
  - [x] Prisma schema (users, workspaces, workflows, versions, nodes, edges,
        executions, node_executions, logs, tools, credentials, templates)
  - [x] Design system tokens (`tailwind.config.ts`) + logo
  - [x] App shell (sidebar, topbar)
  - [x] Dashboard wired to real (currently empty) DB aggregates
  - [x] Pure DAG-traversal core + first unit tests
  - [ ] Auth (email/password + session) — next up

- [x] **Phase 2 — Workflow builder**
  - [x] React Flow canvas, custom node component (`CircuitNode`) with
        per-type icon, status dot, config summary, and branch-aware handles
        for Condition/Loop
  - [x] Node palette (searchable, click-to-add)
  - [x] Config panels for Agent, Tool, Condition (others stubbed with a
        clear "not built yet" message rather than a fake form)
  - [x] Persist graph as a new immutable `WorkflowVersion` on save
        (`POST /api/workflows/:id/versions`)
  - [x] Shared pure `validateGraph()` — runs identically client-side
        (live canvas warning) and server-side (blocks save on failure,
        422 with issue list) — missing trigger, disconnected roots,
        cycles, unreachable nodes, missing branch, per-type required
        config, loop `maxIterations` bounds
  - [x] Unit tests for validation rules
  - [ ] Workflows list page (`/workflows`) — still just `/workflows/[id]`
  - [ ] Undo/redo, multi-select, auto-layout, keyboard shortcuts — Phase 7

- [x] **Phase 3 — Execution engine**
  - [x] `engine/run.ts`: loads the active `WorkflowVersion` from Prisma,
        seeds `WorkflowState` from trigger input, traverses via
        `findExecutableNodes`, persists a `NodeExecution` row per attempt,
        and updates `Execution.state` after every step
  - [x] Real executors: Trigger, Condition (safe operand resolution, no
        `eval`), Transform (extract/template; map/filter are array
        pass-throughs pending real expression support), Delay, Output,
        Approval (pause/resume)
  - [x] Retry with exponential backoff (`retry.ts`, unit tested) — capped,
        driven by `NodeExecutor.handleError`
  - [x] Loop node: real bounded-iteration computation
        (`maxIterations`, truncation logged) — **does not yet re-execute a
        loop body per item**; that requires the engine to re-enter a
        subgraph and is tracked here, not faked. Loop always continues via
        its `"done"` handle today.
  - [x] Cancellation: `cancelRequested` checked before every node step;
        honest limitation noted in the cancel route — there's no
        queue/worker yet, so this only preempts an execution that's still
        mid-run in another concurrent request
  - [x] `POST /api/workflows/:id/execute`, `GET /api/executions/:id`,
        `POST /api/executions/:id/cancel`, `.../approve`, `.../reject`
  - [x] Agent + Tool nodes deliberately return a clear
        "not implemented yet" failure rather than a fake LLM/HTTP response
  - [ ] Real integration test (create → execute → branch → complete)
        needs a running Postgres — deferred to Phase 8 where a DB is
        available; not possible to run in this sandbox (no DB network
        access here)

- [x] **Phase 4 — LLM + tools**
  - [x] `LLMProvider` interface (`generate`, `stream`, `structuredOutput`);
        Anthropic implementation calls the real Messages API. `stream()`
        throws explicitly — not faked as a single chunk — until Phase 5's
        SSE layer makes it meaningful. OpenAI/Google are typed but throw
        "not implemented" rather than silently routing to Anthropic.
  - [x] Agent node: real single-turn LLM call with interpolated
        system/user prompts, injectable provider for testing. Tool-call
        *requests* from the model come back in `output.toolCalls` for the
        execution history to show — the engine does not yet execute them
        and loop back into another turn (documented limitation, not faked)
  - [x] Tool node (HTTP): real fetch, SSRF protection (blocks private/
        loopback/link-local ranges including the cloud metadata IP,
        resolves hostnames via DNS before allowing the request), timeout
        via AbortController, response size cap, 5xx marked retryable vs.
        4xx not
  - [x] Tool registry (`Tool` table + `/tools` page) seeded with 5 builtin
        tool definitions — only HTTP Request has a working executor;
        GitHub/Slack/Email are real schemas without an executor yet, shown
        as such rather than pretending to work
  - [x] Unit tests: SSRF range checks, Tool executor (mocked fetch, private-IP
        blocking, 4xx vs 5xx retry classification), Agent executor (mocked
        provider, prompt interpolation, tool-call surfacing, failed
        provider resolution)

- [x] **Phase 5 — Observability**
  - [x] Runs list (`/runs`) — real Prisma query, status/duration/error-count
        per row, empty state
  - [x] Execution detail (`/runs/:id`) — read-only React Flow canvas reusing
        `CircuitNode`, live-updated via SSE while running
  - [x] `GET /api/executions/:id/stream` — SSE, but **poll-and-diff against
        Postgres every 800ms, not real pub/sub** (documented honestly in
        the route and README; Postgres LISTEN/NOTIFY or a broker is real
        future work, not implemented here)
  - [x] Logs panel from `ExecutionLog`
  - [x] Replay (`POST /api/executions/:id/replay`, `mode: "full"`) and
        "replay from failed node" (`mode: "from-failed"`) — reuses every
        prior SUCCESS/SKIPPED `NodeExecution` as-is and lets the engine's
        normal resume logic pick up from the failure; pure selection logic
        unit tested in `engine/replay.test.ts`
  - [ ] Node click → full execution debugger polish (input diff view,
        state-change timeline) — current inspector shows output/error/
        attempt only

- [x] **Phase 6 — Production features**
  - [x] Auth: bcrypt password hashing, JWT session in an httpOnly cookie
        (`jose`), signup/login/logout routes
  - [x] `authorizeWorkspaceAccess()` — the one function every
        workspace-scoped route calls; applied to workflow save, workflow
        execute, and credentials routes. **Not yet swept across every
        route** (Runs list, Tools list, workflow read endpoints still
        unauthenticated) — tracked here, not silently left inconsistent
  - [x] Credential encryption: AES-256-GCM (`crypto.ts`), round-trip +
        tamper-detection + wrong-key unit tests; `createCredential` /
        `listCredentials` never return plaintext, only `maskedPreview`;
        decryption happens in exactly one function
        (`resolveCredentialForExecution`), called only by the engine
  - [x] Rate limiting: in-memory fixed-window limiter, unit tested,
        applied to signup/login (abuse) and workflow execute (cost control
        — LLM calls are billable). **Documented limitation**: in-memory
        state means this only holds for a single server instance; Redis is
        the real answer for a multi-instance deployment
  - [x] Request timeout (Tool executor's `AbortController`) and payload
        size limit (5MB) already existed from Phase 4
  - [ ] Actually wiring `resolveCredentialForExecution` into the Tool/Agent
        executors (so a Tool node can reference a saved credential by id)
        — the service exists, the executor plumbing doesn't yet

- [x] **Phase 7 — Polish**
  - [x] Command palette (`Cmd/Ctrl+K`) — search + navigate to
        Workflows/Runs/Templates/Settings, arrow-key navigation
  - [x] Keyboard shortcuts in the builder: `Delete`, `Cmd/Ctrl+Z` /
        `+Shift+Z` (undo/redo via a real bounded history stack, unit
        tested), `Cmd/Ctrl+S` (save), `Cmd/Ctrl+Enter` (run), `?` (help
        modal listing all of them)
  - [x] Templates (`/templates`) — 4 real, runnable graphs (GitHub Issue
        Analyzer, Customer Support Classifier, Research Agent, Code Review
        Assistant), each one passes `validateGraph()` the same way a
        hand-built workflow would; "Use template" creates an actual
        `Workflow` + `WorkflowVersion` via `instantiateTemplate()`
  - [x] Workflows list (`/workflows`) with a real empty state — this was a
        gap flagged back in Phase 2's PLAN.md, closed here
  - [ ] Auto-layout, multi-select drag, node search-and-jump — not built;
        the palette's search filters *available node types*, not existing
        canvas nodes
  - [ ] `workspaceId` is still a hardcoded empty string in the "new
        workflow" and "use template" client calls — named directly in
        those files' own TODO comments, this is the same auth-sweep gap
        from Phase 6, not new scope creep hidden here

- [x] **Phase 8 — Testing + docs**
  - [x] `engine/run.integration.test.ts` — an in-memory Prisma fake
        exercising `runExecution` end-to-end (linear success, Condition
        branching, non-retryable failure). **This is not the real Postgres
        integration test** the earlier phases deferred — that item stays
        unchecked below, since this sandbox has no DB network access (see
        the test file's own comment). It's real coverage of the
        orchestration logic itself, which is more than nothing.
  - [x] **Two real bugs found and fixed while writing that test**, not
        hypothetical ones caught by inspection:
        1. `findExecutableNodes` correctly excluded a Condition's untaken
           branch, but nothing ever marked that node `SKIPPED` — so a
           node on the losing branch never entered `completed` and the
           whole execution stalled. Fixed by adding `findSkippedNodes` to
           `graph.ts` (unit tested) and calling it every loop iteration in
           `run.ts` before computing what's executable.
        2. The Trigger node was seeded directly into the `completed` map
           with a fabricated result instead of actually running through
           its executor — so it never got a `NodeExecution` row and would
           have silently shown as never-run in the execution debugger.
           Fixed by routing root nodes through the same `runNodeWithRetry`
           path as everything else.
  - [x] Unit tests across validation, DAG traversal (now including skip
        detection), condition evaluation, variable resolution, retry
        backoff, loop bounds, SSRF ranges, credential crypto, rate
        limiting, role authorization, undo/redo history, and every
        builtin template — **72 tests total, all passing** (`npm test`)
  - [ ] Real Postgres integration test (create → execute → branch →
        complete against an actual database) — genuinely deferred, not
        run anywhere in this repo's history
  - [ ] E2E test on the seeded demo workflow — needs a browser + running
        app + database, none of which this sandbox has; not attempted
  - [x] Architecture diagrams (Mermaid) added to README
  - [x] PLAN.md kept in sync with what's actually built at every phase,
        including this one

## Interview talking points this unlocks

Each phase maps to one of the "how does X work" questions in the brief —
tracked so nothing gets built without a clear answer behind it. See
README.md for the ones Phase 1 already answers (versioning, credential
security, future-scale path).

---

## Audit pass — GitHub / interview-readiness (post-Phase-8)

Performed after all 8 phases were marked complete, per the "do not rebuild,
audit what exists" brief. Findings and fixes:

**Real bugs/gaps found and fixed:**
1. `npm run lint` had no ESLint config at all — would have failed
   immediately on a fresh clone. Added `eslint.config.mjs`; lint now runs
   clean (0 errors, 2 harmless warnings on config files).
2. `npx tsc --noEmit` had never actually been run against this repo. Ran
   it and triaged every error by hand: ~12 were real bugs (unsafe
   array/regex-match indexing under `noUncheckedIndexedAccess` in
   `history.ts`, `validateGraph.ts`, `state.ts`, `simple.ts`, `run.ts`,
   `run.integration.test.ts`, `crypto.test.ts`; two unused imports in the
   approve/reject routes) — all fixed. The rest are artifacts of the
   Prisma client never being generated in this sandbox (no network path to
   `binaries.prisma.sh`) — documented as an explicit, named verification
   gap rather than either faked or silently ignored.
3. `NodeExecutor.validate(config, availableVariables)` declared a required
   second parameter that no implementation and no call site anywhere in
   the app ever used — `validateGraph()` does all real validation
   independently. Made the parameter optional and documented the gap
   between what the interface specifies and what's actually wired up
   (see README's Engineering tradeoffs table).
4. `package.json`'s `seed` script pointed at `prisma/seed.ts`, which did
   not exist — `npm run seed` would have failed immediately. Wrote a real
   seed script that creates a demo workspace/user and calls the
   already-existing (but until now, never-invoked) `seedBuiltinTools()`
   and `seedBuiltinTemplates()` service functions. Also added the
   `"prisma": { "seed": ... }` field to package.json so `prisma db seed`
   resolves correctly per Prisma's own convention.

**Documentation added:**
- README rewritten: elevator pitch, capability table, project structure,
  example workflow/execution, engineering deep dive (DAG execution,
  branching, retries, persistence, trigger execution, integration
  testing), a polished bug story for both Phase-8 bugs, an engineering
  tradeoffs table, a consolidated Known Limitations section, a
  verification matrix distinguishing unit/integration/not-tested, and
  honest commands/env docs.
- `INTERVIEW.md` added — 58 questions across architecture, orchestration,
  persistence, security, testing, system design, and agentic/LLM systems,
  each answered against this specific implementation.

**Repository hygiene checked:** no secrets, no `.env` committed, no
`console.log` left in `src/`, `.gitignore` correct, no dead debug files.
TODO comments in the codebase are intentional documented gaps (matching
README's Known Limitations), not hidden debt.

**Not done, and why:** did not add a real Postgres integration test or an
E2E test — both need infrastructure (DB network access, a browser) this
sandbox doesn't have. Did not build loop-body re-execution or multi-turn
agentic tool-calling — both are named, scoped-out feature gaps, and adding
either now would be adding features mid-audit rather than auditing what
exists, which the brief explicitly said not to do.

---

## UI audit pass — premium developer tool pass

Performed after the GitHub/interview-readiness audit, per the "audit the
existing UI, don't rebuild the backend" brief. No backend orchestration
behavior was changed — only real, functionality-connected UI work plus two
small, justified additions (a workflow-rename endpoint, a recent-executions
query) needed to back real UI, not decorative ones.

**Real "dead button" bugs found and fixed** (the audit brief explicitly
prohibits these, and there were two):
1. `Topbar.tsx` rendered Run/Deploy buttons with no `onClick` at all, plus
   a hardcoded `saveState="unsaved"` that never reflected reality, while
   Canvas had its own separate working save button — two headers, one
   fake. Consolidated into one real header in `Canvas.tsx`; deleted the
   now-fully-dead `Topbar.tsx`.
2. The dashboard's empty-state "Create workflow" / "Browse templates"
   were `<button>` elements with no handlers at all. Converted to real
   links matching the pattern already correct on the Workflows page.

**Real functionality added to support legitimate UI (not decoration):**
- `PATCH /api/workflows/:id` — the workflow name field in the builder was
  about to be an editable input with nowhere for the edit to go; this
  makes renaming actually persist instead of silently doing nothing.
- `getRecentExecutions()` in the dashboard service — real Prisma query
  backing the new recent-executions table, no fabricated rows.

**UI improvements:**
- Toast system (real context/hook/viewport), wired into every previously-
  silent action: Canvas save/run, ExecutionDebugger replay, TemplateCard
  use-template (including the template's known workspaceId limitation
  now surfacing as a real error toast instead of a button that just stops
  spinning).
- Execution debugger: real header stats (duration, node counts by status,
  all computed from data already passed in), duration/timestamps in the
  node detail panel, visual muting (opacity + dashed edge) of skipped
  nodes so the untaken Condition branch is visually distinct from "hasn't
  run yet" — making Bug 1's fix visible in the UI — and a
  `ConditionResult` panel showing the evaluated left/operator/right and
  which branch was taken, using real `NodeExecution.output`.
- Workflow library: real client-side search/sort over server-fetched
  data, including last-execution-status per workflow.
- Loading skeletons (`loading.tsx`) for `/`, `/workflows`, `/runs`,
  `/runs/[id]`; a real `error.tsx` boundary for the execution detail route.
- Global `:focus-visible` outline restored — most interactive elements set
  `outline-none` for their click state, which also strips keyboard focus
  visibility; added back for keyboard navigation only.

**Verified:** 72/72 tests pass; lint 0 errors; `tsc --noEmit` shows no new
errors beyond the same pre-existing Prisma-generation artifacts documented
in the README before this pass (confirmed by diffing the error list).

**Not verified — no browser available in this sandbox:** actual rendering,
click-through interaction, responsive behavior at tablet/laptop widths,
animation smoothness, and screenshot capture. Everything above is verified
by code/type/test inspection only.

**Not done this pass** (named, not hidden): command-style node picker
beyond the existing searchable palette, a workflow-template structure
preview, additional global shortcuts (`/`, `N`), broader micro-interaction
polish, and a full accessibility audit beyond the focus-visible fix and
existing color+text status indicators.

---

## Debugger/execution-visibility pass (9/10 attempt)

Performed per the "verify browser first, then deepen the execution
debugger" brief. Browser verification was attempted for real, not assumed
unavailable:

- `npx playwright install chromium --with-deps` was actually run. It
  failed on a forbidden apt repo (`deb.nodesource.com` → 403), consistent
  with the documented network allowlist.
- Confirmed no Postgres reachable (`localhost:5432` connection refused)
  and `prisma generate` still can't reach `binaries.prisma.sh`.
- Conclusion, evidenced not assumed: **the app cannot be started in this
  sandbox**, so no phase of this pass claims browser verification.

**Real changes, all backed by actual data:**
- `conditionExecutor` now returns `resolvedLeft`/`resolvedRight` (the
  actual post-`{{path}}` values, not the raw config strings) alongside the
  existing `result`/`handle` — a small, backward-compatible engine change,
  covered by a new test (`condition.test.ts`).
- `ConditionResult` panel now shows Expression vs. Resolved vs. Result —
  using the new real fields, not fabricated.
- `NodeDetailTabs` replaces the old flat sidebar with Output/State/Logs
  tabs. Deliberately **not** a separate "Input" tab — `NodeExecution.input`
  is the exact same `WorkflowState` object as what "State" would show, so
  presenting them as two different tabs would have been misleading; this
  is documented in the component itself.
- `ExecutionTimeline` — a real chronological view of `ExecutionLog` rows
  with computed relative offsets; clicking an event opens that node's
  detail tabs. No synthetic events invented; if the engine didn't log it,
  it isn't here.
- `maxAttempts` in the failure view is `DEFAULT_MAX_ATTEMPTS` (3) — the
  actual constant `run.ts` uses, threaded through from `retry.ts`, not a
  hardcoded UI value.
- `PreflightModal` — real validation gate before Run, reusing the exact
  `validateGraph()` the canvas already runs. Confirm is disabled while
  issues exist. Explicitly does **not** show a fake "Credentials
  available" checkmark — Tool/Agent node configs don't reference a stored
  `Credential` by id in the current schema, so there's nothing real to
  check yet; this is stated in the component's own comment rather than
  faked.

**Verified:** 73/73 tests pass (added one). Lint 0 errors. `tsc --noEmit`
shows the same six pre-existing Prisma-generation-artifact errors as
before this pass — confirmed by diff, no new errors introduced.

**Not done this pass**, named rather than hidden: multi-clause AND
conditions (the spec's example shows multiple clauses; the actual
`ConditionConfig` schema only supports one — extending it would be a real
schema/executor/UI change across several files, scoped out rather than
half-built); canvas hero-experience items (multi-select, copy/paste,
context menu, auto-layout, snap-to-grid); version history UX (list/
restore/compare — the backend data exists, no UI or API for it yet); the
three new demo workflows; a full accessibility pass beyond the existing
focus-visible fix and color+text status indicators; responsive-width
verification (can't be verified without a browser); a large-graph (30–50
node) performance test (would need the app actually running).

---

## Light-mode / premium redesign pass

Performed per the "light-first premium product" brief. This sandbox still
has no browser (unchanged from the prior pass's verified finding), so
everything here is verified by tests/lint/types only, plus real HTTP-level
confirmation from the user's own local run (see below).

**Real bug found via the user's own local testing** (not by me): the
sidebar linked to `/agents`, `/credentials`, `/settings`, none of which
had a page — confirmed by actual Next.js server logs showing 404s. Fixed
in the prior turn by removing the dead links; this pass goes further and
builds real pages for two of the three:

- **`/settings`** — real `Workspace` fields (name, slug, member/workflow
  counts), explicitly states workspace-switching isn't wired up rather
  than faking a switcher.
- **`/credentials`** — real listing via the existing `listCredentials()`
  service (was fully built in an earlier pass but never had a page). The
  add-credential form posts to the real, already-existing
  `POST /api/credentials` route; since no login page exists yet, this is
  expected to fail with a real 401/403 until session plumbing lands — the
  UI surfaces that as a toast rather than pretending to succeed.
- **`/agents`** — deliberately NOT added. There's no standalone Agent
  registry entity in the schema (Agent *nodes* live inside workflows) —
  building a page here would be empty or fabricated, so it's named as an
  intentional omission rather than silently missing.

**Design system**: `tailwind.config.ts` token VALUES changed from dark to
light; token NAMES unchanged (`canvas`, `ink`, `accent`, `state.*`) so
every existing component's className strings kept working without a
per-file rewrite. New `node.*` tokens added matching the requested
semantic mapping (trigger=blue, agent=violet, tool=cyan, condition=amber,
transform=indigo, approval=orange, output=emerald) — also updated in
`NODE_TYPE_META`, the single source both the canvas and the node palette
read from. Hardcoded dark hex literals in ReactFlow's `Background`/
`MiniMap` props (which don't take Tailwind classes) and in `Logo.tsx` were
found and updated — the old logo's center dot (`#E7E9F0`) would have been
invisible on the new white background; caught by direct code review, not
inference.

**Templates**: mini graph previews now render the ACTUAL stored
`position`/`type` data for each of the 4 builtin templates, scaled into a
small SVG — not a decorative stand-in. Branch count is a real computed
value (count of `CONDITION`-type nodes), not fabricated.

**Tools**: grouped into real categories (Core / Integrations) with an
honest "Available" vs. "Schema only" badge — only HTTP Request has a
working executor, and this is now visible per-card instead of only in the
page's subtitle text.

**Empty states**: added a schematic workflow illustration (Trigger→Agent→
Condition→branches) used only in empty states — explicitly not presented
as a real workflow, no fabricated name or stats attached to it.

**Bug found and fixed during this pass's own typecheck**: `MiniGraphPreview.tsx`
had a real `noUncheckedIndexedAccess` violation (same class of bug as the
Phase-8 audit found elsewhere) — fixed with the same "safe: derived from
the same array" pattern used throughout the codebase.

**Verified:** 73/73 tests pass. Lint 0 errors. `tsc --noEmit` — after
fixing the one new real error above — is back to exactly the same six
pre-existing Prisma-generation artifacts as every prior pass, confirmed by
diff.

**Not done this pass**, named rather than hidden: full canvas hero-experience
items (multi-select, copy/paste, context menu, auto-layout, snap-to-grid);
Runs page visual pass beyond automatic token inheritance; command palette
already existed from an earlier phase, not rebuilt; a full accessibility
re-audit for the new light contrast ratios (colors were chosen for AA
contrast on white by design — emerald/amber/cyan/rose all darkened from
their dark-mode values — but not measured with a contrast-checking tool);
responsive-width verification (still no browser).

---

## Second polish pass — multi-select + real contrast audit

Browser access re-checked and confirmed still unavailable (no binary, and
the egress proxy explicitly returns `host_not_allowed` for the Playwright
CDN) — fresh evidence, not assumed carried over from the prior pass.
Focused remaining effort on the two items with the highest real value per
unit of honestly-completable work.

**Builder power features (Phase 2)** — the key insight: multi-select
mostly already worked structurally, just wasn't being read. React Flow
fires "select" `NodeChange` events for Ctrl/Cmd-click and Shift-drag box
select automatically, regardless of a custom `onNodeClick`; those flow
through `applyNodeChanges` (already wired in `onNodesChange`) and update
each node's `.selected` flag. The only missing piece was deriving
`selectedIds` from that real flag instead of a separate hand-rolled
single-select state. Added on top of that real foundation:
- Copy/paste/duplicate — `Cmd/Ctrl+C/V/D`, extracted into a pure,
  unit-tested `remapForPaste()` (id remapping, position offset, dangling-edge
  filtering) so the logic isn't buried inside a React component
- `Cmd/Ctrl+A` select all, `Esc` clear selection
- Delete/Backspace now operate over the full multi-selection, not just one
  node
- A small multi-select toolbar (count + Duplicate/Delete) appears only
  when >1 node is selected

**Real accessibility contrast audit (Phase 13)** — did not assume the
light palette from the prior pass was accessible; wrote
`scripts/contrast-audit.mjs`, a real WCAG 2.1 contrast-ratio calculator
run against the actual hex values in `tailwind.config.ts`. First run found
**4 real failures**: `ink-faint` (2.46:1, failing even the lenient 3:1
bar), `accent-cyan`, `state-success`, and `state-warning` (each ~3.2-3.6:1
against the required 4.5:1 for their actual small-text usage in logs,
timelines, and status badges). All four were corrected by computing (not
guessing) darker values that clear the bar while preserving hue, then
re-running the script — `ink-faint` needed two iterations because the
first fix passed against `surface` (#FFFFFF) but not the slightly darker
`canvas` (#F7F8FC) background. Final run: **18/18 pairings pass**, node
accent colors correctly held to the lower 3:1 "UI component" bar (icon/
border-scale use) vs. 4.5:1 for actual body text.

**Verified:** 77/77 tests pass (4 new, for the extracted clipboard logic).
Lint 0 errors. `tsc --noEmit` — identical to every prior pass, the same
six pre-existing Prisma-generation artifacts, confirmed by diff.

**Not done this pass**, named rather than hidden: auto-layout, node
alignment guides, snap-to-grid, connection validation beyond what React
Flow does by default, execution-debugger visual pass beyond what the
color-token swap inherited automatically, Runs page dedicated polish, and
— still — any actual rendered/browser verification.

**One more real bug found and fixed while writing this section**: Escape
was wired only to clear canvas selection — with a modal (Shortcuts help,
Preflight) open, pressing Escape would silently clear the selection
underneath it instead of closing the modal. Fixed to close whichever modal
is open first, falling back to clearing selection only when none is.

---

## Third polish pass — undo/redo tests, snap-to-grid, alignment, error handling audit

Browser still unavailable (not re-attempted a full install this pass — the
environment hasn't changed since the last two verified checks, so
re-running an identical failed command would burn effort without new
information). Nothing below is claimed as browser-verified.

**Architectural change (Section 14):** extracted all graph mutation logic
out of `Canvas.tsx` into pure functions in `graphActions.ts`
(`addNodeAction`, `deleteNodesAction`, `connectAction`,
`updateNodeConfigAction`, `pasteAction`, `alignNodesAction`,
`snapPosition`). `Canvas.tsx`'s callbacks are now thin wrappers: call an
action, `commit()` the result. This is what makes the explicitly-requested
undo/redo tests possible without a browser or component-testing
framework — `graphActions.test.ts` combines these pure actions with the
real `history.ts` push/undo/redo and directly tests: undo/redo add,
undo/redo delete (including that edges come back with the node, not just
the node), undo/redo edge creation, multi-node delete+undo, and
undo/redo align. 22 new tests total between this file and
`escapeHandling.test.ts`.

**Snap-to-grid**: real toggle in the header, wired through React Flow's
own `snapToGrid`/`snapGrid` props (not a fake visual effect) plus applied
on drag-stop via the same `snapPosition()` used by the tests.

**Alignment helpers**: Left/Center/Top/Middle, shown only when 2+ nodes
are selected, computed from real node positions
(`alignNodesAction`), fully undoable through the same history mechanism
as everything else — verified by the `undo align` test above.

**A real limitation found via the paste tests themselves**: repeatedly
pasting the *same* clipboard contents lands every paste on the identical
offset (they'd stack exactly on top of each other) — each paste is offset
from the *original* copy, not from the previous paste. Duplicate
(`Cmd/Ctrl+D`) does NOT have this problem, because it re-reads the live
selection each time, which itself becomes the new selection after each
duplicate. This is documented directly in the test file
(`graphActions.test.ts`) rather than silently left as a surprise.

**Error-handling audit (Section 10)** — found and fixed two real silent
failures, not hypothetical ones:
1. `workflows/new/page.tsx` — on a failed workflow-creation request, the
   page previously just sat on "Creating workflow…" forever with zero
   indication anything went wrong. Now shows a real error state with the
   actual server message and a way back.
2. `useExecutionStream.ts` — an SSE `error` event closed the connection
   with no signal to the user; the debugger would just silently stop
   updating. Fixed by returning `connectionLost` and showing it in the
   debugger header. **This surfaced a second, subtler bug while fixing the
   first**: `EventSource` can't distinguish "the server closed the
   connection because the execution finished" from "the connection died" —
   without proactively closing client-side on a terminal status, *every
   successful execution* would have shown a spurious "connection lost"
   warning right at the end. Fixed by closing the connection ourselves the
   moment a terminal status snapshot arrives.

**NOT_EXECUTED vs SKIPPED (Section 7)**: added a genuine `not_executed`
status, distinct from both `idle` ("Ready" — correct wording only while a
workflow hasn't run at all) and `skipped` (a real, recorded outcome from
the engine — the losing branch of a Condition, which gets its own
`NodeExecution` row since the Bug 1 fix). A node with no execution row at
all, in a run that has already reached a terminal status, now reads "Not
executed" instead of the previously-misleading "Ready".

**Condition result model (Section 8)**: audited, no change needed — the
UI already reads `resolvedLeft`/`resolvedRight`/`result`/`handle`
directly from the condition executor's real output (added two passes
ago); it was never recalculating this client-side.

**Runs page (Section 9)**: added real search (workflow name or execution
id), status filter, workflow filter, and sort (recent/duration/name) —
`RunsTable.tsx`, same client-component-over-server-fetched-data pattern
already used for the workflow library. All filter options are derived
from the actual data, not a hardcoded list.

**Verified:** 99/99 tests pass (22 new). Lint 0 errors. `tsc --noEmit`
unchanged — the same six pre-existing Prisma-generation artifacts,
confirmed by diff, nothing new.

**Not done this pass**, named rather than hidden: dialog focus-trapping
(modals close on Escape/backdrop-click correctly, but focus isn't
programmatically moved into the modal on open or restored to the trigger
element on close — a real, incomplete accessibility item); tooltips on
icon-only buttons beyond the `aria-label`/`title` pairs already present;
duplicate-paste-offset-stacking (documented above, not fixed — fixing it
well means deciding cascading-offset semantics, which is a small design
decision better made deliberately than rushed); and, still, any actual
rendered/browser verification.

---

## Final hardening + documentation pass

Per the explicit "final pass before manual browser QA" brief. Investment
this pass: real jsdom + `@testing-library/react` test infrastructure,
added specifically because it unlocked genuine regression tests for the
two things named most explicitly as incomplete (dialog focus trapping,
SSE lifecycle) rather than leaving them as implemented-but-unverified.

**Real bugs found and fixed:**
1. Cascading paste offset — repeated `Cmd/Ctrl+V` of the same clipboard
   used to stack every paste at the identical position; now offsets
   40/80/120px via a paste-count ref, reset on each fresh copy.
2. Getting jsdom+RTL working surfaced two real environment-specific
   bugs: Vitest's esbuild wasn't transforming JSX at all (because
   `tsconfig.json` sets `jsx: "preserve"` for Next.js, which Vitest's
   esbuild transform respects by default) — fixed via `esbuild.jsx:
   "automatic"` scoped to the test runner only. And no `afterEach(cleanup)`
   was registered, so DOM leaked between tests — fixed in
   `vitest.setup.ts`.
3. Two genuinely unused dependencies (`framer-motion`, `tailwind-merge`)
   found by grepping for actual imports — neither was ever imported
   anywhere in `src/`. Removed.
4. A JSON syntax error (trailing comma + duplicate `devDependencies` key)
   introduced while removing the above — caught immediately by validating
   the file before moving on, not left broken for the next session to
   find.

**New regression coverage:**
- `useFocusTrap.test.tsx` — 4 tests, real jsdom DOM focus assertions:
  focus-on-open, Tab wraparound, Shift+Tab wraparound, focus-restoration-
  on-close. Wired into `ShortcutsHelp` and `PreflightModal`.
- `useExecutionStream.test.tsx` — 6 tests against a fake `EventSource`
  (jsdom has none natively): clean success close, clean failure close,
  genuine connection-loss detection, unmount cleanup, no-reaction-after-
  unmount, and null-executionId opens no connection. This directly
  re-verifies the prior pass's false-connection-lost fix with an actual
  regression test instead of only a code comment.
- `graphActions.test.ts` extended with tests distinguishing the pure
  function's stateless offset behavior from the cascading mechanism
  Canvas.tsx now implements on top of it.

**README rewritten** (707 lines) per the detailed spec in this pass's
brief — every section derived from the actual repo (package.json, schema,
routes) rather than from memory, cross-checked: dependency list pulled
fresh, model count and names pulled fresh, all 8 internal anchor links
verified against real headings.

**Verified:** 110/110 tests pass (14 new this pass). Lint 0 errors.
`tsc --noEmit` — same six pre-existing baseline artifacts, confirmed by
diff, no new errors.

**Not done**, named per the brief's own explicit exclusions: auto-layout
(explicitly excluded from this pass), billing/teams/collaboration/
notifications/marketplace (explicitly excluded scope-creep items), real
Postgres integration testing, E2E browser tests, and — per the brief's
own Part 29 — no browser verification was claimed or attempted, since the
environment is unchanged from prior verified checks.

**Stop condition honored**: per this pass's explicit instruction, no
further features were added after the above was complete. The
recommended next step, matching the brief's own conclusion, is manual
browser QA.
