import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MessageItem from "@/components/chat/MessageItem";
import type { DisplayMessage } from "@/components/chat/MessageList";

const message: DisplayMessage = {
  id: "m1",
  chat_id: "chat-1",
  branch_id: "b1",
  role: "user",
  content: "Hello world",
  created_at: new Date().toISOString(),
};

describe("MessageItem", () => {
  it("shows edit flow for user messages", async () => {
    const user = userEvent.setup();
    const onEditStart = vi.fn();
    const onEditCancel = vi.fn();
    const onEditDraftChange = vi.fn();
    const onEditSubmit = vi.fn();

    const { rerender } = render(
      <MessageItem
        message={message}
        isEditing={false}
        editDraft=""
        onEditStart={onEditStart}
        onEditCancel={onEditCancel}
        onEditDraftChange={onEditDraftChange}
        onEditSubmit={onEditSubmit}
        onRetry={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEditStart).toHaveBeenCalled();

    rerender(
      <MessageItem
        message={message}
        isEditing
        editDraft="Updated"
        onEditStart={onEditStart}
        onEditCancel={onEditCancel}
        onEditDraftChange={onEditDraftChange}
        onEditSubmit={onEditSubmit}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Updated")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resubmit/i }));
    expect(onEditSubmit).toHaveBeenCalled();
  });
});
