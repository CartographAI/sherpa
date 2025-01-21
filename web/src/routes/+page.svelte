<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Textarea } from "$lib/components/ui/textarea";
  import { onMount } from "svelte";

  const API_BASE_URL = "http://localhost:3031";

  let chatMessages: string[] = $state([]);
  let isLoading: boolean = $state(false);
  let inputMessage: string = $state("");

  onMount(() => {
    console.log("creating event source");
    const eventSource = new EventSource(API_BASE_URL + "/api/events");

    eventSource.onmessage = (event) => {
      console.log("received sse message:", event);
      const eventData = JSON.parse(event.data);
      chatMessages.push(`${eventData.role}: ${eventData.content}`);
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

    const requestBody = { userPrompt: inputMessage };
    const response = await fetch(API_BASE_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (response.status === 202) {
      isLoading = false;
      inputMessage = "";
    }
  }
</script>

<div class="flex h-screen">
  <div class="w-1/2 flex-1 max-w-3xl mx-auto flex flex-col">
    <ScrollArea class="flex-grow p-4">
      {#each chatMessages as message, index (index)}
        <div class="mb-4 p-2 bg-secondary rounded-lg">
          {message}
        </div>
      {/each}
    </ScrollArea>

    <form onsubmit={sendMessage} class="p-4 border-t border-border flex">
      <Textarea placeholder="Type your message..." name="message" bind:value={inputMessage} class="flex-grow mr-2" />
      <Button type="submit" disabled={isLoading}>
        {#if isLoading}Loading{:else}Send{/if}
      </Button>
    </form>
  </div>
</div>
