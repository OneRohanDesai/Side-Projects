type Kind = "man-made" | "natural";

interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
  ADMIN_PASSWORD: string;
  PUBLIC_ORIGIN: string;
}

interface PlateRow {
  id: string;
  name: string;
  year: number;
  era: string;
  kind: Kind;
  place: string;
  region: string;
  blurb: string;
  tags_json: string;
  tone: string;
  image_key: string | null;
  created_at: string;
  updated_at: string;
}

const SESSION_TTL = 60 * 60 * 24 * 14;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = corsOrigin(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url, origin, ctx);
      }
      return json({ error: "Not found. Vault API only." }, 404, origin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server error";
      console.error(JSON.stringify({ err: msg, path: url.pathname }));
      return json({ error: msg }, 500, origin);
    }
  },
};

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
  origin: string,
  _ctx: ExecutionContext
): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, name: "vault-api", time: now() }, 200, origin);
  }

  if (path === "/api/auth/login" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    if (!body.password) return json({ error: "Password required" }, 400, origin);
    if (!env.ADMIN_PASSWORD) return json({ error: "Admin password not configured" }, 500, origin);
    if (!(await safeEqual(body.password, env.ADMIN_PASSWORD))) {
      return json({ error: "Invalid password" }, 401, origin);
    }
    const token = crypto.randomUUID() + "." + crypto.randomUUID();
    await env.SESSIONS.put(`sess:${token}`, JSON.stringify({ role: "admin", at: now() }), {
      expirationTtl: SESSION_TTL,
    });
    return json({ token, expiresIn: SESSION_TTL }, 200, origin);
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const token = bearer(request);
    if (token) await env.SESSIONS.delete(`sess:${token}`);
    return json({ ok: true }, 200, origin);
  }

  if (path === "/api/auth/me" && method === "GET") {
    return json({ admin: await isAdmin(env, request) }, 200, origin);
  }

  // Media get
  if (path.startsWith("/api/media/") && method === "GET") {
    const key = decodeURIComponent(path.slice("/api/media/".length));
    if (!key || key.includes("..")) return json({ error: "Bad key" }, 400, origin);
    const obj = await env.MEDIA.get(key);
    if (!obj) return json({ error: "Not found" }, 404, origin);
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("access-control-allow-origin", origin);
    return new Response(obj.body, { headers });
  }

  // Media upload
  if (path === "/api/media" && method === "POST") {
    if (!(await isAdmin(env, request))) return json({ error: "Unauthorized" }, 401, origin);
    const ct = request.headers.get("content-type") || "";
    let bytes: ArrayBuffer;
    let contentType = "application/octet-stream";
    let filename = "upload.bin";

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "file required" }, 400, origin);
      bytes = await file.arrayBuffer();
      contentType = file.type || contentType;
      filename = file.name || filename;
    } else {
      bytes = await request.arrayBuffer();
      contentType = ct || contentType;
      filename = url.searchParams.get("name") || filename;
    }

    if (bytes.byteLength > 15 * 1024 * 1024) {
      return json({ error: "File too large (max 15MB)" }, 413, origin);
    }

    const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const key = `plates/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { original: filename.slice(0, 180) },
    });
    return json({ key, url: mediaUrl(key), contentType, size: bytes.byteLength }, 201, origin);
  }

  // List plates
  if (path === "/api/plates" && method === "GET") {
    const kind = url.searchParams.get("kind");
    const q = (url.searchParams.get("q") || "").trim();
    const where: string[] = [];
    const binds: unknown[] = [];
    if (kind === "man-made" || kind === "natural") {
      where.push("kind = ?");
      binds.push(kind);
    }
    if (q) {
      where.push("(name LIKE ? OR place LIKE ? OR blurb LIKE ? OR era LIKE ? OR region LIKE ?)");
      const like = `%${q}%`;
      binds.push(like, like, like, like, like);
    }
    const sql = `SELECT * FROM plates ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY year ASC, name ASC`;
    const { results } = await env.DB.prepare(sql).bind(...binds).all<PlateRow>();
    return json({ plates: (results || []).map(toDTO) }, 200, origin);
  }

  // Create plate
  if (path === "/api/plates" && method === "POST") {
    if (!(await isAdmin(env, request))) return json({ error: "Unauthorized" }, 401, origin);
    const body = await readPlateBody(request);
    if ("error" in body) return json({ error: body.error }, 400, origin);
    const id = slugify(body.name) || crypto.randomUUID().slice(0, 8);
    const uniqueId = await ensureUniqueId(env, id);
    const ts = now();
    await env.DB.prepare(
      `INSERT INTO plates (id, name, year, era, kind, place, region, blurb, tags_json, tone, image_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        uniqueId,
        body.name,
        body.year,
        body.era,
        body.kind,
        body.place,
        body.region,
        body.blurb,
        JSON.stringify(body.tags),
        body.tone,
        body.imageKey,
        ts,
        ts
      )
      .run();
    const row = await getPlate(env, uniqueId);
    return json({ plate: row ? toDTO(row) : null }, 201, origin);
  }

  const one = /^\/api\/plates\/([^/]+)$/.exec(path);
  if (one) {
    const key = decodeURIComponent(one[1]);

    if (method === "GET") {
      const row = await getPlate(env, key);
      if (!row) return json({ error: "Not found" }, 404, origin);
      return json({ plate: toDTO(row) }, 200, origin);
    }

    if (method === "PUT" || method === "PATCH") {
      if (!(await isAdmin(env, request))) return json({ error: "Unauthorized" }, 401, origin);
      const existing = await getPlate(env, key);
      if (!existing) return json({ error: "Not found" }, 404, origin);
      const body = await readPlateBody(request, existing);
      if ("error" in body) return json({ error: body.error }, 400, origin);
      const ts = now();
      await env.DB.prepare(
        `UPDATE plates SET name=?, year=?, era=?, kind=?, place=?, region=?, blurb=?, tags_json=?, tone=?, image_key=?, updated_at=?
         WHERE id=?`
      )
        .bind(
          body.name,
          body.year,
          body.era,
          body.kind,
          body.place,
          body.region,
          body.blurb,
          JSON.stringify(body.tags),
          body.tone,
          body.imageKey,
          ts,
          existing.id
        )
        .run();
      const row = await getPlate(env, existing.id);
      return json({ plate: row ? toDTO(row) : null }, 200, origin);
    }

    if (method === "DELETE") {
      if (!(await isAdmin(env, request))) return json({ error: "Unauthorized" }, 401, origin);
      const existing = await getPlate(env, key);
      if (!existing) return json({ error: "Not found" }, 404, origin);
      // optional: delete R2 object
      if (existing.image_key) {
        try {
          await env.MEDIA.delete(existing.image_key);
        } catch {
          /* ignore */
        }
      }
      await env.DB.prepare(`DELETE FROM plates WHERE id = ?`).bind(existing.id).run();
      return json({ ok: true }, 200, origin);
    }
  }

  return json({ error: "Not found" }, 404, origin);
}

