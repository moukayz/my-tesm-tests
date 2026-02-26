import { create } from "zustand";

export type PendingMessage = {
  id: string;
  chatId: string;
  branchId: string | null;
  content: string;
  status: "sending" | "failed" | "cancelled";
  parentMessageId?: string;
  editOfMessageId?: string;
  modelIdOverride?: string;
};

type ChatUiState = {
  selectedChatId: string | null;
  selectedBranchId: string | null;
  draftByChatId: Record<string, string>;
  modelOverrideByChatId: Record<string, string | null>;
  pendingMessage: PendingMessage | null;
  isStreaming: boolean;
  streamRequestId: string | null;
  sidebarOpen: boolean;
  setSelectedChatId: (chatId: string | null) => void;
  setSelectedBranchId: (branchId: string | null) => void;
  setDraft: (chatId: string, value: string) => void;
  setModelOverride: (chatId: string, value: string | null) => void;
  setPendingMessage: (message: PendingMessage | null) => void;
  setStreaming: (isStreaming: boolean, requestId?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  resetStreamState: () => void;
  resetChatState: () => void;
};

export const useChatStore = create<ChatUiState>((set) => ({
  selectedChatId: null,
  selectedBranchId: null,
  draftByChatId: {},
  modelOverrideByChatId: {},
  pendingMessage: null,
  isStreaming: false,
  streamRequestId: null,
  sidebarOpen: false,
  setSelectedChatId: (chatId) => set({ selectedChatId: chatId }),
  setSelectedBranchId: (branchId) => set({ selectedBranchId: branchId }),
  setDraft: (chatId, value) =>
    set((state) => ({
      draftByChatId: {
        ...state.draftByChatId,
        [chatId]: value,
      },
    })),
  setModelOverride: (chatId, value) =>
    set((state) => ({
      modelOverrideByChatId: {
        ...state.modelOverrideByChatId,
        [chatId]: value,
      },
    })),
  setPendingMessage: (message) => set({ pendingMessage: message }),
  setStreaming: (isStreaming, requestId = null) =>
    set({ isStreaming, streamRequestId: requestId }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  resetStreamState: () =>
    set({ isStreaming: false, streamRequestId: null, pendingMessage: null }),
  resetChatState: () =>
    set({
      selectedChatId: null,
      selectedBranchId: null,
      draftByChatId: {},
      modelOverrideByChatId: {},
      pendingMessage: null,
      isStreaming: false,
      streamRequestId: null,
    }),
}));
