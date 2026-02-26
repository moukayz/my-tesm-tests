"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ChatHeader from "@/components/chat/ChatHeader";
import Composer from "@/components/chat/Composer";
import MessageList, { type DisplayMessage } from "@/components/chat/MessageList";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  useChatDetailQuery,
  useMessagesQuery,
  useModelsQuery,
  useStreamMessage,
} from "@/lib/apiHooks";
import { isApiError } from "@/lib/apiClient";
import {
  addMessage,
  addMessages,
  buildLocalMessage,
  createBranch,
  createLocalId,
  deleteDraft,
  getDraft,
  getNowIso,
  saveDraft,
  updateChat,
} from "@/lib/localDb";
import type { ChatMessage } from "@/lib/contracts";
import type { LocalMessage } from "@/lib/localTypes";
import { queryKeys } from "@/lib/queryKeys";
import { useChatStore } from "@/lib/store";

type ChatViewProps = {
  chatId: string;
};

export default function ChatView({ chatId }: ChatViewProps) {
  const queryClient = useQueryClient();
  const {
    draftByChatId,
    modelOverrideByChatId,
    pendingMessage,
    isStreaming,
    selectedBranchId,
    setDraft,
    setModelOverride,
    setPendingMessage,
    setSelectedBranchId,
    setSelectedChatId,
    setStreaming,
    resetStreamState,
  } = useChatStore();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [streamAnswer, setStreamAnswer] = useState("");
  const [streamError, setStreamError] = useState<unknown>(null);
  const [streamStatus, setStreamStatus] = useState<
    "streaming" | "error" | "cancelled" | null
  >(null);
  const streamThinkingRef = useRef("");
  const streamAnswerRef = useRef("");
  const { data: chatDetail, isLoading: chatLoading, error: chatError } =
    useChatDetailQuery(chatId);
  const { data: messagesData } = useMessagesQuery(chatId, selectedBranchId);
  const { data: modelsData } = useModelsQuery();
  const { startStream, abort } = useStreamMessage();

  const draft = draftByChatId[chatId] ?? "";
  const modelOverride = modelOverrideByChatId[chatId] ?? null;
  const models = modelsData?.models ?? [];
  const chat = chatDetail?.chat ?? null;
  const branches = chatDetail?.branches ?? [];

  useEffect(() => {
    setSelectedChatId(chatId);
    setStreamError(null);
    setStreamThinking("");
    setStreamAnswer("");
    setStreamStatus(null);
    return () => {
      resetStreamState();
    };
  }, [chatId, resetStreamState, setSelectedChatId]);

  useEffect(() => {
    if (!branches.length) {
      return;
    }
    if (!selectedBranchId) {
      setSelectedBranchId(branches[branches.length - 1]?.id ?? null);
    }
  }, [branches, selectedBranchId, setSelectedBranchId]);

  useEffect(() => {
    let active = true;
    if (!chatId) {
      return undefined;
    }
    getDraft(chatId)
      .then((storedDraft) => {
        if (!active) {
          return;
        }
        if (storedDraft?.content && !draftByChatId[chatId]) {
          setDraft(chatId, storedDraft.content);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [chatId, draftByChatId, setDraft]);

  useEffect(() => {
    if (!chat) {
      return;
    }
    const handle = window.setTimeout(() => {
      if (draft.trim().length > 0) {
        saveDraft(chat.id, draft).catch(() => undefined);
      } else {
        deleteDraft(chat.id).catch(() => undefined);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [chat, draft]);

  useEffect(() => () => abort(), [abort]);

  const baseMessages = messagesData ?? [];

  const displayMessages = useMemo<DisplayMessage[]>(() => {
    const list: DisplayMessage[] = baseMessages.map((message) => ({
      ...message,
      status: pendingMessage?.id === message.id ? pendingMessage.status : undefined,
    }));
    if (
      pendingMessage &&
      pendingMessage.chatId === chatId &&
      !list.some((message) => message.id === pendingMessage.id)
    ) {
      list.push({
        id: pendingMessage.id,
        chat_id: pendingMessage.chatId,
        branch_id: pendingMessage.branchId ?? "",
        role: "user",
        content: pendingMessage.content,
        created_at: new Date().toISOString(),
        status: pendingMessage.status,
      });
    }
    if (
      isStreaming ||
      streamAnswer ||
      streamThinking ||
      streamStatus === "error" ||
      streamStatus === "cancelled"
    ) {
      list.push({
        id: "assistant-stream",
        chat_id: chatId,
        branch_id: selectedBranchId ?? "",
        role: "assistant",
        content: streamAnswer || " ",
        thinking_content: streamThinking || " ",
        created_at: new Date().toISOString(),
        status: streamStatus ?? "streaming",
      });
    }
    return list;
  }, [baseMessages, chatId, isStreaming, pendingMessage, selectedBranchId, streamAnswer, streamStatus, streamThinking]);

  const selectedModelId = modelOverride ?? chat?.model_id ?? models[0]?.id ?? null;

  const handleModelChange = (value: string) => {
    if (!chat) {
      return;
    }
    setModelOverride(chat.id, value === chat.model_id ? null : value);
  };

  const buildChatPayload = (messages: LocalMessage[]): ChatMessage[] =>
    messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const buildBranchClone = (messages: LocalMessage[], branchId: string) => {
    const idMap = new Map<string, string>();
    return messages.map((message) => {
      const newId = createLocalId("msg");
      idMap.set(message.id, newId);
      return {
        ...message,
        id: newId,
        branch_id: branchId,
        parent_message_id: message.parent_message_id
          ? idMap.get(message.parent_message_id)
          : undefined,
        edit_of_message_id: message.edit_of_message_id
          ? idMap.get(message.edit_of_message_id)
          : undefined,
      };
    });
  };

  const handleSend = async (
    content: string,
    options?: { editOfMessage?: LocalMessage; retryMessageId?: string }
  ) => {
    if (!chat || !selectedModelId) {
      return;
    }

    if (isStreaming) {
      abort();
      if (pendingMessage) {
        setPendingMessage({
          ...pendingMessage,
          status: "cancelled",
        });
      }
    }

    setStreamError(null);
    setStreamThinking("");
    setStreamAnswer("");
    setStreamStatus("streaming");
    streamThinkingRef.current = "";
    streamAnswerRef.current = "";
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}`;
    setStreaming(true, requestId);
    const existingMessage = options?.retryMessageId
      ? baseMessages.find((message) => message.id === options.retryMessageId)
      : null;
    let branchId = selectedBranchId;
    let payloadMessages = baseMessages;
    let userMessageId = existingMessage?.id ?? createLocalId("msg");
    let parentMessageId = existingMessage?.parent_message_id;

    if (options?.editOfMessage) {
      const historyMessages = baseMessages;
      const newBranchId = createLocalId("branch");
      const clonedMessages = buildBranchClone(historyMessages, newBranchId);
      const rootId = clonedMessages[0]?.id ?? userMessageId;
      await createBranch({
        id: newBranchId,
        chat_id: chat.id,
        root_message_id: rootId,
      });
      await addMessages(clonedMessages);
      branchId = newBranchId;
      payloadMessages = clonedMessages;
      parentMessageId = clonedMessages[clonedMessages.length - 1]?.id;
      setSelectedBranchId(newBranchId);
    }

    if (!branchId) {
      const newBranchId = createLocalId("branch");
      await createBranch({
        id: newBranchId,
        chat_id: chat.id,
        root_message_id: userMessageId,
      });
      branchId = newBranchId;
      setSelectedBranchId(newBranchId);
      payloadMessages = [];
    }

    if (!existingMessage) {
      const newMessage = buildLocalMessage({
        id: userMessageId,
        chat_id: chat.id,
        branch_id: branchId,
        role: "user",
        content,
        parent_message_id: parentMessageId,
        edit_of_message_id: options?.editOfMessage?.id,
        model_id_override: modelOverride ?? undefined,
      });
      await addMessage(newMessage);
      payloadMessages = [...payloadMessages, newMessage];
      const nextTitle =
        chat.title || content.trim().slice(0, 64) || "Untitled chat";
      const timestamp = getNowIso();
      const updates: {
        title?: string;
        updated_at: string;
        last_message_at: string;
      } = {
        updated_at: timestamp,
        last_message_at: timestamp,
      };
      if (!chat.title) {
        updates.title = nextTitle;
      }
      await updateChat(chat.id, updates);
      setDraft(chat.id, "");
      deleteDraft(chat.id).catch(() => undefined);
    }

    setPendingMessage({
      id: userMessageId,
      chatId: chat.id,
      branchId,
      content,
      status: "sending",
      parentMessageId,
      editOfMessageId: options?.editOfMessage?.id,
      modelIdOverride: modelOverride ?? undefined,
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.chats });
    queryClient.invalidateQueries({
      queryKey: queryKeys.messages(chat.id, branchId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.chatDetail(chat.id),
    });

    await startStream(
      {
        model_id: selectedModelId,
        messages: buildChatPayload(payloadMessages),
      },
      {
        onThinking: (token) => {
          streamThinkingRef.current += token;
          setStreamThinking(streamThinkingRef.current);
        },
        onAnswer: (token) => {
          streamAnswerRef.current += token;
          setStreamAnswer(streamAnswerRef.current);
        },
        onDone: async () => {
          const assistantMessage = buildLocalMessage({
            chat_id: chat.id,
            branch_id: branchId,
            role: "assistant",
            content: streamAnswerRef.current,
            thinking_content: streamThinkingRef.current,
            parent_message_id: userMessageId,
          });
          await addMessage(assistantMessage);
          const timestamp = getNowIso();
          await updateChat(chat.id, {
            updated_at: timestamp,
            last_message_at: timestamp,
          });
          setStreaming(false, null);
          setPendingMessage(null);
          setStreamError(null);
          setStreamStatus(null);
          setStreamThinking("");
          setStreamAnswer("");
          queryClient.invalidateQueries({ queryKey: queryKeys.chats });
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages(chat.id, branchId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.chatDetail(chat.id),
          });
        },
        onError: (error) => {
          setStreaming(false, null);
          setStreamStatus("error");
          setPendingMessage((current) =>
            current
              ? {
                  ...current,
                  status: "failed",
                }
              : current
          );
          setStreamError(error);
        },
        onAbort: () => {
          setStreaming(false, null);
          setStreamStatus("cancelled");
          setPendingMessage((current) =>
            current
              ? {
                  ...current,
                  status: "cancelled",
                }
              : current
          );
        },
      }
    );
  };

  const handleEditStart = (message: DisplayMessage) => {
    setEditingMessageId(message.id);
    setEditDraft(message.content);
  };

  const handleEditSubmit = async (message: DisplayMessage) => {
    await handleSend(editDraft, { editOfMessage: message });
    setEditingMessageId(null);
    setEditDraft("");
  };

  const handleRetry = (message: DisplayMessage) => {
    handleSend(message.content, { retryMessageId: message.id });
  };

  if (chatLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner label="Loading chat" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="p-6">
        <ErrorNotice
          title="Chat unavailable"
          error={isApiError(chatError) ? chatError.payload : null}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        chat={chat}
        branches={branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        models={models}
        selectedModelId={selectedModelId}
        onModelChange={handleModelChange}
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {streamError ? (
            <ErrorNotice
              title="Streaming interrupted"
              error={isApiError(streamError) ? streamError.payload : null}
              compact
            />
          ) : null}
          {displayMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/40 px-6 py-10 text-center text-sm text-slate-300">
              Send the first message to start this chat.
            </div>
          ) : (
            <MessageList
              messages={displayMessages}
              editingMessageId={editingMessageId}
              editDraft={editDraft}
              onEditStart={handleEditStart}
              onEditCancel={() => {
                setEditingMessageId(null);
                setEditDraft("");
              }}
              onEditDraftChange={setEditDraft}
              onEditSubmit={handleEditSubmit}
              onRetry={handleRetry}
            />
          )}
          <div aria-live="polite" className="sr-only">
            {isStreaming ? "Assistant is responding." : ""}
          </div>
        </div>
      </div>
      <Composer
        value={draft}
        onChange={(value) => setDraft(chat.id, value)}
        onSend={() => handleSend(draft)}
        disabled={!chat || models.length === 0}
        isStreaming={isStreaming}
        models={models}
        selectedModelId={selectedModelId}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
