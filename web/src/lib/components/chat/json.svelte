<script lang="ts">
  import Self from "./json.svelte";

  let {
    content,
    nestedLevel = 0,
  }: {
    content: unknown;
    nestedLevel?: number;
  } = $props();

  let openStates = $state<Record<string, boolean>>({});

  function toggleOpenState(key: string) {
    openStates[key] = !openStates[key];
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
    <code>{content}</code>
  {/if}
{:else if typeof content === "object"}
  <ul class={marginClass(nestedLevel)}>
    {#each Object.entries(content) as [key, value] (key)}
      <li>
        {#if openStates[key]}
          <button onclick={() => toggleOpenState(key)}>
            - {key}
          </button>: <Self content={value} nestedLevel={nestedLevel + 1} />
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
