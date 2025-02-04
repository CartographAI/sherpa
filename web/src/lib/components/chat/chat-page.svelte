<script lang="ts">
  import { createChatHistoryState, createChatState, createConfigState } from "$lib/appState.svelte";
  import ChatHistorySidebar from "$lib/components/chat/chat-history-sidebar.svelte";
  import ChatMessage from "$lib/components/chat/chat-message.svelte";
  import ConfigSidebar from "$lib/components/chat/config-sidebar.svelte";
  import MessageInput from "$lib/components/chat/message-input.svelte";
  import ScratchPad from "$lib/components/chat/scratch-pad.svelte";
  import { Button } from "$lib/components/ui/button";
  import { API_BASE_URL, getProviderForModelId } from "$lib/config";
  import { type CoreMessage } from "ai";
  import { CircleAlert, History, Loader, Pencil, Plus, SlidersHorizontal } from "lucide-svelte";
  import { onMount, untrack } from "svelte";
  import { toast } from "svelte-sonner";

  let isLoading: boolean = $state(false);
  let isHistoryPanelOpen = $state(false);
  let openPanel: "config" | "scratch" | null = $state(null);

  const { chatId }: { chatId?: string } = $props();

  const chat = createChatState();
  const chatHistory = createChatHistoryState();
  const config = createConfigState();

  let eventSource: EventSource | null;
  let connectionState: "connecting" | "connected" | "disconnected" = $state("connecting");
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 3;

  $effect(() => {
    if (chatId) {
      const retrievedChat = untrack(() => chatHistory.getChat(chatId));
      if (retrievedChat) chat.loadChatState(retrievedChat);
    } else {
      chat.reset();
    }
    isHistoryPanelOpen = false;
  });

  $effect(() => {
    if (!config.hasApiKeyConfigured) openPanel = "config";
  });

  function setupEventListeners(es: EventSource) {
    es.onopen = () => {
      connectionState = "connected";
      reconnectAttempts = 0;
    };

    es.onmessage = (event) => {
      try {
        console.log("received sse message:", event);
        const eventData = JSON.parse(event.data) as CoreMessage;
        if (eventData.role === "assistant" && chat.lastMessage?.role === "assistant") {
          // Replace last assistant message (received through streaming) with this full message
          chat.lastMessage.content = eventData.content;
        } else {
          chat.messages.push(eventData);
        }
        chatHistory.updateChat(chat);
      } catch (error) {
        console.error("Error processing message:", error);
        toast.error("Error processing message from server", { position: "top-center" });
      }
    };

    es.addEventListener("stream", (event) => {
      try {
        console.log("received sse stream event:", event);
        const textChunk = event.data;
        if (chat.lastMessage?.role === "assistant") {
          chat.messages[chat.messages.length - 1].content += textChunk;
        } else {
          chat.messages.push({ role: "assistant", content: textChunk });
        }
      } catch (error) {
        console.error("Error processing stream:", error);
        toast.error("Error processing stream from server", { position: "top-center" });
      }
    });

    es.onerror = (error) => {
      console.error("EventSource error:", error);
      connectionState = "disconnected";

      if (es.readyState === EventSource.CLOSED) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          toast.error(`Connection lost. Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, {
            position: "top-center",
          });

          setTimeout(() => {
            if (eventSource) eventSource.close();
            eventSource = new EventSource(API_BASE_URL + "/api/events");
            setupEventListeners(eventSource);
          }, 1000 * reconnectAttempts); // Exponential backoff
        } else {
          toast.error("Failed to maintain connection. Please refresh the page.", {
            position: "top-center",
          });
        }
      }
    };

    es.addEventListener("close", () => {
      es.close();
      connectionState = "disconnected";
    });
  }

  onMount(() => {
    connectionState = "connecting";
    eventSource = new EventSource(API_BASE_URL + "/api/events");
    setupEventListeners(eventSource);

    return () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  });

  function togglePanel(panel: "config" | "scratch", open?: boolean) {
    if (openPanel === panel && !open) openPanel = null;
    else openPanel = panel;
  }

  async function sendMessage() {
    const modelProvider = getProviderForModelId(chat.selectedModel)!;
    let apiKey;

    switch (modelProvider) {
      case "Anthropic":
        apiKey = config.apiKeys.anthropic;
        break;
      case "Gemini":
        apiKey = config.apiKeys.gemini;
        break;
      case "OpenAI":
        apiKey = config.apiKeys.openai;
        break;
      default:
        // Handle the case where modelProvider is neither "Anthropic" nor "Gemini"
        throw new Error(`Unsupported model provider: ${modelProvider}`);
    }
    if (!apiKey) {
      toast.error(`Please configure your ${modelProvider} API key to use this model`, { position: "top-center" });
      return;
    }
    isLoading = true;

    let files: string[] = [];
    if (chat.sendFiles) {
      try {
        const dirResponse = await fetch(API_BASE_URL + "/api/directory");
        const { directory } = await dirResponse.json();

        const treeResponse = await fetch(API_BASE_URL + `/api/tree?path=${encodeURIComponent(directory)}`);
        const { tree } = await treeResponse.json();

        function getAllPaths(node) {
          // Base case: if it's a file, add its path
          if (node.type === "file") {
            files.push(node.path);
          }

          // If the node has children, recursively process them
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              getAllPaths(child);
            }
          }
        }
        getAllPaths(tree);
      } catch (error) {
        console.error("Error fetching file tree:", error);
        toast.error("Failed to fetch file tree", { position: "top-center" });
      }
    }

    const requestBody = {
      userPrompt: chat.inputMessage,
      previousMessages: chat.messages,
      model: chat.selectedModel,
      modelProvider,
      apiKey,
      userFiles: files,
    };
    const inputMessageCopy = chat.inputMessage;
    chat.inputMessage = "";
    try {
      const response = await fetch(API_BASE_URL + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      isLoading = false;
      if (response.status === 202) {
      } else {
        chat.inputMessage = inputMessageCopy;
        const resJson = await response.json();
        toast.error("An error occurred: " + resJson.message, { position: "top-center" });
      }
    } catch (error) {
      isLoading = false;
      chat.inputMessage = inputMessageCopy;
      console.error("Error making POST /api/chat call:", error);
      toast.error("An error occurred, please refresh the page and try again", { position: "top-center" });
    }
  }
</script>

<div class="flex gap-2">
  <div>
    <div class="fixed top-0 left-0 p-3 z-20">
      <Button variant="secondary" onclick={() => (isHistoryPanelOpen = !isHistoryPanelOpen)}>
        <History />Chats
      </Button>
    </div>
    <ChatHistorySidebar bind:open={isHistoryPanelOpen} />
  </div>
  <div class="w-full max-w-screen-md mx-auto p-4 mb-4 space-y-6">
    {#if chat.messages.length > 0}
      <div class="space-y-2">
        {#each chat.messages as message}
          <ChatMessage {message} />
        {/each}
      </div>
    {/if}

    {#if isLoading}
      <div class="flex gap-2"><Loader class="animate-spin" /><span>Generating response</span></div>
    {/if}
    {#if connectionState === "disconnected"}
      <div class="flex gap-2"><CircleAlert /><span>Not connected to server</span></div>
    {/if}

    <MessageInput handleSubmit={sendMessage} />
  </div>
  <div class="flex flex-col h-svh">
    <div class="w-[250px]">
      <div class="fixed top-0 right-0 flex flex-row justify-end gap-2 p-3 z-20">
        <Button variant="secondary" onclick={() => chatHistory.addChat(chat)} disabled={chat.messages.length === 0}>
          Save chat
        </Button>
        <Button href="/" onclick={() => chat.reset()}>
          <Plus />New chat
        </Button>
        <Button variant="secondary" onclick={() => togglePanel("scratch")}>
          <Pencil />Scratch
        </Button>
        <Button variant="secondary" onclick={() => togglePanel("config")}>
          <SlidersHorizontal />Config
        </Button>
      </div>
    </div>
    <ConfigSidebar bind:open={() => openPanel === "config", (value) => togglePanel("config", value)} />
    <ScratchPad bind:open={() => openPanel === "scratch", (value) => togglePanel("scratch", value)} />
  </div>
</div>
