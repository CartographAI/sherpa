<script lang="ts">
  import { createChatState, createConfigState } from "$lib/appState.svelte";
  import ChatMessage from "$lib/components/chat/chat-message.svelte";
  import ConfigSidebar from "$lib/components/chat/config-sidebar.svelte";
  import MessageInput from "$lib/components/chat/message-input.svelte";
  import ScratchPad from "$lib/components/chat/scratch-pad.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getProviderForModelId } from "$lib/config";
  import { type CoreMessage } from "ai";
  import { Loader, Pencil, Plus, SlidersHorizontal } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  const API_BASE_URL = "http://localhost:3031";

  let isLoading: boolean = $state(false);
  let openPanel: "config" | "scratch" | null = $state(null);

  const chat = createChatState();
  const config = createConfigState();

  $effect(() => {
    if (!config.hasApiKeyConfigured) openPanel = "config";
  });

  onMount(() => {
    console.log("creating event source");
    const eventSource = new EventSource(API_BASE_URL + "/api/events");

    eventSource.onmessage = (event) => {
      console.log("received sse message:", event);
      const eventData = JSON.parse(event.data) as CoreMessage;
      chat.messages.push(eventData);
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      // if (eventSource.readyState === EventSource.CLOSED) {
      //   console.log("Reconnecting in 1 second");
      //   setTimeout(() => {
      //     connectToEventSource();
      //   }, 1000); // Wait 1 second before reconnecting
      // }
    };
    eventSource.addEventListener("close", () => {
      console.log("closing event source");
      eventSource.close();
    });
    // TODO Cleanup event listeners
  });

  function togglePanel(panel: "config" | "scratch", open?: boolean) {
    if (openPanel === panel && !open) openPanel = null;
    else openPanel = panel;
  }

  async function sendMessage(event: SubmitEvent) {
    event.preventDefault();

    const modelProvider = getProviderForModelId(chat.selectedModel)!;
    const apiKey = modelProvider === "Anthropic" ? config.apiKeys.anthropic : config.apiKeys.gemini;
    if (!apiKey) {
      toast.error(`Please configure your ${modelProvider} API key to use this model`, { position: "top-center" });
      return;
    }
    isLoading = true;
    const requestBody = {
      userPrompt: chat.inputMessage,
      previousMessages: chat.messages,
      model: chat.selectedModel,
      modelProvider,
      apiKey,
    };
    const inputMessageCopy = chat.inputMessage;
    chat.inputMessage = "";
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
  }
</script>

<div class="flex gap-2">
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

    <MessageInput handleSubmit={sendMessage} />
  </div>
  <div class="flex flex-col h-svh">
    <div class="w-[250px]">
      <div class="fixed top-0 right-0 flex flex-row justify-end gap-2 p-3 z-20">
        <Button onclick={() => (chat.messages = [])}>
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
