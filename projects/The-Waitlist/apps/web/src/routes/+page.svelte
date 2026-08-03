<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, type Queue, type QueueScope, type Role, ApiError } from "$lib/api";
  import { auth } from "$lib/auth.svelte";
  import { createRealtime } from "$lib/ws";
  import { throttleTrailing } from "$lib/sync";
  import AuthMenu from "$lib/components/AuthMenu.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import QrCode from "$lib/components/QrCode.svelte";
  import Toast, { type ToastItem } from "$lib/components/Toast.svelte";

  let queues = $state<Queue[]>([]);
  let roles = $state<Role[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showCreate = $state(false);
  let showLan = $state(false);
  let lanUrls = $state<string[]>([]);
  let creating = $state(false);
  let name = $state("");
  let avgMinutes = $state(10);
  let scope = $state<QueueScope>("personal");
  let selectedRoleIds = $state<string[]>([]);
  let toasts = $state<ToastItem[]>([]);
  let toastSeq = 0;
  let rt: ReturnType<typeof createRealtime> | null = null;
  let unsubAuth: (() => void) | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let inFlight = false;

  function toast(message: string, kind: ToastItem["kind"] = "info") {
    const id = ++toastSeq;
    toasts = [...toasts, { id, message, kind }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2800);
  }

  /**
   * @param mode
   *  - full: first paint (shows skeleton once)
   *  - soft: background sync — no skeleton, no auth re-fetch storm
   */
  async function load(mode: "full" | "soft" = "full") {
    if (inFlight && mode === "soft") return;
    inFlight = true;
    if (mode === "full") {
      loading = true;
      error = null;
    }
    try {
      if (mode === "full") {
        await auth.refresh();
      }
      if (!auth.authenticated) {
        queues = [];
        if (mode === "full") error = null;
        return;
      }
      const res = await api.listQueues();
      // Only replace if data actually changed (avoids needless re-renders)
      const next = res.queues;
      if (JSON.stringify(queues) !== JSON.stringify(next)) {
        queues = next;
      }
      if (auth.user?.organizationType === "team" && mode === "full") {
        try {
          const org = await api.myOrg();
          roles = org.roles.filter((r) => r.name !== "manager");
        } catch {
          roles = [];
        }
      }
      if (mode === "full") error = null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        queues = [];
        if (mode === "full") error = null;
      } else if (mode === "full") {
        error =
          e instanceof ApiError
            ? e.message
            : "Could not reach the server. Is it running?";
      }
    } finally {
      if (mode === "full") loading = false;
      inFlight = false;
    }
  }

  // Soft sync: at most once every 3s from realtime; also once a minute on a timer
  const softSync = throttleTrailing(() => {
    void load("soft");
  }, 3000);

  async function createQueue() {
    if (!name.trim()) return;
    creating = true;
    try {
      const { queue } = await api.createQueue({
        name: name.trim(),
        avgServiceMinutes: avgMinutes,
        scope,
        roleIds: scope === "roles" ? selectedRoleIds : undefined,
      });
      showCreate = false;
      name = "";
      avgMinutes = 10;
      scope = "personal";
      selectedRoleIds = [];
      toast(`Created “${queue.name}”`, "success");
      await goto(`/q/${queue.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed to create", "error");
    } finally {
      creating = false;
    }
  }

  async function archive(q: Queue, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Archive “${q.name}”?`)) return;
    try {
      await api.archiveQueue(q.id);
      toast("Queue archived");
      await load("soft");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Failed", "error");
    }
  }

  function toggleRole(id: string) {
    if (selectedRoleIds.includes(id)) {
      selectedRoleIds = selectedRoleIds.filter((x) => x !== id);
    } else {
      selectedRoleIds = [...selectedRoleIds, id];
    }
  }

  const totalWaiting = $derived(
    queues.reduce((n, q) => n + (q.waitingCount ?? 0), 0),
  );

  const isTeam = $derived(auth.user?.organizationType === "team");

  async function openLan() {
    try {
      const n = await api.network();
      lanUrls = n.urls.length
        ? n.urls
        : [typeof window !== "undefined" ? window.location.origin : ""];
      showLan = true;
    } catch {
      lanUrls =
        typeof window !== "undefined" ? [window.location.origin] : [];
      showLan = true;
    }
  }

  onMount(() => {
    void load("full");

    // Login / logout only — not every auth.refresh poll
    unsubAuth = auth.onChange(() => {
      void load("full");
    });

    // Realtime: soft, throttled — no skeleton flash
    rt = createRealtime((ev) => {
      if (ev.type === "connected" || ev.type === "pong" || ev.type === "subscribed") {
        return;
      }
      if (
        ev.type === "queue.list_changed" ||
        ev.type === "queue.updated" ||
        ev.type?.startsWith("entry.") ||
        ev.type === "members.updated"
      ) {
        softSync();
      }
    });

    // Safety net: quiet poll once per minute (no loading spinner)
    pollTimer = setInterval(() => {
      void load("soft");
    }, 60_000);
  });

  onDestroy(() => {
    unsubAuth?.();
    rt?.close();
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<svelte:head>
  <title>Queues · The Waitlist</title>
</svelte:head>

<header class="app-bar">
  <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
    <div class="min-w-0">
      <p class="app-bar-meta">
        {#if auth.user?.organizationName}
          {auth.user.organizationName}
        {:else}
          Local · offline-ready
        {/if}
      </p>
      <h1 class="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
        The Waitlist
      </h1>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      {#if auth.user?.canManageOrg && isTeam}
        <a href="/org" class="app-bar-btn">Team</a>
      {/if}
      <button type="button" class="app-bar-btn" onclick={openLan}>LAN</button>
      <button
        type="button"
        class="app-bar-btn app-bar-btn-solid"
        onclick={() => (showCreate = true)}
        disabled={!auth.authenticated}
      >
        New queue
      </button>
      <AuthMenu />
    </div>
  </div>
  {#if !loading && queues.length > 0}
    <div class="stat-strip mx-auto max-w-5xl">
      <div>
        <div class="n">{queues.length}</div>
        <div class="l">Queues</div>
      </div>
      <div>
        <div class="n">{totalWaiting}</div>
        <div class="l">Waiting now</div>
      </div>
      <div>
        <div class="n">
          {queues.reduce((n, q) => n + (q.servedToday ?? 0), 0)}
        </div>
        <div class="l">Served today</div>
      </div>
    </div>
  {/if}
</header>

<main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
  <div class="mb-6">
    <h2 class="text-xl font-semibold tracking-tight text-ink">Your queues</h2>
    <p class="mt-1 text-sm text-ink-muted">
      Personal by default. Share across the organization when you need to.
    </p>
  </div>

  {#if loading}
    <div class="grid gap-3 sm:grid-cols-2">
      {#each [1, 2] as _}
        <div class="card h-28 animate-pulse bg-paper-sunken"></div>
      {/each}
    </div>
  {:else if !auth.authenticated}
    <div class="card px-6 py-14 text-center">
      <p class="section-label mb-3">Account required</p>
      <h3 class="text-lg font-semibold text-ink">Log in or create an account</h3>
      <p class="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Use the account control in the header. Queues stay private to you unless shared with your team.
      </p>
    </div>
  {:else if error}
    <div class="card border-danger/30 bg-danger-soft p-5 text-danger">
      <p class="font-semibold">Something went wrong</p>
      <p class="mt-1 text-sm opacity-90">{error}</p>
      <button type="button" class="btn-secondary mt-4" onclick={() => load("full")}>Retry</button>
    </div>
  {:else if queues.length === 0}
    <div class="card px-6 py-14 text-center">
      <p class="section-label mb-3">Get started</p>
      <h3 class="text-lg font-semibold text-ink">No queues yet</h3>
      <p class="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Create a personal queue, or share one with your whole organization / a role group.
      </p>
      <button type="button" class="btn-primary btn-lg mt-6" onclick={() => (showCreate = true)}>
        Create a queue
      </button>
    </div>
  {:else}
    <ul class="grid gap-3 sm:grid-cols-2">
      {#each queues as q (q.id)}
        <li>
          <a
            href="/q/{q.id}"
            class="card group block p-4 transition hover:border-ink/30 hover:shadow-lift"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-ink group-hover:underline">
                  {q.name}
                </h3>
                <p class="mt-0.5 text-xs text-ink-faint">
                  <span class="badge bg-paper-sunken text-ink-muted">{q.scope ?? "personal"}</span>
                </p>
              </div>
              <span
                class="badge shrink-0"
                class:bg-success-soft={q.status === "active"}
                class:text-success={q.status === "active"}
                class:bg-warn-soft={q.status === "paused"}
                class:text-warn={q.status === "paused"}
              >
                {q.status}
              </span>
            </div>
            <div class="mt-4 flex items-end justify-between gap-3">
              <div class="flex gap-5">
                <div>
                  <p class="mono text-xl font-semibold text-ink">{q.waitingCount ?? 0}</p>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted">Waiting</p>
                </div>
                <div>
                  <p class="mono text-xl font-semibold text-ink">{q.calledCount ?? 0}</p>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted">Called</p>
                </div>
                <div>
                  <p class="mono text-xl font-semibold text-ink">{q.servedToday ?? 0}</p>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted">Served</p>
                </div>
              </div>
              <button
                type="button"
                class="btn-ghost btn-sm opacity-0 transition group-hover:opacity-100"
                onclick={(e) => archive(q, e)}
              >
                Archive
              </button>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<Modal open={showCreate} title="New queue" onclose={() => (showCreate = false)}>
  <form
    class="space-y-4"
    onsubmit={(e) => {
      e.preventDefault();
      createQueue();
    }}
  >
    <div>
      <label class="label" for="qname">Name</label>
      <input
        id="qname"
        class="input"
        placeholder="Dinner, Front desk…"
        bind:value={name}
        required
      />
    </div>
    <div>
      <label class="label" for="avg">Avg. minutes per party</label>
      <input
        id="avg"
        class="input mono"
        type="number"
        min="1"
        max="240"
        bind:value={avgMinutes}
      />
    </div>
    <div>
      <label class="label" for="scope">Visibility</label>
      <select id="scope" class="input" bind:value={scope}>
        <option value="personal">Personal — only you</option>
        {#if isTeam}
          <option value="organization">Organization — everyone on the team</option>
          <option value="roles">Roles — selected roles only</option>
        {/if}
      </select>
      {#if !isTeam}
        <p class="mt-1 text-xs text-ink-faint">
          Register or join a team organization to share queues.
        </p>
      {/if}
    </div>
    {#if scope === "roles" && roles.length > 0}
      <div>
        <p class="label">Roles that can access</p>
        <div class="flex flex-wrap gap-2">
          {#each roles as r (r.id)}
            <label class="inline-flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedRoleIds.includes(r.id)}
                onchange={() => toggleRole(r.id)}
              />
              {r.name}
            </label>
          {/each}
        </div>
      </div>
    {/if}
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" class="btn-secondary" onclick={() => (showCreate = false)}>
        Cancel
      </button>
      <button
        type="submit"
        class="btn-primary"
        disabled={creating || !name.trim() || (scope === "roles" && selectedRoleIds.length === 0)}
      >
        {creating ? "Creating…" : "Create"}
      </button>
    </div>
  </form>
</Modal>

<Modal open={showLan} title="Share on this network" onclose={() => (showLan = false)}>
  <p class="mb-3 text-sm text-ink-muted">
    Phones on the same Wi‑Fi can open the app in a browser. No native app needed.
  </p>
  {#if lanUrls.length === 0}
    <p class="text-sm text-ink-faint">No LAN address found. Use this machine’s URL.</p>
  {:else}
    <div class="flex flex-col items-center gap-4">
      <QrCode value={lanUrls[0]!} size={160} />
      <ul class="w-full space-y-2">
        {#each lanUrls as u}
          <li class="flex items-center gap-2">
            <code class="mono flex-1 break-all text-xs">{u}</code>
            <button
              type="button"
              class="btn-secondary btn-sm"
              onclick={async () => {
                await navigator.clipboard.writeText(u);
                toast("Copied", "success");
              }}
            >
              Copy
            </button>
          </li>
        {/each}
      </ul>
      <p class="text-center text-xs text-ink-faint">
        Guest join links are <span class="mono">/join/&lt;queue-slug&gt;</span> on the same host.
      </p>
    </div>
  {/if}
</Modal>

<Toast items={toasts} />
