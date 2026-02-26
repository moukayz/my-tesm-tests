import MessageItem from "@/components/chat/MessageItem";
import type { LocalMessage } from "@/lib/localTypes";

export type DisplayMessage = LocalMessage & {
  status?: "sending" | "failed" | "cancelled" | "streaming" | "error";
  tempId?: string;
};

type MessageListProps = {
  messages: DisplayMessage[];
  editingMessageId: string | null;
  editDraft: string;
  onEditStart: (message: DisplayMessage) => void;
  onEditCancel: () => void;
  onEditDraftChange: (value: string) => void;
  onEditSubmit: (message: DisplayMessage) => void;
  onRetry: (message: DisplayMessage) => void;
};

export default function MessageList({
  messages,
  editingMessageId,
  editDraft,
  onEditStart,
  onEditCancel,
  onEditDraftChange,
  onEditSubmit,
  onRetry,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      {messages.map((message) => (
        <MessageItem
          key={message.id ?? message.tempId}
          message={message}
          isEditing={editingMessageId === message.id}
          editDraft={editDraft}
          onEditStart={() => onEditStart(message)}
          onEditCancel={onEditCancel}
          onEditDraftChange={onEditDraftChange}
          onEditSubmit={() => onEditSubmit(message)}
          onRetry={() => onRetry(message)}
        />
      ))}
    </div>
  );
}
