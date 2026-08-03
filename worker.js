/**
 * Static assets + SPA fallback for soft /projects/* app routes.
 *
 * Served as files when they exist, e.g.:
 *   /projects/Gaia/README.md
 *   /projects/projects.json
 *
 * SPA (projects/index.html) for:
 *   /projects
 *   /projects/
 *   /projects/:id
 *   /projects/:id/f/...
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Normalize /projects → serve SPA index via assets
    if (path === "/projects") {
      return env.ASSETS.fetch(new URL("/projects/index.html", url));
    }

    // Try real static asset first
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;

    // Soft app routes under /projects
    if (path.startsWith("/projects/")) {
      const rest = path.slice("/projects/".length); // e.g. "gaia" | "gaia/f/README.md" | "Gaia/README.md"
      const parts = rest.split("/").filter(Boolean);

      // /projects/:id
      if (parts.length === 1) {
        return env.ASSETS.fetch(new URL("/projects/index.html", url));
      }

      // /projects/:id/f/...  (file browser route — not a real filesystem path)
      if (parts.length >= 2 && parts[1] === "f") {
        return env.ASSETS.fetch(new URL("/projects/index.html", url));
      }
    }

    return res;
  },
};
