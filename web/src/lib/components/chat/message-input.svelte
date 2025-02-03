<script lang="ts">
  import { useChat } from "$lib/appState.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Textarea } from "$lib/components/ui/textarea";
  import { getNameForModelId, modelConfig } from "$lib/config";

  let { handleSubmit }: { handleSubmit: (event: SubmitEvent) => void } = $props();

  const chat = useChat();
  const modelSelectContent = $derived(getNameForModelId(chat.selectedModel) ?? "Select a model");
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-1">
  <div class="flex">
    <Textarea placeholder="Type your message..." name="message" bind:value={chat.inputMessage} class="flex-grow mr-2" />
    <Button type="submit" disabled={chat.isLoading}>Send</Button>
  </div>
  <div class="flex items-center gap-2">
    <Select.Root type="single" bind:value={chat.selectedModel}>
      <Select.Trigger class="w-[240px]">{modelSelectContent}</Select.Trigger>
      <Select.Content>
        {#each modelConfig as provider}
          <Select.Group>
            <Select.GroupHeading>{provider.provider}</Select.GroupHeading>
            {#each provider.models as model}
              <Select.Item value={model.id}>
                {model.name}
                <span class="text-muted-foreground ml-1">({model.id})</span>
              </Select.Item>
            {/each}
          </Select.Group>
        {/each}
      </Select.Content>
    </Select.Root>
    <Label for="readFiles">Read all files</Label>
    <Switch bind:checked={chat.sendFiles} id="readFiles"/>
  </div>
</form>
