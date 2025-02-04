<script lang="ts">
  import { useChatHistory } from "$lib/appState.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { X } from "lucide-svelte";

  let { open = $bindable(true) }: { open?: boolean } = $props();
  const chatHistory = useChatHistory();
</script>

<Sidebar.Provider style="--sidebar-width: 300px" class="fixed w-fit z-10" {open}>
  <Sidebar.Root side="left" variant="floating" class="p-2 pt-16">
    <Sidebar.Header class="flex flex-row">
      <Sidebar.GroupLabel class="flex w-full justify-between">
        <div class="font-semibold text-[1rem] text-foreground">Chat History</div>
        <Button variant="ghost" class="px-3" onclick={() => (open = false)}>
          <X />
        </Button>
      </Sidebar.GroupLabel>
    </Sidebar.Header>
    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each chatHistory.chats as chat}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton class="w-full overflow-ellipsis overflow-hidden text-nowrap">
                  {#snippet child({ props })}
                    <a href={`/chat/${chat.id}`} {...props}>
                      <span>{chat.snippet}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Footer />
  </Sidebar.Root>
</Sidebar.Provider>
