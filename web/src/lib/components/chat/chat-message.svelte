<script lang="ts">
  import type { CoreMessage } from "ai";
  import { UserRound } from "lucide-svelte";

  import { Avatar } from "$lib/components/ui/avatar";
  import { Badge } from "$lib/components/ui/badge";
  import Json from "./json.svelte";
  import Markdown from "./markdown.svelte";
  let { message }: { message: CoreMessage } = $props();
</script>

<div class="p-4 rounded-lg flex {message.role === 'user' ? 'bg-stone-300' : 'bg-muted/50'}">
  {#if message.role === "user"}
    <Avatar class="w-6 h-6 mr-2"><UserRound /></Avatar>
  {/if}

  <div class="flex flex-col gap-4 w-full">
    {#if typeof message.content === "string"}
      <Markdown text={message.content} />
    {:else}
      {#each message.content as item, index (index)}
        {#if item.type === "text"}
          <Markdown text={item.text} />
        {:else}
          <div>
            <Badge color="teal" class="mb-2">
              {item.type.replaceAll("-", " ")}
            </Badge>

            {#if item.type === "tool-call"}
              <p>Tool: {item.toolName}</p>
              <Json content={{ args: item.args }} />
            {/if}

            {#if item.type === "tool-result"}
              <p>Tool: {item.toolName}</p>
              <Json content={{ result: item.result }} />
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
