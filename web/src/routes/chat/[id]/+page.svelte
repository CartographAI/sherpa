<script lang="ts">
  import { page } from "$app/state";
  import ChatPage from "$lib/components/chat/chat-page.svelte";
</script>

<ChatPage chatId={page.params.id} />
