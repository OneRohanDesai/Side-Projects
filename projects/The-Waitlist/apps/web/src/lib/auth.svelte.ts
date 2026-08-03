import { api, type AuthUser, type SignupBody, ApiError } from "./api";

type AuthListener = () => void;

function userKey(u: AuthUser | null): string {
  if (!u) return "";
  return `${u.id}|${u.roleId ?? ""}|${u.organizationId ?? ""}|${u.username}`;
}

class AuthState {
  user = $state<AuthUser | null>(null);
  needsBootstrap = $state(false);
  loaded = $state(false);
  error = $state<string | null>(null);
  /** One-time join code after registering an org */
  lastJoinSecretCode = $state<string | null>(null);

  private listeners = new Set<AuthListener>();

  get authenticated() {
    return !!this.user;
  }

  onChange(fn: AuthListener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // never let a listener crash others
      }
    }
  }

  /**
   * Refresh session from server.
   * Only notifies listeners when identity actually changes (login/logout/role).
   * Avoids load→refresh→notify→load loops.
   */
  async refresh(opts?: { forceNotify?: boolean }) {
    const prev = userKey(this.user);
    const prevBootstrap = this.needsBootstrap;
    try {
      const s = await api.authStatus();
      this.user = s.user;
      this.needsBootstrap = s.needsBootstrap;
      this.error = null;
    } catch (e) {
      this.error = e instanceof ApiError ? e.message : "Auth check failed";
      this.user = null;
    } finally {
      this.loaded = true;
      const next = userKey(this.user);
      if (
        opts?.forceNotify ||
        next !== prev ||
        this.needsBootstrap !== prevBootstrap
      ) {
        this.notify();
      }
    }
  }

  async login(username: string, password: string) {
    const res = await api.login({ username, password });
    this.user = res.user;
    this.needsBootstrap = false;
    this.error = null;
    this.lastJoinSecretCode = null;
    this.loaded = true;
    this.notify();
    return res.user;
  }

  async signup(body: SignupBody) {
    const res = await api.signup(body);
    this.user = res.user;
    this.needsBootstrap = false;
    this.error = null;
    this.lastJoinSecretCode = res.joinSecretCode;
    this.loaded = true;
    this.notify();
    return res;
  }

  async logout() {
    await api.logout();
    this.user = null;
    this.lastJoinSecretCode = null;
    this.notify();
  }
}

export const auth = new AuthState();
