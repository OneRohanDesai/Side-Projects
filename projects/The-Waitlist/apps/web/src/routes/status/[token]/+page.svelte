<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import { api, ApiError } from "$lib/api";
  import { createRealtime } from "$lib/ws";
  import { throttleTrailing } from "$lib/sync";
  import { formatWait, partyLabel } from "$lib/format";
  import { ensureNotifyPermission, notify } from "$lib/notifications";

  let loading = $state(true);
  let error = $state<string | null>(null);
  let entry = $state<{
    id: string;
    name: string;
    partySize: number;
    status: string;
    position: number | null;
    estimatedWait?: { minutes: number; partiesAhead: number } | null;
    publicToken: string;
  } | null>(null);
  let queue = $state<{ id: string; name: string; slug: string } | null>(null);
  let rt: ReturnType<typeof createRealtime> | null = null;
  let lastStatus = $state<string | null>(null);
  let notifyEnabled = $state(false);

  const token = $derived($page.params.token);

  async function load(mode: "full" | "soft" = "full") {
    if (!token) return;
    try {
      const res = await api.publicStatus(token);
      const prev = lastStatus;
      if (JSON.stringify(entry) !== JSON.stringify(res.entry)) entry = res.entry;
      if (JSON.stringify(queue) !== JSON.stringify(res.queue)) queue = res.queue;
      lastStatus = res.entry.status;
      // Notify on transition to called (or near turn: position 1 while waiting)
      if (prev && prev !== res.entry.status && res.entry.status === "called") {
        notify("You're up!", `${res.entry.name} — please head to the host stand.`);
      } else if (
        prev === "waiting" &&
        res.entry.status === "waiting" &&
        res.entry.position === 1 &&
        res.entry.estimatedWait?.partiesAhead === 0
      ) {
        // already next; soft heads-up once when we first see position 1 after a higher pos
      }
      error = null;
    } catch (e) {
      if (mode === "full") error = e instanceof ApiError ? e.message : "Not found";
    } finally {
      loading = false;
    }
  }

  const softLoad = throttleTrailing(() => {
    void load("soft");
  }, 2500);

  onMount(() => {
    void load("full");
    void ensureNotifyPermission().then((ok) => {
      notifyEnabled = ok;
    });
    rt = createRealtime((ev) => {
      if (ev.type === "connected" || ev.type === "pong" || ev.type === "subscribed") return;
      if (ev.type?.startsWith("entry.") || ev.type === "entry.reordered") {
        softLoad();
      }
    });
    const poll = setInterval(() => void load("soft"), 60_000);
    return () => clearInterval(poll);
  });

  onDestroy(() => rt?.close());

  $effect(() => {
    if (queue?.id && rt) rt.subscribe(queue.id);
  });

  const headline = $derived.by(() => {
    if (!entry) return "";
    if (entry.status === "called") return "You're up!";
    if (entry.status === "served") return "You're seated";
    if (entry.status === "no_show") return "Marked as no-show";
    if (entry.status === "cancelled") return "Removed from waitlist";
    return "You're on the list";
  });
</script>

<svelte:head>
  <title>
    {entry?.status === "called" ? "You're up!" : "Your place"} · The Waitlist
  </title>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
  {#if loading}
    <div class="flex flex-1 items-center justify-center text-ink-muted">Loading…</div>
  {:else if error || !entry || !queue}
    <div class="card my-auto p-8 text-center">
      <p class="font-semibold text-danger">{error ?? "Not found"}</p>
    </div>
  {:else}
    <p class="text-center text-xs font-bold uppercase tracking-widest text-brand">
      {queue.name}
    </p>

    <div
      class="card mt-6 flex flex-1 flex-col items-center justify-center p-8 text-center"
      class:bg-called-soft={entry.status === "called"}
      class:ring-2={entry.status === "called"}
      class:ring-called={entry.status === "called"}
      class:bg-success-soft={entry.status === "served"}
    >
      <p class="font-display text-2xl font-semibold text-ink sm:text-3xl">
        {headline}
      </p>
      <p class="mt-2 text-ink-muted">
        {entry.name} · {partyLabel(entry.partySize)}
      </p>

      {#if entry.status === "waiting"}
        <div class="mt-10">
          <p class="text-sm font-medium uppercase tracking-wide text-ink-muted">
            Your position
          </p>
          <p class="mt-1 font-display text-7xl font-bold tabular-nums text-brand">
            {entry.position ?? "—"}
          </p>
          {#if entry.estimatedWait}
            <p class="mt-4 text-lg text-ink">
              Estimated wait
              <span class="font-semibold">{formatWait(entry.estimatedWait.minutes)}</span>
            </p>
            <p class="mt-1 text-sm text-ink-muted">
              {entry.estimatedWait.partiesAhead}
              {entry.estimatedWait.partiesAhead === 1 ? "party" : "parties"} ahead
            </p>
          {/if}
        </div>
      {:else if entry.status === "called"}
        <p class="mt-8 max-w-xs text-lg text-called">
          Please head to the host stand — they're ready for you.
        </p>
      {:else if entry.status === "served"}
        <p class="mt-8 text-success">Enjoy!</p>
      {/if}
    </div>

    <p class="mt-6 text-center text-xs text-ink-faint">
      This page updates live.
      {#if notifyEnabled}
        Browser alerts are on when you’re called.
      {:else}
        <button
          type="button"
          class="underline"
          onclick={async () => {
            notifyEnabled = await ensureNotifyPermission();
          }}
        >
          Enable browser alerts
        </button>
      {/if}
    </p>
    {#if entry.status === "waiting" || entry.status === "called"}
      <a
        href="/join/{queue.slug}"
        class="mt-4 text-center text-sm text-ink-muted underline-offset-2 hover:underline"
      >
        Join again for someone else
      </a>
    {/if}
  {/if}
</div>
