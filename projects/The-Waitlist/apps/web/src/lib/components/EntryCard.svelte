<script lang="ts">
  import type { Entry } from "$lib/api";
  import { formatWait, partyLabel, formatTime } from "$lib/format";

  interface Props {
    entry: Entry;
    oncall?: (id: string) => void;
    onserve?: (id: string) => void;
    onnoshow?: (id: string) => void;
    oncancel?: (id: string) => void;
    onedit?: (entry: Entry) => void;
    onmoveup?: (id: string) => void;
    onmovedown?: (id: string) => void;
    busy?: boolean;
  }

  let {
    entry,
    oncall,
    onserve,
    onnoshow,
    oncancel,
    onedit,
    onmoveup,
    onmovedown,
    busy = false,
  }: Props = $props();

  const isCalled = $derived(entry.status === "called");
</script>

<article
  class="card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
  style={isCalled
    ? "background: var(--color-called-soft); border-color: var(--color-called); border-left: 3px solid var(--color-called)"
    : "border-left: 3px solid transparent"}
>
  <div class="flex min-w-0 items-start gap-3">
    <div
      class="mono flex h-10 w-10 shrink-0 flex-col items-center justify-center text-sm font-semibold text-white"
      style="background: {isCalled ? 'var(--color-called)' : 'var(--color-ink)'}"
    >
      {#if isCalled}
        <span class="text-[9px] font-semibold uppercase tracking-wider opacity-80">Now</span>
      {:else}
        <span class="text-base leading-none">{entry.position ?? "—"}</span>
      {/if}
    </div>
    <div class="min-w-0">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 class="truncate text-[0.95rem] font-semibold text-ink">{entry.name}</h3>
        <span class="text-xs text-ink-muted">{partyLabel(entry.partySize)}</span>
        {#if isCalled}
          <span class="badge text-white" style="background: var(--color-called)">Called</span>
        {/if}
      </div>
      <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
        {#if entry.estimatedWait && entry.status === "waiting"}
          <span>Wait {formatWait(entry.estimatedWait.minutes)}</span>
        {/if}
        {#if entry.phone}
          <span class="mono">{entry.phone}</span>
        {/if}
        {#if entry.note}
          <span class="truncate italic">“{entry.note}”</span>
        {/if}
        <span class="text-ink-faint">{formatTime(entry.createdAt)}</span>
      </div>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-1 sm:justify-end">
    {#if onedit}
      <button
        type="button"
        class="btn-ghost btn-sm"
        disabled={busy}
        onclick={() => onedit?.(entry)}
      >
        Edit
      </button>
    {/if}
    {#if onmoveup}
      <button
        type="button"
        class="btn-ghost btn-sm mono"
        title="Move up"
        disabled={busy || entry.position === 1}
        onclick={() => onmoveup?.(entry.id)}
      >
        ↑
      </button>
    {/if}
    {#if onmovedown}
      <button
        type="button"
        class="btn-ghost btn-sm mono"
        title="Move down"
        disabled={busy}
        onclick={() => onmovedown?.(entry.id)}
      >
        ↓
      </button>
    {/if}
    {#if entry.status === "waiting" && oncall}
      <button
        type="button"
        class="btn-secondary btn-sm"
        disabled={busy}
        onclick={() => oncall?.(entry.id)}
      >
        Call
      </button>
    {/if}
    {#if onserve}
      <button
        type="button"
        class="btn-primary btn-sm"
        disabled={busy}
        onclick={() => onserve?.(entry.id)}
      >
        Seated
      </button>
    {/if}
    {#if onnoshow}
      <button
        type="button"
        class="btn-ghost btn-sm"
        style="color: var(--color-warn)"
        disabled={busy}
        onclick={() => onnoshow?.(entry.id)}
      >
        No-show
      </button>
    {/if}
    {#if oncancel}
      <button
        type="button"
        class="btn-ghost btn-sm"
        disabled={busy}
        onclick={() => oncancel?.(entry.id)}
        title="Remove"
      >
        Remove
      </button>
    {/if}
  </div>
</article>