async function readPlateBody(
  request: Request,
  existing?: PlateRow
): Promise<
  | {
      name: string;
      year: number;
      era: string;
      kind: Kind;
      place: string;
      region: string;
      blurb: string;
      tags: string[];
      tone: string;
      imageKey: string | null;
    }
  | { error: string }
> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? existing?.name ?? "").trim();
  if (!name) return { error: "Name required" };
  const year = Number(body.year ?? existing?.year);
  if (!Number.isFinite(year)) return { error: "Year required (number, BCE negative)" };
  const kind = String(body.kind ?? existing?.kind ?? "") as Kind;
  if (kind !== "man-made" && kind !== "natural") return { error: "Kind must be man-made or natural" };
  const tagsRaw = body.tags ?? (existing ? parseTags(existing.tags_json) : []);
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
    : String(tagsRaw)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
  let imageKey: string | null =
    body.imageKey === undefined
      ? existing?.image_key ?? null
      : body.imageKey
        ? String(body.imageKey)
        : null;
  // allow clearing
  if (body.imageKey === null || body.imageKey === "") imageKey = null;

  return {
    name,
    year: Math.trunc(year),
    era: String(body.era ?? existing?.era ?? "").trim() || "Unknown",
    kind,
    place: String(body.place ?? existing?.place ?? "").trim(),
    region: String(body.region ?? existing?.region ?? "").trim(),
    blurb: String(body.blurb ?? existing?.blurb ?? "").trim(),
    tags,
    tone: String(body.tone ?? existing?.tone ?? "#b56a45").trim() || "#b56a45",
    imageKey,
  };
}

function toDTO(row: PlateRow) {
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    era: row.era,
    kind: row.kind,
    place: row.place,
    region: row.region,
    blurb: row.blurb,
    tags: parseTags(row.tags_json),
    tone: row.tone,
    imageKey: row.image_key,
    image: row.image_key ? mediaUrl(row.image_key) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function mediaUrl(key: string): string {
  if (/^https?:\/\//i.test(key)) return key;
  return `/api/media/${encodeURIComponent(key)}`;
}

async function getPlate(env: Env, id: string): Promise<PlateRow | null> {
  return env.DB.prepare(`SELECT * FROM plates WHERE id = ?`).bind(id).first<PlateRow>();
}

async function ensureUniqueId(env: Env, base: string): Promise<string> {
  let id = base;
  let i = 2;
  for (;;) {
    const row = await env.DB.prepare(`SELECT id FROM plates WHERE id = ?`).bind(id).first();
    if (!row) return id;
    id = `${base}-${i++}`;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function now(): string {
  return new Date().toISOString();
}

function bearer(request: Request): string | null {
  const h = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

async function isAdmin(env: Env, request: Request): Promise<boolean> {
  const token = bearer(request);
  if (!token) return false;
  return !!(await env.SESSIONS.get(`sess:${token}`));
}

async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.byteLength !== bb.byteLength) {
    await crypto.subtle.digest("SHA-256", aa);
    return false;
  }
  return crypto.subtle.timingSafeEqual(aa, bb);
}

function corsOrigin(env: Env, request: Request): string {
  if (env.PUBLIC_ORIGIN && env.PUBLIC_ORIGIN !== "*") return env.PUBLIC_ORIGIN;
  return request.headers.get("Origin") || "*";
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-max-age": "86400",
  };
}

function json(data: unknown, status = 200, origin = "*"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}
