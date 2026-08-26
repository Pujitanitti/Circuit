"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, KeyRound } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export type CredentialRow = { id: string; name: string; provider: string; maskedPreview: string; createdAt: string };

export function CredentialsList({ workspaceId, initial }: { workspaceId: string; initial: CredentialRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name, provider, value }),
    });
    setSubmitting(false);
    const data = await res.json();
    if (res.ok) {
      toast({ kind: "success", title: `Credential "${name}" saved` });
      setShowForm(false);
      setName(""); setProvider(""); setValue("");
      router.refresh();
    } else {
      // Honest, expected outcome right now: this route requires a signed-in
      // ADMIN session, and there's no login page wired up yet (only the API
      // route exists) — see README Known Limitations. Surfacing the real
      // error rather than pretending this succeeded.
      toast({ kind: "error", title: "Couldn't save credential", description: data.error ?? "Unknown error" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">{initial.length} stored credentials</p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white"
        >
          <Plus size={13} /> Add credential
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="panel mt-3 space-y-2.5 p-4">
          <input
            required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Anthropic API key)"
            className="w-full rounded-md border border-canvas-border bg-canvas px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
          />
          <input
            required value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Provider (e.g. anthropic)"
            className="w-full rounded-md border border-canvas-border bg-canvas px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
          />
          <input
            required type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Secret value"
            className="w-full rounded-md border border-canvas-border bg-canvas px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {initial.length === 0 && !showForm && (
          <p className="text-[13px] text-ink-muted">No credentials stored yet.</p>
        )}
        {initial.map((c) => (
          <div key={c.id} className="panel flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              <KeyRound size={14} className="text-accent" />
              <div>
                <p className="text-[13px] text-ink">{c.name}</p>
                <p className="text-[11px] text-ink-faint">{c.provider}</p>
              </div>
            </div>
            <span className="font-mono text-[12px] text-ink-muted">{c.maskedPreview}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
