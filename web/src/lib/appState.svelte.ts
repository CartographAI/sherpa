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

// Gets first 50 characters of the first non-empty assistant text message
function getSnippet(messages: CoreMessage[]): string {
  for (const message of messages) {
    if (message.role === "assistant" && message.content) {
      const content = message.content;
      if (typeof content === "string" && content.trim() !== "") {
        return content.slice(0, 50);
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "text" && part.text && part.text.trim() !== "") {
            return part.text.slice(0, 50);
          }
        }
      }
    }
  }
  return "New chat";
}

class ChatHistoryState {
  chats: StoredChat[] = $state(JSON.parse(localStorage.getItem("chatHistory") || "[]"));

  constructor() {
    $effect(() => {
      localStorage.setItem("chatHistory", JSON.stringify(this.chats));
    });
  }

  addChat(chat: ChatState) {
    const storedChat: StoredChat = {
      id: chat.id,
      snippet: getSnippet(chat.messages),
      messages: chat.messages,
    };
    this.chats.unshift(storedChat);
  }

  updateChat(chat: ChatState) {
    const existingIndex = this.chats.findIndex((c) => c.id === chat.id);

    if (existingIndex === -1) {
      this.addChat(chat);
    } else {
      const existingChat = this.chats[existingIndex];
      const storedChat: StoredChat = {
        id: chat.id,
        snippet: existingChat.snippet.length > 10 ? existingChat.snippet : getSnippet(chat.messages),
        messages: chat.messages,
      };

      this.chats[existingIndex] = storedChat;
    }
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
