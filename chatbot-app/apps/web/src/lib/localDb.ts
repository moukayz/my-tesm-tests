import type {
  LocalBranch,
  LocalChat,
  LocalChatDetail,
  LocalDraft,
  LocalMessage,
} from "@/lib/localTypes";

const DB_NAME = "chatbot-app";
const DB_VERSION = 1;

const STORES = {
  chats: "chats",
  branches: "branches",
  messages: "messages",
  drafts: "drafts",
  metadata: "metadata",
} as const;

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = () => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.chats)) {
        const store = db.createObjectStore(STORES.chats, { keyPath: "id" });
        store.createIndex("byUpdatedAt", "updated_at");
      }
      if (!db.objectStoreNames.contains(STORES.branches)) {
        const store = db.createObjectStore(STORES.branches, { keyPath: "id" });
        store.createIndex("byChatId", "chat_id");
      }
      if (!db.objectStoreNames.contains(STORES.messages)) {
        const store = db.createObjectStore(STORES.messages, { keyPath: "id" });
        store.createIndex("byChatId", "chat_id");
        store.createIndex("byBranchId", "branch_id");
      }
      if (!db.objectStoreNames.contains(STORES.drafts)) {
        db.createObjectStore(STORES.drafts, { keyPath: "chat_id" });
      }
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(STORES.metadata, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export const createChat = async (payload: {
  model_id: string;
  title?: string;
}): Promise<LocalChat> => {
  const db = await openDb();
  const chat: LocalChat = {
    id: createId("chat"),
    title: payload.title,
    model_id: payload.model_id,
    created_at: nowIso(),
    updated_at: nowIso(),
    last_message_at: undefined,
  };

  const tx = db.transaction(STORES.chats, "readwrite");
  tx.objectStore(STORES.chats).put(chat);
  await transactionDone(tx);
  return chat;
};

export const listChats = async (): Promise<LocalChat[]> => {
  const db = await openDb();
  const tx = db.transaction(STORES.chats, "readonly");
  const store = tx.objectStore(STORES.chats);
  const index = store.index("byUpdatedAt");
  const chats: LocalChat[] = [];

  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor(null, "prev");
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        chats.push(cursor.value as LocalChat);
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });

  return chats;
};

export const getChat = async (chatId: string): Promise<LocalChat | null> => {
  const db = await openDb();
  const tx = db.transaction(STORES.chats, "readonly");
  const store = tx.objectStore(STORES.chats);
  const chat = await requestToPromise(store.get(chatId));
  return (chat as LocalChat | undefined) ?? null;
};

export const getChatDetail = async (
  chatId: string
): Promise<LocalChatDetail | null> => {
  const chat = await getChat(chatId);
  if (!chat) {
    return null;
  }
  const branches = await listBranches(chatId);
  return { chat, branches };
};

export const listBranches = async (chatId: string): Promise<LocalBranch[]> => {
  const db = await openDb();
  const tx = db.transaction(STORES.branches, "readonly");
  const store = tx.objectStore(STORES.branches);
  const index = store.index("byChatId");
  const branches: LocalBranch[] = [];

  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor(IDBKeyRange.only(chatId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        branches.push(cursor.value as LocalBranch);
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });

  return branches.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export const createBranch = async (payload: {
  chat_id: string;
  root_message_id: string;
  id?: string;
  created_at?: string;
}): Promise<LocalBranch> => {
  const db = await openDb();
  const branch: LocalBranch = {
    id: payload.id ?? createId("branch"),
    chat_id: payload.chat_id,
    root_message_id: payload.root_message_id,
    created_at: payload.created_at ?? nowIso(),
  };
  const tx = db.transaction(STORES.branches, "readwrite");
  tx.objectStore(STORES.branches).put(branch);
  await transactionDone(tx);
  return branch;
};

export const listMessages = async (
  chatId: string,
  branchId: string | null
): Promise<LocalMessage[]> => {
  if (!branchId) {
    return [];
  }
  const db = await openDb();
  const tx = db.transaction(STORES.messages, "readonly");
  const store = tx.objectStore(STORES.messages);
  const index = store.index("byBranchId");
  const messages: LocalMessage[] = [];

  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor(IDBKeyRange.only(branchId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        const value = cursor.value as LocalMessage;
        if (value.chat_id === chatId) {
          messages.push(value);
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });

  return messages.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export const addMessage = async (message: LocalMessage) => {
  const db = await openDb();
  const tx = db.transaction(STORES.messages, "readwrite");
  tx.objectStore(STORES.messages).put(message);
  await transactionDone(tx);
};

export const addMessages = async (messages: LocalMessage[]) => {
  if (!messages.length) {
    return;
  }
  const db = await openDb();
  const tx = db.transaction(STORES.messages, "readwrite");
  const store = tx.objectStore(STORES.messages);
  messages.forEach((message) => store.put(message));
  await transactionDone(tx);
};

export const updateChat = async (
  chatId: string,
  updates: Partial<Pick<LocalChat, "title" | "updated_at" | "last_message_at">>
) => {
  const db = await openDb();
  const tx = db.transaction(STORES.chats, "readwrite");
  const store = tx.objectStore(STORES.chats);
  const existing = (await requestToPromise(store.get(chatId))) as LocalChat;
  if (!existing) {
    return;
  }
  const updated: LocalChat = {
    ...existing,
    ...updates,
  };
  store.put(updated);
  await transactionDone(tx);
};

export const getDraft = async (chatId: string): Promise<LocalDraft | null> => {
  const db = await openDb();
  const tx = db.transaction(STORES.drafts, "readonly");
  const store = tx.objectStore(STORES.drafts);
  const draft = await requestToPromise(store.get(chatId));
  return (draft as LocalDraft | undefined) ?? null;
};

export const saveDraft = async (chatId: string, content: string) => {
  const db = await openDb();
  const tx = db.transaction(STORES.drafts, "readwrite");
  tx.objectStore(STORES.drafts).put({
    chat_id: chatId,
    content,
    updated_at: nowIso(),
  });
  await transactionDone(tx);
};

export const deleteDraft = async (chatId: string) => {
  const db = await openDb();
  const tx = db.transaction(STORES.drafts, "readwrite");
  tx.objectStore(STORES.drafts).delete(chatId);
  await transactionDone(tx);
};

export const clearHistory = async () => {
  const db = await openDb();
  const tx = db.transaction(
    [STORES.chats, STORES.branches, STORES.messages, STORES.drafts],
    "readwrite"
  );
  tx.objectStore(STORES.chats).clear();
  tx.objectStore(STORES.branches).clear();
  tx.objectStore(STORES.messages).clear();
  tx.objectStore(STORES.drafts).clear();
  await transactionDone(tx);
};

export const buildLocalMessage = (payload: {
  id?: string;
  chat_id: string;
  branch_id: string;
  role: LocalMessage["role"];
  content: string;
  thinking_content?: string;
  parent_message_id?: string;
  edit_of_message_id?: string;
  model_id_override?: string;
  created_at?: string;
}): LocalMessage => ({
  id: payload.id ?? createId("msg"),
  chat_id: payload.chat_id,
  branch_id: payload.branch_id,
  role: payload.role,
  content: payload.content,
  thinking_content: payload.thinking_content,
  parent_message_id: payload.parent_message_id,
  edit_of_message_id: payload.edit_of_message_id,
  model_id_override: payload.model_id_override,
  created_at: payload.created_at ?? nowIso(),
});

export const getNowIso = nowIso;
export const createLocalId = createId;
