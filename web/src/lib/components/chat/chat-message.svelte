<script lang="ts">
  import type { CoreMessage, ToolResultPart } from "ai";
  import { UserRound, Copy } from "lucide-svelte";

  import { Avatar } from "$lib/components/ui/avatar";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
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
  <div class="py-4 px-6 rounded-lg flex relative {message.role === 'user' ? 'bg-stone-300' : 'bg-muted/50'}">
    {#if message.role === "user"}
      <Avatar class="w-6 h-6 mr-2"><UserRound /></Avatar>
    {/if}

    <div class="flex flex-col gap-4 w-full break-words">
      {#if typeof message.content === "string"}
        <Markdown text={message.content} />
      {:else}
        {#each message.content as item}
          {#if item.type === "text"}
            <Markdown text={item.text} />
          {:else if item.type === "tool-call"}
            {@const toolResult = getToolCallResult(item.toolCallId)}
            <div class="flex flex-col gap-y-2">
              <div>
                <Badge class="mr-2">{item.toolName}</Badge>
                <Json content={item.args} expandUpTo={3} />
              </div>
              {#if toolResult && toolResult.result}
                <Json content={{ result: toolResult.result }} />
              {/if}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
    {#if typeof message.content === 'string' || message.content.some(item => item.type === 'text')}
      <Button
        variant="ghost"
        size="icon"
        class={cn(
          'absolute bottom-0 right-0 h-4 w-4 p-4 opacity-50 hover:opacity-100',
          'hover:bg-stone-200 dark:hover:bg-stone-700'
        )}
        onclick={() => {
        const text = typeof message.content === 'string'
          ? message.content
          : message.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join('\n');
        navigator.clipboard.writeText(text);
      }}
    >
      <Copy />
    </Button>
    {/if}
  </div>
{/if}
