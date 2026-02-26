"use client";

type ThinkingBlockProps = {
  content: string;
  expanded: boolean;
  onToggle: () => void;
};

export default function ThinkingBlock({
  content,
  expanded,
  onToggle,
}: ThinkingBlockProps) {
  return (
    <div
      className="rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-300"
      data-testid="thinking-block"
    >
      <button
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-amber-200"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        data-testid="thinking-toggle"
      >
        Thinking
        <span>{expanded ? "–" : "+"}</span>
      </button>
      {expanded ? (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
          {content}
        </p>
      ) : null}
    </div>
  );
}
