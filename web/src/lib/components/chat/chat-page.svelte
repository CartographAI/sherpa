<script lang="ts">
  import { createChatHistoryState, createChatState, createConfigState } from "$lib/appState.svelte";
  import ChatMessage from "$lib/components/chat/chat-message.svelte";
  import ConfigSidebar from "$lib/components/chat/config-sidebar.svelte";
  import MainSidebar from "$lib/components/chat/main-sidebar.svelte";
  import MessageInput from "$lib/components/chat/message-input.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { API_BASE_URL, getProviderForModelId } from "$lib/config";
  import { type CoreMessage } from "ai";
  import { CircleAlert, Loader } from "lucide-svelte";
  import { onMount, untrack } from "svelte";
  import { toast } from "svelte-sonner";

  let isLoading: boolean = $state(false);
  let openPanel: "config" | null = $state(null);
  let fileTree: any = $state(null);
  let totalFileTokens: number | null = $state(null);

  const { chatId }: { chatId?: string } = $props();

  const chat = createChatState();
  const chatHistory = createChatHistoryState();
  const config = createConfigState();
  let currentAllowedDirectory: string | null = $state(null);

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
            eventSource = new EventSource(`${API_BASE_URL}/api/events/${chat.id}`);
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

  async function getWorkingDirectory() {
    const dirResponse = await fetch(API_BASE_URL + "/api/directory");
    const { directory } = await dirResponse.json();
    currentAllowedDirectory = directory;
    if (!chat.workingDirectory) chat.workingDirectory = directory;
  }

  async function fetchFileTree() {
    if (!chat.workingDirectory) return;

    try {
      const treeResponse = await fetch(API_BASE_URL + `/api/tree?path=${encodeURIComponent(chat.workingDirectory)}`);
      const { tree } = await treeResponse.json();
      fileTree = tree;
    } catch (error) {
      console.error("Error fetching file tree:", error);
      toast.error("Failed to fetch file tree", { position: "top-center" });
    }
  }

  async function fetchFileTokens(filePaths: string[]) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/file-tokens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paths: filePaths }),
        }
      );
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      const data = await response.json();
      totalFileTokens = data.count;
    } catch (error) {
      console.error("Error fetching file tokens:", error);
      toast.error("Failed to fetch file tokens", { position: "top-center" });
    }
  }

  onMount(async () => {
    await getWorkingDirectory();
    await fetchFileTree();
    fetchFileTokens([]); // Initialize with empty array
  });

  $effect(() => {
    connectionState = "connecting";
    eventSource = new EventSource(`${API_BASE_URL}/api/events/${chat.id}`);
    setupEventListeners(eventSource);

    return () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  });

  function togglePanel(panel: "config", open?: boolean) {
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
        getAllPaths(fileTree);
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
    let errorMessage: string | null = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/${chat.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      isLoading = false;
      if (response.status === 202) {
      } else {
        const resJson = await response.json();
        errorMessage = "An error occurred: " + resJson.message;
      }
    } catch (error) {
      isLoading = false;
      console.error("Error making POST /api/chat call:", error);
      errorMessage = "An error occurred, please refresh the page and try again";
    }
    if (errorMessage !== null) {
      toast.error(errorMessage, { position: "top-center", duration: 12000 });
      // Try to reset chat state to before POST call
      if (chat.messages.length && chat.messages[chat.messages.length - 1].role === "user") {
        chat.messages = chat.messages.slice(0, chat.messages.length - 1);
        chat.inputMessage = inputMessageCopy;
      }
    }
  }

  // Call fetchFileTokens when sendFiles changes
  $effect(() => {
    if (chat.sendFiles && fileTree) {
      let files: string[] = [];
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
      getAllPaths(fileTree);
      fetchFileTokens(files);
    } else {
      totalFileTokens = null;
    }
  });
</script>

<div class="flex gap-2">
  <MainSidebar toggleConfig={() => togglePanel("config")} />

  <!-- Main chat interface -->
  <div class="w-full max-w-[860px] mx-auto p-4 mb-4 space-y-6">
    {#if chat.messages.length === 0}
      <div class="text-muted-foreground p-2 pt-[10%]">
        Hi there! I'm Sherpa, your friendly codebase guide. 👋<br />
        I'm here to help you understand this codebase and assist with code-related questions.<br /><br />
        You can ask me to explain code, suggest improvements, or help with development tasks.<br />
        Just note that I can only read files in <span class="text-sm font-medium">{chat.workingDirectory}</span> - I
        can't modify any files directly.<br /><br />
        What would you like to explore today?
      </div>
    {:else}
      <div class="text-sm font-medium pt-2">Working directory: {chat.workingDirectory}</div>
      <div class="space-y-2">
        {#each chat.messages as message, index}
          <ChatMessage {message} nextMessage={index < chat.messages.length - 1 ? chat.messages[index + 1] : null} />
        {/each}
      </div>
    {/if}

    {#if isLoading}
      <div class="flex gap-2"><Loader class="animate-spin" /><span>Generating response</span></div>
    {/if}
    {#if connectionState === "disconnected"}
      <div class="flex gap-2"><CircleAlert /><span>Not connected to server</span></div>
    {/if}

    {#if currentAllowedDirectory === chat.workingDirectory}
      <MessageInput handleSubmit={sendMessage} {totalFileTokens} />
    {:else}
      <div class="flex gap-2">
        <CircleAlert />
        <span>
          Cannot continue chat because this chat's working directory
          <span class="text-sm font-medium pt-2">{chat.workingDirectory}</span>
          is different from Sherpa's current working directory
          <span class="text-sm font-medium pt-2">{currentAllowedDirectory}</span>.
        </span>
      </div>
    {/if}
  </div>

  <!-- Right sidebar (config) -->
  <div class="flex flex-col h-svh">
    <Sidebar.Provider style="--sidebar-width: 500px" class="flex-1" open={openPanel != null}>
      <Sidebar.Root side="right" variant="floating">
        {#if openPanel === "config"}
          <ConfigSidebar bind:open={() => openPanel === "config", (value) => togglePanel("config", value)} />
        {/if}
      </Sidebar.Root>
    </Sidebar.Provider>
  </div>
</div>
