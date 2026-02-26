export type LocalChat = {
  id: string;
  title?: string;
  model_id: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
};

export type LocalBranch = {
  id: string;
  chat_id: string;
  root_message_id: string;
  created_at: string;
};

export type LocalMessage = {
  id: string;
  chat_id: string;
  branch_id: string;
  parent_message_id?: string;
  edit_of_message_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking_content?: string;
  model_id_override?: string;
  created_at: string;
};

export type LocalDraft = {
  chat_id: string;
  content: string;
  updated_at: string;
};

export type LocalChatDetail = {
  chat: LocalChat;
  branches: LocalBranch[];
};
