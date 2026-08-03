<script lang="ts">
  export type ToastItem = {
    id: number;
    message: string;
    kind?: "info" | "success" | "error";
  };

  interface Props {
    items: ToastItem[];
  }

  let { items }: Props = $props();

  function tone(kind?: ToastItem["kind"]) {
    if (kind === "success") return "background: var(--color-success); color: #fff";
    if (kind === "error") return "background: var(--color-danger); color: #fff";
    return "background: var(--color-ink); color: #fff";
  }
</script>

<div
  class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
  aria-live="polite"
>
  {#each items as t (t.id)}
    <div
      class="pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lift"
      style={tone(t.kind)}
    >
      {t.message}
    </div>
  {/each}
</div>
