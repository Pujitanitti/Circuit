"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange, type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import type { NodeType } from "@prisma/client";
import { nodeTypes } from "./CircuitNode";
import { NodePalette } from "./NodePalette";
import { ConfigPanel } from "./ConfigPanel";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { PreflightModal } from "./PreflightModal";
import { validateGraph } from "./validateGraph";
import { createHistory, push, undo, redo, type History } from "./history";
import {
  addNodeAction, deleteNodesAction, connectAction, updateNodeConfigAction, pasteAction, alignNodesAction,
  snapPosition, type GraphSnapshot, type Alignment,
} from "./graphActions";
import { resolveEscapeAction } from "./escapeHandling";
import type { CircuitNodeData, NodeConfig } from "./types";
import { useToast } from "@/components/ui/Toast";

let nodeCounter = 1;
const GRID_SIZE = 20;

function defaultConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "TRIGGER": return { kind: "manual" };
    case "AGENT": return { provider: "anthropic", model: "", systemPrompt: "", userPrompt: "", temperature: 0.4, maxTokens: 1024, tools: [] };
    case "TOOL": return { method: "GET", url: "", headers: {}, timeoutMs: 10000, retry: { maxAttempts: 3, backoffMs: 1000 } };
    case "CONDITION": return { left: "", operator: "==", right: "" };
    case "TRANSFORM": return { kind: "extract", expression: "" };
    case "LOOP": return { itemsExpression: "", maxIterations: 50 };
    case "DELAY": return { seconds: 5 };
    case "APPROVAL": return { prompt: "", approvers: [] };
    case "OUTPUT": return { resultExpression: "" };
  }
}

