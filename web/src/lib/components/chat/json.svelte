<script lang="ts">
  import Self from "./json.svelte";

  let {
    content,
    nestedLevel = 0,
    expandUpTo = 0,
  }: {
    content: unknown;
    nestedLevel?: number;
    expandUpTo?: number;
  } = $props();

  let objectOpenStates = $state<Record<string, boolean>>(
    typeof content === "object" && content != null && Object.keys(content).length <= expandUpTo
      ? Object.fromEntries(Object.keys(content).map((key) => [key, true]))
      : {},
  );

  let arrayLengthTooLong = $derived(Array.isArray(content) && content.length > expandUpTo);
  let arrayIsTruncated = $state(true);
  let arrayItemsToDisplay = $derived(
    Array.isArray(content) ? (arrayLengthTooLong && arrayIsTruncated ? content.slice(0, expandUpTo) : content) : [],
  );

  function toggleOpenState(key: string) {
    objectOpenStates[key] = !objectOpenStates[key];
  }

  function marginClass(indentLevel: number): string {
    switch (indentLevel) {
      case 0:
        return "ml-0";
      case 1:
        return "ml-2";
      case 2:
        return "ml-4";
      case 3:
        return "ml-6";
      default:
        return "ml-8";
    }
  }
</script>

{#if content == null}
  {null}
{:else if typeof content === "string"}
  {#if content.includes("\n")}
    <span class="prose">
      <pre class={marginClass(nestedLevel)}><code>{content}</code></pre>
    </span>
  {:else}
    <span class="text-sm">{content}</span>
  {/if}
{:else if Array.isArray(content)}
  <ul class={marginClass(nestedLevel) + " text-sm"}>
    {#each arrayItemsToDisplay as value}
      <li>
        - <Self content={value} nestedLevel={nestedLevel + 1} {expandUpTo} />
      </li>
    {/each}
    {#if arrayLengthTooLong}
      {#if arrayIsTruncated}
        <button class="text-sm text-muted-foreground" onclick={() => (arrayIsTruncated = false)}>
          {content.length - arrayItemsToDisplay.length} more items. click to show
        </button>
      {:else}
        <button class="text-sm text-muted-foreground" onclick={() => (arrayIsTruncated = true)}> click to hide </button>
      {/if}
    {/if}
  </ul>
{:else if typeof content === "object"}
  <ul class={marginClass(nestedLevel) + " text-sm"}>
    {#each Object.entries(content) as [key, value] (key)}
      <li>
        {#if objectOpenStates[key]}
          <button onclick={() => toggleOpenState(key)}>
            - {key}
          </button>: <Self content={value} nestedLevel={nestedLevel + 1} {expandUpTo} />
        {:else}
          <button onclick={() => toggleOpenState(key)}>
            + {key}
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <code>{JSON.stringify(content)}</code>
{/if}
