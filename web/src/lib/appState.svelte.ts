import { type CoreMessage } from "ai";
import { getContext, setContext } from "svelte";
import { defaultModel } from "./config";

interface ApiKeys {
  anthropic?: string;
  gemini?: string;
}

class ChatState {
  messages: CoreMessage[] = $state([]);
  isLoading = $state(false);
  inputMessage = $state("");
  selectedModel = $state(localStorage.getItem("modelId") || defaultModel);

  constructor() {
    $effect(() => {
      localStorage.setItem("modelId", this.selectedModel);
    });
  }

  get lastMessage() {
    if (this.messages.length === 0) return null;
    return this.messages[this.messages.length - 1];
  }
}

export function createChatState(): ChatState {
  const chatState = new ChatState();
  return setContext("chat", chatState);
}

export function useChat(): ChatState {
  return getContext("chat");
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
