import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import ChatView from "@/components/chat/ChatView";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { useChatStore } from "@/lib/store";
import {
  addMessage,
  clearHistory,
  createBranch,
  createChat,
  getChatDetail,
  listMessages,
} from "@/lib/localDb";
import type { ChatCompletionRequest } from "@/lib/contracts";

let chatId = "";
let branchId = "";

describe("Edit flow integration", () => {
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
      title: "Edit test",
    });
    chatId = chat.id;
    const branch = await createBranch({
      chat_id: chatId,
      root_message_id: "root-a",
    });
    branchId = branch.id;
    await addMessage({
      id: "m1",
      chat_id: chatId,
      branch_id: branchId,
      role: "user",
      content: "Original question",
      created_at: new Date().toISOString(),
    });
    await addMessage({
      id: "m2",
      chat_id: chatId,
      branch_id: branchId,
      role: "assistant",
      content: "Original answer",
      created_at: new Date().toISOString(),
    });

    server.use(
      http.post("/api/v1/chat/completions:stream", async ({ request }) => {
        const body = (await request.json()) as ChatCompletionRequest;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                "event: answer\ndata: {\"token\":\"Edited response\"}\n\n"
              )
            );
            controller.enqueue(
              encoder.encode(
                "event: done\ndata: {\"completion_id\":\"c2\",\"finish_reason\":\"stop\"}\n\n"
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

  it("creates a new branch after edit", async () => {
    renderWithProviders(<ChatView chatId={chatId} />);

    const user = userEvent.setup();
    await screen.findByText(/Original question/i);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const editor = screen.getByDisplayValue(/Original question/i);
    await user.clear(editor);
    await user.type(editor, "Updated question");
    await user.click(screen.getByRole("button", { name: /resubmit/i }));

    const responses = await screen.findAllByText(/Edited response/i);
    expect(responses.length).toBeGreaterThan(0);
    await waitFor(async () => {
      const detail = await getChatDetail(chatId);
      expect(detail?.branches.length).toBe(2);
      const branchSelect = screen.getByLabelText(/branch/i) as HTMLSelectElement;
      expect(detail?.branches.map((branch) => branch.id)).toContain(
        branchSelect.value
      );
      const messages = await listMessages(chatId, branchSelect.value);
      expect(messages.length).toBeGreaterThan(1);
    });
  });
});
