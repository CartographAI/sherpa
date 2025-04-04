<script lang="ts">
  import { useConfig } from "$lib/appState.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { API_BASE_URL } from "$lib/config";
  import { RefreshCw, X } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  let { open = $bindable(true) }: { open?: boolean } = $props();
  const config = useConfig();
  let mcpServerNames: string[] = $state([]);
  let isLoadingMcpConfig = $state(false); // Start as false, set true during fetch
  let loadError: string | null = $state(null);

  async function fetchMcpConfig() {
    isLoadingMcpConfig = true;
    loadError = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/mcp-config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP config: ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.mcpServers) {
        mcpServerNames = Object.keys(data.mcpServers);
      } else {
        mcpServerNames = []; // Ensure it's an empty array if structure is unexpected
      }
      loadError = null;
    } catch (error) {
      console.error("Error loading MCP config:", error);
      loadError = "Could not load MCP server configuration.";
      mcpServerNames = []; // Clear any potentially stale data
      toast.error(loadError, { position: "top-center" });
    } finally {
      isLoadingMcpConfig = false;
    }
  }

  onMount(async () => {
    await fetchMcpConfig(); // Call the fetch function on mount
  });
</script>

<Sidebar.Header class="flex flex-row">
  <Sidebar.GroupLabel class="flex w-full justify-between">
    <div class="font-semibold text-[1rem] text-foreground">Model configuration</div>
    <Button variant="ghost" class="px-3" onclick={() => (open = false)}>
      <X />
    </Button>
  </Sidebar.GroupLabel>
</Sidebar.Header>
<Sidebar.Content>
  <Sidebar.Group class="p-4">
    <form class="space-y-6">
      <!-- Anthropic API Key -->
      <div class="flex w-full flex-col gap-1.5">
        <Label for="anthropic">Anthropic</Label>
        <p class="text-muted-foreground text-sm">
          Create an API key at <a href="https://console.anthropic.com/settings/keys" target="_blank" class="underline"
            >https://console.anthropic.com/settings/keys</a
          >
        </p>
        <Input
          type="password"
          id="anthropic"
          placeholder="sk-ant-xxxxxxx"
          value={config.apiKeys.anthropic}
          onblur={(event) => {
            if (event.currentTarget.value !== config.apiKeys.anthropic) {
              toast.success("Saved", { position: "top-right" });
              config.setApiKey("anthropic", event.currentTarget.value);
            }
          }}
        />
      </div>

      <!-- Gemini API Key -->
      <div class="flex w-full flex-col gap-1.5">
        <Label for="gemini">Google Gemini</Label>
        <p class="text-muted-foreground text-sm">
          Create an API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" class="underline"
            >https://aistudio.google.com/app/apikey</a
          >
        </p>
        <Input
          type="password"
          id="gemini"
          placeholder="AIzaxxxxxxx"
          value={config.apiKeys.gemini}
          onblur={(event) => {
            if (event.currentTarget.value !== config.apiKeys.gemini) {
              toast.success("Saved", { position: "top-right" });
              config.setApiKey("gemini", event.currentTarget.value);
            }
          }}
        />
      </div>

      <!-- OpenAI API Key -->
      <div class="flex w-full flex-col gap-1.5">
        <Label for="openai">OpenAI</Label>
        <p class="text-muted-foreground text-sm">
          Create an API key at <a
            href="https://platform.openai.com/settings/organization/api-keys"
            target="_blank"
            class="underline">https://platform.openai.com/settings/organization/api-keys</a
          >
        </p>
        <Input
          type="password"
          id="openai"
          placeholder="sk-xxxxxxxxx"
          value={config.apiKeys.openai}
          onblur={(event) => {
            if (event.currentTarget.value !== config.apiKeys.openai) {
              toast.success("Saved", { position: "top-right" });
              config.setApiKey("openai", event.currentTarget.value);
            }
          }}
        />
      </div>
    </form>
  </Sidebar.Group>

  <!-- MCP Servers List -->
  <Sidebar.Group class="p-4">
    <div class="flex items-center justify-between">
      <Sidebar.GroupLabel class="font-semibold text-[1rem] text-foreground px-0">MCP Servers</Sidebar.GroupLabel>
      <Button variant="ghost" size="icon" class="h-7 w-7" onclick={fetchMcpConfig} disabled={isLoadingMcpConfig}>
        <RefreshCw class="h-4 w-4 {isLoadingMcpConfig ? 'animate-spin' : ''}" />
      </Button>
    </div>
    <Sidebar.GroupContent>
      <p class="text-muted-foreground text-xs pt-1">
        Configuration file located at <code class="font-mono">~/.config/sherpa/mcp_servers.json</code>
      </p>
      {#if isLoadingMcpConfig && mcpServerNames.length === 0}
        <!-- Show loading only if list is empty, otherwise show stale list while loading -->
        <div class="text-muted-foreground text-sm pt-2">Loading...</div>
      {:else if loadError}
        <div class="text-destructive text-sm pt-2">{loadError}</div>
      {:else if mcpServerNames.length > 0}
        <div class="space-y-1 pt-2">
          {#each mcpServerNames as name}
            <div class="text-sm text-muted-foreground">{name}</div>
          {/each}
        </div>
      {:else if !isLoadingMcpConfig}
        <!-- Only show "No servers" if not loading and list is empty -->
        <div class="text-muted-foreground text-sm pt-2">No MCP servers configured.</div>
      {/if}
    </Sidebar.GroupContent>
  </Sidebar.Group>
</Sidebar.Content>
<Sidebar.Footer />
