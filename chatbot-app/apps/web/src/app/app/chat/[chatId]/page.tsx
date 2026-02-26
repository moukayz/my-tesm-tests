"use client";

import { useParams } from "next/navigation";
import ChatView from "@/components/chat/ChatView";

export default function ChatPage() {
  const params = useParams();
  const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;

  if (!chatId) {
    return null;
  }

  return <ChatView chatId={chatId} />;
}
