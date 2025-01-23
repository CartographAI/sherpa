<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Textarea } from "$lib/components/ui/textarea";
  import { type CoreMessage } from "ai";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  const API_BASE_URL = "http://localhost:3031";

  let chatMessages: CoreMessage[] = $state([]);
  let isLoading: boolean = $state(false);
  let inputMessage: string = $state("");
  let anthropicApiKey: string = $state("");
  let geminiApiKey: string = $state("");

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

  async function sendMessage() {
    isLoading = true;

    const requestBody = { userPrompt: inputMessage, model: "claude-3-5-sonnet-20241022", apiKey: anthropicApiKey };
    const response = await fetch(API_BASE_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    isLoading = false;
    if (response.status === 202) {
      inputMessage = "";
    } else {
      const resJson = await response.json();
      toast.error("An error occurred: " + resJson.message, { position: "top-center" });
    }
  }
</script>

<Sidebar.Provider style="--sidebar-width: 500px">
  <Sidebar.Inset>
    <div class="flex h-screen">
      <div class="w-1/2 flex-1 max-w-3xl mx-auto flex flex-col">
        <ScrollArea class="flex-grow p-4">
          {#each chatMessages as message, index (index)}
            <div class="mb-4 p-2 bg-secondary rounded-lg">
              <p>{message.role}:</p>
              {JSON.stringify(message.content)}
            </div>
          {/each}
        </ScrollArea>

        <form onsubmit={sendMessage} class="p-4 border-t border-border flex">
          <Textarea
            placeholder="Type your message..."
            name="message"
            bind:value={inputMessage}
            class="flex-grow mr-2"
          />
          <Button type="submit" disabled={isLoading}>
            {#if isLoading}Loading{:else}Send{/if}
          </Button>
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
            <Input type="text" id="anthropic" placeholder="sk-ant-xxxxxxx" bind:value={anthropicApiKey} />
          </div>
          <div class="flex w-full flex-col gap-1.5">
            <Label for="gemini">Google Gemini</Label>
            <p class="text-muted-foreground text-sm">
              Create an API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" class="underline"
                >https://aistudio.google.com/app/apikey</a
              >
            </p>
            <Input type="text" id="gemini" placeholder="AIzaxxxxxxx" bind:value={geminiApiKey} />
          </div>
          <div class="flex justify-end">
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Sidebar.Group>
      <Sidebar.Group />
    </Sidebar.Content>
    <Sidebar.Footer /></Sidebar.Root
  >
</Sidebar.Provider>
