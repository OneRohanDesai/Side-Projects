import type { Block, Env, PostDTO, PostRow, Topic } from "./types";
import { TOPICS } from "./types";

export function json(data: unknown, status = 200, origin = "*"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "cache-control": "no-store",
    },
  });
}

export function err(message: string, status = 400, origin = "*"): Response {
  return json({ error: message }, status, origin);
}

export function corsOrigin(env: Env, request: Request): string {
  const reqOrigin = request.headers.get("Origin");
  if (env.PUBLIC_SITE_ORIGIN && env.PUBLIC_SITE_ORIGIN !== "*") {
    return env.PUBLIC_SITE_ORIGIN;
  }
  return reqOrigin || "*";
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `post-${Date.now().toString(36)}`;
}

export function isTopic(v: unknown): v is Topic {
  return v === "game-theory" || v === "poker" || v === "geopolitics";
}

export function estimateReadingMinutes(blocks: Block[]): number {
  let words = 0;
  for (const b of blocks) {
    if (b.text) words += b.text.split(/\s+/).filter(Boolean).length;
    if (b.items) for (const it of b.items) words += it.split(/\s+/).filter(Boolean).length;
    if (b.type === "image" || b.type === "gif" || b.type === "video") words += 20;
  }
  return Math.max(1, Math.ceil(words / 220));
}

export function parseBody(raw: string): Block[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as Block[]) : [];
  } catch {
    return [];
  }
}

export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("data:")) {
    return key;
  }
  return `/api/media/${encodeURIComponent(key)}`;
}

export function toDTO(row: PostRow): PostDTO {
  return {
    id: row.id,
    slug: row.slug,
    topic: row.topic,
    title: row.title,
    excerpt: row.excerpt,
    coverKey: row.cover_key,
    coverUrl: mediaUrl(row.cover_key),
    body: parseBody(row.body_json),
    status: row.status,
    readingMinutes: row.reading_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export function topicMeta() {
  return Object.values(TOPICS);
}

/** Timing-safe string compare for secrets */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.byteLength !== bb.byteLength) {
    // still run digest path to reduce timing leak shape
    const pad = new Uint8Array(aa.byteLength);
    crypto.getRandomValues(pad);
    await crypto.subtle.digest("SHA-256", pad);
    return false;
  }
  return crypto.subtle.timingSafeEqual(aa, bb);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function bearerToken(request: Request): string | null {
  const h = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
