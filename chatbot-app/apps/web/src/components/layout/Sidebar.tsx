"use client";

import { useRouter } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import {
  useChatsQuery,
  useClearHistoryMutation,
  useCreateChatMutation,
  useModelsQuery,
} from "@/lib/apiHooks";
import { isApiError } from "@/lib/apiClient";
import { formatChatTitle, formatTime } from "@/lib/format";
import { useChatStore } from "@/lib/store";

export default function Sidebar() {
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen, resetChatState } = useChatStore();
  const { data: chatsData, error: chatsError, isLoading } = useChatsQuery();
  const { data: modelsData } = useModelsQuery();
  const createChatMutation = useCreateChatMutation();
  const clearHistoryMutation = useClearHistoryMutation();
  const chats = chatsData ?? [];
  const models = modelsData?.models ?? [];
  const apiError = isApiError(chatsError) ? chatsError.payload : null;

  const handleCreateChat = async () => {
    if (!models.length) {
      return;
    }
    const response = await createChatMutation.mutateAsync({
      model_id: models[0].id,
    });
    setSidebarOpen(false);
    router.push(`/app/chat/${response.id}`);
  };

  const handleClearHistory = async () => {
    await clearHistoryMutation.mutateAsync();
    resetChatState();
    setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800/80 bg-slate-950/95 px-4 py-5 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              Chats
            </p>
            <p className="text-sm text-slate-400">Recent activity</p>
          </div>
          <button
            className="rounded-lg border border-amber-400/30 px-3 py-1 text-xs text-amber-100 hover:border-amber-300"
            type="button"
            onClick={handleCreateChat}
            disabled={!models.length || createChatMutation.isPending}
            data-testid="new-chat-button"
          >
            New
          </button>
        </div>
        <div className="mt-6 flex-1 space-y-3 overflow-y-auto" data-testid="chat-list">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading chats...</p>
          ) : null}
          {apiError ? <ErrorNotice title="Chat history" error={apiError} compact /> : null}
          {!isLoading && chats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800/80 px-4 py-4 text-sm text-slate-400">
              No chats yet. Start a new chat to begin.
            </div>
          ) : null}
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                router.push(`/app/chat/${chat.id}`);
              }}
              className="flex w-full flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-3 text-left transition hover:border-amber-400/50"
              data-testid="chat-list-item"
            >
              <span className="text-sm font-medium text-slate-100">
                {formatChatTitle(chat.title)}
              </span>
              <span className="text-xs text-slate-400">
                {chat.model_id} · {formatTime(chat.last_message_at ?? chat.updated_at)}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-800/80 pt-4">
          <button
            className="w-full rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-300 hover:border-amber-400/50"
            type="button"
            onClick={handleClearHistory}
            disabled={clearHistoryMutation.isPending}
            data-testid="clear-history"
          >
            {clearHistoryMutation.isPending ? "Clearing..." : "Clear history"}
          </button>
        </div>
      </aside>
    </>
  );
}
