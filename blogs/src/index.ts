import { login, logout, requireAdmin } from "./auth";
import type { Block, Env, PostRow, Topic } from "./types";
import {
  corsOrigin,
  err,
  estimateReadingMinutes,
  isTopic,
  json,
  mediaUrl,
  newId,
  nowIso,
  slugify,
  toDTO,
  topicMeta,
} from "./util";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = corsOrigin(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "content-type, authorization",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url, origin, ctx);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server error";
      console.error(JSON.stringify({ err: msg, path: url.pathname }));
      return err(msg, 500, origin);
    }

    // Static assets (Inkboard UI)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return err("Not found", 404, origin);
  },
};

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
  origin: string,
  ctx: ExecutionContext
): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, name: "inkboard", time: nowIso() }, 200, origin);
  }

  if (path === "/api/topics" && method === "GET") {
    return json({ topics: topicMeta() }, 200, origin);
  }

  if (path === "/api/auth/login" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    if (!body.password) return err("Password required", 400, origin);
    const result = await login(env, body.password);
    if (!result) return err("Invalid password", 401, origin);
    return json(result, 200, origin);
  }

  if (path === "/api/auth/logout" && method === "POST") {
    await logout(env, request);
    return json({ ok: true }, 200, origin);
  }

  if (path === "/api/auth/me" && method === "GET") {
    const ok = await requireAdmin(env, request);
    return json({ admin: ok }, 200, origin);
  }

  // Media get
  if (path.startsWith("/api/media/") && method === "GET") {
    const key = decodeURIComponent(path.slice("/api/media/".length));
    if (!key || key.includes("..")) return err("Bad key", 400, origin);
    const obj = await env.MEDIA.get(key);
    if (!obj) return err("Not found", 404, origin);
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("access-control-allow-origin", origin);
    return new Response(obj.body, { headers });
  }

  // Media upload (admin)
  if (path === "/api/media" && method === "POST") {
    if (!(await requireAdmin(env, request))) return err("Unauthorized", 401, origin);
    const ct = request.headers.get("content-type") || "";
    let bytes: ArrayBuffer;
    let contentType = "application/octet-stream";
    let filename = "upload.bin";

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return err("file field required", 400, origin);
      bytes = await file.arrayBuffer();
      contentType = file.type || contentType;
      filename = file.name || filename;
    } else {
      bytes = await request.arrayBuffer();
      contentType = ct || contentType;
      filename = url.searchParams.get("name") || filename;
    }

    if (bytes.byteLength > 25 * 1024 * 1024) {
      return err("File too large (max 25MB)", 413, origin);
    }

    const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `m/${new Date().toISOString().slice(0, 10)}/${newId()}.${ext || "bin"}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { original: filename.slice(0, 180) },
    });
    return json({ key, url: mediaUrl(key), contentType, size: bytes.byteLength }, 201, origin);
  }

  // List posts
  if (path === "/api/posts" && method === "GET") {
    const topic = url.searchParams.get("topic");
    const status = url.searchParams.get("status") || "published";
    const q = (url.searchParams.get("q") || "").trim();
    const admin = await requireAdmin(env, request);

    const where: string[] = [];
    const binds: unknown[] = [];

    if (!admin || status !== "all") {
      if (status === "draft" && admin) {
        where.push("status = ?");
        binds.push("draft");
      } else if (status === "all" && admin) {
        // no status filter
      } else {
        where.push("status = ?");
        binds.push("published");
      }
    } else if (admin && status === "all") {
      // all
    }

    if (topic && isTopic(topic)) {
      where.push("topic = ?");
      binds.push(topic);
    }

    if (q) {
      where.push("(title LIKE ? OR excerpt LIKE ?)");
      binds.push(`%${q}%`, `%${q}%`);
    }

    const sql = `
      SELECT * FROM posts
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY COALESCE(published_at, updated_at) DESC
      LIMIT 100
    `;
    const { results } = await env.DB.prepare(sql)
      .bind(...binds)
      .all<PostRow>();
    return json({ posts: (results || []).map(toDTO) }, 200, origin);
  }

  // Create post
  if (path === "/api/posts" && method === "POST") {
    if (!(await requireAdmin(env, request))) return err("Unauthorized", 401, origin);
    const body = (await request.json()) as {
      title?: string;
      topic?: string;
      excerpt?: string;
      slug?: string;
      coverKey?: string | null;
      body?: Block[];
      status?: string;
    };
    if (!body.title?.trim()) return err("Title required", 400, origin);
    if (!isTopic(body.topic)) return err("Invalid topic", 400, origin);

    const blocks = Array.isArray(body.body) ? body.body : [];
    const id = newId();
    let slug = slugify(body.slug || body.title);
    slug = await uniqueSlug(env, slug);
    const ts = nowIso();
    const status = body.status === "published" ? "published" : "draft";
    const published_at = status === "published" ? ts : null;

    await env.DB.prepare(
      `INSERT INTO posts
      (id, slug, topic, title, excerpt, cover_key, body_json, status, reading_minutes, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        slug,
        body.topic,
        body.title.trim(),
        (body.excerpt || "").trim(),
        body.coverKey || null,
        JSON.stringify(blocks),
        status,
        estimateReadingMinutes(blocks),
        ts,
        ts,
        published_at
      )
      .run();

    ctx.waitUntil(bustCache(env));
    const row = await getPostById(env, id);
    return json({ post: row ? toDTO(row) : null }, 201, origin);
  }

  // Single post by slug or id
  const postMatch = /^\/api\/posts\/([^/]+)$/.exec(path);
  if (postMatch) {
    const key = decodeURIComponent(postMatch[1]);
    if (method === "GET") {
      const admin = await requireAdmin(env, request);
      const row =
        (await getPostBySlug(env, key)) || (await getPostById(env, key));
      if (!row) return err("Not found", 404, origin);
      if (row.status !== "published" && !admin) return err("Not found", 404, origin);
      return json({ post: toDTO(row) }, 200, origin);
    }

    if (method === "PUT" || method === "PATCH") {
      if (!(await requireAdmin(env, request))) return err("Unauthorized", 401, origin);
      const existing = (await getPostById(env, key)) || (await getPostBySlug(env, key));
      if (!existing) return err("Not found", 404, origin);

      const body = (await request.json()) as {
        title?: string;
        topic?: string;
        excerpt?: string;
        slug?: string;
        coverKey?: string | null;
        body?: Block[];
        status?: string;
      };

      const title = body.title?.trim() ?? existing.title;
      const topic = (isTopic(body.topic) ? body.topic : existing.topic) as Topic;
      const excerpt = body.excerpt !== undefined ? body.excerpt.trim() : existing.excerpt;
      let slug = body.slug ? slugify(body.slug) : existing.slug;
      if (slug !== existing.slug) slug = await uniqueSlug(env, slug, existing.id);
      const blocks = Array.isArray(body.body) ? body.body : JSON.parse(existing.body_json);
      const cover_key =
        body.coverKey !== undefined ? body.coverKey : existing.cover_key;
      let status = existing.status;
      let published_at = existing.published_at;
      if (body.status === "published" || body.status === "draft") {
        status = body.status;
        if (status === "published" && !published_at) published_at = nowIso();
        if (status === "draft") published_at = null;
      }
      const updated_at = nowIso();

      await env.DB.prepare(
        `UPDATE posts SET
          slug = ?, topic = ?, title = ?, excerpt = ?, cover_key = ?,
          body_json = ?, status = ?, reading_minutes = ?, updated_at = ?, published_at = ?
         WHERE id = ?`
      )
        .bind(
          slug,
          topic,
          title,
          excerpt,
          cover_key,
          JSON.stringify(blocks),
          status,
          estimateReadingMinutes(blocks as Block[]),
          updated_at,
          published_at,
          existing.id
        )
        .run();

      ctx.waitUntil(bustCache(env));
      const row = await getPostById(env, existing.id);
      return json({ post: row ? toDTO(row) : null }, 200, origin);
    }

    if (method === "DELETE") {
      if (!(await requireAdmin(env, request))) return err("Unauthorized", 401, origin);
      const existing = (await getPostById(env, key)) || (await getPostBySlug(env, key));
      if (!existing) return err("Not found", 404, origin);
      await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(existing.id).run();
      ctx.waitUntil(bustCache(env));
      return json({ ok: true }, 200, origin);
    }
  }

  return err("Not found", 404, origin);
}

async function getPostById(env: Env, id: string): Promise<PostRow | null> {
  return env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<PostRow>();
}

async function getPostBySlug(env: Env, slug: string): Promise<PostRow | null> {
  return env.DB.prepare(`SELECT * FROM posts WHERE slug = ?`).bind(slug).first<PostRow>();
}

async function uniqueSlug(env: Env, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let i = 2;
  for (;;) {
    const row = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ?`)
      .bind(slug)
      .first<{ id: string }>();
    if (!row || (excludeId && row.id === excludeId)) return slug;
    slug = `${base}-${i++}`;
  }
}

async function bustCache(env: Env): Promise<void> {
  // Simple namespace bump for future list caching
  await env.CACHE.put("posts:version", nowIso());
}
