import type { Env, SessionData } from "./types";

export const COOKIE = "aesthete_sid";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const KV_PREFIX = "session:";
const OAUTH_PREFIX = "oauth:";

export function randomString(len = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getSessionId(request: Request): string | null {
  const raw = request.headers.get("Cookie") || "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function readSession(request: Request, env: Env): Promise<SessionData | null> {
  const sid = getSessionId(request);
  if (!sid || !env.CACHE) return null;
  try {
    const data = await env.CACHE.get(`${KV_PREFIX}${sid}`, "json");
    return (data as SessionData) || null;
  } catch {
    return null;
  }
}

export async function createSession(env: Env, data: SessionData): Promise<string> {
  if (!env.CACHE) throw new Error("KV CACHE binding missing — cannot store session");
  const sid = randomString(24);
  await env.CACHE.put(`${KV_PREFIX}${sid}`, JSON.stringify(data), {
    expirationTtl: SESSION_TTL,
  });
  return sid;
}

export async function updateSession(env: Env, sid: string, data: SessionData): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(`${KV_PREFIX}${sid}`, JSON.stringify(data), {
    expirationTtl: SESSION_TTL,
  });
}

export async function destroySession(env: Env, sid: string | null): Promise<void> {
  if (!sid || !env.CACHE) return;
  await env.CACHE.delete(`${KV_PREFIX}${sid}`);
}

/** OAuth CSRF state lives in KV — no cookie required (avoids lost cookies on Spotify hop). */
export async function putOAuthState(env: Env, state: string): Promise<void> {
  if (!env.CACHE) throw new Error("KV CACHE missing");
  await env.CACHE.put(`${OAUTH_PREFIX}${state}`, "1", { expirationTtl: 600 });
}

export async function takeOAuthState(env: Env, state: string): Promise<boolean> {
  if (!env.CACHE) return false;
  const key = `${OAUTH_PREFIX}${state}`;
  const val = await env.CACHE.get(key);
  if (!val) return false;
  await env.CACHE.delete(key);
  return true;
}

export function buildSetCookie(name: string, value: string, opts: {
  maxAge: number;
  secure: boolean;
  httpOnly?: boolean;
}): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string, secure: boolean): string {
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export { SESSION_TTL };
