<script lang="ts">
  import SvelteMarkdown from "@humanspeak/svelte-markdown";

  let { text }: { text: string } = $props();
</script>

{#if text}
  <div class="prose">
    <SvelteMarkdown source={text} />
  </div>
{/if}

<style>
  :global(.prose pre) {
    width: fit-content;
    min-width: 100%;
    max-width: 720px;
  }

  :global(.prose > pre) {
    max-width: 780px
  }
</style>
