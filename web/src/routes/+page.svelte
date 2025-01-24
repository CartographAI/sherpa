<script lang="ts">
  import ChatMessage from "$lib/components/chat/chat-message.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Textarea } from "$lib/components/ui/textarea";
  import { type CoreMessage } from "ai";
  import { Loader } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  const API_BASE_URL = "http://localhost:3031";

  let chatMessages: CoreMessage[] = $state([]);
  let isLoading: boolean = $state(false);
  let inputMessage: string = $state("");
  let apiKeys: { anthropic: string; gemini: string } = $state(JSON.parse(localStorage.getItem("apiKeys") || "{}"));

  $effect(() => {
    localStorage.setItem("apiKeys", JSON.stringify(apiKeys));
    toast.success("Saved", { position: "top-right" });
  });

  onMount(() => {
    console.log("creating event source");
    const eventSource = new EventSource(API_BASE_URL + "/api/events");

    eventSource.onmessage = (event) => {
      console.log("received sse message:", event);
      const eventData = JSON.parse(event.data) as CoreMessage;
      chatMessages.push(eventData);
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

  async function sendMessage(event: SubmitEvent) {
    event.preventDefault();
    isLoading = true;

    const requestBody = { userPrompt: inputMessage, model: "claude-3-5-sonnet-20241022", apiKey: apiKeys.anthropic };
    const inputMessageCopy = inputMessage;
    inputMessage = "";
    const response = await fetch(API_BASE_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    isLoading = false;
    if (response.status === 202) {
    } else {
      inputMessage = inputMessageCopy;
      const resJson = await response.json();
      toast.error("An error occurred: " + resJson.message, { position: "top-center" });
    }
  }
</script>

<Sidebar.Provider style="--sidebar-width: 500px">
  <Sidebar.Inset>
    <div class="">
      <div class="max-w-screen-md mx-auto p-4 mb-4 space-y-2">
        {#each chatMessages as message}
          <ChatMessage {message} />
        {/each}

        {#if isLoading}
          <div class="flex gap-2"><Loader class="animate-spin" /><span>Generating response</span></div>
        {/if}

        <form onsubmit={sendMessage} class="flex">
          <Textarea
            placeholder="Type your message..."
            name="message"
            bind:value={inputMessage}
            class="flex-grow mr-2"
          />
          <Button type="submit" disabled={isLoading}>Send</Button>
        </form>
      </div>
    </div>
  </Sidebar.Inset>
  <Sidebar.Root side="right" variant="floating">
    <Sidebar.Header>
      <Sidebar.GroupLabel>
        <div class="font-semibold text-[1rem] text-foreground">Model configuration</div>
      </Sidebar.GroupLabel>
    </Sidebar.Header>
    <Sidebar.Content>
      <Sidebar.Group class="p-4">
        <form class="space-y-6">
          <div class="flex w-full flex-col gap-1.5">
            <Label for="anthropic">Anthropic</Label>
            <p class="text-muted-foreground text-sm">
              Create an API key at <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                class="underline">https://console.anthropic.com/settings/keys</a
              >
            </p>
            <Input
              type="text"
              id="anthropic"
              placeholder="sk-ant-xxxxxxx"
              defaultValue={apiKeys.anthropic}
              onblur={(event) => {
                apiKeys.anthropic = event.currentTarget.value;
              }}
            />
          </div>
          <div class="flex w-full flex-col gap-1.5">
            <Label for="gemini">Google Gemini</Label>
            <p class="text-muted-foreground text-sm">
              Create an API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" class="underline"
                >https://aistudio.google.com/app/apikey</a
              >
            </p>
            <Input
              type="text"
              id="gemini"
              placeholder="AIzaxxxxxxx"
              defaultValue={apiKeys.gemini}
              onblur={(event) => {
                apiKeys.gemini = event.currentTarget.value;
              }}
            />
          </div>
        </form>
      </Sidebar.Group>
      <Sidebar.Group />
    </Sidebar.Content>
    <Sidebar.Footer /></Sidebar.Root
  >
</Sidebar.Provider>
