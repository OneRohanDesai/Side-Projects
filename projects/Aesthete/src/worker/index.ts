import { Hono } from "hono";
import type { Env, SessionData } from "./types";
import {
  COOKIE as SESSION_COOKIE,
  SESSION_TTL,
  buildSetCookie,
  clearCookie,
  createSession,
  destroySession,
  getSessionId,
  putOAuthState,
  randomString,
  readSession,
  takeOAuthState,
  updateSession,
} from "./session";
import {
  ensureFreshSession,
  parsePlaylistIds,
  playOnDevice,
  spotifyFetch,
} from "./spotify";
import {
  getCatalog,
  getCurated,
  getPlaylistDetail,
  maybeRefreshStaleCatalog,
  previewCuratedMeta,
  publishCurated,
  saveCurated,
} from "./catalog";

type Vars = { session: SessionData | null; sessionId: string | null };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

function isSecureRequest(c: { env: Env; req: { url: string } }): boolean {
  // Prefer actual request URL so local http works even if APP_URL is wrong
  try {
    return new URL(c.req.url).protocol === "https:";
  } catch {
    return (c.env.APP_URL || "").startsWith("https://");
  }
}

function appOrigin(c: { env: Env; req: { url: string } }): string {
  // Always bounce back to the host the user is on (fixes APP_URL mismatch)
  try {
    return new URL(c.req.url).origin;
  } catch {
    return c.env.APP_URL || "https://aesthete.rohandesai.in";
  }
}

function redirectUri(c: { env: Env; req: { url: string } }): string {
  // Dynamic redirect so local + production both work with the same worker code
  return `${appOrigin(c)}/api/auth/callback`;
}

function jsonError(
  c: { json: (b: unknown, s?: number) => Response },
  message: string,
  status = 400,
) {
  return c.json({ error: message }, status);
}

function redirectWithCookies(
  location: string,
  cookies: string[],
): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}

/** Visible HTML result so OAuth failures never look like a silent refresh. */
function authResultPage(opts: {
  ok: boolean;
  title: string;
  message: string;
  redirectTo: string;
  cookies?: string[];
}): Response {
  const { ok, title, message, redirectTo, cookies = [] } = opts;
  const color = ok ? "#c4a574" : "#e07a6a";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="refresh" content="${ok ? "1" : "8"};url=${redirectTo.replace(/"/g, "")}"/>
  <title>${title} · Aesthete</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070708;color:#f2ebe0;
      font-family:system-ui,sans-serif;padding:24px;text-align:center}
    h1{font-weight:500;font-size:1.6rem;margin:0 0 12px;color:${color}}
    p{opacity:.7;max-width:42ch;line-height:1.5;margin:0 auto 20px;word-break:break-word}
    a{color:#f2ebe0}
    code{font-size:.85em;opacity:.85}
  </style>
</head>
<body>
  <div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="${redirectTo}">Continue →</a></p>
  </div>
  <script>setTimeout(function(){location.replace(${JSON.stringify(redirectTo)})},${ok ? 400 : 8000});</script>
</body>
</html>`;
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(html, { status: ok ? 200 : 400, headers });
}

async function refreshAndPersist(
  c: {
    env: Env;
    req: { raw: Request };
    set: (k: "session", v: SessionData) => void;
  },
  session: SessionData,
): Promise<SessionData> {
  const { session: fresh, rotated } = await ensureFreshSession(c.env, session);
  if (rotated) {
    const sid = getSessionId(c.req.raw);
    if (sid) await updateSession(c.env, sid, fresh);
  }
  c.set("session", fresh);
  return fresh;
}

app.use("/api/*", async (c, next) => {
  const session = await readSession(c.req.raw, c.env);
  c.set("session", session);
  c.set("sessionId", getSessionId(c.req.raw));
  await next();
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    app: "aesthete",
    configured: Boolean(
      c.env.SPOTIFY_CLIENT_ID && c.env.SPOTIFY_CLIENT_SECRET && c.env.SESSION_SECRET,
    ),
    hasCache: Boolean(c.env.CACHE),
    hasOwnerRefresh: Boolean(c.env.SPOTIFY_OWNER_REFRESH),
    origin: appOrigin(c),
    redirectUri: redirectUri(c),
  }),
);

/** Verifies Client ID + Secret with Spotify (no user login). */
app.get("/api/auth/spotify-check", async (c) => {
  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return c.json({ ok: false, reason: "missing_secrets" }, 503);
  }
  const basic = btoa(`${c.env.SPOTIFY_CLIENT_ID}:${c.env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const text = await res.text();
  return c.json({
    ok: res.ok,
    status: res.status,
    // Safe excerpt — no secrets
    detail: res.ok ? "Spotify accepted client id + secret" : text.slice(0, 300),
    clientIdPrefix: c.env.SPOTIFY_CLIENT_ID.slice(0, 8),
    redirectUri: redirectUri(c),
    mustRegisterRedirectUris: [
      "https://aesthete.rohandesai.in/api/auth/callback",
      "https://localhost:5173/api/auth/callback",
    ],
  });
});

