import { type CoreMessage } from "ai";
import { getContext, setContext } from "svelte";
import { defaultModel } from "./config";

interface ApiKeys {
  anthropic?: string;
  gemini?: string;
}

interface StoredChat {
  id: string;
  snippet: string;
  messages: CoreMessage[];
}

class ChatState {
  id: string = $state(crypto.randomUUID());
  messages: CoreMessage[] = $state([]);
  isLoading = $state(false);
  inputMessage = $state("");
  selectedModel = $state(localStorage.getItem("modelId") || defaultModel);
  sendFiles = $state(false);

  constructor() {
    $effect(() => {
      localStorage.setItem("modelId", this.selectedModel);
    });
  }

  get lastMessage() {
    if (this.messages.length === 0) return null;
    return this.messages[this.messages.length - 1];
  }

  loadChatState(storedChat: StoredChat) {
    this.id = storedChat.id;
    this.messages = storedChat.messages;
    this.isLoading = false;
  }

  reset() {
    this.id = crypto.randomUUID();
    this.messages = [];
    this.isLoading = false;
  }
}

export function createChatState(): ChatState {
  const chatState = new ChatState();
  return setContext("chat", chatState);
}

export function useChat(): ChatState {
  return getContext("chat");
}

class ChatHistoryState {
  chats: StoredChat[] = $state(JSON.parse(localStorage.getItem("chatHistory") || "[]"));

  constructor() {
    $effect(() => {
      localStorage.setItem("chatHistory", JSON.stringify(this.chats));
    });
  }

  addChat(chat: ChatState) {
    let snippet: string;
    const assistantMessageContent = chat.messages.find((m) => m.role === "assistant")?.content;
    if (assistantMessageContent == undefined) snippet = "New chat";
    else if (typeof assistantMessageContent === "string") snippet = assistantMessageContent.slice(0, 50);
    else {
      snippet = assistantMessageContent.find((part) => part.type === "text")?.text.slice(0, 50) ?? "New chat";
    }
    const storedChat: StoredChat = {
      id: chat.id,
      snippet: snippet,
      messages: chat.messages,
    };
    this.chats.unshift(storedChat);
  }

  getChat(id: string) {
    return this.chats.find((chat) => chat.id === id);
  }

  deleteChat(id: string) {
    this.chats = this.chats.filter((chat) => chat.id !== id);
  }
}

export function createChatHistoryState(): ChatHistoryState {
  const historyState = new ChatHistoryState();
  return setContext("chatHistory", historyState);
}

export function useChatHistory(): ChatHistoryState {
  return getContext("chatHistory");
}

class ConfigState {
  apiKeys: ApiKeys = $state(JSON.parse(localStorage.getItem("apiKeys") || "{}"));
  hasApiKeyConfigured = $derived(this.apiKeys.anthropic || this.apiKeys.gemini);

  setApiKey(provider: "anthropic" | "gemini", key: string) {
    this.apiKeys[provider] = key;
    localStorage.setItem("apiKeys", JSON.stringify(this.apiKeys));
  }
}

export function createConfigState(): ConfigState {
  const configState = new ConfigState();
  return setContext("config", configState);
}

export function useConfig(): ConfigState {
  return getContext("config");
}
