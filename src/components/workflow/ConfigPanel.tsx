"use client";

import type { CircuitNodeData, AgentConfig, ToolConfig, ConditionConfig } from "./types";
import { NODE_TYPE_META } from "./types";

export function ConfigPanel({
  node,
  errors,
  onChange,
  onClose,
}: {
  node: CircuitNodeData;
  errors: string[];
  onChange: (config: CircuitNodeData["config"]) => void;
  onClose: () => void;
}) {
  const meta = NODE_TYPE_META[node.type]!; // safe: exhaustive Record over NodeType

  return (
    <aside className="w-80 shrink-0 border-l border-canvas-border bg-canvas-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-ink-faint">{meta.label}</p>
          <p className="text-[13px] font-medium text-ink">{node.label}</p>
        </div>
        <button onClick={onClose} className="text-[11px] text-ink-faint hover:text-ink">
          Close
        </button>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 space-y-1 rounded-md border border-state-error/30 bg-state-error/10 p-2">
          {errors.map((e, i) => (
            <p key={i} className="text-[11px] text-state-error">{e}</p>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {node.type === "AGENT" && <AgentFields config={node.config as AgentConfig} onChange={onChange} />}
        {node.type === "TOOL" && <ToolFields config={node.config as ToolConfig} onChange={onChange} />}
        {node.type === "CONDITION" && <ConditionFields config={node.config as ConditionConfig} onChange={onChange} />}
        {!["AGENT", "TOOL", "CONDITION"].includes(node.type) && (
          <p className="text-[12px] text-ink-muted">
            Configuration for {meta.label} nodes lands in a later phase — see PLAN.md.
          </p>
        )}
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-canvas-border bg-canvas px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent";

function AgentFields({ config, onChange }: { config: AgentConfig; onChange: (c: AgentConfig) => void }) {
  return (
    <>
      <Field label="Model">
        <input
          className={inputClass}
          value={config.model}
          placeholder="claude-sonnet-5"
          onChange={(e) => onChange({ ...config, model: e.target.value })}
        />
      </Field>
      <Field label="System prompt">
        <textarea
          className={inputClass}
          rows={3}
          value={config.systemPrompt}
          onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
        />
      </Field>
      <Field label="User prompt">
        <textarea
          className={inputClass}
          rows={4}
          value={config.userPrompt}
          placeholder="{{trigger.issue}}"
          onChange={(e) => onChange({ ...config, userPrompt: e.target.value })}
        />
      </Field>
      <Field label="Temperature">
        <input
          type="number" min={0} max={1} step={0.1}
          className={inputClass}
          value={config.temperature}
          onChange={(e) => onChange({ ...config, temperature: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function ToolFields({ config, onChange }: { config: ToolConfig; onChange: (c: ToolConfig) => void }) {
  return (
    <>
      <Field label="Method">
        <select
          className={inputClass}
          value={config.method}
          onChange={(e) => onChange({ ...config, method: e.target.value as ToolConfig["method"] })}
        >
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="URL">
        <input
          className={inputClass}
          value={config.url}
          placeholder="https://api.example.com/..."
          onChange={(e) => onChange({ ...config, url: e.target.value })}
        />
      </Field>
      <Field label="Timeout (ms)">
        <input
          type="number"
          className={inputClass}
          value={config.timeoutMs}
          onChange={(e) => onChange({ ...config, timeoutMs: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function ConditionFields({ config, onChange }: { config: ConditionConfig; onChange: (c: ConditionConfig) => void }) {
  return (
    <>
      <Field label="Left">
        <input
          className={inputClass}
          value={config.left}
          placeholder="{{nodes.analyzer.output.priority}}"
          onChange={(e) => onChange({ ...config, left: e.target.value })}
        />
      </Field>
      <Field label="Operator">
        <select
          className={inputClass}
          value={config.operator}
          onChange={(e) => onChange({ ...config, operator: e.target.value as ConditionConfig["operator"] })}
        >
          {["==", "!=", ">", "<", "contains"].map((op) => <option key={op}>{op}</option>)}
        </select>
      </Field>
      <Field label="Right">
        <input
          className={inputClass}
          value={config.right}
          placeholder="high"
          onChange={(e) => onChange({ ...config, right: e.target.value })}
        />
      </Field>
    </>
  );
}
