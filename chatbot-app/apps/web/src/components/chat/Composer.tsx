"use client";

import ModelSelector from "@/components/chat/ModelSelector";
import type { Model } from "@/lib/contracts";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isStreaming: boolean;
  models: Model[];
  selectedModelId: string | null;
  onModelChange: (value: string) => void;
};

export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  isStreaming,
  models,
  selectedModelId,
  onModelChange,
}: ComposerProps) {
  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div className="border-t border-slate-800/80 bg-slate-950/70 px-4 py-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div className="hidden md:block">
          <ModelSelector
            models={models}
            selectedId={selectedModelId}
            onChange={onModelChange}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <textarea
            className="min-h-[90px] flex-1 rounded-xl border border-slate-700/60 bg-slate-950/70 p-3 text-sm text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="Ask anything. Use Shift+Enter for a new line."
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled || isStreaming}
            data-testid="chat-composer"
          />
          <button
            className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            data-testid="send-message"
          >
            {isStreaming ? "Streaming..." : "Send"}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Streaming status updates are announced for screen readers.
        </p>
      </div>
    </div>
  );
}