export function Canvas({
  workflowId,
  initialWorkflowName,
  initialVersion,
}: {
  workflowId: string;
  initialWorkflowName: string;
  initialVersion: number;
}) {
  const toast = useToast();
  const [workflowName, setWorkflowName] = useState(initialWorkflowName);
  const [version, setVersion] = useState(initialVersion);
  const [history, setHistory] = useState<History<GraphSnapshot>>(() => createHistory({ nodes: [], edges: [] }));
  const { nodes, edges } = history.present;
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [running, setRunning] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("unsaved");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // Selection is derived from React Flow's own `.selected` flag on each
  // node (kept in sync via applyNodeChanges in onNodesChange below), not a
  // separate parallel id — React Flow already fires the right "select"
  // NodeChange events for Ctrl/Cmd-click and Shift-drag box select
  // regardless of a custom onNodeClick; reading `.selected` back out here
  // is the only piece that's ours.
  const selectedIds = useMemo(() => nodes.filter((n) => n.selected).map((n) => n.id), [nodes]);
  const clipboardRef = useRef<{ nodes: Node<CircuitNodeData>[]; edges: Edge[] } | null>(null);
  // Tracks how many times the CURRENT clipboard contents have been pasted,
  // so repeated Cmd/Ctrl+V of the same copy cascades outward (40px, 80px,
  // 120px, ...) instead of every paste landing on the exact same spot.
  // Resets whenever a fresh copy happens. Duplicate (Cmd+D) doesn't need
  // this — it already cascades naturally because each call re-reads the
  // live selection, which becomes the new selection after each duplicate.
  const pasteCountRef = useRef(0);

  const generateKey = useCallback((typeKey: string) => `${typeKey.toLowerCase()}_${nodeCounter++}`, []);

  // Commits a new snapshot to history (used by every structural change:
  // add/delete node, connect edge, config edit, paste, align, drag-stop).
  // Node/edge changes during an active drag skip this via the plain
  // setters below so undo doesn't record every intermediate pixel.
  const commit = useCallback((next: GraphSnapshot) => {
    setHistory((h) => push(h, next));
    setSaveState("unsaved");
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setHistory((h) => ({ ...h, present: { ...h.present, nodes: applyNodeChanges(changes, h.present.nodes) } }));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setHistory((h) => ({ ...h, present: { ...h.present, edges: applyEdgeChanges(changes, h.present.edges) } }));
  }, []);
  const onConnect = useCallback(
    (connection: Connection) => commit(connectAction(history.present, connection)),
    [commit, history.present]
  );

  const handleAddNode = useCallback((type: NodeType) => {
    const position = { x: 120 + nodes.length * 40, y: 120 + nodes.length * 30 };
    commit(addNodeAction(history.present, type, defaultConfig(type), generateKey, snapEnabled ? snapPosition(position, GRID_SIZE) : position));
  }, [nodes.length, history.present, generateKey, snapEnabled, commit]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    commit(deleteNodesAction(history.present, selectedIds));
  }, [selectedIds, history.present, commit]);

  const copySelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    clipboardRef.current = {
      nodes: nodes.filter((n) => idSet.has(n.id)),
      // Only edges fully internal to the selection get copied — an edge
      // pointing at a node that wasn't selected would dangle after paste.
      edges: edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
    };
    pasteCountRef.current = 0;
  }, [selectedIds, nodes, edges]);

  const pasteClipboard = useCallback(() => {
    if (!clipboardRef.current) return;
    pasteCountRef.current += 1;
    commit(pasteAction(history.present, clipboardRef.current, generateKey, 40 * pasteCountRef.current));
  }, [history.present, generateKey, commit]);

  const duplicateSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const source = {
      nodes: nodes.filter((n) => idSet.has(n.id)),
      edges: edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
    };
    commit(pasteAction(history.present, source, generateKey));
  }, [selectedIds, nodes, edges, history.present, generateKey, commit]);

  const alignSelection = useCallback((alignment: Alignment) => {
    if (selectedIds.length < 2) return;
    commit(alignNodesAction(history.present, selectedIds, alignment));
  }, [selectedIds, history.present, commit]);

  const selectAll = useCallback(() => {
    // Selection-only change — deliberately NOT pushed through commit(), so
    // "select all" doesn't itself become an undoable history entry (same
    // reasoning as why in-progress drags are excluded from history).
    setHistory((h) => ({ ...h, present: { ...h.present, nodes: h.present.nodes.map((n) => ({ ...n, selected: true })) } }));
  }, []);

  const clearSelection = useCallback(() => {
    setHistory((h) => ({ ...h, present: { ...h.present, nodes: h.present.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)) } }));
  }, []);

  const issues = useMemo(
    () =>
      validateGraph(
        nodes.map((n) => ({ key: n.id, type: n.data.type, data: n.data })),
        edges.map((e) => ({ sourceKey: e.source, targetKey: e.target, sourceHandle: e.sourceHandle }))
      ),
    [nodes, edges]
  );

  const selectedNode = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) ?? null : null;
  const selectedErrors = selectedNode ? issues.filter((i) => i.nodeKey === selectedNode.id).map((i) => i.message) : [];

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    const res = await fetch(`/api/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: nodes.map((n) => ({ key: n.id, type: n.data.type, label: n.data.label, config: n.data.config, position: n.position })),
        edges: edges.map((e) => ({ sourceKey: e.source, targetKey: e.target, sourceHandle: e.sourceHandle })),
      }),
    });
    setSaveState(res.ok ? "saved" : "unsaved");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.version === "number") setVersion(data.version);
      toast({ kind: "success", title: "Workflow saved", description: `Version ${data.version}` });
    } else {
      const body = await res.json().catch(() => ({}));
      toast({
        kind: "error",
        title: "Save failed",
        description: body.error === "Workflow validation failed" ? "Fix the validation issues shown on the canvas first." : body.error ?? "Unknown error",
      });
    }
  }, [workflowId, nodes, edges, toast]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    const res = await fetch(`/api/workflows/${workflowId}/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setRunning(false);
    if (res.ok) {
      setShowPreflight(false);
      toast({ kind: "success", title: "Execution started", description: "Open Runs to watch it live." });
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ kind: "error", title: "Couldn't start execution", description: body.error ?? "Unknown error" });
    }
  }, [workflowId, toast]);

  const handleRenameCommit = useCallback(async (name: string) => {
    if (!name.trim() || name === initialWorkflowName) return;
    const res = await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast({ kind: "error", title: "Rename failed", description: body.error ?? "Unknown error" });
    }
  }, [workflowId, initialWorkflowName, toast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);

      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); setHistory((h) => undo(h)); }
      if (meta && e.key.toLowerCase() === "z" && e.shiftKey) { e.preventDefault(); setHistory((h) => redo(h)); }
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); handleSave(); }
      if (meta && e.key === "Enter") { e.preventDefault(); setShowPreflight(true); }
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) { deleteSelected(); }
      if (e.key === "?" && !inInput) { setShowShortcuts(true); }
      if (meta && e.key.toLowerCase() === "c" && !inInput) { copySelection(); }
      if (meta && e.key.toLowerCase() === "v" && !inInput) { e.preventDefault(); pasteClipboard(); }
      if (meta && e.key.toLowerCase() === "d" && !inInput) { e.preventDefault(); duplicateSelection(); }
      if (meta && e.key.toLowerCase() === "a" && !inInput) { e.preventDefault(); selectAll(); }
      if (e.key === "Escape" && !inInput) {
        // Priority is resolved by a pure, directly-tested function
        // (escapeHandling.ts) — a modal open over the canvas always wins
        // over clearing selection underneath it.
        const action = resolveEscapeAction({ showShortcuts, showPreflight });
        if (action === "close-shortcuts") setShowShortcuts(false);
        else if (action === "close-preflight") setShowPreflight(false);
        else clearSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, deleteSelected, copySelection, pasteClipboard, duplicateSelection, selectAll, clearSelection, showShortcuts, showPreflight]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-canvas-border bg-canvas-surface px-4">
        <div className="flex items-center gap-3">
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            onBlur={(e) => handleRenameCommit(e.target.value)}
            aria-label="Workflow name"
            className="bg-transparent text-[13px] font-medium text-ink outline-none focus:underline"
          />
          <span className="rounded-full border border-canvas-border px-2 py-0.5 text-[11px] text-ink-faint">
            v{version}
          </span>
          <SaveIndicator state={saveState} />
          {issues.length > 0 && (
            <span className="text-[11px] text-state-warning">
              {issues.length} validation {issues.length === 1 ? "issue" : "issues"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSnapEnabled((s) => !s)}
            aria-pressed={snapEnabled}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
              snapEnabled ? "border-accent bg-accent/10 text-accent" : "border-canvas-border text-ink-faint hover:text-ink"
            }`}
          >
            Snap to grid
          </button>
          <button
            onClick={() => rfInstance.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 })}
            aria-label="Reset view"
            className="rounded-md border border-canvas-border px-2 py-1.5 text-[11px] text-ink-faint hover:text-ink"
          >
            Reset view
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            aria-label="Keyboard shortcuts"
            className="rounded-md border border-canvas-border px-2 py-1.5 text-[11px] text-ink-faint hover:text-ink"
          >
            ?
          </button>
          <button
            onClick={() => setShowPreflight(true)}
            className="flex items-center gap-1.5 rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink"
          >
            Run
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent/90"
          >
            Save version
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAdd={handleAddNode} />

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(instance) => { rfInstance.current = instance; }}
            onNodeDragStop={(_, draggedNode) => {
              // Snap only applies at drag-END (not live during drag) so the
              // node doesn't visually jump mid-drag — it settles onto the
              // grid once released, which reads as intentional rather than
              // jittery. When disabled this is just a normal commit.
              const finalNodes = snapEnabled
                ? history.present.nodes.map((n) => (n.id === draggedNode.id ? { ...n, position: snapPosition(n.position, GRID_SIZE) } : n))
                : history.present.nodes;
              commit({ nodes: finalNodes, edges: history.present.edges });
            }}
            nodeTypes={nodeTypes}
            snapToGrid={snapEnabled}
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            fitView
          >
            <Background color="#DCE0EA" gap={GRID_SIZE} size={1.5} />
            <Controls className="!bg-canvas-surface !border-canvas-border [&>button]:!bg-canvas-surface [&>button]:!border-canvas-border [&>button]:!text-ink-muted" />
            <MiniMap
              className="!bg-canvas-surface"
              maskColor="rgba(28,31,42,0.06)"
              nodeColor={() => "#6D5AE6"}
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-[14px] text-ink">Empty canvas</p>
              <p className="text-[12px] text-ink-muted">Add a Trigger node from the left panel to get started.</p>
            </div>
          )}

          {selectedIds.length > 1 && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-[12px] text-ink-muted shadow-panelHover">
              <span>{selectedIds.length} nodes selected</span>
              <span className="text-canvas-border">|</span>
              <button onClick={() => alignSelection("left")} aria-label="Align left" title="Align left" className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-canvas-raised hover:text-ink">Left</button>
              <button onClick={() => alignSelection("center")} aria-label="Align center" title="Align center" className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-canvas-raised hover:text-ink">Center</button>
              <button onClick={() => alignSelection("top")} aria-label="Align top" title="Align top" className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-canvas-raised hover:text-ink">Top</button>
              <button onClick={() => alignSelection("middle")} aria-label="Align middle" title="Align middle" className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-canvas-raised hover:text-ink">Middle</button>
              <span className="text-canvas-border">|</span>
              <button onClick={duplicateSelection} className="text-ink-muted hover:text-ink">Duplicate</button>
              <button onClick={deleteSelected} className="text-state-error hover:text-state-error/80">Delete</button>
            </div>
          )}
        </div>

        {selectedNode && (
          <ConfigPanel
            node={selectedNode.data}
            errors={selectedErrors}
            onChange={(config) => commit(updateNodeConfigAction(history.present, selectedNode.id, config))}
            onClose={clearSelection}
          />
        )}
      </div>

      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      {showPreflight && (
        <PreflightModal
          version={version}
          nodeCount={nodes.length}
          issues={issues}
          onCancel={() => setShowPreflight(false)}
          onConfirm={handleRun}
          running={running}
        />
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: "saved" | "saving" | "unsaved" }) {
  if (state === "saved") return <span className="text-[11px] text-state-success">Saved</span>;
  if (state === "saving") return <span className="text-[11px] text-ink-faint">Saving…</span>;
  return <span className="text-[11px] text-state-warning">Unsaved changes</span>;
}
