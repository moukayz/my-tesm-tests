export default function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/40 px-8 py-12 text-center">
      <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
        Ready when you are
      </div>
      <div className="max-w-xl">
        <h2 className="font-display text-2xl font-semibold text-white">
          Select or start a chat to begin.
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          Choose a previous thread from the left, or create a new chat to bring
          your next idea to life. Model selection unlocks once you have an active
          chat.
        </p>
      </div>
    </div>
  );
}
