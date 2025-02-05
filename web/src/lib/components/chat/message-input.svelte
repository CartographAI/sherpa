<script lang="ts">
  import { useChat } from "$lib/appState.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Switch } from "$lib/components/ui/switch";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { getNameForModelId, modelConfig } from "$lib/config";

  let { handleSubmit }: { handleSubmit: () => void } = $props();

  const chat = useChat();
  const modelSelectContent = $derived(getNameForModelId(chat.selectedModel) ?? "Select a model");

  function handleKeyDown(event: KeyboardEvent) {
    // Check for Command+Enter (on Mac) or Ctrl+Enter (on Windows/Linux)
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();

      if (chat.inputMessage.trim() && !chat.isLoading) {
        handleSubmit();
      }
    }
  }
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    handleSubmit();
  }}
  class="flex flex-col gap-1"
>
  <div class="flex">
    <Textarea
      placeholder="Type your message..."
      name="message"
      bind:value={chat.inputMessage}
      onkeydown={handleKeyDown}
      class="flex-grow mr-2"
    />
    <Button type="submit" disabled={chat.isLoading || chat.inputMessage.trim() === ""}>Send</Button>
  </div>
  <div class="flex items-center gap-4">
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
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger>
          <div class="flex items-center gap-2">
            <Label for="readFiles">Read all files</Label>
            <Switch bind:checked={chat.sendFiles} id="readFiles" />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p>Enabling this will send all file contents to the model along with your first message</p>
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  </div>
</form>
