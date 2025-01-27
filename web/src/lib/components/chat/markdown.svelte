<script lang="ts">
  import SvelteMarkdown from "@humanspeak/svelte-markdown";

  let { text }: { text: string } = $props();
</script>

{#if text}
  <div class="prose">
    <SvelteMarkdown source={text} />
  </div>
{/if}
