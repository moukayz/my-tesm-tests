"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { apiFetch, ApiError, streamFetch } from "@/lib/apiClient";
import type {
  ChatCompletionRequest,
  ErrorResponse,
  ModelListResponse,
} from "@/lib/contracts";
import type { LocalChat } from "@/lib/localTypes";
import {
  clearHistory,
  createChat,
  getChatDetail,
  listChats,
  listMessages,
} from "@/lib/localDb";
import { queryKeys } from "@/lib/queryKeys";

type StreamCallbacks = {
  onThinking: (token: string) => void;
  onAnswer: (token: string) => void;
  onDone: (payload: { completion_id: string; finish_reason: string }) => void;
  onError: (error: ApiError) => void;
  onAbort?: () => void;
};

const parseSseEvent = (block: string) => {
  const lines = block.split("\n");
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.replace("event:", "").trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.replace("data:", "").trim());
    }
  }

  return {
    eventType,
    data: dataLines.join("\n"),
  };
};

const readStream = async (
  response: Response,
  callbacks: StreamCallbacks,
  signal: AbortSignal
) => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new ApiError(500, "Streaming response was empty.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let sawEvent = false;
  let receivedTerminal = false;
  let stopReading = false;

  const handleEvent = (event: { eventType: string; data: string }) => {
    if (event.eventType === "thinking") {
      sawEvent = true;
      const payload = JSON.parse(event.data) as { token: string };
      callbacks.onThinking(payload.token);
    }
    if (event.eventType === "answer") {
      sawEvent = true;
      const payload = JSON.parse(event.data) as { token: string };
      callbacks.onAnswer(payload.token);
    }
    if (event.eventType === "done") {
      sawEvent = true;
      if (receivedTerminal) {
        return;
      }
      receivedTerminal = true;
      const payload = JSON.parse(event.data) as {
        completion_id: string;
        finish_reason: string;
      };
      callbacks.onDone(payload);
      stopReading = true;
    }
    if (event.eventType === "error") {
      sawEvent = true;
      if (receivedTerminal) {
        return;
      }
      receivedTerminal = true;
      const payload = JSON.parse(event.data) as ErrorResponse;
      callbacks.onError(new ApiError(500, payload.error.message, payload));
      stopReading = true;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      const event = parseSseEvent(trimmed);
      handleEvent(event);
      if (stopReading) {
        break;
      }
    }
    if (stopReading) {
      await reader.cancel();
      break;
    }
  }

  if (!receivedTerminal && buffer.trim().length > 0) {
    const event = parseSseEvent(buffer.trim());
    handleEvent(event);
  }

  if (signal.aborted) {
    callbacks.onAbort?.();
    return;
  }

  if (!receivedTerminal) {
    if (sawEvent) {
      callbacks.onDone({
        completion_id: "stream_fallback",
        finish_reason: "stop",
      });
    } else {
      const payload: ErrorResponse = {
        error: {
          code: "STREAM_INTERRUPTED",
          message: "The stream was interrupted. Please retry.",
          request_id: "stream-unknown",
        },
      };
      callbacks.onError(new ApiError(503, payload.error.message, payload));
    }
  }
};

export const useModelsQuery = () =>
  useQuery({
    queryKey: queryKeys.models,
    queryFn: () => apiFetch<ModelListResponse>("/models"),
  });

export const useChatsQuery = () =>
  useQuery({
    queryKey: queryKeys.chats,
    queryFn: () => listChats(),
  });

export const useChatDetailQuery = (chatId?: string | null) =>
  useQuery({
    queryKey: chatId ? queryKeys.chatDetail(chatId) : ["chat", "empty"],
    queryFn: () => getChatDetail(chatId ?? ""),
    enabled: Boolean(chatId),
  });

export const useMessagesQuery = (
  chatId?: string | null,
  branchId?: string | null
) =>
  useQuery({
    queryKey: chatId ? queryKeys.messages(chatId, branchId ?? null) : ["messages"],
    queryFn: () => listMessages(chatId ?? "", branchId ?? null),
    enabled: Boolean(chatId),
  });
export const useCreateChatMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { model_id: string; title?: string }) =>
      createChat(payload),
    onSuccess: (data: LocalChat) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatDetail(data.id),
      });
    },
  });
};

export const useClearHistoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
};

export const useStreamMessage = () => {
  const abortController = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(
    async (
      payload: ChatCompletionRequest,
      callbacks: StreamCallbacks
    ) => {
      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;
      setIsStreaming(true);

      try {
        const response = await streamFetch(`/chat/completions:stream`, {
          method: "POST",
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        await readStream(response, callbacks, controller.signal);
      } catch (error) {
        if (error instanceof ApiError) {
          callbacks.onError(error);
        } else if ((error as DOMException).name === "AbortError") {
          callbacks.onAbort?.();
        } else {
          callbacks.onError(new ApiError(500, "Streaming failed."));
        }
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortController.current?.abort();
    setIsStreaming(false);
  }, []);

  return { startStream, abort, isStreaming };
};
