<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { WithElementRef, WithoutChildren } from "bits-ui";
  import type { HTMLTextareaAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    autoExpand = false,
    ...restProps
  }: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> & {
    autoExpand?: boolean;
  } = $props();

  function adjustHeight() {
    if (!ref || !autoExpand) return;

    // Reset height to auto to get the correct scrollHeight
    ref.style.height = "auto";

    // Set the height to match the content, adding a small buffer to ensure no scrollbar appears
    ref.style.height = `${ref.scrollHeight + 3}px`;
  }

  $effect(() => {
    if (value !== undefined && autoExpand) {
      // Wait for next tick to ensure DOM is updated
      setTimeout(adjustHeight, 0);
    }
  });
</script>

<textarea
  bind:this={ref}
  class={cn(
    "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    className,
  )}
  bind:value
  oninput={autoExpand ? adjustHeight : undefined}
  {...restProps}
></textarea>
