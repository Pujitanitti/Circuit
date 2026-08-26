"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { clsx } from "clsx";

type ToastKind = "success" | "error" | "warning" | "info";
type Toast = { id: string; kind: ToastKind; title: string; description?: string };

type ToastContextValue = { push: (toast: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info,
};
const COLORS: Record<ToastKind, string> = {
  success: "text-state-success", error: "text-state-error", warning: "text-state-warning", info: "text-accent-cyan",
};

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast_${++idCounter}`;
    setToasts((t) => [...t, { ...toast, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div
              key={toast.id}
              role="status"
              className="panel-raised pointer-events-auto flex items-start gap-2.5 p-3 animate-[toast-in_0.15s_ease-out]"
            >
              <Icon size={15} className={clsx("mt-0.5 shrink-0", COLORS[toast.kind])} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-ink">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-[11px] text-ink-muted">{toast.description}</p>}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 text-ink-faint hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Throws outside ToastProvider on purpose — a silently-missing toast is worse than a loud dev-time error. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.push;
}
