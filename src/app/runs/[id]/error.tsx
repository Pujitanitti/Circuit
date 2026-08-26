"use client";

import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle size={20} className="text-state-error" />
      <p className="text-[14px] text-ink">Couldn&apos;t load this execution.</p>
      <p className="max-w-md text-[12px] text-ink-muted">{error.message}</p>
      <button onClick={() => reset()} className="mt-2 rounded-md border border-canvas-border px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink">
        Try again
      </button>
    </div>
  );
}
