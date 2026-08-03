const SESSION_COOKIE = "wl_sid";
const isProd = process.env.NODE_ENV === "production";

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setSessionCookie(token: string, expiresAt: Date): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Expires=${expiresAt.toUTCString()}`,
    "Max-Age=" + Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  ];
  if (isProd || process.env.COOKIE_SECURE === "1") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (isProd || process.env.COOKIE_SECURE === "1") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function getSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.get("cookie"));
  return cookies[SESSION_COOKIE] ?? null;
}
