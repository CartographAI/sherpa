<script lang="ts">
  import type { CoreMessage, ToolResultPart } from "ai";
  import { UserRound } from "lucide-svelte";

  import { Avatar } from "$lib/components/ui/avatar";
  import { Badge } from "$lib/components/ui/badge";
  import Json from "./json.svelte";
  import Markdown from "./markdown.svelte";

  let {
    message,
    nextMessage = null,
  }: {
    message: CoreMessage;
    nextMessage?: CoreMessage | null;
  } = $props();

  const hasToolCall = $derived(
    Array.isArray(message.content) && message.content.some((item) => item.type === "tool-call"),
  );

  const hasToolResult = $derived(
    Array.isArray(message.content) && message.content.some((item) => item.type === "tool-result"),
  );

  // Determine if this message should be skipped (it's a tool result that belongs to previous message)
  const shouldSkip = $derived(message.role === "tool" && hasToolResult && !hasToolCall);

  function getToolCallResult(toolCallId: string): ToolResultPart | undefined {
    if (!nextMessage || !Array.isArray(nextMessage.content)) return;
    return nextMessage.content.find(
      (contentPart) => contentPart.type === "tool-result" && contentPart.toolCallId === toolCallId,
    ) as ToolResultPart;
  }
</script>

{#if !shouldSkip}
  <div class="p-4 rounded-lg flex {message.role === 'user' ? 'bg-stone-300' : 'bg-muted/50'}">
    {#if message.role === "user"}
      <Avatar class="w-6 h-6 mr-2"><UserRound /></Avatar>
    {/if}

    <div class="flex flex-col gap-4 w-full">
      {#if typeof message.content === "string"}
        <Markdown text={message.content} />
      {:else}
        {#each message.content as item}
          {#if item.type === "text"}
            <Markdown text={item.text} />
          {:else if item.type === "tool-call"}
            {@const toolResult = getToolCallResult(item.toolCallId)}
            <div>
              <Badge class="mr-2">Tool</Badge><span>{item.toolName}</span>
              <Json content={{ args: item.args }} />

              {#if toolResult}
                <Json content={{ result: toolResult.result }} />
              {/if}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
{/if}
