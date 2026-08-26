"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// TODO(Phase 6 sweep): workspaceId should come from the signed-in session
// once workspace switching exists in the UI; hardcoding it here would be
// worse than this honest placeholder that currently just fails visibly
// via the fetch error rather than silently creating orphaned workflows.
export default function NewWorkflowPage() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: "", name: "Untitled workflow" }),
        });
        const data = await res.json();
        if (data.id) {
          router.replace(`/workflows/${data.id}`);
        } else {
          // This was a real silent failure before: on error, the page
          // stayed on "Creating workflow…" forever with no indication
          // anything went wrong. Now it surfaces the actual server error.
          setError(data.error ?? "Unknown error");
          toast({ kind: "error", title: "Couldn't create workflow", description: data.error ?? "Unknown error" });
        }
      } catch {
        setError("Network request failed.");
        toast({ kind: "error", title: "Couldn't create workflow", description: "Network request failed." });
      }
    })();
  }, [router, toast]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle size={20} className="text-state-error" />
        <p className="text-[14px] text-ink">Couldn&apos;t create workflow</p>
        <p className="max-w-md text-[12px] text-ink-muted">{error}</p>
        <button
          onClick={() => router.push("/workflows")}
          className="mt-2 rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink"
        >
          Back to Workflows
        </button>
      </div>
    );
  }

  return <div className="p-8 text-[13px] text-ink-muted">Creating workflow…</div>;
}
