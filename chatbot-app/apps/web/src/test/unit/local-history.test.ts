import { describe, expect, it, beforeEach } from "vitest";
import {
  addMessage,
  clearHistory,
  createBranch,
  createChat,
  getChatDetail,
  getDraft,
  listChats,
  listMessages,
  saveDraft,
} from "@/lib/localDb";

describe("local history repository", () => {
  beforeEach(async () => {
    await clearHistory();
  });

  it("creates chats and retrieves details", async () => {
    const chat = await createChat({ model_id: "gpt-4o-mini", title: "Focus" });
    const branch = await createBranch({
      chat_id: chat.id,
      root_message_id: "root-1",
    });

    const chats = await listChats();
    expect(chats).toHaveLength(1);
    expect(chats[0]?.id).toBe(chat.id);

    const detail = await getChatDetail(chat.id);
    expect(detail?.chat.id).toBe(chat.id);
    expect(detail?.branches[0]?.id).toBe(branch.id);
  });

  it("writes and reads messages by branch", async () => {
    const chat = await createChat({ model_id: "gpt-4o-mini" });
    const branch = await createBranch({
      chat_id: chat.id,
      root_message_id: "root-1",
    });

    await addMessage({
      id: "m1",
      chat_id: chat.id,
      branch_id: branch.id,
      role: "user",
      content: "Hello",
      created_at: new Date().toISOString(),
    });

    const messages = await listMessages(chat.id, branch.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("Hello");
  });

  it("persists drafts and clears history", async () => {
    const chat = await createChat({ model_id: "gpt-4o-mini" });
    await saveDraft(chat.id, "Draft note");

    const draft = await getDraft(chat.id);
    expect(draft?.content).toBe("Draft note");

    await clearHistory();
    const chats = await listChats();
    expect(chats).toHaveLength(0);
    const clearedDraft = await getDraft(chat.id);
    expect(clearedDraft).toBeNull();
  });
});
