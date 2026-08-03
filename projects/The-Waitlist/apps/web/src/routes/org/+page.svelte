<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    api,
    type Member,
    type Role,
    ApiError,
  } from "$lib/api";
  import { auth } from "$lib/auth.svelte";
  import { createRealtime } from "$lib/ws";
  import { throttleTrailing } from "$lib/sync";
  import AuthMenu from "$lib/components/AuthMenu.svelte";
  import Toast, { type ToastItem } from "$lib/components/Toast.svelte";

  let members = $state<Member[]>([]);
  let roles = $state<Role[]>([]);
  let orgName = $state("");
  let loading = $state(true);
  let error = $state<string | null>(null);
  let newRole = $state("");
  let shownSecret = $state<string | null>(null);
  let busy = $state(false);
  let toasts = $state<ToastItem[]>([]);
  let toastSeq = 0;
  let rt: ReturnType<typeof createRealtime> | null = null;

  function toast(message: string, kind: ToastItem["kind"] = "info") {
    const id = ++toastSeq;
    toasts = [...toasts, { id, message, kind }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2600);
  }

  async function load(mode: "full" | "soft" = "full") {
    if (mode === "full") {
      loading = true;
      error = null;
    }
    try {
      if (mode === "full") await auth.refresh();
      if (!auth.user?.canManageOrg) {
        if (mode === "full") await goto("/");
        return;
      }
      const res = await api.myOrg();
      orgName = res.organization?.name ?? "";
      members = res.members;
      roles = res.roles;
    } catch (e) {
      if (mode === "full") {
        error = e instanceof ApiError ? e.message : "Failed to load";
      }
    } finally {
      if (mode === "full") loading = false;
    }
  }

  const softLoad = throttleTrailing(() => {
    void load("soft");
  }, 3000);

  async function rotate() {
    busy = true;
    try {
      const res = await api.rotateJoinCode();
      shownSecret = res.secretCode;
      toast("Join code rotated", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed", "error");
    } finally {
      busy = false;
    }
  }

  async function addRole() {
    if (!newRole.trim()) return;
    busy = true;
    try {
      await api.createRole(newRole.trim());
      newRole = "";
      toast("Role created", "success");
      await load("soft");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed", "error");
    } finally {
      busy = false;
    }
  }

  async function setMemberRole(userId: string, roleId: string) {
    busy = true;
    try {
      await api.assignMemberRole(userId, roleId);
      toast("Role updated", "success");
      await load("soft");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed", "error");
    } finally {
      busy = false;
    }
  }

  async function removeRole(roleId: string, name: string) {
    if (!confirm(`Delete role “${name}”? Members move to staff.`)) return;
    busy = true;
    try {
      await api.deleteRole(roleId);
      toast("Role deleted");
      await load("soft");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed", "error");
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void load("full");
    rt = createRealtime((ev) => {
      if (ev.type === "members.updated" || ev.type === "org.updated") softLoad();
    });
  });

  onDestroy(() => rt?.close());
</script>

<svelte:head>
  <title>Team · The Waitlist</title>
</svelte:head>

<header class="app-bar">
  <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
    <div class="flex min-w-0 items-center gap-3">
      <a href="/" class="app-bar-btn shrink-0">← Queues</a>
      <div class="min-w-0 border-l border-white/15 pl-3">
        <h1 class="truncate text-base font-semibold text-white">Team</h1>
        <p class="app-bar-meta truncate">{orgName || "Organization"}</p>
      </div>
    </div>
    <AuthMenu />
  </div>
</header>

<main class="mx-auto max-w-3xl space-y-8 px-4 py-6">
  {#if loading}
    <p class="text-ink-muted">Loading…</p>
  {:else if error}
    <p class="text-danger">{error}</p>
  {:else}
    <section>
      <h2 class="section-label mb-2">Join code</h2>
      <p class="mb-3 text-sm text-ink-muted">
        Staff sign up with this code. Rotate daily or after a leak. In managed mode the code is also emailed to the org contact.
      </p>
      {#if shownSecret}
        <div class="card mb-3 p-4">
          <p class="mono text-2xl font-semibold tracking-widest">{shownSecret}</p>
        </div>
      {/if}
      <button type="button" class="btn-primary" disabled={busy} onclick={rotate}>
        {busy ? "…" : shownSecret ? "Rotate again" : "Show / rotate join code"}
      </button>
    </section>

    <section>
      <h2 class="section-label mb-2">Roles</h2>
      <p class="mb-3 text-sm text-ink-muted">
        Text labels like receptionist, waiter, chef. Assign queues to roles when creating them.
      </p>
      <ul class="card mb-3 divide-y divide-black/8">
        {#each roles as r (r.id)}
          <li class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              <span class="font-medium">{r.name}</span>
              {#if r.isSystem}
                <span class="badge ml-1 bg-paper-sunken text-ink-faint">system</span>
              {/if}
              {#if r.canManageOrg}
                <span class="badge ml-1 bg-paper-sunken">manager</span>
              {/if}
            </span>
            {#if !r.isSystem}
              <button
                type="button"
                class="btn-ghost btn-sm"
                style="color: var(--color-danger)"
                disabled={busy}
                onclick={() => removeRole(r.id, r.name)}
              >
                Delete
              </button>
            {/if}
          </li>
        {/each}
      </ul>
      <form
        class="flex gap-2"
        onsubmit={(e) => {
          e.preventDefault();
          addRole();
        }}
      >
        <input
          class="input"
          placeholder="New role (e.g. receptionist)"
          bind:value={newRole}
        />
        <button type="submit" class="btn-secondary shrink-0" disabled={busy || !newRole.trim()}>
          Add
        </button>
      </form>
    </section>

    <section>
      <h2 class="section-label mb-2">Members</h2>
      <ul class="card divide-y divide-black/8">
        {#each members as m (m.id)}
          <li class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-medium text-ink">{m.username}</p>
              {#if m.email}
                <p class="text-xs text-ink-faint">{m.email}</p>
              {/if}
            </div>
            <select
              class="input max-w-[12rem]"
              value={m.roleId ?? ""}
              disabled={busy || m.id === auth.user?.id}
              onchange={(e) => setMemberRole(m.id, e.currentTarget.value)}
            >
              {#each roles as r (r.id)}
                <option value={r.id}>{r.name}</option>
              {/each}
            </select>
          </li>
        {/each}
        {#if members.length === 0}
          <li class="px-3 py-6 text-center text-sm text-ink-muted">No members yet.</li>
        {/if}
      </ul>
    </section>
  {/if}
</main>

<Toast items={toasts} />