// ── Auth ──────────────────────────────────────────────────────────

app.get("/api/auth/login", async (c) => {
  const origin = appOrigin(c);
  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return authResultPage({
      ok: false,
      title: "Not configured",
      message: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET missing on the server.",
      redirectTo: `${origin}/?auth=error&reason=missing_secrets`,
    });
  }
  if (!c.env.CACHE) {
    return authResultPage({
      ok: false,
      title: "KV missing",
      message: "CACHE binding is required for login sessions.",
      redirectTo: `${origin}/?auth=error&reason=no_kv`,
    });
  }

  const state = randomString(24);
  await putOAuthState(c.env, state);

  // Build authorize URL with dynamic redirect_uri matching this host
  const params = new URLSearchParams({
    response_type: "code",
    client_id: c.env.SPOTIFY_CLIENT_ID,
    scope: [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-playback-state",
      "user-modify-playback-state",
      "playlist-read-private",
      "playlist-read-collaborative",
    ].join(" "),
    redirect_uri: redirectUri(c),
    state,
    show_dialog: "true",
  });

  return redirectWithCookies(`https://accounts.spotify.com/authorize?${params}`, []);
});

app.get("/api/auth/callback", async (c) => {
  const origin = appOrigin(c);
  const code = c.req.query("code");
  const state = c.req.query("state");
  const err = c.req.query("error");
  const errDesc = c.req.query("error_description");
  const secure = isSecureRequest(c);

  if (err) {
    return authResultPage({
      ok: false,
      title: "Spotify denied access",
      message: errDesc || err,
      redirectTo: `${origin}/?auth=error&reason=${encodeURIComponent(errDesc || err)}`,
    });
  }
  if (!code || !state) {
    return authResultPage({
      ok: false,
      title: "Missing code",
      message: "Spotify did not return an authorization code.",
      redirectTo: `${origin}/?auth=error&reason=missing_code`,
    });
  }

  const stateOk = await takeOAuthState(c.env, state);
  if (!stateOk) {
    return authResultPage({
      ok: false,
      title: "Login expired",
      message: "OAuth state not found (took too long, or server restarted). Click Connect Spotify again.",
      redirectTo: `${origin}/?auth=error&reason=state_mismatch`,
    });
  }

  try {
    // Exchange with the SAME redirect_uri used in /login
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(c),
    });
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${c.env.SPOTIFY_CLIENT_ID}:${c.env.SPOTIFY_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return authResultPage({
        ok: false,
        title: "Token exchange failed",
        message: `Spotify said ${tokenRes.status}: ${tokenText.slice(0, 280)}. Check Client Secret and that redirect URI is registered exactly as: ${redirectUri(c)}`,
        redirectTo: `${origin}/?auth=error&reason=${encodeURIComponent(`token_${tokenRes.status}`)}`,
      });
    }

    const tokens = JSON.parse(tokenText) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meRes.ok) {
      const t = await meRes.text();
      return authResultPage({
        ok: false,
        title: "Profile fetch failed",
        message: t.slice(0, 280),
        redirectTo: `${origin}/?auth=error&reason=profile_failed`,
      });
    }
    const me = (await meRes.json()) as {
      id: string;
      display_name: string;
      product: string;
    };

    const session: SessionData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      userId: me.id,
      displayName: me.display_name || me.id,
      product: me.product || "unknown",
    };

    const sid = await createSession(c.env, session);
    const sidCookie = buildSetCookie(SESSION_COOKIE, sid, {
      maxAge: SESSION_TTL,
      secure,
      httpOnly: true,
    });

    return authResultPage({
      ok: true,
      title: `Welcome, ${me.display_name || me.id}`,
      message: "Connected. Taking you to Studio to add playlist links…",
      redirectTo: `${origin}/studio?auth=ok`,
      cookies: [sidCookie],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth_failed";
    return authResultPage({
      ok: false,
      title: "Login failed",
      message: msg,
      redirectTo: `${origin}/?auth=error&reason=${encodeURIComponent(msg)}`,
    });
  }
});

