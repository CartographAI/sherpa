<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Textarea } from "$lib/components/ui/textarea";
  import { X } from "lucide-svelte";
  import { onMount } from "svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let scratchText: string = $state("");

  const STORAGE_KEY = "scratchPad";

  onMount(() => {
    const savedText = localStorage.getItem(STORAGE_KEY);
    if (savedText) {
      scratchText = savedText;
      open = true;
    }

    window.addEventListener("beforeunload", saveToLocalStorage);
    return () => window.removeEventListener("beforeunload", saveToLocalStorage);
  });

  function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, scratchText);
  }
</script>

<Sidebar.Provider style="--sidebar-width: 500px" class="flex-1" {open}>
  <Sidebar.Root side="right" variant="floating" class="p-2 pt-16">
    <Sidebar.Header class="flex flex-row">
      <Sidebar.GroupLabel class="flex w-full justify-between">
        <div class="font-semibold text-[1rem] text-foreground">Scratch Pad</div>
        <Button variant="ghost" class="px-3" onclick={() => (open = false)}>
          <X />
        </Button>
      </Sidebar.GroupLabel>
    </Sidebar.Header>
    <Sidebar.Content>
      <Sidebar.Group class="p-4">
        <Textarea
          placeholder="Store your frequently used prompts here..."
          class="min-h-[300px]"
          bind:value={scratchText}
          onblur={saveToLocalStorage}
        />
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Footer />
  </Sidebar.Root>
</Sidebar.Provider>
