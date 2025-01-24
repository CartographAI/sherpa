<script lang="ts">
  import SvelteMarkdown from "@humanspeak/svelte-markdown";

  let { text }: { text: string } = $props();
</script>

<div class="prose">
  <SvelteMarkdown source={text} />
</div>