app.get("/api/auth/me", async (c) => {
  let session = c.get("session");
  if (!session) {
    return c.json({
      authenticated: false,
      hasCookie: Boolean(c.get("sessionId")),
    });
  }

  try {
    session = await refreshAndPersist(c, session);
    return c.json({
      authenticated: true,
      user: {
        id: session.userId,
        displayName: session.displayName,
        product: session.product,
        isPremium: session.product === "premium",
      },
    });
  } catch (e) {
    const sid = c.get("sessionId");
    await destroySession(c.env, sid);
    const secure = isSecureRequest(c);
    return new Response(JSON.stringify({ authenticated: false, error: String(e) }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearCookie(SESSION_COOKIE, secure),
      },
    });
  }
});

app.get("/api/auth/token", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  try {
    session = await refreshAndPersist(c, session);
    return c.json({ access_token: session.accessToken, expires_at: session.expiresAt });
  } catch {
    return jsonError(c, "Session expired", 401);
  }
});

app.post("/api/auth/logout", async (c) => {
  const sid = c.get("sessionId");
  await destroySession(c.env, sid);
  const secure = isSecureRequest(c);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie(SESSION_COOKIE, secure),
    },
  });
});

// ── Catalog (public) ──────────────────────────────────────────────

app.get("/api/catalog", async (c) => {
  let catalog = await getCatalog(c.env);
  if (!catalog) {
    catalog = await maybeRefreshStaleCatalog(c.env);
  } else {
    const age = Date.now() - new Date(catalog.syncedAt).getTime();
    if (age > 1000 * 60 * 60 * 12 && c.env.SPOTIFY_OWNER_REFRESH) {
      catalog = (await maybeRefreshStaleCatalog(c.env)) || catalog;
    }
  }
  if (!catalog || !catalog.playlists?.length) {
    return c.json({
      empty: true,
      playlists: [],
      message: "No playlists published yet. Open Studio, paste links, and publish.",
    });
  }
  return c.json({ empty: false, ...catalog });
});

app.get("/api/catalog/playlists/:id", async (c) => {
  const id = c.req.param("id");
  const detail = await getPlaylistDetail(c.env, id);
  if (!detail) return jsonError(c, "Playlist not in the gallery. Publish it from Studio.", 404);
  return c.json(detail);
});

// ── Studio / curated ──────────────────────────────────────────────

app.get("/api/studio/curated", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Connect Spotify to manage the gallery.", 401);
  try {
    session = await refreshAndPersist(c, session);
  } catch {
    return jsonError(c, "Session expired", 401);
  }

  const curated = await getCurated(c.env);
  let previews: Awaited<ReturnType<typeof previewCuratedMeta>> = [];
  if (curated.playlistIds.length) {
    try {
      previews = await previewCuratedMeta(session.accessToken, curated.playlistIds);
    } catch {
      previews = curated.playlistIds.map((id) => ({
        id,
        uri: `spotify:playlist:${id}`,
        name: id,
        description: "",
        imageUrl: null as string | null,
        trackCount: 0,
        owner: "",
        color: null as string | null,
      }));
    }
  }

  return c.json({
    playlistIds: curated.playlistIds,
    playlists: previews,
    ownerId: curated.ownerId,
    ownerName: curated.ownerName,
    updatedAt: curated.updatedAt,
  });
});

app.put("/api/studio/curated", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  try {
    session = await refreshAndPersist(c, session);
  } catch {
    return jsonError(c, "Session expired", 401);
  }

  const body = await c.req.json<{ links?: string; ids?: string[] }>();
  let ids: string[] = [];
  if (Array.isArray(body.ids)) {
    ids = body.ids.map((x) => String(x)).filter(Boolean);
  } else if (typeof body.links === "string") {
    ids = parsePlaylistIds(body.links);
  }

  if (!ids.length) {
    return jsonError(c, "No valid Spotify playlist links found.", 400);
  }

  const seen = new Set<string>();
  ids = ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  await saveCurated(c.env, {
    playlistIds: ids,
    ownerId: session.userId,
    ownerName: session.displayName,
    updatedAt: new Date().toISOString(),
  });

  const previews = await previewCuratedMeta(session.accessToken, ids);
  return c.json({ ok: true, playlistIds: ids, playlists: previews });
});

