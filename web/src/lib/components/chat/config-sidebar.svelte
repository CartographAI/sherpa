<script lang="ts">
  import { useConfig } from "$lib/appState.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { X } from "lucide-svelte";
  import { toast } from "svelte-sonner";

  let { open = $bindable(true) }: { open?: boolean } = $props();
  const config = useConfig();
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
</Sidebar.Content>
<Sidebar.Footer />
