<script lang="ts">
  import type { CoreMessage } from "ai";
  import { UserRound } from "lucide-svelte";

  import { Avatar } from "$lib/components/ui/avatar";
  import { Badge } from "$lib/components/ui/badge";
  import Json from "./json.svelte";
  import Markdown from "./markdown.svelte";
  let { message }: { message: CoreMessage } = $props();
</script>

<div class="p-4 rounded-lg flex {message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}">
  {#if message.role === "user"}
    <Avatar><UserRound /></Avatar>
  {/if}

  <div class="flex flex-col gap-4">
    {#if typeof message.content === "string"}
      <Markdown text={message.content} />
    {:else}
      {#each message.content as item, index (index)}
        <div>
          {#if item.type === "text"}
            <Markdown text={item.text || ""} />
          {:else}
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
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
