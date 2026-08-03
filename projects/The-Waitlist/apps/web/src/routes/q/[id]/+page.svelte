<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api, type Entry, type Queue, ApiError } from "$lib/api";
  import { auth } from "$lib/auth.svelte";
  import { createRealtime } from "$lib/ws";
  import { throttleTrailing } from "$lib/sync";
  import { formatDateTime, partyLabel, statusLabel } from "$lib/format";
  import AuthMenu from "$lib/components/AuthMenu.svelte";
  import EntryCard from "$lib/components/EntryCard.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import QrCode from "$lib/components/QrCode.svelte";
  import Toast, { type ToastItem } from "$lib/components/Toast.svelte";

  let queue = $state<Queue | null>(null);
  let entries = $state<Entry[]>([]);
  let history = $state<Entry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let historyOpen = $state(false);
  let historyLoading = $state(false);
  let selectedHistory = $state<Set<string>>(new Set());

  let showAdd = $state(false);
  let showShare = $state(false);
  let showSettings = $state(false);
  let showEdit = $state(false);
  let showDeleteQueue = $state(false);
  let deleteConfirmName = $state("");
  let editing = $state<Entry | null>(null);

  let addName = $state("");
  let addParty = $state(2);
  let addPhone = $state("");
  let addNote = $state("");

  let editName = $state("");
  let editParty = $state(1);
  let editPhone = $state("");
  let editEmail = $state("");
  let editNote = $state("");

  let settingsName = $state("");
  let settingsAvg = $state(10);
  let settingsStatus = $state<"active" | "paused">("active");

  let toasts = $state<ToastItem[]>([]);
  let toastSeq = 0;
  let rt: ReturnType<typeof createRealtime> | null = null;

  const queueId = $derived($page.params.id ?? "");
  const joinUrl = $derived(
    typeof window !== "undefined" && queue
      ? `${window.location.origin}/join/${queue.slug}`
      : "",
  );
  const called = $derived(entries.filter((e) => e.status === "called"));
  const waiting = $derived(entries.filter((e) => e.status === "waiting"));

  function toast(message: string, kind: ToastItem["kind"] = "info") {
    const id = ++toastSeq;
    toasts = [...toasts, { id, message, kind }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2600);
  }

  let refreshInFlight = false;

  /** Soft refresh: no auth storm, no full-page loading flash after first paint. */
  async function refresh(mode: "full" | "soft" = "soft") {
    if (!queueId) return;
    if (refreshInFlight && mode === "soft") return;
    refreshInFlight = true;
    try {
      if (mode === "full") {
        await auth.refresh();
      }
      const [qRes, eRes] = await Promise.all([
        api.getQueue(queueId),
        api.listEntries(queueId),
      ]);
      const nextQ = qRes.queue;
      const nextE = eRes.entries;
      if (JSON.stringify(queue) !== JSON.stringify(nextQ)) queue = nextQ;
      if (JSON.stringify(entries) !== JSON.stringify(nextE)) entries = nextE;
      error = null;
      if (historyOpen) await loadHistory(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        error = "Log in required to manage this queue.";
      } else if (mode === "full" || !queue) {
        error = e instanceof ApiError ? e.message : "Failed to load queue";
      }
    } finally {
      loading = false;
      refreshInFlight = false;
    }
  }

  const softRefresh = throttleTrailing(() => {
    void refresh("soft");
  }, 2500);

  async function loadHistory(showSpinner = true) {
    if (!queueId) return;
    if (showSpinner) historyLoading = true;
    try {
      const res = await api.listHistory(queueId);
      history = res.entries;
      // Drop selections that no longer exist
      const ids = new Set(history.map((h) => h.id));
      selectedHistory = new Set([...selectedHistory].filter((id) => ids.has(id)));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not load history", "error");
    } finally {
      historyLoading = false;
    }
  }

  function toggleHistorySelect(id: string) {
    const next = new Set(selectedHistory);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedHistory = next;
  }

  function selectAllHistory() {
    selectedHistory = new Set(history.map((h) => h.id));
  }

  function clearHistorySelection() {
    selectedHistory = new Set();
  }

  async function deleteSelectedHistory() {
    if (selectedHistory.size === 0) return;
    if (
      !confirm(
        `Permanently delete ${selectedHistory.size} history item(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    await withBusy(async () => {
      const { deleted } = await api.deleteHistory(queueId, {
        ids: [...selectedHistory],
      });
      toast(`Deleted ${deleted} history item(s)`, "success");
      selectedHistory = new Set();
      await loadHistory(false);
    });
  }

  async function deleteAllHistory() {
    if (history.length === 0) return;
    if (
      !confirm(
        `Permanently delete ALL ${history.length} history items? This cannot be undone.`,
      )
    ) {
      return;
    }
    await withBusy(async () => {
      const { deleted } = await api.deleteHistory(queueId, { all: true });
      toast(`Deleted ${deleted} history item(s)`, "success");
      selectedHistory = new Set();
      await loadHistory(false);
    });
  }

  async function destroyQueue() {
    if (!queue) return;
    await withBusy(async () => {
      await api.destroyQueue(queue!.id, deleteConfirmName.trim());
      toast("Queue deleted", "success");
      await goto("/");
    });
  }

  async function toggleHistory() {
    historyOpen = !historyOpen;
    if (historyOpen) await loadHistory();
  }

  async function withBusy(fn: () => Promise<void>) {
    busy = true;
    try {
      await fn();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action failed", "error");
    } finally {
      busy = false;
    }
  }

  async function callNext() {
    await withBusy(async () => {
      const { entry } = await api.callNext(queueId);
      if (!entry) toast("No one waiting");
      else toast(`Called ${entry.name}`, "success");
      await refresh();
    });
  }

  async function addPerson() {
    if (!addName.trim()) return;
    await withBusy(async () => {
      await api.addEntry(queueId, {
        name: addName.trim(),
        partySize: addParty,
        phone: addPhone.trim() || null,
        note: addNote.trim() || null,
      });
      showAdd = false;
      addName = "";
      addParty = 2;
      addPhone = "";
      addNote = "";
      toast("Added to waitlist", "success");
      await refresh();
    });
  }

  function openEdit(entry: Entry) {
    editing = entry;
    editName = entry.name;
    editParty = entry.partySize;
    editPhone = entry.phone ?? "";
    editEmail = entry.email ?? "";
    editNote = entry.note ?? "";
    showEdit = true;
  }

  async function saveEdit() {
    if (!editing || !editName.trim()) return;
    await withBusy(async () => {
      await api.updateEntry(editing!.id, {
        name: editName.trim(),
        partySize: editParty,
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        note: editNote.trim() || null,
      });
      showEdit = false;
      editing = null;
      toast("Entry updated", "success");
      await refresh();
    });
  }

  /** Re-queue a historical guest as a new waiting entry. */
  async function reAdd(h: Entry) {
    await withBusy(async () => {
      await api.addEntry(queueId, {
        name: h.name,
        partySize: h.partySize,
        phone: h.phone,
        email: h.email,
        note: h.note,
      });
      toast(`Re-added ${h.name}`, "success");
      await refresh();
      await loadHistory(false);
    });
  }

  async function saveSettings() {
    await withBusy(async () => {
      await api.updateQueue(queueId, {
        name: settingsName.trim(),
        avgServiceMinutes: settingsAvg,
        status: settingsStatus,
      });
      showSettings = false;
      toast("Queue updated", "success");
      await refresh();
    });
  }

  function openSettings() {
    if (!queue) return;
    settingsName = queue.name;
    settingsAvg = queue.avgServiceMinutes;
    settingsStatus = queue.status === "paused" ? "paused" : "active";
    showSettings = true;
  }

  async function copyLink() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    toast("Join link copied", "success");
  }

  onMount(() => {
    void refresh("full");
    const unsub = auth.onChange(() => {
      void refresh("full");
    });
    rt = createRealtime((ev) => {
      if (ev.type === "connected" || ev.type === "pong" || ev.type === "subscribed") {
        return;
      }
      if (
        ev.type?.startsWith("entry.") ||
        ev.type === "queue.updated" ||
        ev.type === "queue.list_changed" ||
        ev.type === "entry.reordered"
      ) {
        if (!ev.queueId || ev.queueId === queueId || queue?.id === ev.queueId) {
          softRefresh();
        }
      }
    });
    if (queueId) rt.subscribe(queueId);
    const poll = setInterval(() => void refresh("soft"), 60_000);
    return () => {
      unsub();
      clearInterval(poll);
    };
  });

  onDestroy(() => rt?.close());
</script>

<svelte:head>
  <title>{queue?.name ?? "Queue"} · The Waitlist</title>
</svelte:head>

{#if loading}
  <div class="flex min-h-dvh items-center justify-center text-ink-muted">Loading…</div>
{:else if error || !queue}
  <div class="mx-auto max-w-lg px-4 py-16 text-center">
    <p class="text-danger">{error ?? "Queue not found"}</p>
    <a href="/" class="btn-secondary mt-4 inline-flex">All queues</a>
  </div>
{:else}
  <!-- Command bar header (not a soft SaaS nav) -->
  <header class="app-bar sticky top-0 z-20">
    <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
      <div class="flex min-w-0 items-center gap-3">
        <a href="/" class="app-bar-btn shrink-0" title="All queues">← Queues</a>
        <div class="min-w-0 border-l border-white/15 pl-3">
          <h1 class="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
            {queue.name}
          </h1>
          <p class="app-bar-meta mt-0.5 truncate">
            {queue.status === "paused" ? "Paused · " : ""}
            ~{queue.avgServiceMinutes} min / party
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="app-bar-btn"
          class:app-bar-btn-solid={historyOpen}
          onclick={toggleHistory}
        >
          History
        </button>
        <button type="button" class="app-bar-btn" onclick={() => (showShare = true)}>
          Share
        </button>
        <button type="button" class="app-bar-btn" onclick={openSettings}>
          Settings
        </button>
        <AuthMenu />
      </div>
    </div>
    <div class="stat-strip mx-auto max-w-3xl">
      <div>
        <div class="n">{waiting.length}</div>
        <div class="l">Waiting</div>
      </div>
      <div>
        <div class="n">{called.length}</div>
        <div class="l">Called</div>
      </div>
      <div>
        <div class="n">{queue.servedToday ?? 0}</div>
        <div class="l">Served today</div>
      </div>
    </div>
  </header>

  <!-- Primary actions -->
  <div class="sticky top-[97px] z-10 border-b border-black/10 bg-paper-elevated">
    <div class="mx-auto flex max-w-3xl gap-2 px-4 py-2.5">
      <button
        type="button"
        class="btn-primary flex-1 btn-lg"
        disabled={busy}
        onclick={() => (showAdd = true)}
      >
        Add person
      </button>
      <button
        type="button"
        class="btn-accent flex-1 btn-lg"
        disabled={busy || waiting.length === 0}
        onclick={callNext}
      >
        Call next
      </button>
    </div>
  </div>

  <main class="mx-auto max-w-3xl space-y-6 px-4 py-5 pb-28">
    {#if called.length > 0}
      <section>
        <h2 class="section-label mb-2" style="color: var(--color-called)">Now serving</h2>
        <div class="space-y-2">
          {#each called as entry (entry.id)}
            <EntryCard
              {entry}
              {busy}
              onedit={openEdit}
              onserve={(id: string) =>
                withBusy(async () => {
                  await api.serveEntry(id);
                  await refresh();
                })}
              onnoshow={(id: string) =>
                withBusy(async () => {
                  await api.noShowEntry(id);
                  await refresh();
                })}
              oncancel={(id: string) =>
                withBusy(async () => {
                  await api.cancelEntry(id);
                  await refresh();
                })}
            />
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h2 class="section-label mb-2">Waiting · {waiting.length}</h2>
      {#if waiting.length === 0}
        <div class="card px-5 py-10 text-center">
          <p class="font-medium text-ink">Line is empty</p>
          <p class="mt-1 text-sm text-ink-muted">
            Add someone, share the join link, or re-add from History.
          </p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each waiting as entry (entry.id)}
            <EntryCard
              {entry}
              {busy}
              onedit={openEdit}
              oncall={(id: string) =>
                withBusy(async () => {
                  await api.callEntry(id);
                  await refresh();
                })}
              onserve={(id: string) =>
                withBusy(async () => {
                  await api.serveEntry(id);
                  await refresh();
                })}
              onnoshow={(id: string) =>
                withBusy(async () => {
                  await api.noShowEntry(id);
                  await refresh();
                })}
              oncancel={(id: string) =>
                withBusy(async () => {
                  await api.cancelEntry(id);
                  await refresh();
                })}
              onmoveup={(id: string) =>
                withBusy(async () => {
                  const pos = entry.position;
                  if (pos && pos > 1) {
                    await api.reorderEntry(id, pos - 1);
                    await refresh();
                  }
                })}
              onmovedown={(id: string) =>
                withBusy(async () => {
                  const pos = entry.position;
                  if (pos) {
                    await api.reorderEntry(id, pos + 1);
                    await refresh();
                  }
                })}
            />
          {/each}
        </div>
      {/if}
    </section>

    <!-- History panel -->
    {#if historyOpen}
      <section class="border-t border-black/10 pt-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="section-label">History</h2>
          <div class="flex flex-wrap items-center gap-1">
            <button
              type="button"
              class="btn-ghost btn-sm"
              disabled={historyLoading || busy || history.length === 0}
              onclick={selectAllHistory}
            >
              Select all
            </button>
            <button
              type="button"
              class="btn-ghost btn-sm"
              disabled={selectedHistory.size === 0}
              onclick={clearHistorySelection}
            >
              Clear
            </button>
            <button
              type="button"
              class="btn-danger btn-sm"
              disabled={busy || selectedHistory.size === 0}
              onclick={deleteSelectedHistory}
            >
              Delete selected ({selectedHistory.size})
            </button>
            <button
              type="button"
              class="btn-ghost btn-sm"
              style="color: var(--color-danger)"
              disabled={busy || history.length === 0}
              onclick={deleteAllHistory}
            >
              Delete all
            </button>
            <button
              type="button"
              class="btn-ghost btn-sm"
              disabled={historyLoading || busy}
              onclick={() => loadHistory()}
            >
              {historyLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
        <p class="mb-3 text-xs text-ink-muted">
          Served, no-show, and removed parties. Select rows to purge, or re-add to the line.
        </p>
        {#if historyLoading && history.length === 0}
          <p class="text-sm text-ink-muted">Loading history…</p>
        {:else if history.length === 0}
          <div class="card px-5 py-8 text-center text-sm text-ink-muted">
            No completed entries yet. Seat or remove someone and they’ll show up here.
          </div>
        {:else}
          <ul class="card divide-y divide-black/8 overflow-hidden">
            {#each history as h (h.id)}
              <li class="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    class="mt-1 h-4 w-4 accent-ink"
                    checked={selectedHistory.has(h.id)}
                    onchange={() => toggleHistorySelect(h.id)}
                    aria-label="Select {h.name}"
                  />
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span class="font-semibold text-ink">{h.name}</span>
                      <span class="text-xs text-ink-muted">{partyLabel(h.partySize)}</span>
                      <span
                        class="badge"
                        class:bg-success-soft={h.status === "served"}
                        class:text-success={h.status === "served"}
                        class:bg-warn-soft={h.status === "no_show"}
                        class:text-warn={h.status === "no_show"}
                        class:bg-paper-sunken={h.status === "cancelled"}
                        class:text-ink-muted={h.status === "cancelled"}
                      >
                        {statusLabel(h.status)}
                      </span>
                    </div>
                    <div class="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                      <span>{formatDateTime(h.updatedAt)}</span>
                      {#if h.phone}
                        <span class="mono">{h.phone}</span>
                      {/if}
                      {#if h.note}
                        <span class="italic truncate">“{h.note}”</span>
                      {/if}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-secondary btn-sm shrink-0 self-start sm:self-center"
                  disabled={busy || queue.status === "paused"}
                  onclick={() => reAdd(h)}
                >
                  Re-add to line
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </main>

  <!-- Add person -->
  <Modal open={showAdd} title="Add person" onclose={() => (showAdd = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        addPerson();
      }}
    >
      <div>
        <label class="label" for="name">Name</label>
        <input id="name" class="input" bind:value={addName} required placeholder="Guest name" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="party">Party size</label>
          <input id="party" class="input mono" type="number" min="1" max="99" bind:value={addParty} />
        </div>
        <div>
          <label class="label" for="phone">Phone</label>
          <input id="phone" class="input mono" type="tel" bind:value={addPhone} placeholder="Optional" />
        </div>
      </div>
      <div>
        <label class="label" for="note">Note</label>
        <input id="note" class="input" bind:value={addNote} placeholder="Optional" />
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="btn-secondary" onclick={() => (showAdd = false)}>Cancel</button>
        <button type="submit" class="btn-primary" disabled={busy || !addName.trim()}>
          Add to line
        </button>
      </div>
    </form>
  </Modal>

  <!-- Edit entry -->
  <Modal
    open={showEdit}
    title="Edit entry"
    onclose={() => {
      showEdit = false;
      editing = null;
    }}
  >
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        saveEdit();
      }}
    >
      <div>
        <label class="label" for="ename">Name</label>
        <input id="ename" class="input" bind:value={editName} required />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="eparty">Party size</label>
          <input id="eparty" class="input mono" type="number" min="1" max="99" bind:value={editParty} />
        </div>
        <div>
          <label class="label" for="ephone">Phone</label>
          <input id="ephone" class="input mono" type="tel" bind:value={editPhone} />
        </div>
      </div>
      <div>
        <label class="label" for="eemail">Email</label>
        <input id="eemail" class="input" type="email" bind:value={editEmail} placeholder="Optional" />
      </div>
      <div>
        <label class="label" for="enote">Note</label>
        <input id="enote" class="input" bind:value={editNote} />
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <button
          type="button"
          class="btn-secondary"
          onclick={() => {
            showEdit = false;
            editing = null;
          }}
        >
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={busy || !editName.trim()}>
          Save changes
        </button>
      </div>
    </form>
  </Modal>

  <!-- Share -->
  <Modal open={showShare} title="Guest join link" onclose={() => (showShare = false)}>
    <div class="flex flex-col items-center gap-4">
      {#if joinUrl}
        <QrCode value={joinUrl} size={176} />
        <p class="mono break-all text-center text-xs text-ink-muted">{joinUrl}</p>
        <div class="flex w-full gap-2">
          <button type="button" class="btn-primary flex-1" onclick={copyLink}>Copy link</button>
          <a
            class="btn-secondary flex-1 text-center"
            href="/join/{queue.slug}"
            target="_blank"
            rel="noopener"
          >
            Open
          </a>
        </div>
        <p class="text-center text-xs text-ink-faint">
          Guests use this to join and watch their place in line.
        </p>
      {/if}
    </div>
  </Modal>

  <!-- Settings -->
  <Modal open={showSettings} title="Queue settings" onclose={() => (showSettings = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        saveSettings();
      }}
    >
      <div>
        <label class="label" for="sname">Name</label>
        <input id="sname" class="input" bind:value={settingsName} required />
      </div>
      <div>
        <label class="label" for="savg">Avg. minutes per party</label>
        <input id="savg" class="input mono" type="number" min="1" max="240" bind:value={settingsAvg} />
      </div>
      <div>
        <label class="label" for="sstatus">Status</label>
        <select id="sstatus" class="input" bind:value={settingsStatus}>
          <option value="active">Active — accepting joins</option>
          <option value="paused">Paused — no new joins</option>
        </select>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="btn-secondary" onclick={() => (showSettings = false)}>
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={busy}>Save</button>
      </div>
    </form>

    <div class="mt-8 border-t border-black/10 pt-5">
      <p class="section-label mb-2" style="color: var(--color-danger)">Danger zone</p>
      <p class="mb-3 text-xs text-ink-muted">
        Permanently delete this queue and every entry in it. Archive hides it without destroying data.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn-secondary btn-sm"
          disabled={busy}
          onclick={async () => {
            if (!queue) return;
            if (!confirm(`Archive “${queue.name}”?`)) return;
            await withBusy(async () => {
              await api.archiveQueue(queue!.id);
              toast("Queue archived");
              await goto("/");
            });
          }}
        >
          Archive queue
        </button>
        <button
          type="button"
          class="btn-danger btn-sm"
          disabled={busy}
          onclick={() => {
            deleteConfirmName = "";
            showSettings = false;
            showDeleteQueue = true;
          }}
        >
          Delete queue…
        </button>
      </div>
    </div>
  </Modal>

  <!-- Permanent delete confirmation -->
  <Modal
    open={showDeleteQueue}
    title="Delete queue permanently"
    onclose={() => (showDeleteQueue = false)}
  >
    <p class="text-sm text-ink-muted">
      Type the queue name
      <span class="font-semibold text-ink">{queue.name}</span>
      to confirm. This cannot be undone.
    </p>
    <form
      class="mt-4 space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        destroyQueue();
      }}
    >
      <div>
        <label class="label" for="delname">Queue name</label>
        <input id="delname" class="input" bind:value={deleteConfirmName} autocomplete="off" />
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" onclick={() => (showDeleteQueue = false)}>
          Cancel
        </button>
        <button
          type="submit"
          class="btn-danger"
          disabled={busy || deleteConfirmName.trim() !== queue.name}
        >
          Delete forever
        </button>
      </div>
    </form>
  </Modal>

  <Toast items={toasts} />
{/if}
