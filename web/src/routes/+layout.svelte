<script lang="ts">
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import "../app.css";
  let { children } = $props();
</script>

<svelte:head>
  <title>Sherpa</title>
</svelte:head>

{@render children()}
<Toaster />
