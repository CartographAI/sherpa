<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Textarea } from "$lib/components/ui/textarea";

  let chatMessages: string[] = $state([]);
  let isLoading: boolean = $state(false);
  let inputMessage: string = $state("");

  async function sendMessage() {
        isLoading = true;

        // const requestBody = { message: inputMessage }
        // const response = await fetch("/api/chat", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(requestBody),
        // });
        // const result = await response.json();
        await new Promise(resolve => setTimeout(resolve, 3000));

        isLoading = false;
        chatMessages.push(inputMessage);
        chatMessages.push("Response from model");
        inputMessage = "";
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

    <form onsubmit={sendMessage}
      class="p-4 border-t border-border flex"
    >
      <Textarea placeholder="Type your message..." name="message" bind:value={inputMessage} class="flex-grow mr-2" />
      <Button type="submit" disabled={isLoading}>
        {#if isLoading}Loading{:else}Send{/if}
      </Button>
    </form>
  </div>
</div>
