<script lang="ts">
  import { useChat, useChatHistory } from "$lib/appState.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { History, PanelLeftClose, PanelLeftOpen, Plus, Settings } from "lucide-svelte";

  let { open = $bindable(false), toggleConfig }: { open?: boolean; toggleConfig: () => void } = $props();
  const chatHistory = useChatHistory();
  const chat = useChat();
</script>

<Sidebar.Provider style="--sidebar-width: 360px" class="flex w-fit z-10" {open}>
  <Sidebar.Root side="left" variant="inset" collapsible="icon">
    <Sidebar.Header>
      {#if open}
        <Sidebar.MenuButton onclick={() => (open = false)} class="justify-end">
          <PanelLeftClose />
        </Sidebar.MenuButton>
      {:else}
        <Sidebar.MenuButton onclick={() => (open = true)}>
          {#snippet tooltipContent()}Expand panel{/snippet}
          <PanelLeftOpen />
        </Sidebar.MenuButton>
      {/if}

      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>
            {#snippet tooltipContent()}New chat{/snippet}
            {#snippet child({ props })}
              <Button
                href="/"
                {...props}
                class="max-w-full group-data-[collapsible=icon]:h-8"
                onclick={() => chat.reset()}
              >
                <Plus />
                <span class="group-data-[collapsible=icon]:hidden">New Chat</span>
              </Button>
            {/snippet}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton onclick={() => (open = true)}>
                {#snippet tooltipContent()}Chat history{/snippet}
                <History />
                <span>Chat history</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>

            <Sidebar.MenuItem>
              <Sidebar.MenuSub class="group-data-[collapsible=icon]:hidden mr-0 pr-0">
                {#each chatHistory.chats as chat}
                  <Sidebar.MenuSubItem class="px-2 py-1 overflow-ellipsis overflow-hidden text-nowrap">
                    <a href={`/chat/${chat.id}`}>
                      <span>{chat.snippet}</span>
                    </a>
                  </Sidebar.MenuSubItem>
                {/each}
                {#if chatHistory.chats.length === 0}
                  <span>No chats yet</span>
                {/if}
              </Sidebar.MenuSub>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Footer class="mt-2">
      <Sidebar.MenuButton onclick={toggleConfig}>
        {#snippet tooltipContent()}Configuration{/snippet}
        <Settings />
        <span>Configuration</span>
      </Sidebar.MenuButton>
    </Sidebar.Footer>
  </Sidebar.Root>
</Sidebar.Provider>
