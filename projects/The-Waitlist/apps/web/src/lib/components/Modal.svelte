<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
    wide?: boolean;
  }

  let { open, title, onclose, children, footer, wide = false }: Props = $props();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    onkeydown={onkeydown}
  >
    <button
      type="button"
      class="absolute inset-0 bg-black/50"
      aria-label="Close dialog"
      onclick={onclose}
    ></button>
    <div
      class="relative max-h-[90dvh] w-full overflow-y-auto border border-black/10 bg-paper-elevated shadow-lift"
      class:max-w-md={!wide}
      class:max-w-lg={wide}
    >
      <div
        class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/10 bg-paper-elevated px-4 py-3"
      >
        <h2 id="modal-title" class="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <button type="button" class="btn-ghost btn-sm" onclick={onclose}>Close</button>
      </div>
      <div class="p-4">
        {@render children()}
        {#if footer}
          <div class="mt-5 flex justify-end gap-2">
            {@render footer()}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
