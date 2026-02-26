"use client";

import { useChatStore } from "@/lib/store";

export default function TopBar() {
  const { setSidebarOpen } = useChatStore();

  return (
    <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/80 text-slate-200 hover:border-amber-400/50 md:hidden"
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open chat history"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <div>
          <div className="font-display text-lg font-semibold text-white">Signal Chat</div>
          <div className="text-xs text-slate-400">Streaming workspace</div>
        </div>
      </div>
      <div className="text-xs text-slate-300">
        Local-only chat history
      </div>
    </header>
  );
}
