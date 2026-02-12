"use client";

import React from "react";
import { cn } from "@/shared/lib/cn";

type ToastKind = "success" | "error";

type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  requestId?: string;
};

type ToastCtx = {
  push: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = React.createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 space-y-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "rounded-[calc(var(--radius)-6px)] border bg-white/90 px-4 py-3 shadow-[var(--shadow)] backdrop-blur",
              t.kind === "error" ? "border-danger/30" : "border-card-border",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {t.description}
                  </p>
                ) : null}
                {t.requestId ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted">
                      Details
                    </summary>
                    <p className="mt-1 text-xs text-muted">requestId: {t.requestId}</p>
                  </details>
                ) : null}
              </div>
              <button
                className="rounded px-2 py-1 text-xs text-muted hover:bg-black/5"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
