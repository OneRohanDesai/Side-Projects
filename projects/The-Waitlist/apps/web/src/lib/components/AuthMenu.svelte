<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { api, type OrgPublic, ApiError } from "$lib/api";

  let open = $state(false);
  let mode = $state<"login" | "signup" | "account">("login");
  let signupPath = $state<"individual" | "join" | "register_org">("individual");

  let username = $state("");
  let password = $state("");
  let email = $state("");
  let orgName = $state("");
  let orgQuery = $state("");
  let orgResults = $state<OrgPublic[]>([]);
  let selectedOrg = $state<OrgPublic | null>(null);
  let secretCode = $state("");
  let shownSecret = $state<string | null>(null);

  let busy = $state(false);
  let formError = $state<string | null>(null);
  let rootEl: HTMLDivElement | undefined = $state();
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    auth.refresh();
  });

  $effect(() => {
    if (auth.needsBootstrap) mode = "signup";
    else if (auth.authenticated) mode = "account";
    else if (mode === "account") mode = "login";
  });

  function toggle() {
    open = !open;
    formError = null;
    if (open && auth.lastJoinSecretCode) {
      shownSecret = auth.lastJoinSecretCode;
    }
  }

  /** Keep popup open when switching login ↔ signup (DOM re-render would detach click target). */
  function switchMode(next: "login" | "signup", e?: Event) {
    e?.preventDefault();
    e?.stopPropagation();
    mode = next;
    formError = null;
    open = true;
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open || !rootEl) return;
    // composedPath survives re-renders better than e.target + contains()
    const path = e.composedPath();
    if (path.includes(rootEl)) return;
    open = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") open = false;
  }

  function searchOrgs(q: string) {
    orgQuery = q;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        const res = await api.searchOrgs(q);
        orgResults = res.organizations;
      } catch {
        orgResults = [];
      }
    }, 200);
  }

  async function submitLogin() {
    formError = null;
    busy = true;
    try {
      await auth.login(username, password);
      password = "";
      open = false;
    } catch (e) {
      formError = e instanceof ApiError ? e.message : "Login failed";
    } finally {
      busy = false;
    }
  }

  async function submitSignup() {
    formError = null;
    busy = true;
    try {
      if (signupPath === "individual") {
        await auth.signup({
          mode: "individual",
          username,
          password,
          email: email || undefined,
        });
      } else if (signupPath === "join") {
        if (!selectedOrg) {
          formError = "Select an organization";
          busy = false;
          return;
        }
        await auth.signup({
          mode: "join",
          username,
          password,
          email: email || undefined,
          organizationId: selectedOrg.id,
          secretCode,
        });
      } else {
        if (!email.trim()) {
          formError = "Email is required to register an organization";
          busy = false;
          return;
        }
        const res = await auth.signup({
          mode: "register_org",
          username,
          password,
          email: email.trim(),
          organizationName: orgName.trim(),
        });
        shownSecret = res.joinSecretCode;
      }
      password = "";
      if (!shownSecret) open = false;
      else mode = "account";
    } catch (e) {
      formError = e instanceof ApiError ? e.message : "Sign up failed";
    } finally {
      busy = false;
    }
  }

  async function logout() {
    busy = true;
    formError = null;
    try {
      await auth.logout();
      open = false;
      mode = "login";
      shownSecret = null;
    } catch (e) {
      formError = e instanceof ApiError ? e.message : "Logout failed";
    } finally {
      busy = false;
    }
  }

  async function rotateCode() {
    busy = true;
    formError = null;
    try {
      const res = await api.rotateJoinCode();
      shownSecret = res.secretCode;
    } catch (e) {
      formError = e instanceof ApiError ? e.message : "Could not rotate code";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window onpointerdown={onDocPointerDown} onkeydown={onKey} />

<div class="relative" bind:this={rootEl}>
  {#if auth.authenticated && auth.user}
    <button type="button" class="app-bar-btn" onclick={toggle} aria-expanded={open}>
      <span class="max-w-[8rem] truncate">{auth.user.username}</span>
      <span class="text-white/40" aria-hidden="true">▾</span>
    </button>
  {:else}
    <button
      type="button"
      class="app-bar-btn app-bar-btn-solid"
      onclick={toggle}
      aria-expanded={open}
    >
      {auth.needsBootstrap ? "Create account" : "Log in"}
    </button>
  {/if}

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] border border-black/15 bg-paper-elevated text-ink shadow-lift"
      role="dialog"
      aria-label="Account"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="border-b border-black/10 px-3 py-2">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          {#if mode === "account"}
            Account
          {:else if mode === "signup"}
            Sign up
          {:else}
            Log in
          {/if}
        </p>
      </div>

      <div class="max-h-[min(80dvh,28rem)] overflow-y-auto p-3">
        {#if mode === "account" && auth.user}
          <p class="text-sm">
            <span class="font-semibold">{auth.user.username}</span>
            <span class="text-xs text-ink-muted"> · {auth.user.roleName}</span>
          </p>
          {#if auth.user.organizationName}
            <p class="mt-1 text-xs text-ink-muted">
              {auth.user.organizationName}
              {#if auth.user.organizationType === "team"}
                <span class="badge ml-1 bg-paper-sunken">team</span>
              {:else}
                <span class="badge ml-1 bg-paper-sunken">individual</span>
              {/if}
            </p>
          {/if}

          {#if shownSecret}
            <div class="mt-3 border border-black/10 bg-paper-sunken p-2">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Today’s join code
              </p>
              <p class="mono mt-1 text-lg font-semibold tracking-widest">{shownSecret}</p>
              <p class="mt-1 text-[11px] text-ink-faint">
                Share with staff signing up today. Rotate anytime.
              </p>
            </div>
          {/if}

          {#if auth.user.canManageOrg && auth.user.organizationType === "team"}
            <button
              type="button"
              class="btn-secondary mt-3 w-full btn-sm"
              disabled={busy}
              onclick={rotateCode}
            >
              {busy ? "…" : "Rotate join code"}
            </button>
            <a href="/org" class="btn-ghost mt-1 w-full btn-sm">Manage team</a>
          {/if}

          {#if formError}
            <p class="mt-2 bg-danger-soft px-2 py-1.5 text-xs text-danger">{formError}</p>
          {/if}

          <button
            type="button"
            class="btn-primary mt-4 w-full"
            disabled={busy}
            onclick={logout}
          >
            {busy ? "…" : "Log out"}
          </button>
        {:else if mode === "login"}
          <form
            class="space-y-3"
            onsubmit={(e) => {
              e.preventDefault();
              submitLogin();
            }}
          >
            <div>
              <label class="label" for="auth-user">Username</label>
              <input id="auth-user" class="input" bind:value={username} required autocomplete="username" />
            </div>
            <div>
              <label class="label" for="auth-pass">Password</label>
              <input
                id="auth-pass"
                class="input"
                type="password"
                bind:value={password}
                required
                autocomplete="current-password"
              />
            </div>
            {#if formError}
              <p class="bg-danger-soft px-2 py-1.5 text-xs text-danger">{formError}</p>
            {/if}
            <button type="submit" class="btn-primary w-full" disabled={busy}>
              {busy ? "…" : "Log in"}
            </button>
          </form>
          <button
            type="button"
            class="btn-ghost mt-2 w-full text-xs"
            onclick={(e) => switchMode("signup", e)}
          >
            Need an account? Sign up
          </button>
        {:else}
          <!-- Signup -->
          <div class="mb-3 flex flex-wrap gap-1">
            <button
              type="button"
              class="btn-sm {signupPath === 'individual' ? 'btn-primary' : 'btn-secondary'}"
              onclick={(e) => {
                e.stopPropagation();
                signupPath = "individual";
              }}
            >
              Individual
            </button>
            <button
              type="button"
              class="btn-sm {signupPath === 'join' ? 'btn-primary' : 'btn-secondary'}"
              onclick={(e) => {
                e.stopPropagation();
                signupPath = "join";
                searchOrgs("");
              }}
            >
              Join org
            </button>
            <button
              type="button"
              class="btn-sm {signupPath === 'register_org' ? 'btn-primary' : 'btn-secondary'}"
              onclick={(e) => {
                e.stopPropagation();
                signupPath = "register_org";
              }}
            >
              Register org
            </button>
          </div>

          <form
            class="space-y-3"
            onsubmit={(e) => {
              e.preventDefault();
              submitSignup();
            }}
          >
            <div>
              <label class="label" for="su-user">Username</label>
              <input id="su-user" class="input" bind:value={username} required minlength="3" maxlength="32" />
            </div>
            <div>
              <label class="label" for="su-pass">Password</label>
              <input
                id="su-pass"
                class="input"
                type="password"
                bind:value={password}
                required
                minlength="12"
                autocomplete="new-password"
              />
              <p class="mt-1 text-[11px] text-ink-faint">
                12+ chars, upper, lower, number, symbol.
              </p>
            </div>

            {#if signupPath === "register_org" || signupPath === "join"}
              <div>
                <label class="label" for="su-email">
                  Email {signupPath === "register_org" ? "(required)" : "(optional)"}
                </label>
                <input
                  id="su-email"
                  class="input"
                  type="email"
                  bind:value={email}
                  required={signupPath === "register_org"}
                />
              </div>
            {:else}
              <div>
                <label class="label" for="su-email2">Email (optional)</label>
                <input id="su-email2" class="input" type="email" bind:value={email} />
              </div>
            {/if}

            {#if signupPath === "register_org"}
              <div>
                <label class="label" for="su-orgname">Organization name</label>
                <input
                  id="su-orgname"
                  class="input"
                  bind:value={orgName}
                  required
                  placeholder="e.g. Riverside Clinic"
                />
                <p class="mt-1 text-[11px] text-ink-faint">
                  You become the manager. Join codes are shown here (rotate anytime under Team).
                </p>
              </div>
            {/if}

            {#if signupPath === "join"}
              <div>
                <label class="label" for="su-orgq">Find organization</label>
                <input
                  id="su-orgq"
                  class="input"
                  value={orgQuery}
                  oninput={(e) => searchOrgs(e.currentTarget.value)}
                  placeholder="Search…"
                />
                {#if orgResults.length > 0}
                  <ul class="mt-1 max-h-32 overflow-y-auto border border-black/10">
                    {#each orgResults as o (o.id)}
                      <li>
                        <button
                          type="button"
                          class="w-full px-2 py-1.5 text-left text-sm hover:bg-paper-sunken {selectedOrg?.id === o.id
                            ? 'bg-paper-sunken font-semibold'
                            : ''}"
                          onclick={() => (selectedOrg = o)}
                        >
                          {o.name}
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
                {#if selectedOrg}
                  <p class="mt-1 text-xs text-ink-muted">Selected: {selectedOrg.name}</p>
                {/if}
              </div>
              <div>
                <label class="label" for="su-code">Join code</label>
                <input
                  id="su-code"
                  class="input mono"
                  bind:value={secretCode}
                  required
                  placeholder="ABCD-EFGH"
                  autocomplete="off"
                />
                <p class="mt-1 text-[11px] text-ink-faint">
                  Ask your manager for today’s code.
                </p>
              </div>
            {/if}

            {#if formError}
              <p class="bg-danger-soft px-2 py-1.5 text-xs text-danger">{formError}</p>
            {/if}

            <button type="submit" class="btn-primary w-full" disabled={busy}>
              {busy ? "…" : "Create account"}
            </button>
          </form>

          {#if !auth.needsBootstrap}
            <button
              type="button"
              class="btn-ghost mt-2 w-full text-xs"
              onclick={(e) => switchMode("login", e)}
            >
              Have an account? Log in
            </button>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
