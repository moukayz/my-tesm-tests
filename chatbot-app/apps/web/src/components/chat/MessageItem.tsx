"use client";

import { useState } from "react";
import type { DisplayMessage } from "@/components/chat/MessageList";
import ThinkingBlock from "@/components/chat/ThinkingBlock";

type MessageItemProps = {
  message: DisplayMessage;
  isEditing: boolean;
  editDraft: string;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditDraftChange: (value: string) => void;
  onEditSubmit: () => void;
  onRetry: () => void;
};

export default function MessageItem({
  message,
  isEditing,
  editDraft,
  onEditStart,
  onEditCancel,
  onEditDraftChange,
  onEditSubmit,
  onRetry,
}: MessageItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  return (
    <div
      className={`flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm ${
        isUser
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-slate-800/80 bg-slate-950/60"
      }`}
      data-testid="message-item"
      data-role={message.role}
      data-status={message.status ?? "complete"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {isUser ? "You" : "Assistant"}
        </div>
        {isUser ? (
          <div className="flex items-center gap-2 text-xs text-amber-200">
            {isSending ? <span>Sending...</span> : null}
            {isFailed ? (
              <button
                className="rounded-full border border-amber-400/50 px-2 py-1 text-[11px] text-amber-100 hover:border-amber-300"
                type="button"
                onClick={onRetry}
                data-testid="retry-message"
              >
                Retry
              </button>
            ) : null}
            {!isFailed ? (
              <button
                className="rounded-full border border-amber-400/20 px-2 py-1 text-[11px] text-amber-100/80 hover:border-amber-300"
                type="button"
                onClick={onEditStart}
                data-testid="edit-message"
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            className="min-h-[90px] w-full rounded-lg border border-amber-400/30 bg-slate-950/70 p-3 text-sm text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            value={editDraft}
            onChange={(event) => onEditDraftChange(event.target.value)}
            data-testid="edit-message-input"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950"
              type="button"
              onClick={onEditSubmit}
              data-testid="resubmit-message"
            >
              Resubmit
            </button>
            <button
              className="rounded-lg border border-slate-700/70 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              type="button"
              onClick={onEditCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-slate-100">{message.content}</p>
      )}
      {isAssistant && message.thinking_content ? (
        <ThinkingBlock
          content={message.thinking_content}
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
        />
      ) : null}
    </div>
  );
}
