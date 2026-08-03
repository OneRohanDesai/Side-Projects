<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api, ApiError } from "$lib/api";
  import { formatWait } from "$lib/format";

  let loading = $state(true);
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let queue = $state<{
    id: string;
    name: string;
    slug: string;
    status: string;
    waitingCount?: number;
    avgServiceMinutes: number;
  } | null>(null);

  let name = $state("");
  let partySize = $state(2);
  let phone = $state("");
  let note = $state("");

  const slug = $derived($page.params.slug);

  onMount(async () => {
    if (!slug) {
      error = "Queue not found";
      loading = false;
      return;
    }
    try {
      const res = await api.publicQueue(slug);
      queue = res.queue;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Queue not found";
    } finally {
      loading = false;
    }
  });

  async function join() {
    if (!name.trim() || !queue) return;
    submitting = true;
    error = null;
    try {
      const { entry } = await api.publicJoin(queue.slug, {
        name: name.trim(),
        partySize,
        phone: phone.trim() || null,
        note: note.trim() || null,
      });
      await goto(`/status/${entry.publicToken}`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Could not join";
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{queue ? `Join ${queue.name}` : "Join"} · The Waitlist</title>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
  {#if loading}
    <div class="flex flex-1 items-center justify-center text-ink-muted">Loading…</div>
  {:else if !queue}
    <div class="card my-auto p-8 text-center">
      <p class="font-semibold text-danger">{error ?? "Queue not found"}</p>
      <p class="mt-2 text-sm text-ink-muted">Check the link or ask staff for a new QR code.</p>
    </div>
  {:else}
    <div class="mb-8 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand">Join waitlist</p>
      <h1 class="mt-2 font-display text-3xl font-semibold text-ink">{queue.name}</h1>
      {#if queue.status === "paused"}
        <p class="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
          This queue is paused. New joins may not be accepted.
        </p>
      {:else}
        <p class="mt-2 text-sm text-ink-muted">
          {queue.waitingCount ?? 0} currently waiting
          · ~{formatWait((queue.waitingCount ?? 0) * queue.avgServiceMinutes)} if you join now
        </p>
      {/if}
    </div>

    <form
      class="card space-y-4 p-5"
      onsubmit={(e) => {
        e.preventDefault();
        join();
      }}
    >
      <div>
        <label class="label" for="name">Your name</label>
        <input
          id="name"
          class="input"
          bind:value={name}
          required
          placeholder="How should we call you?"
          autocomplete="name"
        />
      </div>
      <div>
        <label class="label" for="party">Party size</label>
        <input
          id="party"
          class="input"
          type="number"
          min="1"
          max="99"
          bind:value={partySize}
        />
      </div>
      <div>
        <label class="label" for="phone">Phone (optional)</label>
        <input
          id="phone"
          class="input"
          type="tel"
          bind:value={phone}
          placeholder="For a heads-up when it’s almost your turn"
          autocomplete="tel"
        />
      </div>
      <div>
        <label class="label" for="note">Note (optional)</label>
        <input id="note" class="input" bind:value={note} placeholder="Anything we should know?" />
      </div>

      {#if error}
        <p class="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      {/if}

      <button
        type="submit"
        class="btn-primary btn-lg w-full"
        disabled={submitting || !name.trim() || queue.status === "paused"}
      >
        {submitting ? "Joining…" : "Join waitlist"}
      </button>
    </form>

    <p class="mt-6 text-center text-xs text-ink-faint">
      Powered by The Waitlist · Your data stays with this venue
    </p>
  {/if}
</div>
