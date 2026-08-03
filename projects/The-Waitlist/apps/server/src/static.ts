import { existsSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Serve SvelteKit static build if present.
 * Returns null when path should fall through to SPA index or API.
 */
export function tryStatic(
  webRoot: string,
  pathname: string,
): Response | null {
  if (!existsSync(webRoot)) return null;

  let rel = pathname === "/" ? "/index.html" : pathname;
  // prevent path escape
  if (rel.includes("..")) return new Response("Bad path", { status: 400 });

  let filePath = resolve(webRoot, "." + rel);
  if (!filePath.startsWith(resolve(webRoot))) {
    return new Response("Bad path", { status: 400 });
  }

  if (!existsSync(filePath)) {
    // SPA fallback for client routes
    const fallback = join(webRoot, "index.html");
    if (!existsSync(fallback)) return null;
    filePath = fallback;
    rel = "/index.html";
  }

  const file = Bun.file(filePath);
  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  return new Response(file, {
    headers: {
      "Content-Type": type,
      "Cache-Control":
        rel === "/index.html" ? "no-cache" : "public, max-age=86400",
    },
  });
}
