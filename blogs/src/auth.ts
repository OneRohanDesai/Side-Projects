import type { Env } from "./types";
import { bearerToken, newId, nowIso, safeEqual } from "./util";

const SESSION_TTL = 60 * 60 * 24 * 14; // 14 days

export async function login(
  env: Env,
  password: string
): Promise<{ token: string; expiresIn: number } | null> {
  if (!env.ADMIN_PASSWORD) return null;
  const ok = await safeEqual(password, env.ADMIN_PASSWORD);
  if (!ok) return null;

  const token = newId() + "." + newId();
  const payload = JSON.stringify({
    role: "admin",
    createdAt: nowIso(),
  });
  await env.SESSIONS.put(`sess:${token}`, payload, { expirationTtl: SESSION_TTL });
  return { token, expiresIn: SESSION_TTL };
}

export async function requireAdmin(env: Env, request: Request): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  const raw = await env.SESSIONS.get(`sess:${token}`);
  return !!raw;
}

export async function logout(env: Env, request: Request): Promise<void> {
  const token = bearerToken(request);
  if (token) await env.SESSIONS.delete(`sess:${token}`);
}
