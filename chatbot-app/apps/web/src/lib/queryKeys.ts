export const queryKeys = {
  models: ["models"] as const,
  chats: ["chats"] as const,
  chatDetail: (chatId: string) => ["chat", chatId] as const,
  messages: (chatId: string, branchId: string | null) =>
    ["messages", chatId, branchId] as const,
};
