import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import ChatView from "@/components/chat/ChatView";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { useChatStore } from "@/lib/store";
import {
  clearHistory,
  createChat,
  createBranch,
  addMessage,
  getChatDetail,
  listMessages,
} from "@/lib/localDb";
import type { ChatCompletionRequest } from "@/lib/contracts";

let chatId = "";

describe("Chat flow integration", () => {
  beforeEach(() => {
    useChatStore.setState({
      selectedChatId: null,
      selectedBranchId: null,
      draftByChatId: {},
      modelOverrideByChatId: {},
      pendingMessage: null,
      isStreaming: false,
      streamRequestId: null,
      sidebarOpen: false,
    });
  });

  beforeEach(async () => {
    await clearHistory();
    const chat = await createChat({
      model_id: "gpt-4o-mini",
      title: "Stream test",
    });
    chatId = chat.id;

    server.use(
      http.post("/api/v1/chat/completions:stream", async ({ request }) => {
        const body = (await request.json()) as ChatCompletionRequest;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                "event: thinking\ndata: {\"token\":\"Planning...\"}\n\n"
              )
            );
            controller.enqueue(
              encoder.encode(
                "event: answer\ndata: {\"token\":\"Hello from stream\"}\n\n"
              )
            );
            controller.enqueue(
              encoder.encode(
                "event: done\ndata: {\"completion_id\":\"c1\",\"finish_reason\":\"stop\"}\n\n"
              )
            );
            controller.close();
          },
        });

        if (!body.messages.length) {
          throw new Error("Expected messages payload");
        }

        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      })
    );
  });

  it("streams a response and renders thinking block", async () => {
    renderWithProviders(<ChatView chatId={chatId} />);

    const user = userEvent.setup();
    const input = await screen.findByPlaceholderText(/ask anything/i);
    await user.type(input, "Hello there");
    await user.click(screen.getByRole("button", { name: /send/i }));

    const thinkingBlocks = await screen.findAllByText("Thinking");
    expect(thinkingBlocks.length).toBeGreaterThan(0);
    const responses = await screen.findAllByText(/Hello from stream/i);
    expect(responses.length).toBeGreaterThan(0);

    await waitFor(async () => {
      const detail = await getChatDetail(chatId);
      const branchId = detail?.branches[0]?.id ?? null;
      expect(branchId).toBeTruthy();
      const messages = await listMessages(chatId, branchId);
      expect(messages).toHaveLength(2);
    });
  });

  it("restores local history after remount", async () => {
    const branch = await createBranch({
      chat_id: chatId,
      root_message_id: "root-1",
    });
    await addMessage({
      id: "m1",
      chat_id: chatId,
      branch_id: branch.id,
      role: "user",
      content: "Persisted hello",
      created_at: new Date().toISOString(),
    });
    await addMessage({
      id: "m2",
      chat_id: chatId,
      branch_id: branch.id,
      role: "assistant",
      content: "Persisted answer",
      created_at: new Date().toISOString(),
    });

    const view = renderWithProviders(<ChatView chatId={chatId} />);
    await screen.findByText(/Persisted hello/i);
    view.unmount();

    renderWithProviders(<ChatView chatId={chatId} />);
    await screen.findByText(/Persisted answer/i);
  });
});