app.post("/api/studio/curated/add", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  try {
    session = await refreshAndPersist(c, session);
  } catch {
    return jsonError(c, "Session expired", 401);
  }

  const body = await c.req.json<{ links?: string }>();
  const add = parsePlaylistIds(body.links || "");
  if (!add.length) return jsonError(c, "No valid playlist links.", 400);

  const curated = await getCurated(c.env);
  const seen = new Set(curated.playlistIds);
  const next = [...curated.playlistIds];
  for (const id of add) {
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }

  await saveCurated(c.env, {
    playlistIds: next,
    ownerId: session.userId,
    ownerName: session.displayName,
    updatedAt: new Date().toISOString(),
  });

  const previews = await previewCuratedMeta(session.accessToken, next);
  return c.json({ ok: true, playlistIds: next, playlists: previews, added: add.length });
});

app.delete("/api/studio/curated/:id", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  try {
    session = await refreshAndPersist(c, session);
  } catch {
    return jsonError(c, "Session expired", 401);
  }

  const id = c.req.param("id");
  const curated = await getCurated(c.env);
  const next = curated.playlistIds.filter((x) => x !== id);
  await saveCurated(c.env, {
    ...curated,
    playlistIds: next,
    ownerId: session.userId,
    ownerName: session.displayName,
    updatedAt: new Date().toISOString(),
  });
  return c.json({ ok: true, playlistIds: next });
});

app.post("/api/studio/publish", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  try {
    session = await refreshAndPersist(c, session);
  } catch {
    return jsonError(c, "Session expired", 401);
  }

  const body = await c.req
    .json<{ links?: string; ids?: string[] }>()
    .catch(() => ({}) as { links?: string; ids?: string[] });

  let ids: string[] | undefined;
  if (typeof body.links === "string" && body.links.trim()) {
    ids = parsePlaylistIds(body.links);
  } else if (Array.isArray(body.ids) && body.ids.length) {
    ids = body.ids;
  }

  try {
    const catalog = await publishCurated(
      c.env,
      session.accessToken,
      session.displayName,
      session.userId,
      ids,
    );
    return c.json({
      ok: true,
      catalog,
      count: catalog.playlists.length,
      totalTracks: catalog.totalTracks,
    });
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Publish failed", 500);
  }
});

// ── Player ────────────────────────────────────────────────────────

app.put("/api/player/play", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  if (session.product !== "premium") {
    return jsonError(c, "Spotify Premium is required for browser playback.", 403);
  }

  try {
    session = await refreshAndPersist(c, session);
    const body = await c.req.json<{
      device_id: string;
      uris?: string[];
      context_uri?: string;
      offset?: { position?: number; uri?: string };
    }>();

    if (!body.device_id) return jsonError(c, "device_id required");

    const res = await playOnDevice(session.accessToken, body.device_id, {
      uris: body.uris,
      context_uri: body.context_uri,
      offset: body.offset,
    });

    if (res.status === 204 || res.status === 202 || res.ok) {
      return c.json({ ok: true });
    }

    const text = await res.text();
    if (res.status === 404 || res.status === 502) {
      await new Promise((r) => setTimeout(r, 400));
      const retry = await playOnDevice(session.accessToken, body.device_id, {
        uris: body.uris,
        context_uri: body.context_uri,
        offset: body.offset,
      });
      if (retry.status === 204 || retry.status === 202 || retry.ok) {
        return c.json({ ok: true });
      }
      return jsonError(c, (await retry.text()) || "Playback failed", retry.status);
    }

    return jsonError(c, text || "Playback failed", res.status);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "play_failed", 500);
  }
});

app.put("/api/player/transfer", async (c) => {
  let session = c.get("session");
  if (!session) return jsonError(c, "Not authenticated", 401);
  try {
    session = await refreshAndPersist(c, session);
    const { device_id, play } = await c.req.json<{ device_id: string; play?: boolean }>();
    const res = await spotifyFetch(session.accessToken, "/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [device_id], play: Boolean(play) }),
    });
    if (res.status === 204 || res.ok) return c.json({ ok: true });
    return jsonError(c, await res.text(), res.status);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "transfer_failed", 500);
  }
});

export default app;
